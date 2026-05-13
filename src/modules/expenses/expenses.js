import { db, softDelete } from '../../core/db.js';
import { bus, EXPENSE_SAVED, SHIFT_SAVED, XP_EARNED } from '../../core/events.js';
import { store } from '../../core/store.js';
import { calcEVCost, calcFuelCost } from '../../utils/calculations.js';
import { t } from '../../utils/strings.js';
import { renderEmptyState, showModal, showToast } from '../../ui/components.js';
import { destroyChart, renderBarChart, renderDonutChart } from '../../ui/charts.js';
import { getIcon } from '../../ui/icons.js';
import { ExpenseCategoryRegistry } from '../../registry/expense-categories/index.js';
import { renderExpenseForm } from './expense-form.js';

const APP_STATE_CUSTOM_CATEGORIES_KEY = 'expense_custom_categories';
const AUTO_EXPENSE_SOURCES = new Set(['auto_fuel', 'auto_ev']);

const EXPENSE_CHART_COLORS = ['#3b82f6', '#14b8a6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#ec4899', '#64748b'];

/**
 * @param {string} ym `YYYY-MM`
 * @param {string} [locale]
 */
function formatChartMonthLabel(ym, locale = 'en') {
  const [y, mo] = ym.split('-').map((x) => Number(x));
  if (!Number.isFinite(y) || !Number.isFinite(mo)) return ym;
  const d = new Date(y, mo - 1, 1);
  return d.toLocaleString(locale, { month: 'short', year: 'numeric' });
}

/**
 * @param {Record<string, unknown>} row
 * @param {string} q
 */
function expenseRowMatchesSearch(row, q) {
  if (!q) return true;
  const s = q.toLowerCase();
  const blob = [row.date, row.category, row.notes, row.customCategory, row.platformId]
    .map((x) => String(x ?? '').toLowerCase())
    .join(' ');
  return blob.includes(s);
}

/**
 * @param {Record<string, unknown>} row
 */
function expenseDescriptionCell(row) {
  const c = String(row.customCategory || '').trim();
  if (c) return c;
  const n = String(row.notes || '').trim();
  if (!n) return '—';
  return n.length > 120 ? `${n.slice(0, 117)}…` : n;
}

/**
 * @param {Record<string, unknown>} row
 */
function expenseNotesCell(row) {
  const n = String(row.notes || '').trim();
  if (!n) return '—';
  return n.length > 80 ? `${n.slice(0, 77)}…` : n;
}

