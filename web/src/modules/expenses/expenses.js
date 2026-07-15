import { db, softDelete } from '../../core/db.js';
import { newId } from '../../core/id.js';
import { bus, EXPENSE_SAVED, SHIFT_SAVED, XP_EARNED } from '../../core/events.js';
import { store } from '../../core/store.js';
import { calcEVCost, calcFuelCost } from '../../utils/calculations.js';
import { t } from '../../utils/strings.js';
import { matchesFilter } from '../../utils/filters.js';
import { applySheetPresentation, renderEmptyState, showConfirm, showModal, showToast } from '../../ui/components.js';
import { getIcon } from '../../ui/icons.js';
import { ExpenseCategoryRegistry, canonicalCategoryId } from '../../registry/expense-categories/index.js';
import { renderExpenseForm } from './expense-form.js';

const APP_STATE_CUSTOM_CATEGORIES_KEY = 'expense_custom_categories';
const AUTO_EXPENSE_SOURCES = new Set(['auto_fuel', 'auto_ev']);

/** Remove `fab` query flag from the current hash (used after FAB deep-links). */
function stripFabQueryFromHash() {
  try {
    const raw = window.location.hash || '';
    const qi = raw.indexOf('?');
    if (qi === -1) return;
    const base = raw.slice(0, qi);
    const params = new URLSearchParams(raw.slice(qi + 1));
    if (!params.has('fab')) return;
    params.delete('fab');
    const qs = params.toString();
    const next = qs ? `${base}?${qs}` : base;
    const path = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, '', `${path}${next}`);
  } catch {
    /* ignore */
  }
}

function nowIso() {
  return new Date().toISOString();
}

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resolveExpenseProvinceId(input) {
  if (typeof input.provinceId === 'string' && input.provinceId.trim()) return input.provinceId.trim().toUpperCase();
  const user = /** @type {{ provinceId?: string } | null} */ (store.get('user'));
  if (user?.provinceId) return String(user.provinceId).toUpperCase();
  return 'ON';
}

export function normalizeExpenseInput(input) {
  const now = nowIso();
  const date = typeof input.date === 'string' && input.date ? input.date : ymd(new Date());
  // Canonicalize legacy web slugs (car_wash→wash, …) — every write path funnels through here.
  const category = canonicalCategoryId(String(input.category || 'other'));
  const recurring = Boolean(input.isRecurring);
  // amount is real dollars (Dexie v5 — see db.js STORES_V4 doc). Legacy `amountCents` alias (if a
  // caller still supplies it) is treated as cents and converted for backward compat.
  const amountRaw = input.amount != null ? input.amount : input.amountCents != null ? num(input.amountCents) / 100 : 0;
  const amount = Math.max(0, num(amountRaw));
  const catDef = ExpenseCategoryRegistry.getById(category);
  const isDeductible = catDef ? catDef.deductible !== false : true;
  // `businessPct` renamed to `deductiblePct` (mobile field name); accept legacy input.businessPct too.
  const deductiblePct = isDeductible
    ? Math.max(0, Math.min(100, num(input.deductiblePct ?? input.businessPct, 100)))
    : 0;
  const provinceId = resolveExpenseProvinceId(input);
  const hstPaidRaw = input.hstPaid != null ? input.hstPaid : input.hstItcAmount;
  const hstPaid = Math.max(0, num(hstPaidRaw));
  const confirmedPaid =
    input.confirmedPaid != null ? Boolean(input.confirmedPaid) : !recurring;
  const merchant = typeof input.merchant === 'string' ? input.merchant.trim() : '';
  const receiptData = typeof input.receiptData === 'string' ? input.receiptData : null;

  /** @type {Record<string, unknown>} */
  const row = {
    // Fix 2 (interop plan) — client-generated string primary key (see core/id.js). Preserve an
    // incoming string id (updateExpense re-normalizes an existing row) rather than minting a new
    // one.
    id: typeof input.id === 'string' && input.id ? input.id : newId('exp'),
    category,
    customCategory: String(input.customCategory || ''),
    amount,
    deductiblePct,
    date,
    provinceId,
    platformId: input.platformId == null || input.platformId === 'all' ? null : String(input.platformId),
    notes: String(input.notes || ''),
    receiptData,
    merchant,
    merchantNormalized: merchant.toLowerCase(),
    // receiptUri mirrors receiptData's value for schema parity with mobile (web has no real
    // filesystem URI — the base64 data URL remains web's actual local storage mechanism).
    receiptUri: receiptData,
    isRecurring: recurring,
    recurringInterval: recurring ? String(input.recurringInterval || 'monthly') : null,
    recurringNextDate: recurring
      ? String(input.recurringNextDate || addInterval(date, String(input.recurringInterval || 'monthly')))
      : null,
    hstPaid,
    confirmedPaid,
    deletedAt: null,
    createdAt: input.createdAt || now,
    updatedAt: now,
    source: typeof input.source === 'string' ? input.source : 'manual',
    // shifts.id is a client-generated string (Fix 2) — no numeric coercion.
    shiftId: input.shiftId == null || input.shiftId === '' ? null : String(input.shiftId),
    syncUpdatedAt: Date.now(),
    syncDeletedAt: null,
  };
  if ('recurringSnoozeUntil' in input) {
    row.recurringSnoozeUntil =
      input.recurringSnoozeUntil == null || input.recurringSnoozeUntil === ''
        ? null
        : String(input.recurringSnoozeUntil);
  }
  return row;
}

function addInterval(dateStr, interval) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  if (interval === 'weekly') d.setDate(d.getDate() + 7);
  else if (interval === 'annual' || interval === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return ymd(d);
}

function fmtMoney(v) {
  const user = store.get('user');
  const sym = user?.locale?.currencySymbol || '$';
  return `${sym}${num(v).toFixed(2)}`;
}

function categoryLabel(row) {
  const id = String(row.category || '');
  const key = `expenses.categories.${id}`;
  const val = t(key);
  if (val !== key) return val;
  return id || t('expenses.uncategorized');
}

/**
 * Upsert a `db.merchants` row for schema parity with mobile (merchants table added in Dexie v5).
 * Best-effort — a failure here must never block the expense save.
 * @param {string} name
 */