/** @param {unknown} catId */
function categoryPillTone(catId) {
  const s = String(catId ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 6;
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

function dollarsToCents(v) {
  if (v == null || v === '') return 0;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function resolveExpenseProvinceId(input) {
  if (typeof input.provinceId === 'string' && input.provinceId.trim()) return input.provinceId.trim().toUpperCase();
  const user = /** @type {{ provinceId?: string } | null} */ (store.get('user'));
  if (user?.provinceId) return String(user.provinceId).toUpperCase();
  return 'ON';
}

function normalizeExpenseInput(input) {
  const now = nowIso();
  const date = typeof input.date === 'string' && input.date ? input.date : ymd(new Date());
  const category = String(input.category || 'other');
  const recurring = Boolean(input.isRecurring);
  const amountRaw = input.amount != null ? input.amount : input.amountCents;
  const amount =
    input.amountCents != null && Number.isFinite(Number(input.amountCents))
      ? Math.max(0, Math.round(Number(input.amountCents)))
      : dollarsToCents(amountRaw);
  const businessPct = Math.max(0, Math.min(100, num(input.businessPct, 100)));
  const provinceId = resolveExpenseProvinceId(input);
  const hstPaidRaw = input.hstPaid != null ? input.hstPaid : input.hstItcAmount;
  const hstPaid = Math.max(0, dollarsToCents(hstPaidRaw));
  const confirmedPaid =
    input.confirmedPaid != null ? Boolean(input.confirmedPaid) : !recurring;

  /** @type {Record<string, unknown>} */
  const row = {
    category,
    customCategory: String(input.customCategory || ''),
    amount,
    businessPct,
    date,
    provinceId,
    platformId: input.platformId == null || input.platformId === 'all' ? null : String(input.platformId),
    notes: String(input.notes || ''),
    receiptData: typeof input.receiptData === 'string' ? input.receiptData : null,
    isRecurring: recurring,
    recurringInterval: recurring ? String(input.recurringInterval || 'monthly') : null,
    recurringNextDate: recurring ? String(input.recurringNextDate || date) : null,
    hstPaid,
    confirmedPaid,
    deletedAt: null,
    createdAt: input.createdAt || now,
    updatedAt: now,
    source: typeof input.source === 'string' ? input.source : 'manual',
    shiftId: input.shiftId == null ? null : Number(input.shiftId),
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
  else if (interval === 'annual') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return ymd(d);
}

function fmtMoney(v) {
  const user = store.get('user');
  const sym = user?.locale?.currencySymbol || '$';
  return `${sym}${(num(v) / 100).toFixed(2)}`;
}

function categoryLabel(row) {
  const id = String(row.category || '');
  const key = `expenses.categories.${id}`;
  const val = t(key);
  if (val !== key) return val;
  return id || t('expenses.uncategorized');
}

/**
 * @param {Record<string, unknown>} expenseData
 */
export async function saveExpense(expenseData) {
  const row = normalizeExpenseInput(expenseData);
  const id = await db.expenses.add(row);
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
  }
  const updatedNext = addInterval(nextDate, String(template.recurringInterval || 'monthly'));
  await db.expenses.update(template.id, {
    recurringNextDate: updatedNext,
    recurringSnoozeUntil: null,
    updatedAt: nowIso(),
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
  const vehicle = await db.vehicles.get(Number(vehicleId));
  if (!vehicle) return 0;
  const dollars = calcFuelCost(distanceKm, vehicle.fuelEfficiency, vehicle.currentFuelPrice);
  return Math.round(num(dollars) * 100);
}

export async function calcAutoEVCost(vehicleId, distanceKm) {
  const vehicle = await db.vehicles.get(Number(vehicleId));
  if (!vehicle) return 0;
  const dollars = calcEVCost(distanceKm, vehicle.kwPer100km, vehicle.electricityRate);
  return Math.round(num(dollars) * 100);
}

export async function getMonthlyExpenseByCategory(month, year) {
  const mm = String(month).padStart(2, '0');
  const prefix = `${year}-${mm}-`;
  const rows = await db.expenses.filter((e) => e.deletedAt == null && String(e.date || '').startsWith(prefix)).toArray();
  /** @type {Record<string, number>} */
  const out = {};
  for (const row of rows) {
    const key = String(row.category || 'other');
    out[key] = (out[key] || 0) + num(row.amount) * (num(row.businessPct, 100) / 100);
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
        (platformId ? String(e.platformId || '') === String(platformId) : true),
    )
    .toArray();
  return rows.reduce((sum, row) => sum + num(row.amount) * (num(row.businessPct, 100) / 100), 0);
}

/**
 * Personal (non‑business) portion of expenses in the period, in cents.
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
        (platformId ? String(e.platformId || '') === String(platformId) : true),
    )
    .toArray();
  return rows.reduce((sum, row) => {
    const amt = num(row.amount);
    const bp = num(row.businessPct, 100);
    return sum + amt * ((100 - bp) / 100);
  }, 0);
}

export async function getExpenseRatio(startDate, endDate) {
  const expenseTotal = await getTotalExpensesForPeriod(startDate, endDate);
  const shifts = await db.shifts
    .filter((s) => s.deletedAt == null && String(s.date || '') >= startDate && String(s.date || '') <= endDate)
    .toArray();
  const gross = shifts.reduce((sum, s) => {
    const raw = s.grossEarnings ?? s.gross;
    return sum + (s.grossEarnings != null ? num(raw) : Math.round(num(raw) * 100));
  }, 0);
  if (gross <= 0) return 0;
  return (expenseTotal / gross) * 100;
}

export async function updateFuelPrice(vehicleId, price) {
  const row = {
    vehicleId: Number(vehicleId),
    price: Math.max(0, num(price)),
    date: nowIso(),
    notes: '',
  };
  await db.fuelPrices.add(row);
  await db.vehicles.update(Number(vehicleId), { currentFuelPrice: row.price, updatedAt: nowIso() });
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
  if (!shift.vehicleId || !num(shift.distanceKm)) return;

  const vehicle = await db.vehicles.get(Number(shift.vehicleId));
  if (!vehicle || vehicle.active === false) return;

  const prior = await db.expenses
    .filter((e) => e.deletedAt == null && Number(e.shiftId) === Number(shiftId) && AUTO_EXPENSE_SOURCES.has(String(e.source || '')))
    .first();
  if (prior) return;

  const isEv = String(vehicle.type || '').toLowerCase() === 'ev';
  const amountCents = isEv
    ? await calcAutoEVCost(vehicle.id, num(shift.distanceKm))
    : await calcAutoFuelCost(vehicle.id, num(shift.distanceKm));
  if (amountCents <= 0) return;

  const categories = await getAllCategories();
  const formApi = renderExpenseForm({
    initial: {
      category: 'fuel',
      amount: amountCents,
      date: shift.date,
      platformId: shift.platformId,
      businessPct: 100,
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
  if (!shift.vehicleId || !num(shift.distanceKm)) return;

  const vehicle = await db.vehicles.get(Number(shift.vehicleId));
  if (!vehicle || vehicle.active === false) return;

  const prior = await db.expenses
    .filter((e) => e.deletedAt == null && Number(e.shiftId) === Number(shiftId) && AUTO_EXPENSE_SOURCES.has(String(e.source || '')))
    .first();
  if (prior) return;

  const isEv = String(vehicle.type || '').toLowerCase() === 'ev';
  const amountCents = isEv
    ? await calcAutoEVCost(vehicle.id, num(shift.distanceKm))
    : await calcAutoFuelCost(vehicle.id, num(shift.distanceKm));
  if (amountCents <= 0) return;

  const amountLabel = fmtMoney(amountCents);
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
    const id = Number(data?.id);
    if (!Number.isFinite(id) || id <= 0) return;
    void suggestShiftFuelExpenseToast(id);
  });
}

async function listExpenses(filters = {}, sort = { key: 'date', dir: 'desc' }) {
  const rows = await db.expenses.filter((e) => e.deletedAt == null).toArray();
  const filtered = rows.filter((e) => {
    if (filters.category && String(e.category) !== String(filters.category)) return false;
    if (filters.platformId && String(e.platformId || '') !== String(filters.platformId || '')) return false;
    if (filters.minAmount != null && num(e.amount) < num(filters.minAmount) * 100) return false;
    if (filters.maxAmount != null && num(e.amount) > num(filters.maxAmount) * 100) return false;
    if (filters.receiptOnly && !e.receiptData) return false;
    if (filters.startDate && String(e.date || '') < String(filters.startDate)) return false;
    if (filters.endDate && String(e.date || '') > String(filters.endDate)) return false;
    return true;
  });
  filtered.sort((a, b) => {
    let av;
    let bv;
    if (sort.key === 'description') {
      av = String(a.customCategory || '') + String(a.notes || '');
      bv = String(b.customCategory || '') + String(b.notes || '');
    } else {
      av = a[sort.key];
      bv = b[sort.key];
    }
    const cmp =
      typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''));
    return sort.dir === 'asc' ? cmp : -cmp;
  });
  return filtered;
}

/**
 * Full-screen expense ledger (filters + table + modals). Caller must invoke the returned
 * teardown when the host `root` is reused (e.g. route change) so listeners and bus subs are removed.
 * @param {HTMLElement} root
 * @returns {Promise<() => void>}
 */
export async function renderExpensesView(root) {
  const categories = await getAllCategories();
  const user = store.get('user');
  const platformRows = (store.get('platforms') || []).map((p) => ({ id: String(p.id), name: String(p.name || p.id) }));
  const catOptions = categories
    .map((c) => `<option value="${esc(c.id)}">${esc(c.emoji || '🧾')} ${esc(c.name)}</option>`)
    .join('');
  const platformOptions = platformRows
    .map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`)
    .join('');

  root.innerHTML = `
    <section class="expenses-view">
      <header class="expenses-view-header">
        <div class="expenses-view-header-text">
          <h1 class="expenses-view-title">
            <span class="expenses-view-title-icon" aria-hidden="true">${getIcon('receipt', 28)}</span>
            ${esc(t('expenses.title'))}
          </h1>
          <p class="expenses-view-subtitle">${esc(t('expenses.subtitle'))}</p>
        </div>
        <div class="expenses-view-header-actions">
          <button type="button" class="btn btn-primary expenses-add-btn" data-action="new-expense">
            <span class="expenses-add-btn-icon" aria-hidden="true">${getIcon('plus', 18)}</span>
            ${esc(t('expenses.addNewExpense'))}
          </button>
        </div>
      </header>

      <div class="expenses-tabstrip" role="tablist" aria-label="${esc(t('expenses.title'))}">
        <button type="button" role="tab" class="expenses-tab is-active" data-action="expense-tab" data-tab="all" aria-selected="true">${esc(t('expenses.tabAll'))}</button>
        <button type="button" role="tab" class="expenses-tab" data-action="expense-tab" data-tab="category" aria-selected="false">${esc(t('expenses.tabByCategory'))}</button>
        <button type="button" role="tab" class="expenses-tab" data-action="expense-tab" data-tab="recurring" aria-selected="false">${esc(t('expenses.tabRecurring'))}</button>
        <button type="button" role="tab" class="expenses-tab" data-action="expense-tab" data-tab="deductions" aria-selected="false">${esc(t('expenses.tabDeductions'))}</button>
      </div>

      <div class="expenses-panels">
        <div class="expenses-panel" data-panel="all" role="tabpanel">
          <div class="expenses-dash card">
            <div class="expenses-kpi-row">
              <article class="expenses-kpi expenses-kpi--total">
                <span class="expenses-kpi-label">${esc(t('expenses.kpiTotal'))}</span>
                <span class="expenses-kpi-value" data-kpi="total">—</span>
              </article>
              <article class="expenses-kpi expenses-kpi--count">
                <span class="expenses-kpi-label">${esc(t('expenses.kpiCount'))}</span>
                <span class="expenses-kpi-value" data-kpi="count">—</span>
              </article>
              <article class="expenses-kpi expenses-kpi--avg">
                <span class="expenses-kpi-label">${esc(t('expenses.kpiAverage'))}</span>
                <span class="expenses-kpi-value" data-kpi="avg">—</span>
              </article>
              <article class="expenses-kpi expenses-kpi--cats">
                <span class="expenses-kpi-label">${esc(t('expenses.kpiCategories'))}</span>
                <span class="expenses-kpi-value" data-kpi="categories">—</span>
              </article>
            </div>
            <div class="expenses-charts-row">
              <article class="expenses-chart-card">
                <h2 class="expenses-chart-title">${getIcon('chart-donut', 18, 'expenses-chart-title-icon')} ${esc(t('expenses.chartByCategory'))}</h2>
                <div class="expenses-chart-body"><canvas data-chart="by-category" aria-label="${esc(t('expenses.chartByCategory'))}"></canvas></div>
              </article>
              <article class="expenses-chart-card">
                <h2 class="expenses-chart-title">${getIcon('chart-bar', 18, 'expenses-chart-title-icon')} ${esc(t('expenses.chartMonthlyTrend'))}</h2>
                <div class="expenses-chart-body"><canvas data-chart="monthly" aria-label="${esc(t('expenses.chartMonthlyTrend'))}"></canvas></div>
              </article>
            </div>
          </div>

          <div class="expenses-records card">
            <div class="expenses-records-toolbar">
              <div class="expenses-records-toolbar-left">
                <span class="expenses-records-icon" aria-hidden="true">${getIcon('layout-grid', 20)}</span>
                <h2 class="expenses-records-title">${esc(t('expenses.recordsTitle'))}</h2>
              </div>
              <div class="expenses-records-toolbar-right">
                <input class="input expenses-input-compact" type="date" name="startDate" aria-label="${esc(t('expenses.filterStartDate'))}" />
                <input class="input expenses-input-compact" type="date" name="endDate" aria-label="${esc(t('expenses.filterEndDate'))}" />
                <select class="select expenses-select-compact" name="category" aria-label="${esc(t('expenses.category'))}">
                  <option value="">${esc(t('common.all'))}</option>${catOptions}
                </select>
                <select class="select expenses-select-compact" name="platformId" aria-label="${esc(t('expenses.platformAssignment'))}">
                  <option value="">${esc(t('common.all'))}</option>${platformOptions}
                </select>
                <input class="input expenses-search" type="search" name="search" placeholder="${esc(t('expenses.searchPlaceholder'))}" autocomplete="off" />
                <label class="expenses-page-size">
                  <span class="sr-only">${esc(t('expenses.rowsPerPage'))}</span>
                  <select class="select expenses-select-compact" name="pageSize" aria-label="${esc(t('expenses.rowsPerPage'))}">
                    <option value="10">${esc(t('expenses.rowsOption').replace('{n}', '10'))}</option>
                    <option value="15" selected>${esc(t('expenses.rowsOption').replace('{n}', '15'))}</option>
                    <option value="25">${esc(t('expenses.rowsOption').replace('{n}', '25'))}</option>
                    <option value="50">${esc(t('expenses.rowsOption').replace('{n}', '50'))}</option>
                  </select>
                </label>
                <button type="button" class="btn btn-secondary btn-sm" data-action="reset-filters">${esc(t('expenses.resetFilters'))}</button>
              </div>
            </div>
            <details class="expenses-more-filters">
              <summary>${esc(t('expenses.moreFilters'))}</summary>
              <div class="expenses-more-filters-grid">
                <label class="field"><span class="field-label">${esc(t('expenses.minAmount'))}</span><input class="input" type="number" step="0.01" min="0" name="minAmount" /></label>
                <label class="field"><span class="field-label">${esc(t('expenses.maxAmount'))}</span><input class="input" type="number" step="0.01" min="0" name="maxAmount" /></label>
                <label class="toggle"><input type="checkbox" name="receiptOnly" /><span class="toggle-track"><span class="toggle-thumb"></span></span><span>${esc(t('expenses.receiptOnly'))}</span></label>
              </div>
            </details>
            <div class="expenses-list-wrap">
              <table class="expenses-table expenses-table--records">
                <thead>
                  <tr>
                    <th scope="col"><button type="button" class="expenses-th-sort" data-sort-col="date" aria-label="${esc(t('expenses.sortAria').replace('{column}', t('expenses.date')))}">${esc(t('expenses.date'))}<span class="expenses-sort-ind" aria-hidden="true"></span></button></th>
                    <th scope="col"><button type="button" class="expenses-th-sort" data-sort-col="category" aria-label="${esc(t('expenses.sortAria').replace('{column}', t('expenses.category')))}">${esc(t('expenses.category'))}<span class="expenses-sort-ind" aria-hidden="true"></span></button></th>
                    <th scope="col"><button type="button" class="expenses-th-sort" data-sort-col="description" aria-label="${esc(t('expenses.sortAria').replace('{column}', t('expenses.columnDescription')))}">${esc(t('expenses.columnDescription'))}<span class="expenses-sort-ind" aria-hidden="true"></span></button></th>
                    <th scope="col"><button type="button" class="expenses-th-sort" data-sort-col="amount" aria-label="${esc(t('expenses.sortAria').replace('{column}', t('expenses.amount')))}">${esc(t('expenses.amount'))}<span class="expenses-sort-ind" aria-hidden="true"></span></button></th>
                    <th scope="col">${esc(t('expenses.receipt'))}</th>
                    <th scope="col">${esc(t('expenses.notes'))}</th>
                    <th scope="col" class="expenses-th-actions">${esc(t('expenses.columnActions'))}</th>
                  </tr>
                </thead>
                <tbody data-slot="rows"></tbody>
              </table>
            </div>
            <footer class="expenses-records-footer">
              <span class="expenses-page-meta" data-slot="page-meta"></span>
              <div class="expenses-page-nav">
                <button type="button" class="btn btn-secondary btn-sm" data-action="page-prev">${esc(t('expenses.previousPage'))}</button>
                <button type="button" class="btn btn-secondary btn-sm" data-action="page-next">${esc(t('expenses.nextPage'))}</button>
              </div>
            </footer>
          </div>
        </div>

        <div class="expenses-panel" data-panel="category" role="tabpanel" hidden>
          <p class="expenses-panel-hint">${esc(t('expenses.byCategoryHint'))}</p>
          <div class="expenses-list-wrap">
            <table class="expenses-table expenses-table--compact">
              <thead><tr>
                <th>${esc(t('expenses.category'))}</th>
                <th>${esc(t('expenses.categoryTotalHeader'))}</th>
              </tr></thead>
              <tbody data-slot="category-rows"></tbody>
            </table>
          </div>
        </div>

        <div class="expenses-panel" data-panel="recurring" role="tabpanel" hidden>
          <p class="expenses-panel-hint">${esc(t('expenses.recurringPanelHint'))}</p>
          <div class="expenses-list-wrap">
            <table class="expenses-table expenses-table--compact">
              <thead><tr>
                <th>${esc(t('expenses.category'))}</th>
                <th>${esc(t('expenses.recurringNextDue'))}</th>
                <th>${esc(t('expenses.recurringInterval'))}</th>
                <th>${esc(t('expenses.recurringAmount'))}</th>
                <th>${esc(t('expenses.platformAssignment'))}</th>
              </tr></thead>
              <tbody data-slot="recurring-rows"></tbody>
            </table>
          </div>
        </div>

        <div class="expenses-panel" data-panel="deductions" role="tabpanel" hidden>
          <div class="card expenses-deductions-card">
            <h2 class="expenses-deductions-title">${esc(t('expenses.deductionsTitle'))}</h2>
            <p class="expenses-deductions-lead">${esc(t('expenses.deductionsLead'))}</p>
            <a class="btn btn-primary" href="#/tax">${esc(t('expenses.deductionsGoTax'))}</a>
          </div>
        </div>
      </div>
    </section>
  `;

  const rowsSlot = root.querySelector('[data-panel="all"] [data-slot="rows"]');
  const categoryRowsSlot = root.querySelector('[data-slot="category-rows"]');
  const recurringRowsSlot = root.querySelector('[data-slot="recurring-rows"]');
  const pageMetaSlot = root.querySelector('[data-slot="page-meta"]');
  const prevBtn = root.querySelector('[data-action="page-prev"]');
  const nextBtn = root.querySelector('[data-action="page-next"]');

  /** @type {{ key: string; dir: 'asc' | 'desc' }} */
  let sortState = { key: 'date', dir: 'desc' };
  let page = 1;

  const controls = {
    startDate: root.querySelector('[name="startDate"]'),
    endDate: root.querySelector('[name="endDate"]'),
    category: root.querySelector('[name="category"]'),
    platformId: root.querySelector('[name="platformId"]'),
    minAmount: root.querySelector('[name="minAmount"]'),
    maxAmount: root.querySelector('[name="maxAmount"]'),
    receiptOnly: root.querySelector('[name="receiptOnly"]'),
    search: root.querySelector('[name="search"]'),
    pageSize: root.querySelector('[name="pageSize"]'),
  };

  function listFilterPayload() {
    return {
      startDate: controls.startDate?.value || '',
      endDate: controls.endDate?.value || '',
      category: controls.category?.value || '',
      platformId: controls.platformId?.value || '',
      minAmount: controls.minAmount?.value || null,
      maxAmount: controls.maxAmount?.value || null,
      receiptOnly: Boolean(controls.receiptOnly?.checked),
    };
  }

  function syncSortHeaders() {
    for (const btn of root.querySelectorAll('.expenses-th-sort')) {
      const col = btn.getAttribute('data-sort-col');
      const ind = btn.querySelector('.expenses-sort-ind');
      const active = col === sortState.key;
      btn.classList.toggle('is-active', active);
      if (ind) ind.textContent = active ? (sortState.dir === 'asc' ? '↑' : '↓') : '';
    }
  }

  function paintKpiAndCharts(rows) {
    const totalCents = rows.reduce((acc, r) => acc + num(r.amount) * (num(r.businessPct, 100) / 100), 0);
    const kTotal = root.querySelector('[data-kpi="total"]');
    const kCount = root.querySelector('[data-kpi="count"]');
    const kAvg = root.querySelector('[data-kpi="avg"]');
    const kCats = root.querySelector('[data-kpi="categories"]');
    if (kTotal) kTotal.textContent = fmtMoney(totalCents);
    if (kCount) kCount.textContent = String(rows.length);
    if (kAvg) kAvg.textContent = rows.length ? fmtMoney(totalCents / rows.length) : fmtMoney(0);
    if (kCats) kCats.textContent = String(new Set(rows.map((r) => String(r.category || 'other'))).size);

    const catCanvas = /** @type {HTMLCanvasElement | null} */ (root.querySelector('[data-chart="by-category"]'));
    const moCanvas = /** @type {HTMLCanvasElement | null} */ (root.querySelector('[data-chart="monthly"]'));
    destroyChart(catCanvas);
    destroyChart(moCanvas);
    const loc = typeof navigator !== 'undefined' ? navigator.language : 'en';

    const byCat = new Map();
    for (const row of rows) {
      const id = String(row.category || 'other');
      const amt = num(row.amount) * (num(row.businessPct, 100) / 100);
      byCat.set(id, (byCat.get(id) || 0) + amt);
    }
    const entries = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
    if (entries.length && catCanvas) {
      const labels = entries.map(([id]) => categoryLabel({ category: id }));
      const dataVals = entries.map(([, cents]) => Math.round(cents) / 100);
      const colors = entries.map((_, i) => EXPENSE_CHART_COLORS[i % EXPENSE_CHART_COLORS.length]);
      renderDonutChart(
        catCanvas,
        {
          labels,
          datasets: [{ data: dataVals, backgroundColor: colors, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' }],
        },
        { plugins: { legend: { position: 'bottom' } } },
      );
    }

    const byMonth = new Map();
    for (const row of rows) {
      const ym = String(row.date || '').slice(0, 7);
      if (ym.length !== 7) continue;
      const amt = num(row.amount) * (num(row.businessPct, 100) / 100);
      byMonth.set(ym, (byMonth.get(ym) || 0) + amt);
    }
    const monthKeys = [...byMonth.keys()].sort();
    const lastKeys = monthKeys.slice(-12);
    if (lastKeys.length && moCanvas) {
      const labels = lastKeys.map((k) => formatChartMonthLabel(k, loc));
      const data = lastKeys.map((k) => Math.round(byMonth.get(k) || 0) / 100);
      renderBarChart(
        moCanvas,
        {
          labels,
          datasets: [
            {
              label: t('expenses.amount'),
              data,
              backgroundColor: 'color-mix(in srgb, var(--color-brand) 50%, var(--color-surface-raised))',
              borderRadius: 6,
            },
          ],
        },
        { scales: { x: { grid: { display: false } }, y: { beginAtZero: true } } },
      );
    }
  }

  function recurringIntervalLabel(iv) {
    const x = String(iv || 'monthly');
    if (x === 'weekly') return t('expenses.recurringWeekly');
    if (x === 'annual') return t('expenses.recurringAnnual');
    return t('expenses.recurringMonthly');
  }

  function setExpenseTab(tab) {
    for (const btn of root.querySelectorAll('[data-action="expense-tab"]')) {
      const v = btn.getAttribute('data-tab');
      const on = v === tab;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    }
    for (const panel of root.querySelectorAll('.expenses-panel[data-panel]')) {
      const id = panel.getAttribute('data-panel');
      panel.hidden = id !== tab;
    }
  }

  async function refreshRows() {
    const rows = await listExpenses(listFilterPayload(), sortState);
    paintKpiAndCharts(rows);
    syncSortHeaders();

    const q = String(controls.search?.value || '').trim().toLowerCase();
    const searched = rows.filter((r) => expenseRowMatchesSearch(r, q));
    const total = searched.length;
    const pageSize = Math.max(1, Math.min(100, Number(controls.pageSize?.value) || 15));
    const pages = Math.max(1, Math.ceil(total / pageSize));
    if (page > pages) page = pages;
    if (page < 1) page = 1;
    const start = (page - 1) * pageSize;
    const slice = searched.slice(start, start + pageSize);

    if (pageMetaSlot) {
      pageMetaSlot.textContent = t('expenses.pageInfo')
        .replace('{page}', String(page))
        .replace('{pages}', String(pages))
        .replace('{total}', String(total));
    }
    if (prevBtn) prevBtn.disabled = page <= 1;
    if (nextBtn) nextBtn.disabled = page >= pages;

    if (!rowsSlot) return;

    if (!total) {
      rowsSlot.innerHTML = `<tr><td colspan="7">${renderEmptyState({
        title: t('expenses.emptyTitle'),
        message: t('expenses.emptyMessage'),
      })}</td></tr>`;
      return;
    }

    const totalsCents = searched.reduce((acc, r) => acc + num(r.amount) * (num(r.businessPct, 100) / 100), 0);
    const rowsHtml = slice
      .map((row) => {
        const amt = num(row.amount) * (num(row.businessPct, 100) / 100);
        const tone = categoryPillTone(row.category);
        const desc = expenseDescriptionCell(row);
        const notes = expenseNotesCell(row);
        return `<tr data-expense-id="${esc(row.id)}">
          <td>${esc(row.date)}</td>
          <td><span class="expenses-cat-pill expenses-cat-pill--${tone}">${esc(categoryLabel(row))}</span></td>
          <td>${esc(desc)}</td>
          <td class="expenses-amount-cell"><strong>${esc(fmtMoney(amt))}</strong></td>
          <td>${row.receiptData ? '📷' : '—'}</td>
          <td class="expenses-notes-cell">${esc(notes)}</td>
          <td class="expenses-row-actions">
            <button type="button" class="expenses-icon-btn expenses-icon-btn--edit" data-action="edit" aria-label="${esc(t('common.edit'))}">${getIcon('edit', 16)}</button>
            <button type="button" class="expenses-icon-btn expenses-icon-btn--delete" data-action="delete" aria-label="${esc(t('common.delete'))}">${getIcon('trash', 16)}</button>
          </td>
        </tr>`;
      })
      .join('');
    const totalsRow = `<tr class="expenses-totals-row">
      <td colspan="3"><strong>${esc(t('expenses.totalsLabel'))}</strong></td>
      <td><strong>${esc(fmtMoney(totalsCents))}</strong></td>
      <td colspan="2">${esc(t('expenses.totalsExpensesCount').replace('{n}', String(total)))}</td>
      <td></td>
    </tr>`;
    rowsSlot.innerHTML = rowsHtml + totalsRow;
  }

  async function refreshCategoryRows() {
    if (!categoryRowsSlot) return;
    const rows = await listExpenses(listFilterPayload(), { key: 'category', dir: 'asc' });
    /** @type {Map<string, number>} */
    const totals = new Map();
    for (const row of rows) {
      const key = String(row.category || 'other');
      const amt = num(row.amount) * (num(row.businessPct, 100) / 100);
      totals.set(key, (totals.get(key) || 0) + amt);
    }
    const entries = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    if (!entries.length) {
      categoryRowsSlot.innerHTML = `<tr><td colspan="2">${renderEmptyState({
        title: t('expenses.emptyTitle'),
        message: t('expenses.emptyMessage'),
      })}</td></tr>`;
      return;
    }
    categoryRowsSlot.innerHTML = entries
      .map(([catId, cents]) => {
        const labelRow = { category: catId };
        return `<tr>
          <td>${esc(categoryLabel(labelRow))}</td>
          <td>${esc(fmtMoney(cents))}</td>
        </tr>`;
      })
      .join('');
  }

  async function refreshRecurringRows() {
    if (!recurringRowsSlot) return;
    const rows = await db.expenses
      .filter((e) => e.deletedAt == null && e.isRecurring === true)
      .toArray();
    rows.sort((a, b) => String(a.recurringNextDate || '').localeCompare(String(b.recurringNextDate || '')));
    if (!rows.length) {
      recurringRowsSlot.innerHTML = `<tr><td colspan="5">${renderEmptyState({
        title: t('expenses.emptyTitle'),
        message: t('expenses.emptyMessage'),
      })}</td></tr>`;
      return;
    }
    recurringRowsSlot.innerHTML = rows
      .map((row) => {
        const platformLabel = row.platformId ? String(row.platformId) : t('app.platformAll');
        return `<tr>
          <td>${esc(categoryLabel(row))}</td>
          <td>${esc(String(row.recurringNextDate || '—'))}</td>
          <td>${esc(recurringIntervalLabel(row.recurringInterval))}</td>
          <td>${esc(fmtMoney(num(row.amount)))}</td>
          <td>${esc(platformLabel)}</td>
        </tr>`;
      })
      .join('');
  }

  async function refreshAllPanels() {
    await refreshRows();
    await refreshCategoryRows();
    await refreshRecurringRows();
  }

  const ac = new AbortController();
  const { signal } = ac;

  const onFilterInput = () => {
    page = 1;
    void refreshAllPanels();
  };

  root.addEventListener('input', onFilterInput, { signal });
  root.addEventListener('change', onFilterInput, { signal });

  root.addEventListener(
    'click',
    async (e) => {
      const sortBtn = e.target instanceof HTMLElement ? e.target.closest('.expenses-th-sort[data-sort-col]') : null;
      if (sortBtn && root.contains(sortBtn)) {
        const col = sortBtn.getAttribute('data-sort-col');
        if (col === 'date' || col === 'category' || col === 'description' || col === 'amount') {
          if (sortState.key === col) sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
          else {
            sortState.key = col;
            sortState.dir = col === 'category' || col === 'description' ? 'asc' : 'desc';
          }
          page = 1;
          void refreshAllPanels();
        }
        return;
      }

      const tabBtn = e.target instanceof HTMLElement ? e.target.closest('[data-action="expense-tab"]') : null;
      if (tabBtn) {
        const tab = tabBtn.getAttribute('data-tab');
        if (tab) setExpenseTab(tab);
        return;
      }

      const target = e.target instanceof HTMLElement ? e.target.closest('[data-action]') : null;
      if (!target || !root.contains(target)) return;
      const action = target.getAttribute('data-action');

      if (action === 'page-prev') {
        page = Math.max(1, page - 1);
        void refreshAllPanels();
        return;
      }
      if (action === 'page-next') {
        page += 1;
        void refreshAllPanels();
        return;
      }
      if (action === 'reset-filters') {
        if (controls.startDate) controls.startDate.value = '';
        if (controls.endDate) controls.endDate.value = '';
        if (controls.category) controls.category.value = '';
        if (controls.platformId) controls.platformId.value = '';
        if (controls.minAmount) controls.minAmount.value = '';
        if (controls.maxAmount) controls.maxAmount.value = '';
        if (controls.receiptOnly) controls.receiptOnly.checked = false;
        if (controls.search) controls.search.value = '';
        if (controls.pageSize) controls.pageSize.value = '15';
        sortState = { key: 'date', dir: 'desc' };
        page = 1;
        void refreshAllPanels();
        return;
      }

      if (action === 'new-expense') {
        await openExpenseEditor({
          categories,
          platformRows,
          isHstRegistered: Boolean(user?.hstRegistered),
          currencySymbol: user?.locale?.currencySymbol || '$',
          onSave: saveExpense,
        });
        await refreshAllPanels();
        return;
      }

      const rowEl = target.closest('[data-expense-id]');
      const id = Number(rowEl?.getAttribute('data-expense-id'));
      if (!Number.isFinite(id) || id <= 0) return;
      if (action === 'edit') {
        const row = await db.expenses.get(id);
        if (!row) return;
        await openExpenseEditor({
          initial: row,
          categories,
          platformRows,
          isHstRegistered: Boolean(user?.hstRegistered),
          currencySymbol: user?.locale?.currencySymbol || '$',
          onSave: async (payload) => updateExpense(id, payload),
        });
        await refreshAllPanels();
      }
      if (action === 'delete') {
        await deleteExpense(id);
        showToast({ type: 'success', message: t('expenses.deletedToast'), duration: 1800 });
        await refreshAllPanels();
      }
    },
    { signal },
  );

  const offExpenseSaved = bus.on(EXPENSE_SAVED, () => {
    void refreshAllPanels();
  });

  await refreshAllPanels();

  return () => {
    destroyChart(/** @type {HTMLCanvasElement | null} */ (root.querySelector('[data-chart="by-category"]')));
    destroyChart(/** @type {HTMLCanvasElement | null} */ (root.querySelector('[data-chart="monthly"]')));
    ac.abort();
    offExpenseSaved();
  };
}

/** Log one recurring payment from the confirmation flow (editable amount). */
async function openRecurringOccurrenceEditor({ template, categories, platformRows, user, onDone }) {
  const nextDate = String(template.recurringNextDate);
  const formApi = renderExpenseForm({
    initial: {
      category: template.category,
      customCategory: template.customCategory,
      amount: num(template.amount),
      date: nextDate,
      platformId: template.platformId,
      businessPct: num(template.businessPct, 100),
      notes: String(template.notes || ''),
      receiptData: template.receiptData,
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
  const handle = showModal({
    title: t('expenses.recurringEditTitle'),
    content: formApi.el,
    actions: [],
  });
  const form = formApi.el.querySelector('form');
  if (!form) return;
  await new Promise((resolve) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await createRecurringOccurrenceAndAdvance(template, formApi.getValue());
      onDone?.();
      handle.close();
      resolve(null);
    });
    form.addEventListener('reset', () => resolve(null), { once: true });
  });
}

async function openExpenseEditor({ initial = {}, categories, platformRows, isHstRegistered, currencySymbol, onSave }) {
  const formApi = renderExpenseForm({
    initial,
    categories,
    platforms: platformRows,
    isHstRegistered,
    currencySymbol,
    onCancel: () => handle.close(),
  });
  const handle = showModal({
    title: initial.id ? t('expenses.editTitle') : t('expenses.add'),
    content: formApi.el,
    actions: [],
  });
  const form = formApi.el.querySelector('form');
  if (!form) return;
  await new Promise((resolve) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await onSave(formApi.getValue());
      showToast({ type: 'success', message: t('expenses.savedToast'), duration: 1800 });
      handle.close();
      resolve(null);
    });
    form.addEventListener('reset', () => resolve(null), { once: true });
  });
}