async function upsertMerchant(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return;
  const normalizedName = trimmed.toLowerCase();
  try {
    const existing = await db.merchants.filter((m) => m.normalizedName === normalizedName).first();
    if (existing) {
      // Also revive a tombstoned merchant on reuse (interop audit) — the row is
      // identity-matched across devices, so clearing the tombstone syncs the revival.
      await db.merchants.update(existing.id, { syncUpdatedAt: Date.now(), syncDeletedAt: null });
    } else {
      await db.merchants.add({
        id: newId('mer'),
        name: trimmed,
        normalizedName,
        syncUpdatedAt: Date.now(),
        syncDeletedAt: null,
      });
    }
  } catch (err) {
    console.warn('[comma expenses] merchant upsert failed', err);
  }
}

/**
 * Save multiple expenses in a single transaction (Bulk Import).
 * @param {Array<import('./expenses.js').Expense>} expenses
 */
export async function saveExpensesBulk(expenses) {
  if (!expenses || expenses.length === 0) return;
  await db.transaction('rw', db.expenses, async () => {
    await db.expenses.bulkPut(expenses);
  });
  for (const row of expenses) {
    const merchant = typeof row?.merchant === 'string' ? row.merchant.trim() : '';
    if (merchant) void upsertMerchant(merchant);
  }
}

/**
 * @param {Record<string, unknown>} expenseData
 */
export async function saveExpense(expenseData) {
  const row = normalizeExpenseInput(expenseData);
  const id = await db.expenses.add(row);
  if (row.merchant) void upsertMerchant(/** @type {string} */ (row.merchant));
  bus.emit(EXPENSE_SAVED, { id });
  bus.emit(XP_EARNED, { action: 'expense_saved', xp: 3 });
  return id;
}

/**
 * @param {number} id
 * @param {Record<string, unknown>} patch
 */
export async function updateExpense(id, patch) {
  const prev = await db.expenses.get(id);
  if (!prev) throw new Error('expense:not_found');
  const next = normalizeExpenseInput({ ...prev, ...patch, createdAt: prev.createdAt });
  await db.expenses.put({ ...prev, ...next, id });
  if (next.merchant) void upsertMerchant(/** @type {string} */ (next.merchant));
  bus.emit(EXPENSE_SAVED, { id });
  return id;
}

/** @param {number} id */
export async function deleteExpense(id) {
  await softDelete('expenses', id);
  bus.emit(EXPENSE_SAVED, { id, deleted: true });
}

/**
 * Recurring ledger rows are created only after the user confirms (see {@link runRecurringExpensePromptOnce}).
 * @returns {Promise<number>} always 0; kept for callers that awaited legacy auto-generation.
 */
export async function generateRecurringExpenses() {
  return 0;
}

/**
 * Record one paid occurrence for a recurring template and advance its next date (mirrors legacy duplicate checks).
 * @param {Record<string, unknown>} template
 * @param {Record<string, unknown>} [overrides] fields merged before save (e.g. edited amount from the form)
 */
export async function createRecurringOccurrenceAndAdvance(template, overrides = {}) {
  const nextDate = String(template.recurringNextDate);
  const childInput = {
    ...template,
    ...overrides,
    id: undefined,
    shiftId: null,
    date: nextDate,
    recurringNextDate: null,
    isRecurring: false,
    source: 'recurring',
    createdAt: undefined,
  };
  const normalized = normalizeExpenseInput(childInput);
  const existing = await db.expenses
    .filter(
      (e) =>
        e.deletedAt == null &&
        e.source === 'recurring' &&
        e.date === nextDate &&
        e.category === normalized.category &&
        e.amount === normalized.amount &&
        (e.platformId || null) === (normalized.platformId || null),
    )
    .first();
  if (!existing) {
    await db.expenses.add(normalized);
    if (normalized.merchant) void upsertMerchant(/** @type {string} */ (normalized.merchant));
  }
  const updatedNext = addInterval(nextDate, String(template.recurringInterval || 'monthly'));
  await db.expenses.update(template.id, {
    recurringNextDate: updatedNext,
    recurringSnoozeUntil: null,
    updatedAt: nowIso(),
    syncUpdatedAt: Date.now(),
  });
  bus.emit(EXPENSE_SAVED, { id: template.id });
}

function addDaysFromYmd(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + days);
  return ymd(d);
}

let recurringBootPromptDone = false;

/** After onboarding: at most one modal for the earliest due recurring expense (respects snooze). */
export async function runRecurringExpensePromptOnce() {
  if (recurringBootPromptDone) return;
  const user = /** @type {{ onboardingComplete?: boolean } | null} */ (store.get('user'));
  if (!user?.onboardingComplete) return;
  recurringBootPromptDone = true;

  const today = ymd(new Date());
  const recurring = await db.expenses
    .filter((e) => e.deletedAt == null && e.isRecurring === true && typeof e.recurringNextDate === 'string')
    .toArray();
  const due = recurring
    .filter((row) => {
      if (String(row.recurringNextDate) > today) return false;
      const sn = row.recurringSnoozeUntil;
      if (sn && String(sn).trim() && today <= String(sn).trim()) return false;
      return true;
    })
    .sort((a, b) => String(a.recurringNextDate).localeCompare(String(b.recurringNextDate)));

  const template = due[0];
  if (!template || template.id == null) return;

  const categories = await getAllCategories();
  const platformRows = (store.get('platforms') || []).map((p) => ({ id: String(p.id), name: p.name || p.id }));
  const bodyRaw = t('expenses.recurringPromptBody')
    .replace('{category}', categoryLabel(template))
    .replace('{amount}', fmtMoney(num(template.amount)))
    .replace('{date}', String(template.recurringNextDate));

  showModal({
    title: t('expenses.recurringPromptTitle'),
    content: `<p class="expenses-recurring-prompt">${esc(bodyRaw)}</p>`,
    size: 'sm',
    actions: [
      {
        label: t('expenses.recurringSkip'),
        class: 'btn btn-secondary',
        onClick: async () => {
          await updateExpense(template.id, { recurringSnoozeUntil: addDaysFromYmd(today, 3) });
        },
      },
      {
        label: t('expenses.recurringEditAmount'),
        class: 'btn btn-secondary',
        close: false,
        onClick: (handle) => {
          handle.close();
          void openRecurringOccurrenceEditor({
            template,
            categories,
            platformRows,
            user,
            onDone: () => showToast({ type: 'success', message: t('expenses.savedToast'), duration: 1800 }),
          });
        },
      },
      {
        label: t('expenses.recurringYesPaid'),
        class: 'btn btn-primary',
        autofocus: true,
        onClick: async () => {
          await createRecurringOccurrenceAndAdvance(template);
          showToast({ type: 'success', message: t('expenses.savedToast'), duration: 1800 });
        },
      },
    ],
  });
}

export async function calcAutoFuelCost(vehicleId, distanceKm) {
  const vehicle = await db.vehicles.get(vehicleId);
  if (!vehicle) return 0;
  const dollars = calcFuelCost(distanceKm, vehicle.fuelEfficiency, vehicle.currentFuelPrice);
  return Math.max(0, num(dollars));
}

export async function calcAutoEVCost(vehicleId, distanceKm) {
  const vehicle = await db.vehicles.get(vehicleId);
  if (!vehicle) return 0;
  const dollars = calcEVCost(distanceKm, vehicle.kwPer100km, vehicle.electricityRate);
  return Math.max(0, num(dollars));
}

export async function getMonthlyExpenseByCategory(month, year) {
  const mm = String(month).padStart(2, '0');
  const prefix = `${year}-${mm}-`;
  const rows = await db.expenses.filter((e) => e.deletedAt == null && String(e.date || '').startsWith(prefix)).toArray();
  /** @type {Record<string, number>} */
  const out = {};
  for (const row of rows) {
    const key = String(row.category || 'other');
    out[key] = (out[key] || 0) + num(row.amount) * (num(row.deductiblePct, 100) / 100);
  }
  return out;
}

export async function getTotalExpensesForPeriod(startDate, endDate, platformId) {
  const rows = await db.expenses
    .filter(
      (e) =>
        e.deletedAt == null &&
        String(e.date || '') >= startDate &&
        String(e.date || '') <= endDate &&
        matchesFilter(e.platformId, platformId ?? 'all'),
    )
    .toArray();
  return rows.reduce((sum, row) => sum + num(row.amount) * (num(row.deductiblePct, 100) / 100), 0);
}

/**
 * Personal (non‑business) portion of expenses in the period, in dollars.
 * @param {string} startDate YYYY-MM-DD
 * @param {string} endDate YYYY-MM-DD
 * @param {string} [platformId] When set, only expenses tagged with this platform id.
 * @returns {Promise<number>}
 */
export async function getOutOfPocketExpensesForPeriod(startDate, endDate, platformId) {
  const rows = await db.expenses
    .filter(
      (e) =>
        e.deletedAt == null &&
        String(e.date || '') >= startDate &&
        String(e.date || '') <= endDate &&
        matchesFilter(e.platformId, platformId ?? 'all'),
    )
    .toArray();
  return rows.reduce((sum, row) => {
    const amt = num(row.amount);
    const bp = num(row.deductiblePct, 100);
    return sum + amt * ((100 - bp) / 100);
  }, 0);
}

export async function getExpenseRatio(startDate, endDate) {
  // expenseTotal is dollars (getTotalExpensesForPeriod); shifts.grossRevenue is likewise real
  // dollars (Dexie v5 — see db.js STORES_V4 doc / shifts.js), so both sides of the ratio are the
  // same unit with no cents conversion needed.
  const expenseTotal = await getTotalExpensesForPeriod(startDate, endDate);
  const shifts = await db.shifts
    .filter((s) => s.deletedAt == null && String(s.date || '') >= startDate && String(s.date || '') <= endDate)
    .toArray();
  const gross = shifts.reduce((sum, s) => sum + num(s.grossRevenue), 0);
  if (gross <= 0) return 0;
  return (expenseTotal / gross) * 100;
}

export async function updateFuelPrice(vehicleId, price) {
  const row = {
    vehicleId: String(vehicleId),
    price: Math.max(0, num(price)),
    date: nowIso(),
    notes: '',
  };
  await db.fuelPrices.add(row);
  await db.vehicles.update(vehicleId, { currentFuelPrice: row.price, updatedAt: nowIso(), syncUpdatedAt: Date.now() });
}

export async function getAllCategories() {
  const prov = /** @type {{ expenseCategories?: Array<{ id: string; labelKey: string }> } | null} */ (
    store.get('provinceDef')
  );
  const preset = ExpenseCategoryRegistry.getAll().map((c) => ({
    id: c.id,
    emoji: c.emoji,
    name: t(`expenses.categories.${c.id}`),
    custom: false,
  }));
  let base = preset;
  if (Array.isArray(prov?.expenseCategories) && prov.expenseCategories.length) {
    const presetById = new Map(preset.map((c) => [c.id, c]));
    const seen = new Set();
    const fromProv = prov.expenseCategories.map((c) => {
      seen.add(c.id);
      const p = presetById.get(c.id);
      let name = c.id;
      if (typeof c.labelKey === 'string' && c.labelKey) {
        const tr = t(c.labelKey);
        name = tr !== c.labelKey ? tr : p?.name || c.id;
      } else if (p?.name) name = p.name;
      return {
        id: c.id,
        emoji: p?.emoji || '🧾',
        name,
        custom: false,
      };
    });
    base = [...fromProv, ...preset.filter((c) => !seen.has(c.id))];
  }
  const row = await db.appState.get(APP_STATE_CUSTOM_CATEGORIES_KEY);
  let custom = [];
  try {
    custom = row?.value ? JSON.parse(row.value) : [];
  } catch {
    custom = [];
  }
  if (!Array.isArray(custom)) custom = [];
  return [
    ...base,
    ...custom
      .filter((c) => c && typeof c.id === 'string')
      .map((c) => ({ id: c.id, name: c.name || c.id, emoji: c.emoji || '🧾', custom: true })),
  ];
}

export async function addCustomCategory(name, emoji) {
  const nm = String(name || '').trim();
  if (!nm) throw new Error('category:name_required');
  const id = `custom_${nm.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
  const current = await getAllCategories();
  if (current.some((c) => c.id === id)) return id;
  const row = await db.appState.get(APP_STATE_CUSTOM_CATEGORIES_KEY);
  let arr = [];
  try {
    arr = row?.value ? JSON.parse(row.value) : [];
  } catch {
    arr = [];
  }
  if (!Array.isArray(arr)) arr = [];
  arr.push({ id, name: nm, emoji: emoji || '🧾' });
  await db.appState.put({ key: APP_STATE_CUSTOM_CATEGORIES_KEY, value: JSON.stringify(arr), updatedAt: nowIso() });
  return id;
}

async function openAutoExpenseFromShiftModal(shiftId) {
  const shift = await db.shifts.get(shiftId);
  if (!shift || shift.deletedAt != null) return;
  if (!shift.vehicleId || !num(shift.activeMileage)) return;

  const vehicle = await db.vehicles.get(shift.vehicleId);
  if (!vehicle || vehicle.active === false) return;

  const prior = await db.expenses
    .filter((e) => e.deletedAt == null && e.shiftId === shiftId && AUTO_EXPENSE_SOURCES.has(String(e.source || '')))
    .first();
  if (prior) return;

  const isEv = String(vehicle.type || '').toLowerCase() === 'ev';
  const amountDollars = isEv
    ? await calcAutoEVCost(vehicle.id, num(shift.activeMileage))
    : await calcAutoFuelCost(vehicle.id, num(shift.activeMileage));
  if (amountDollars <= 0) return;

  const categories = await getAllCategories();
  const formApi = renderExpenseForm({
    initial: {
      category: 'fuel',
      amount: amountDollars,
      date: shift.date,
      platformId: shift.platformId,
      deductiblePct: 100,
      notes: t('expenses.autoExpenseNote').replace('{shiftId}', String(shiftId)),
    },
    categories,
    platforms: (store.get('platforms') || []).map((p) => ({ id: String(p.id), name: p.name || p.id })),
    isHstRegistered: Boolean(store.get('user')?.hstRegistered),
    currencySymbol: store.get('user')?.locale?.currencySymbol || '$',
    submitLabel: t('expenses.confirmAutoExpense'),
  });

  const handle = showModal({
    title: isEv ? t('expenses.autoExpenseTitleEv') : t('expenses.autoExpenseTitle'),
    content: formApi.el,
    actions: [],
  });
  const formEl = formApi.el.querySelector('form');
  if (!formEl) return;
  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveExpense({
      ...formApi.getValue(),
      source: isEv ? 'auto_ev' : 'auto_fuel',
      shiftId,
    });
    showToast({ type: 'success', message: t('expenses.savedToast'), duration: 1800 });
    handle.close();
  });
}

async function suggestShiftFuelExpenseToast(shiftId) {
  const shift = await db.shifts.get(shiftId);
  if (!shift || shift.deletedAt != null) return;
  if (!shift.vehicleId || !num(shift.activeMileage)) return;

  const vehicle = await db.vehicles.get(shift.vehicleId);
  if (!vehicle || vehicle.active === false) return;

  const prior = await db.expenses
    .filter((e) => e.deletedAt == null && e.shiftId === shiftId && AUTO_EXPENSE_SOURCES.has(String(e.source || '')))
    .first();
  if (prior) return;

  const isEv = String(vehicle.type || '').toLowerCase() === 'ev';
  const amountDollars = isEv
    ? await calcAutoEVCost(vehicle.id, num(shift.activeMileage))
    : await calcAutoFuelCost(vehicle.id, num(shift.activeMileage));
  if (amountDollars <= 0) return;

  const amountLabel = fmtMoney(amountDollars);
  const msg = isEv
    ? t('expenses.fuelExpenseToastEv').replace('{amount}', amountLabel)
    : t('expenses.fuelExpenseToast').replace('{amount}', amountLabel);
  showToast({
    type: 'info',
    message: msg,
    duration: 10000,
    actionLabel: t('expenses.addExpenseToastAction'),
    action: () => {
      void openAutoExpenseFromShiftModal(shiftId);
    },
  });
}

let autoWired = false;
export function initExpensesModule() {
  if (autoWired) return;
  autoWired = true;
  bus.on(SHIFT_SAVED, (data) => {
    const id = data?.id;
    if (!id) return;
    void suggestShiftFuelExpenseToast(id);
  });
}

/**
 * Full-screen expense ledger — mobile-parity layout mirroring the Android Expenses tab
 * (header + month navigator, weekly bar chart, YTD bento, filterable transactions, month
 * selector modal). Caller must invoke the returned teardown when the host `root` is reused
 * (e.g. route change) so listeners and bus subs are removed.
 * @param {HTMLElement} root
 * @param {Record<string, unknown>} [ctx]
 * @returns {Promise<() => void>}
 */
/** Touch devices get swipeable rows; mouse devices act via the visible row buttons. */
const COARSE_POINTER = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

export async function renderExpensesView(root, ctx = {}) {
  const categories = await getAllCategories();
  const user = store.get('user');
  const platformRows = (store.get('platforms') || []).map((p) => ({ id: String(p.id), name: String(p.name || p.id) }));

  const currencySymbol = user?.locale?.currencySymbol || '$';
  const locale = typeof navigator !== 'undefined' ? navigator.language : 'en';

  /** @param {number} v */
  function money(v) {
    return `${currencySymbol}${num(v).toFixed(2)}`;
  }
  /** @param {number} v — value split into symbol + digits for the big header amount. */
  function moneyParts(v) {
    return { symbol: currencySymbol, value: num(v).toFixed(2) };
  }

  function rowIsDeductible(row) {
    const cat = ExpenseCategoryRegistry.getById(row.category);
    return cat ? cat.deductible !== false : true;
  }
  function catMeta(id) {
    const c = categories.find((x) => x.id === String(id));
    return { emoji: c?.emoji || '🧾', name: c?.name || categoryLabel({ category: id }) };
  }

  // ── State ────────────────────────────────────────────────────────────────
  const now = new Date();
  let selectedMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  let selectorYear = now.getFullYear();
  /** @type {string} */ let filterCategory = '';
  /** @type {'all' | 'yes' | 'no'} */ let filterDeductible = 'all';
  /** @type {number | null} */ let selectedWeekIndex = null;
  let filtersVisible = false;

  /** All non-deleted expense rows (loaded once, refreshed on EXPENSE_SAVED). */
  let allRows = [];
  async function loadRows() {
    allRows = await db.expenses.filter((e) => e.deletedAt == null).toArray();
  }
  await loadRows();

  function monthKeyOf(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  function rowsForMonth(d) {
    const key = monthKeyOf(d);
    return allRows.filter((e) => String(e.date || '').slice(0, 7) === key);
  }

  // ── Static shell ─────────────────────────────────────────────────────────
  root.innerHTML = `
    <section class="expenses-m">
      <header class="expenses-m-header">
        <div class="expenses-m-header-text">
          <h1 class="expenses-m-title">${esc(t('expenses.title'))}</h1>
          <p class="expenses-m-subtitle">${esc(t('expenses.subtitle'))}</p>
        </div>
        <ion-button size="small" class="expenses-m-add" data-action="new-expense">
          ${getIcon('plus', 16)}<span>${esc(t('expenses.add'))}</span>
        </ion-button>
      </header>

      <div class="expenses-m-nav">
        <button type="button" class="expenses-m-monthpill" data-action="open-month-modal">
          <span data-slot="month-label"></span>
          ${getIcon('chevron-down', 14)}
        </button>
        <div class="expenses-m-navrow">
          <button type="button" class="expenses-m-arrow" data-action="prev-month" aria-label="${esc(t('expenses.previousPage'))}">${getIcon('chevron-left', 22)}</button>
          <div class="expenses-m-amount">
            <span class="expenses-m-amount-sym" data-slot="total-sym">${esc(currencySymbol)}</span>
            <span class="expenses-m-amount-val" data-slot="total-val">0.00</span>
          </div>
          <button type="button" class="expenses-m-arrow" data-action="next-month" data-slot="next-arrow" aria-label="${esc(t('expenses.nextPage'))}">${getIcon('chevron-right', 22)}</button>
        </div>
      </div>

      <div class="expenses-m-chart" data-slot="chart"></div>

      <div class="expenses-m-bento">
        <article class="expenses-m-bento-card">
          <div class="expenses-m-bento-head">
            <span class="expenses-m-bento-icon expenses-m-bento-icon--in">${getIcon('trending-down', 14)}</span>
            <span class="expenses-m-bento-label">${esc(t('expenses.deductibleYtd') || 'Deductible YTD')}</span>
          </div>
          <span class="expenses-m-bento-value" data-slot="ytd-deductible">—</span>
        </article>
        <article class="expenses-m-bento-card">
          <div class="expenses-m-bento-head">
            <span class="expenses-m-bento-icon expenses-m-bento-icon--out">${getIcon('trending-up', 14)}</span>
            <span class="expenses-m-bento-label">${esc(t('expenses.standardYtd') || 'Standard YTD')}</span>
          </div>
          <span class="expenses-m-bento-value" data-slot="ytd-standard">—</span>
        </article>
      </div>

      <div class="expenses-m-txhead">
        <h2 class="expenses-m-txtitle">${esc(t('expenses.transactions') || 'Transactions')}</h2>
        <button type="button" class="expenses-m-filterbtn" data-action="toggle-filters" aria-expanded="false">
          ${getIcon('filter', 14)}<span>${esc(t('expenses.filters') || 'Filters')}</span>
        </button>
      </div>

      <div class="expenses-m-filters" data-slot="filters" hidden></div>

      <div class="expenses-m-list" data-slot="list"></div>
    </section>
  `;

  const monthLabelEl = root.querySelector('[data-slot="month-label"]');
  const totalSymEl = root.querySelector('[data-slot="total-sym"]');
  const totalValEl = root.querySelector('[data-slot="total-val"]');
  const nextArrowEl = root.querySelector('[data-slot="next-arrow"]');
  const chartEl = root.querySelector('[data-slot="chart"]');
  const ytdDeductibleEl = root.querySelector('[data-slot="ytd-deductible"]');
  const ytdStandardEl = root.querySelector('[data-slot="ytd-standard"]');
  const filtersEl = root.querySelector('[data-slot="filters"]');
  const listEl = root.querySelector('[data-slot="list"]');

  // ── Derived helpers ──────────────────────────────────────────────────────
  function filteredMonthRows() {
    return rowsForMonth(selectedMonth).filter((e) => {
      if (filterCategory && String(e.category) !== filterCategory) return false;
      if (filterDeductible === 'yes' && !rowIsDeductible(e)) return false;
      if (filterDeductible === 'no' && rowIsDeductible(e)) return false;
      return true;
    });
  }

  function weekBucketsFor(rows, monthDate) {
    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
    const w = [
      { label: 'W1', min: 1, max: 7, total: 0, items: [] },
      { label: 'W2', min: 8, max: 14, total: 0, items: [] },
      { label: 'W3', min: 15, max: 21, total: 0, items: [] },
      { label: 'W4', min: 22, max: daysInMonth, total: 0, items: [] },
    ];
    let total = 0;
    for (const exp of rows) {
      total += num(exp.amount);
      const day = Number(String(exp.date || '').slice(8, 10));
      const week = w.find((wk) => day >= wk.min && day <= wk.max);
      if (week) {
        week.total += num(exp.amount);
        week.items.push(exp);
      }
    }
    const max = Math.max(...w.map((wk) => wk.total), 0);
    return { weeks: w, total, max };
  }

  function ytdSummary() {
    const year = now.getFullYear();
    const ytd = allRows.filter((e) => Number(String(e.date || '').slice(0, 4)) === year);
    let deductible = 0;
    let standard = 0;
    for (const e of ytd) {
      if (rowIsDeductible(e)) deductible += num(e.amount) * (num(e.deductiblePct, 100) / 100);
      else standard += num(e.amount);
    }
    return { deductible, standard };
  }

  // ── Renderers ────────────────────────────────────────────────────────────
  function renderNav(total) {
    if (monthLabelEl) {
      monthLabelEl.textContent = selectedMonth.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    }
    const parts = moneyParts(total);
    if (totalSymEl) totalSymEl.textContent = parts.symbol;
    if (totalValEl) totalValEl.textContent = parts.value;
    const isCurrentOrFuture =
      selectedMonth.getFullYear() === now.getFullYear() && selectedMonth.getMonth() >= now.getMonth();
    if (nextArrowEl) {
      nextArrowEl.disabled = isCurrentOrFuture;
      nextArrowEl.classList.toggle('is-disabled', isCurrentOrFuture);
    }
  }

  function renderChart(weeks, max) {
    if (!chartEl) return;
    const highBadge =
      max > 0
        ? `<div class="expenses-m-chart-high"><span class="expenses-m-chart-highline"></span><span class="expenses-m-chart-highbadge">${esc((t('expenses.chartHigh') || 'HIGH'))}: ${esc(money(max))}</span></div>`
        : '';
    const cols = weeks
      .map((week, idx) => {
        const pct = max > 0 ? (week.total / max) * 100 : 0;
        const h = Math.max(pct, week.total > 0 ? 8 : 2);
        const active = selectedWeekIndex === null || selectedWeekIndex === idx;
        const selected = selectedWeekIndex === idx;
        return `<button type="button" class="expenses-m-chart-col" data-action="select-week" data-week="${idx}">
          <span class="expenses-m-chart-track">
            <span class="expenses-m-chart-fill${active ? '' : ' is-dim'}" style="--h:${h}%"></span>
          </span>
          <span class="expenses-m-chart-lbl${selected ? ' is-selected' : ''}">${esc(week.label)}</span>
        </button>`;
      })
      .join('');
    chartEl.innerHTML = `${highBadge}<div class="expenses-m-chart-row">${cols}</div>`;
  }

  function renderBento() {
    const s = ytdSummary();
    if (ytdDeductibleEl) ytdDeductibleEl.textContent = money(s.deductible);
    if (ytdStandardEl) ytdStandardEl.textContent = money(s.standard);
  }

  function renderFilters() {
    if (!filtersEl) return;
    filtersEl.hidden = !filtersVisible;
    root.querySelector('[data-action="toggle-filters"]')?.setAttribute('aria-expanded', String(filtersVisible));
    root.querySelector('[data-action="toggle-filters"]')?.classList.toggle('is-active', filtersVisible);
    if (!filtersVisible) {
      filtersEl.innerHTML = '';
      return;
    }
    const catPills = [`<button type="button" class="expenses-m-pill${!filterCategory ? ' is-active' : ''}" data-action="filter-cat" data-cat="">${esc(t('common.all'))}</button>`]
      .concat(
        categories.map((c) => {
          const active = filterCategory === c.id;
          return `<button type="button" class="expenses-m-pill${active ? ' is-active' : ''}" data-action="filter-cat" data-cat="${esc(c.id)}"><span class="expenses-m-pill-emoji">${esc(c.emoji || '🧾')}</span>${esc(c.name)}</button>`;
        }),
      )
      .join('');
    const typePills = [
      { key: 'all', label: t('common.all') },
      { key: 'yes', label: t('expenses.deductibleOnly') || 'Deductible' },
      { key: 'no', label: t('expenses.standardOnly') || 'Standard' },
    ]
      .map(({ key, label }) => {
        const active = filterDeductible === key;
        return `<button type="button" class="expenses-m-typepill expenses-m-typepill--${key}${active ? ' is-active' : ''}" data-action="filter-ded" data-ded="${key}">${esc(label)}</button>`;
      })
      .join('');
    filtersEl.innerHTML = `
      <div class="expenses-m-pillrow">${catPills}</div>
      <div class="expenses-m-typerow">${typePills}</div>
    `;
  }

  function renderList(displayed) {
    if (!listEl) return;
    if (!displayed.length) {
      listEl.innerHTML = renderEmptyState({
        title: t('expenses.emptyTitle'),
        message: selectedWeekIndex !== null ? (t('expenses.emptyWeek') || t('expenses.emptyMessage')) : t('expenses.emptyMessage'),
      });
      return;
    }
    const sorted = [...displayed].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    listEl.innerHTML = sorted
      .map((exp) => {
        const meta = catMeta(exp.category);
        const dateLabel = (() => {
          const d = new Date(`${String(exp.date || '').slice(0, 10)}T12:00:00`);
          if (Number.isNaN(d.getTime())) return String(exp.date || '');
          return d.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
        })();
        const ded = rowIsDeductible(exp);
        const notes = String(exp.notes || '').trim();
        const badge = ded
          ? `<span class="expenses-m-badge">${esc(t('expenses.taxDeductible') || 'Tax Deductible')}</span>`
          : '';
        const rowHtml = `<div class="expenses-m-row" data-expense-id="${esc(exp.id)}">
              <button type="button" class="expenses-m-row-main" data-action="edit">
                <span class="expenses-m-row-icon">${esc(meta.emoji)}</span>
                <span class="expenses-m-row-body">
                  <span class="expenses-m-row-titleline">
                    <span class="expenses-m-row-title">${esc(meta.name)}</span>${badge}
                  </span>
                  <span class="expenses-m-row-sub">${esc(dateLabel)}${notes ? ` · ${esc(notes)}` : ''}</span>
                </span>
              </button>
              <div class="expenses-m-row-right">
                <span class="expenses-m-row-amount">-${esc(money(num(exp.amount)))}</span>
                <button type="button" class="expenses-m-row-del" data-action="delete" aria-label="${esc(t('common.delete'))}">${getIcon('trash', 12)}</button>
              </div>
            </div>`;
        // Swipe wrapper only where swipe exists (touch). Every ion-item-sliding is a live
        // component (shadow DOM + gesture controller), and this list rebuilds wholesale on
        // each month step — wrapping on desktop made rapid arrow clicks visibly stutter for
        // zero benefit, since mouse users act via the always-visible row buttons instead.
        if (!COARSE_POINTER) return rowHtml;
        return `<ion-item-sliding class="expenses-m-sliding" data-expense-id="${esc(exp.id)}">
          <ion-item class="expenses-m-ion-item" lines="none">
            ${rowHtml}
          </ion-item>
          <ion-item-options side="end">
            <ion-item-option color="medium" data-action="edit">${esc(t('common.edit'))}</ion-item-option>
            <ion-item-option color="danger" data-action="delete">${esc(t('common.delete'))}</ion-item-option>
          </ion-item-options>
        </ion-item-sliding>`;
      })
      .join('');
  }

  /**
   * Month selector — an ion-modal bottom sheet (drag handle, breakpoints; Escape/backdrop/
   * swipe-down dismissal are ion-modal's own paths) hosting the same month-card content the
   * old fixed-overlay modal rendered. Mirrors shifts-view's `openWeekSelector`.
   */
  async function openMonthModal() {
    selectorYear = selectedMonth.getFullYear();
    // Remove any prior instance first so rapid re-opens can't stack.
    document.querySelectorAll('.expenses-m-month-modal').forEach((n) => n.remove());
    const modal = /** @type {HTMLElement & { present: () => Promise<void>; dismiss: () => Promise<boolean> }} */ (
      document.createElement('ion-modal')
    );
    modal.classList.add('expenses-m-month-modal');
    applySheetPresentation(modal, [0, 0.65, 0.92], 0.65);
    const host = document.createElement('div');
    host.className = 'expenses-m-modal-sheet';
    modal.appendChild(host);

    /** Build the sheet markup for `selectorYear`. */
    const build = () => {
      const realYear = now.getFullYear();
      const realMonth = now.getMonth();
      const maxMonthIndex = selectorYear === realYear ? realMonth : 11;
      const s = ytdSummary();

      const cards = [];
      for (let i = maxMonthIndex; i >= 0; i--) {
        const mDate = new Date(selectorYear, i, 1);
        const rows = rowsForMonth(mDate);
        const { weeks, total, max } = weekBucketsFor(rows, mDate);
        const isSel =
          selectedMonth.getFullYear() === selectorYear && selectedMonth.getMonth() === i;
        const mini = weeks
          .map((week) => {
            const pct = max > 0 ? (week.total / max) * 100 : 0;
            const h = Math.max(pct, week.total > 0 ? 8 : 2);
            return `<span class="expenses-m-mini-col"><span class="expenses-m-mini-track"><span class="expenses-m-mini-fill" style="--h:${h}%"></span></span></span>`;
          })
          .join('');
        cards.push(`<button type="button" class="expenses-m-mcard${isSel ? ' is-selected' : ''}" data-action="pick-month" data-month="${i}">
          <span class="expenses-m-mcard-info">
            <span class="expenses-m-mcard-name">${esc(mDate.toLocaleDateString(locale, { month: 'long' }))} ${selectorYear}</span>
            <span class="expenses-m-mcard-total">${esc(money(total))}</span>
          </span>
          <span class="expenses-m-mini">${mini}</span>
        </button>`);
      }

      const nextYearDisabled = selectorYear >= realYear;
      host.innerHTML = `
        <div class="expenses-m-modal-head">
          <div class="expenses-m-modal-headline">
            <h2 class="expenses-m-modal-title">${esc(t('expenses.title'))}</h2>
            <span class="expenses-m-modal-yearnav">
              <button type="button" class="expenses-m-modal-yearbtn" data-action="prev-year" aria-label="${esc(t('expenses.previousYear') || 'Previous Year')}">${getIcon('chevron-left', 18)}</button>
              <span class="expenses-m-modal-yearlbl">${selectorYear}</span>
              <button type="button" class="expenses-m-modal-yearbtn${nextYearDisabled ? ' is-disabled' : ''}" data-action="next-year" ${nextYearDisabled ? 'disabled' : ''} aria-label="${esc(t('expenses.nextYear') || 'Next Year')}">${getIcon('chevron-right', 18)}</button>
            </span>
          </div>
          <button type="button" class="expenses-m-modal-done" data-action="close-month-modal">${esc(t('common.done') || 'Done')}</button>
        </div>
        <div class="expenses-m-modal-subhead">
          <span>${esc((t('expenses.month') || 'MONTH'))}</span>
          <span>${esc((t('expenses.ytdDeductibleShort') || 'YTD DEDUCTIBLE'))}: ${esc(money(s.deductible))}</span>
        </div>
        <div class="expenses-m-modal-list">${cards.join('')}</div>
      `;
    };

    build();
    modal.addEventListener('ionModalDidDismiss', () => modal.remove());
    document.body.appendChild(modal);
    await modal.present();

    const close = () => void modal.dismiss();

    // The sheet lives on document.body, outside `root` — it wires its own delegation.
    host.addEventListener('click', (ev) => {
      const el = ev.target instanceof Element ? ev.target.closest('[data-action]') : null;
      if (!el) return;
      const action = el.getAttribute('data-action');
      if (action === 'close-month-modal') {
        close();
        return;
      }
      if (action === 'prev-year') {
        selectorYear -= 1;
        build();
        return;
      }
      if (action === 'next-year') {
        if (selectorYear < now.getFullYear()) {
          selectorYear += 1;
          build();
        }
        return;
      }
      if (action === 'pick-month') {
        const mi = Number(el.getAttribute('data-month'));
        selectedMonth = new Date(selectorYear, mi, 1);
        selectedWeekIndex = null;
        refresh();
        close();
      }
    });
  }

  function refresh() {
    const monthRows = filteredMonthRows();
    const { weeks, total, max } = weekBucketsFor(monthRows, selectedMonth);
    renderNav(total);
    renderChart(weeks, max);
    renderBento();
    renderFilters();
    const displayed = selectedWeekIndex !== null && weeks[selectedWeekIndex] ? weeks[selectedWeekIndex].items : monthRows;
    renderList(displayed);
  }

  refresh();

  // ── Interactions ─────────────────────────────────────────────────────────
  const ac = new AbortController();
  const { signal } = ac;

  async function openEditorForNew() {
    await openExpenseEditor({
      categories,
      platformRows,
      isHstRegistered: Boolean(user?.hstRegistered),
      currencySymbol,
      onSave: saveExpense,
    });
    await loadRows();
    refresh();
  }

  function openEditorForRow(id) {
    // Ionic rollout: the editor presents as a bottom sheet (drag handle, swipe-down dismiss)
    // instead of the centered modal — same pattern as shifts-view's openShiftFormModal.
    const modal = /** @type {HTMLElement & { present: () => Promise<void>; dismiss: () => Promise<boolean> }} */ (
      document.createElement('ion-modal')
    );
    applySheetPresentation(modal, [0, 0.92], 0.92);
    const handle = { close: () => void modal.dismiss() };

    const wrap = document.createElement('div');
    wrap.className = 'expenses-m-sheet-body';
    wrap.innerHTML = `<h2 class="expenses-m-sheet-title">${esc(t('expenses.editTitle'))}</h2><div class="expense-edit-loading"><div class="shimmer-line"></div><div class="shimmer-line shimmer-line--short"></div><div class="shimmer-line"></div><p class="expense-loading-text">${esc(t('common.loading'))}...</p></div>`;
    modal.appendChild(wrap);
    modal.addEventListener('ionModalDidDismiss', () => modal.remove());
    document.body.appendChild(modal);
    void modal.present();

    void db.expenses.get(id).then((row) => {
      if (!row) {
        handle.close();
        return;
      }
      const formApi = renderExpenseForm({
        initial: row,
        categories,
        platforms: platformRows,
        isHstRegistered: Boolean(user?.hstRegistered),
        currencySymbol,
        onCancel: () => handle.close(),
      });
      const formEl = formApi.el.querySelector('form');
      if (formEl) {
        formEl.addEventListener('submit', async (e) => {
          e.preventDefault();
          await updateExpense(id, formApi.getValue());
          handle.close();
          await loadRows();
          refresh();
        });
      }
      wrap.querySelector('.expense-edit-loading')?.remove();
      wrap.appendChild(formApi.el);
      setTimeout(() => wrap.querySelector('input, select, textarea')?.focus(), 0);
    });
  }

  root.addEventListener(
    'click',
    async (e) => {
      const target = e.target instanceof Element ? e.target.closest('[data-action]') : null;
      if (!target || !root.contains(target)) return;
      const action = target.getAttribute('data-action');

      switch (action) {
        case 'new-expense':
          void openEditorForNew();
          return;
        case 'prev-month':
          selectedWeekIndex = null;
          selectedMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1);
          refresh();
          return;
        case 'next-month': {
          const next = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1);
          const cur = new Date(now.getFullYear(), now.getMonth(), 1);
          if (next <= cur) {
            selectedWeekIndex = null;
            selectedMonth = next;
            refresh();
          }
          return;
        }
        case 'select-week': {
          const idx = Number(target.getAttribute('data-week'));
          selectedWeekIndex = selectedWeekIndex === idx ? null : idx;
          refresh();
          return;
        }
        case 'toggle-filters':
          filtersVisible = !filtersVisible;
          renderFilters();
          return;
        case 'filter-cat':
          filterCategory = target.getAttribute('data-cat') || '';
          selectedWeekIndex = null;
          refresh();
          return;
        case 'filter-ded':
          filterDeductible = /** @type {'all'|'yes'|'no'} */ (target.getAttribute('data-ded') || 'all');
          selectedWeekIndex = null;
          refresh();
          return;
        case 'open-month-modal':
          void openMonthModal();
          return;
        default:
          break;
      }

      const rowEl = target.closest('[data-expense-id]');
      const id = rowEl?.getAttribute('data-expense-id');
      if (!id) return;
      // Swipe-option taps come from inside an open ion-item-sliding — snap it shut before acting.
      const slider = /** @type {{ close?: () => Promise<void> } | null} */ (target.closest('ion-item-sliding'));
      if (slider && typeof slider.close === 'function') void slider.close();
      if (action === 'edit') {
        openEditorForRow(id);
      } else if (action === 'delete') {
        showConfirm({
          message: t('expenses.deleteConfirm') || 'Delete this expense?',
          confirmLabel: t('common.delete'),
          confirmClass: 'btn btn-danger',
          onConfirm: async () => {
            await deleteExpense(id);
            showToast({ type: 'success', message: t('expenses.deletedToast'), duration: 1800 });
            await loadRows();
            refresh();
          },
        });
      }
    },
    { signal },
  );

  const offExpenseSaved = bus.on(EXPENSE_SAVED, () => {
    void loadRows().then(() => refresh());
  });

  if (ctx && /** @type {{ fabQuickExpense?: boolean }} */ (ctx).fabQuickExpense) {
    stripFabQueryFromHash();
    queueMicrotask(() => void openEditorForNew());
  }

  return () => {
    ac.abort();
    offExpenseSaved();
  };
}

/** Log one recurring payment from the confirmation flow (editable amount). */
async function openRecurringOccurrenceEditor({ template, categories, platformRows, user, onDone }) {
  const nextDate = String(template.recurringNextDate);
  // Ionic rollout: bottom-sheet form modal (shifts-view openShiftFormModal pattern).
  const modal = /** @type {HTMLElement & { present: () => Promise<void>; dismiss: () => Promise<boolean> }} */ (
    document.createElement('ion-modal')
  );
  applySheetPresentation(modal, [0, 0.92], 0.92);
  const handle = { close: () => void modal.dismiss() };

  const formApi = renderExpenseForm({
    initial: {
      category: template.category,
      customCategory: template.customCategory,
      amount: num(template.amount),
      date: nextDate,
      platformId: template.platformId,
      deductiblePct: num(template.deductiblePct, 100),
      notes: String(template.notes || ''),
      receiptData: template.receiptData,
      merchant: template.merchant,
      isRecurring: false,
      hstPaid: template.hstPaid,
      confirmedPaid: true,
    },
    categories,
    platforms: platformRows,
    isHstRegistered: Boolean(user?.hstRegistered),
    currencySymbol: /** @type {{ locale?: { currencySymbol?: string } }} */ (user)?.locale?.currencySymbol || '$',
    submitLabel: t('common.save'),
    onCancel: () => handle.close(),
  });

  const wrap = document.createElement('div');
  wrap.className = 'expenses-m-sheet-body';
  const heading = document.createElement('h2');
  heading.className = 'expenses-m-sheet-title';
  heading.textContent = t('expenses.recurringEditTitle');
  wrap.appendChild(heading);
  wrap.appendChild(formApi.el);
  modal.appendChild(wrap);

  const form = formApi.el.querySelector('form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await createRecurringOccurrenceAndAdvance(template, formApi.getValue());
      onDone?.();
      handle.close();
    });
  }

  await new Promise((resolve) => {
    modal.addEventListener('ionModalDidDismiss', () => {
      modal.remove();
      resolve(null);
    });
    document.body.appendChild(modal);
    void modal.present();
  });
}

async function openExpenseEditor({ initial = {}, categories, platformRows, isHstRegistered, currencySymbol, onSave }) {
  // Ionic rollout: bottom-sheet form modal (shifts-view openShiftFormModal pattern); native
  // <form> submit wiring is kept — ion-modal only replaces the overlay chrome.
  const modal = /** @type {HTMLElement & { present: () => Promise<void>; dismiss: () => Promise<boolean> }} */ (
    document.createElement('ion-modal')
  );
  applySheetPresentation(modal, [0, 0.92], 0.92);
  const handle = { close: () => void modal.dismiss() };

  const formApi = renderExpenseForm({
    initial,
    categories,
    platforms: platformRows,
    isHstRegistered,
    currencySymbol,
    onCancel: () => handle.close(),
  });

  const wrap = document.createElement('div');
  wrap.className = 'expenses-m-sheet-body';
  const heading = document.createElement('h2');
  heading.className = 'expenses-m-sheet-title';
  heading.textContent = initial.id ? t('expenses.editTitle') : t('expenses.add');
  wrap.appendChild(heading);
  wrap.appendChild(formApi.el);
  modal.appendChild(wrap);

  const form = formApi.el.querySelector('form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await onSave(formApi.getValue());
      showToast({ type: 'success', message: t('expenses.savedToast'), duration: 1800 });
      handle.close();
    });
  }

  // Resolve once the sheet is gone (save, Cancel, swipe-down, backdrop or Escape) so the
  // caller's reload-and-refresh runs on every close path.
  await new Promise((resolve) => {
    modal.addEventListener('ionModalDidDismiss', () => {
      modal.remove();
      resolve(null);
    });
    document.body.appendChild(modal);
    void modal.present();
  });
}
