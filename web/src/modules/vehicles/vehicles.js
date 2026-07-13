import { db } from '../../core/db.js';
import { bus, EXPENSE_SAVED, VEHICLE_FILTER_CHANGED } from '../../core/events.js';
import { store } from '../../core/store.js';
import { calcDepreciation, calcVehicleCostPerKm } from '../../utils/calculations.js';
import { t } from '../../utils/strings.js';
import { filterIds, filterLabel, pruneFilter, toggleFilter } from '../../utils/filters.js';
import { renderEmptyState, showModal, showToast, closeModal } from '../../ui/components.js';
import { getIcon } from '../../ui/icons.js';
import { newId } from '../../core/id.js';

const APP_STATE_ODOMETER_KEY = 'vehicle_odometer_logs';

function nowIso() {
  return new Date().toISOString();
}

function ymd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Province / region id for auto-created vehicle expenses (align with user market). */
function provinceIdForExpenseFromUser() {
  const u = store.get('user');
  if (!u || typeof u !== 'object') return 'ON';
  const rec = /** @type {Record<string, unknown>} */ (u);
  const cid =
    typeof rec.countryId === 'string' && rec.countryId
      ? String(rec.countryId).toUpperCase()
      : typeof /** @type {{ country?: unknown }} */ (rec.locale)?.country === 'string'
        ? String(rec.locale.country).toUpperCase()
        : 'CA';
  const rawPid = typeof rec.provinceId === 'string' ? rec.provinceId.trim().toUpperCase() : '';
  if (cid === 'CA') return rawPid || 'ON';
  return rawPid;
}

function money(v) {
  const sym = store.get('user')?.locale?.currencySymbol || '$';
  return `${sym}${num(v).toFixed(2)}`;
}

function fixed(v, decimals = 1) {
  return num(v).toFixed(decimals);
}

/**
 * @param {Record<string, unknown>} input
 */
export function normalizeVehicleInput(input) {
  const ts = nowIso();
  const type = String(input.type || 'gas').toLowerCase();
  const nickname = String(input.nickname || '').trim() || 'Vehicle';
  const active = input.active !== false;
  return {
    // Fix 2 (interop plan) — client-generated string primary key (see core/id.js). Preserve an
    // incoming string id (editing an existing vehicle) rather than minting a new one.
    id: typeof input.id === 'string' && input.id ? input.id : newId('veh'),
    nickname,
    // Mobile-canonical mirrors (2026-07-03 interop audit): mobile's `vehicles.name` is NOT NULL
    // and its active flag is `isActive` — without these keys a web-created vehicle crashed
    // mobile's sync apply, and web vehicles rendered blank/inactive on mobile.
    name: nickname,
    isActive: active,
    type,
    make: String(input.make || '').trim(),
    model: String(input.model || '').trim(),
    year: Number.isFinite(Number(input.year)) ? Number(input.year) : null,
    fuelEfficiency: Math.max(0, num(input.fuelEfficiency, 0)),
    currentFuelPrice: Math.max(0, num(input.currentFuelPrice, 0)),
    kwPer100km: Math.max(0, num(input.kwPer100km, 0)),
    electricityRate: Math.max(0, num(input.electricityRate, 0)),
    maintenanceCostPerKm: Math.max(0, num(input.maintenanceCostPerKm, 0)),
    purchasePrice: Math.max(0, num(input.purchasePrice, 0)),
    expectedLifespanKm: Math.max(0, num(input.expectedLifespanKm, 0)),
    estimatedAnnualKm: Math.max(1, num(input.estimatedAnnualKm, 20000)),
    active,
    updatedAt: ts,
    createdAt: typeof input.createdAt === 'string' ? input.createdAt : ts,
    insuranceRenewalDate: String(input.insuranceRenewalDate || ''),
    insuranceAmount: Math.max(0, num(input.insuranceAmount, 0)),
    registrationRenewalDate: String(input.registrationRenewalDate || ''),
    registrationAmount: Math.max(0, num(input.registrationAmount, 0)),
    oilChangeIntervalKm: Math.max(0, num(input.oilChangeIntervalKm, 8000)),
    lastOilChangeOdometerKm: Math.max(0, num(input.lastOilChangeOdometerKm, 0)),
    tireTreadMm: Math.max(0, num(input.tireTreadMm, 7)),
    tireTreadMinMm: Math.max(0, num(input.tireTreadMinMm, 3)),
    totalKmLogged: Math.max(0, num(input.totalKmLogged, 0)),
    fuelType: input.fuelType != null && String(input.fuelType).trim() !== '' ? String(input.fuelType).trim() : null,
    licensePlate: String(input.licensePlate || '').trim(),
    currentOdometer: Math.max(0, num(input.currentOdometer, 0)),
    syncUpdatedAt: Date.now(),
    syncDeletedAt: input.syncDeletedAt ?? null,
  };
}

/** @param {Record<string, unknown>} row */
function vehicleLabel(row) {
  const bits = [row.nickname || '', row.make || '', row.model || '', row.year || ''].filter(Boolean);
  return bits.join(' ').trim() || 'Vehicle';
}

async function getOdometerLog() {
  const row = await db.appState.get(APP_STATE_ODOMETER_KEY);
  try {
    const parsed = row?.value ? JSON.parse(row.value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function putOdometerLog(items) {
  await db.appState.put({
    key: APP_STATE_ODOMETER_KEY,
    value: JSON.stringify(items),
    updatedAt: nowIso(),
  });
}

function calcVehicleStats(vehicle, expenses, maintenanceRows, shifts) {
  const annualExpenses =
    expenses.reduce((sum, e) => sum + num(e.amount) * (num(e.deductiblePct, 100) / 100), 0) +
    maintenanceRows.reduce((sum, m) => sum + num(m.cost), 0);
  const costPerKm = calcVehicleCostPerKm(
    { estimatedAnnualKm: Math.max(1, num(vehicle.estimatedAnnualKm, vehicle.totalKmLogged || 1)) },
    { totalAnnual: annualExpenses },
  );
  const depreciation = calcDepreciation(vehicle.purchasePrice, vehicle.expectedLifespanKm, vehicle.totalKmLogged);
  const shiftKm = shifts.reduce((sum, s) => sum + num(s.activeMileage), 0);
  const shiftCount = shifts.length;
  return { annualExpenses, costPerKm, depreciation, shiftKm, shiftCount };
}

/** Call once after `initDatabase` + initial `store.loadFromDB`, mirrors initPlatforms(). */
export async function initVehicles() {
  await store.refresh('vehicles');
}

async function listVehicles() {
  const rows = await db.vehicles.toArray();
  // ids are opaque client-generated strings (Fix 2 — interop plan), not sortable numbers —
  // sort by createdAt (ISO string) instead, preserving insertion order.
  return rows
    .filter((v) => v.active !== false && v.syncDeletedAt == null)
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
}

// ── Vehicle filter switcher (header) ────────────────────────────────────────
// Mirrors the platform switcher (modules/platforms/platforms.js) — same tabs/dropdown modes, same
// slot-mount pattern, and the same all/subset/one selection the phone app uses (see utils/filters.js).
// No drag-reorder, no swipe-to-cycle — those are platform-specific polish nobody asked for here.

/**
 * @param {'tabs'|'dropdown'} mode
 * @param {{ activeRows: any[]; selectedId: string }} opts
 * @returns {string}
 */
function renderVehicleSwitcher(mode, opts) {
  const { activeRows, selectedId } = opts;
  const truckIcon = getIcon('truck', 13);

  if (mode === 'dropdown') {
    const label = filterLabel(
      selectedId,
      (id) => {
        const v = activeRows.find((x) => String(x.id) === id);
        return v ? vehicleLabel(v) : id;
      },
      String(t('app.vehicleAll')),
    );

    return `<div class="platform-switcher platform-switcher--dropdown vehicle-switcher" style="--platform-color:var(--color-brand)">
      <button type="button" class="platform-switcher-trigger" aria-haspopup="listbox" aria-label="${esc(
        t('vehicles.switcher') || 'Vehicle filter',
      )}">
        <span class="platform-switcher-trigger-logo">${truckIcon}</span>
        <span class="platform-switcher-trigger-text">${esc(label)}</span>
        <svg class="platform-switcher-trigger-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </button>
    </div>`;
  }

  const allLabel = String(t('app.vehicleAll'));
  const allInner = `<span class="platform-tab-inner"><span class="platform-tab-logo" aria-hidden="true">${truckIcon}</span><span class="platform-tab-label">${esc(allLabel)}</span></span>`;

  const selectedSet = new Set(filterIds(selectedId));

  const tabs = [
    `<button type="button" class="platform-tab platform-tab--fixed platform-tab--has-logo" data-vehicle-tab-id="all" aria-selected="${selectedSet.size === 0 ? 'true' : 'false'}">${allInner}</button>`,
    ...activeRows.map((v) => {
      const id = String(v.id);
      const label = vehicleLabel(v);
      const sel = selectedSet.has(id) ? 'true' : 'false';
      const inner = `<span class="platform-tab-inner"><span class="platform-tab-logo" aria-hidden="true">${truckIcon}</span><span class="platform-tab-label">${esc(label)}</span></span>`;
      return `<button type="button" class="platform-tab platform-tab--has-logo" data-vehicle-tab-id="${esc(id)}" aria-selected="${sel}">${inner}</button>`;
    }),
  ];
  return `<div class="platform-switcher platform-switcher--tabs vehicle-switcher" role="tablist" style="--platform-color:var(--color-brand)" aria-label="${esc(
    t('vehicles.switcher') || 'Vehicle filter',
  )}">${tabs.join('')}</div>`;
}

/** @type {WeakMap<HTMLElement, () => void>} */
const vehicleSwitcherTeardown = new WeakMap();

/**
 * Mount header vehicle switcher into `slot` (re-renders on store/bus). Hidden entirely when
 * there are 0 or 1 vehicles — nothing to filter.
 * @param {HTMLElement | null} slot
 */
export function mountVehicleSwitcher(slot) {
  if (!slot) return;

  const prev = vehicleSwitcherTeardown.get(slot);
  if (typeof prev === 'function') prev();

  const onDocClick = (e) => {
    const tablist = slot.querySelector('.vehicle-switcher.platform-switcher--tabs');
    if (!tablist || !tablist.classList.contains('is-expanded')) return;
    if (!tablist.contains(/** @type {Node} */ (e.target))) {
      tablist.classList.remove('is-expanded');
    }
  };
  if (typeof document !== 'undefined') {
    document.addEventListener('click', onDocClick);
  }

  const render = async () => {
    const user = store.get('user');
    const modeRaw = user && typeof user.platformSwitcherMode === 'string' ? user.platformSwitcherMode : 'tabs';
    const displayMode = modeRaw === 'dropdown' ? 'dropdown' : 'tabs';
    const activeRows = /** @type {any[]} */ (store.get('vehicles') || []);

    if (activeRows.length <= 1) {
      slot.innerHTML = '';
      slot.hidden = true;
      return;
    }

    slot.hidden = false;

    const ids = new Set(activeRows.map((r) => String(r.id)));
    const count = activeRows.length;
    // An archived vehicle must not linger in the filter and silently hide every shift.
    const selectedId = pruneFilter(store.get('activeVehicleId'), ids);

    slot.innerHTML = renderVehicleSwitcher(displayMode, { activeRows, selectedId });

    const applySelectionVisual = (filter) => {
      const set = new Set(filterIds(filter));
      slot.querySelectorAll('.platform-tab').forEach((el) => {
        const vid = String(el.getAttribute('data-vehicle-tab-id'));
        const on = vid === 'all' ? set.size === 0 : set.has(vid);
        el.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    };

    /**
     * All / subset / one, same rule as the platform switcher and the phone app: tap to add, tap
     * again to remove, at most `count - 1` at once.
     * @returns {string} the filter that was applied
     */
    const setFilter = (id) => {
      const current = String(store.get('activeVehicleId') ?? 'all');
      if (id !== 'all' && !ids.has(id)) return current;
      const next = toggleFilter(current, id, count);
      applySelectionVisual(next);
      store.set('activeVehicleId', next);
      bus.emit(VEHICLE_FILTER_CHANGED, { vehicleId: next, source: 'switcher' });
      return next;
    };

    if (displayMode === 'dropdown') {
      const trigger = slot.querySelector('.platform-switcher-trigger');
      if (trigger) {
        trigger.addEventListener('click', () => {
          showVehicleSelectionModal(activeRows, selectedId, setFilter);
        });
      }
      return;
    }

    const tablist = slot.querySelector('.vehicle-switcher.platform-switcher--tabs');
    if (tablist) {
      tablist.addEventListener('click', (e) => {
        const tEl = /** @type {HTMLElement | null} */ (e.target && /** @type {HTMLElement} */ (e.target).closest('[data-vehicle-tab-id]'));

        if (!tablist.classList.contains('is-expanded')) {
          tablist.classList.add('is-expanded');
          return;
        }

        if (tEl) {
          const id = tEl.getAttribute('data-vehicle-tab-id');
          if (id) {
            // Stay open while a subset is still being assembled — collapsing on the first tap
            // would make picking a second vehicle impossible.
            const chosen = filterIds(setFilter(id));
            const maxAllowed = Math.max(1, count - 1);
            if (chosen.length === 0) {
              tablist.classList.remove('is-expanded');
            } else if (chosen.length >= maxAllowed) {
              setTimeout(() => tablist.classList.remove('is-expanded'), 500);
            }
          }
        } else {
          tablist.classList.remove('is-expanded');
        }
      });
    }
  };

  const run = (payload) => {
    if (payload && payload.source === 'switcher') return;
    void render();
  };

  run();
  store.subscribe('vehicles', run);
  const off = bus.on(VEHICLE_FILTER_CHANGED, run);

  const teardown = () => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('click', onDocClick);
    }
    off();
    store.unsubscribe('vehicles', run);
    slot.innerHTML = '';
  };
  vehicleSwitcherTeardown.set(slot, teardown);
}

/**
 * @param {any[]} activeRows
 * @param {string} currentId
 * @param {(id: string) => void} onSelect
 */
function showVehicleSelectionModal(activeRows, currentId, onSelect) {
  const wrap = document.createElement('div');
  wrap.className = 'platform-selection-list';

  const items = [{ id: 'all', label: t('app.vehicleAll') }, ...activeRows.map((v) => ({ id: String(v.id), label: vehicleLabel(v) }))];

  // `currentId` is a filter (possibly a comma-joined subset), so a row is ticked when it is a
  // member of it — and the 'All' row when nothing is selected.
  const selected = new Set(filterIds(currentId));
  const isOn = (id) => (id === 'all' ? selected.size === 0 : selected.has(id));

  for (const item of items) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'platform-selection-item';
    btn.dataset.vehicleId = item.id;
    btn.setAttribute('aria-selected', isOn(item.id) ? 'true' : 'false');

    btn.innerHTML = `
      <span class="platform-selection-item-logo">${getIcon('truck', 14)}</span>
      <span class="platform-selection-item-name">${esc(item.label)}</span>
      ${isOn(item.id) ? '<svg class="platform-selection-item-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>' : ''}
    `;

    btn.addEventListener('click', () => {
      onSelect(item.id);
      closeModal();
    });
    wrap.appendChild(btn);
  }

  showModal({
    title: t('vehicles.switcher') || 'Vehicle filter',
    content: wrap,
    size: 'sm',
  });
}

async function syncRecurringExpense(vehicleId, kind, date, amount) {
  if (!date || amount <= 0) return;
  const cat = kind === 'insurance' ? 'insurance' : 'licensing';
  const existing = await db.expenses
    .filter(
      (e) =>
        e.deletedAt == null &&
        e.source === `vehicle_${kind}` &&
        String(e.date || '') === date &&
        String(e.category || '') === cat &&
        String(e.vehicleId || '') === String(vehicleId),
    )
    .first();
  if (existing) return;
  await db.expenses.add({
    id: newId('exp'),
    category: cat,
    customCategory: '',
    amount: Math.max(0, num(amount)),
    deductiblePct: 100,
    date,
    platformId: null,
    notes: `Auto-created from vehicle ${kind} renewal`,
    receiptData: null,
    isRecurring: true,
    recurringInterval: 'annual',
    recurringNextDate: date,
    hstPaid: 0,
    provinceId: provinceIdForExpenseFromUser(),
    deletedAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    source: `vehicle_${kind}`,
    shiftId: null,
    vehicleId: String(vehicleId),
    syncUpdatedAt: Date.now(),
    syncDeletedAt: null,
  });
  bus.emit(EXPENSE_SAVED, { source: `vehicle_${kind}` });
}

async function openVehicleEditor(initial = {}) {
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <form class="vehicles-form">
      <label class="field"><span class="field-label">Nickname</span><input class="input" name="nickname" value="${esc(initial.nickname || '')}" required /></label>
      <label class="field"><span class="field-label">Type</span>
        <select class="select" name="type">
          <option value="gas" ${String(initial.type || 'gas') === 'gas' ? 'selected' : ''}>${esc(t('vehicles.fuel'))}</option>
          <option value="ev" ${String(initial.type || '') === 'ev' ? 'selected' : ''}>${esc(t('vehicles.ev'))}</option>
          <option value="hybrid" ${String(initial.type || '') === 'hybrid' ? 'selected' : ''}>Hybrid</option>
          <option value="bicycle" ${String(initial.type || '') === 'bicycle' ? 'selected' : ''}>Bicycle</option>
        </select>
      </label>
      <label class="field"><span class="field-label">Make</span><input class="input" name="make" value="${esc(initial.make || '')}" /></label>
      <label class="field"><span class="field-label">Model</span><input class="input" name="model" value="${esc(initial.model || '')}" /></label>
      <label class="field"><span class="field-label">Year</span><input class="input" type="number" min="1990" max="2100" name="year" value="${esc(initial.year || '')}" /></label>
      <label class="field"><span class="field-label">Fuel Type</span>
        <select class="select" name="fuelType">
          <option value="" ${!initial.fuelType ? 'selected' : ''}>Not set</option>
          <option value="gas" ${String(initial.fuelType || '') === 'gas' ? 'selected' : ''}>Gas</option>
          <option value="diesel" ${String(initial.fuelType || '') === 'diesel' ? 'selected' : ''}>Diesel</option>
          <option value="electric" ${String(initial.fuelType || '') === 'electric' ? 'selected' : ''}>Electric</option>
          <option value="hybrid" ${String(initial.fuelType || '') === 'hybrid' ? 'selected' : ''}>Hybrid</option>
          <option value="other" ${String(initial.fuelType || '') === 'other' ? 'selected' : ''}>Other</option>
        </select>
      </label>
      <label class="field"><span class="field-label">License Plate</span><input class="input" name="licensePlate" value="${esc(initial.licensePlate || '')}" /></label>
      <label class="field"><span class="field-label">Current Odometer (km)</span><input class="input" type="number" min="0" step="1" name="currentOdometer" value="${esc(initial.currentOdometer || 0)}" /></label>
      <label class="field"><span class="field-label">Fuel L/100km</span><input class="input" type="number" min="0" step="0.1" name="fuelEfficiency" value="${esc(initial.fuelEfficiency || '')}" /></label>
      <label class="field"><span class="field-label">kWh/100km</span><input class="input" type="number" min="0" step="0.1" name="kwPer100km" value="${esc(initial.kwPer100km || '')}" /></label>
      <label class="field"><span class="field-label">Fuel or charge price</span><input class="input" type="number" min="0" step="0.01" name="currentFuelPrice" value="${esc(initial.currentFuelPrice || '')}" /></label>
      <label class="field"><span class="field-label">Electricity rate</span><input class="input" type="number" min="0" step="0.01" name="electricityRate" value="${esc(initial.electricityRate || '')}" /></label>
      <label class="field"><span class="field-label">Estimated annual km</span><input class="input" type="number" min="1" step="1" name="estimatedAnnualKm" value="${esc(initial.estimatedAnnualKm || 20000)}" /></label>
      <label class="field"><span class="field-label">Purchase price</span><input class="input" type="number" min="0" step="0.01" name="purchasePrice" value="${esc(initial.purchasePrice || '')}" /></label>
      <label class="field"><span class="field-label">Expected lifespan (km)</span><input class="input" type="number" min="1" step="1" name="expectedLifespanKm" value="${esc(initial.expectedLifespanKm || '')}" /></label>
      <label class="field"><span class="field-label">Insurance renewal date</span><input class="input" type="date" name="insuranceRenewalDate" value="${esc(initial.insuranceRenewalDate || '')}" /></label>
      <label class="field"><span class="field-label">Insurance amount</span><input class="input" type="number" min="0" step="0.01" name="insuranceAmount" value="${esc(initial.insuranceAmount || '')}" /></label>
      <label class="field"><span class="field-label">Registration renewal date</span><input class="input" type="date" name="registrationRenewalDate" value="${esc(initial.registrationRenewalDate || '')}" /></label>
      <label class="field"><span class="field-label">Registration amount</span><input class="input" type="number" min="0" step="0.01" name="registrationAmount" value="${esc(initial.registrationAmount || '')}" /></label>
      <label class="field"><span class="field-label">Oil change interval (km)</span><input class="input" type="number" min="0" step="100" name="oilChangeIntervalKm" value="${esc(initial.oilChangeIntervalKm || 8000)}" /></label>
      <label class="field"><span class="field-label">Last oil change odometer (km)</span><input class="input" type="number" min="0" step="1" name="lastOilChangeOdometerKm" value="${esc(initial.lastOilChangeOdometerKm || 0)}" /></label>
      <label class="field"><span class="field-label">Current tire tread (mm)</span><input class="input" type="number" min="0" step="0.1" name="tireTreadMm" value="${esc(initial.tireTreadMm || 7)}" /></label>
      <label class="field"><span class="field-label">Minimum tire tread (mm)</span><input class="input" type="number" min="0" step="0.1" name="tireTreadMinMm" value="${esc(initial.tireTreadMinMm || 3)}" /></label>
    </form>
  `;
  const form = /** @type {HTMLFormElement | null} */ (wrap.querySelector('form'));
  if (!form) return null;
  return new Promise((resolve) => {
    const handle = showModal({
      title: initial.id ? t('vehicles.edit') : t('vehicles.add'),
      content: wrap,
      actions: [
        { label: t('common.cancel'), class: 'btn btn-ghost', onClick: () => resolve(null) },
        {
          label: t('common.save'),
          class: 'btn btn-primary',
          onClick: () => {
            const fd = new FormData(form);
            const raw = Object.fromEntries(fd.entries());
            resolve({ ...initial, ...raw, active: true });
          },
        },
      ],
      onClose: () => resolve(null),
    });
    void handle;
  });
}

async function addMaintenanceLog(vehicleId, defaults = {}) {
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <form>
      <label class="field"><span class="field-label">Date</span><input class="input" type="date" name="date" value="${esc(defaults.date || ymd())}" required /></label>
      <label class="field"><span class="field-label">Service</span><input class="input" name="type" value="${esc(defaults.type || '')}" required /></label>
      <label class="field"><span class="field-label">Cost</span><input class="input" type="number" min="0" step="0.01" name="cost" value="${esc(defaults.cost || '')}" /></label>
      <label class="field"><span class="field-label">Odometer (km)</span><input class="input" type="number" min="0" step="1" name="odometer" value="${esc(defaults.odometer || '')}" /></label>
      <label class="field"><span class="field-label">Notes</span><textarea class="input" name="notes">${esc(defaults.notes || '')}</textarea></label>
    </form>
  `;
  const form = /** @type {HTMLFormElement | null} */ (wrap.querySelector('form'));
  if (!form) return false;
  return new Promise((resolve) => {
    showModal({
      title: t('vehicles.maintenance'),
      content: wrap,
      actions: [
        { label: t('common.cancel'), class: 'btn btn-ghost', onClick: () => resolve(false) },
        {
          label: t('common.save'),
          class: 'btn btn-primary',
          onClick: async () => {
            const fd = new FormData(form);
            await db.vehicleMaintenanceLogs.add({
              id: newId('mnt'),
              vehicleId: String(vehicleId),
              date: String(fd.get('date') || ymd()),
              type: String(fd.get('type') || ''),
              cost: Math.max(0, num(fd.get('cost'), 0)),
              odometer: Math.max(0, num(fd.get('odometer'), 0)),
              notes: String(fd.get('notes') || ''),
              createdAt: nowIso(),
              updatedAt: nowIso(),
              syncUpdatedAt: Date.now(),
              syncDeletedAt: null,
            });
            resolve(true);
          },
        },
      ],
      onClose: () => resolve(false),
    });
  });
}

async function addOdometerEntry(vehicleId) {
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="vehicles-modal-body">
      <p class="vehicles-modal-hint">
        Enter the current odometer reading for your vehicle. This will update the total mileage and cost-per-km estimates.
      </p>
      <form class="vehicles-form-simple">
        <label class="field">
          <span class="field-label">Current Odometer (km)</span>
          <input class="input" type="number" name="km" step="1" autofocus required />
        </label>
      </form>
    </div>
  `;
  const form = /** @type {HTMLFormElement} */ (wrap.querySelector('form'));
  
  return new Promise((resolve) => {
    showModal({
      title: t('vehicles.mileage'),
      content: wrap,
      size: 'sm',
      actions: [
        { label: t('common.cancel'), class: 'btn btn-ghost', onClick: () => resolve(false) },
        {
          label: t('common.save'),
          class: 'btn btn-primary',
          onClick: async () => {
            const fd = new FormData(form);
            const km = Math.max(0, num(fd.get('km')));
            const all = await getOdometerLog();
            all.push({ vehicleId: String(vehicleId), km, date: ymd(), createdAt: nowIso() });
            await putOdometerLog(all.slice(-1000));
            await db.vehicles.update(vehicleId, { totalKmLogged: km, updatedAt: nowIso(), syncUpdatedAt: Date.now() });
            resolve(true);
          },
        },
      ],
      onClose: () => resolve(false),
    });
  });
}

/** @param {HTMLElement} root */
export async function renderVehiclesView(root) {
  root.innerHTML = `
    <section class="vehicles-view">
      <header class="card card-raised tax-header">
        <div class="tax-header-title">
          <h1>${esc(t('vehicles.title'))}</h1>
          <p>${esc(t('vehicles.subtitle'))}</p>
        </div>
        <div class="expenses-view-header-actions">
          <ion-button data-action="add-vehicle">
            ${getIcon('plus', 18)}
            ${esc(t('vehicles.add'))}
          </ion-button>
        </div>
      </header>
      
      <div class="vehicles-grid" data-slot="cards"></div>
      
      <section class="card vehicle-comparison" data-slot="compare"></section>
    </section>
  `;

  const cardsSlot = /** @type {HTMLElement | null} */ (root.querySelector('[data-slot="cards"]'));
  const compareSlot = /** @type {HTMLElement | null} */ (root.querySelector('[data-slot="compare"]'));

  const refresh = async () => {
    const vehicles = await listVehicles();
    const today = ymd();
    if (!cardsSlot) return;

    if (!vehicles.length) {
      cardsSlot.innerHTML = renderEmptyState({
        title: t('vehicles.emptyTitle'),
        message: t('vehicles.emptyMessage'),
      });
      if (compareSlot) compareSlot.innerHTML = '';
      return;
    }

    const maintenance = await db.vehicleMaintenanceLogs.toArray();
    const expenses = await db.expenses.filter((e) => e.deletedAt == null).toArray();
    const shifts = await db.shifts.filter((s) => s.deletedAt == null).toArray();

    const statsRows = [];

    cardsSlot.innerHTML = (
      await Promise.all(
        vehicles.map(async (v) => {
          const vMaintenance = maintenance.filter((m) => String(m.vehicleId) === String(v.id));
          const vExpenses = expenses.filter((e) => String(e.vehicleId || '') === String(v.id));
          const vShifts = shifts.filter((s) => String(s.vehicleId || '') === String(v.id));
          const stats = calcVehicleStats(v, vExpenses, vMaintenance, vShifts);
          statsRows.push({ id: v.id, label: vehicleLabel(v), ...stats });

          const oilDueAt = num(v.lastOilChangeOdometerKm) + Math.max(1, num(v.oilChangeIntervalKm, 8000));
          const oilRemaining = oilDueAt - num(v.totalKmLogged, 0);
          const treadAlert = num(v.tireTreadMm, 0) <= num(v.tireTreadMinMm, 3);
          const insuranceDue = v.insuranceRenewalDate && String(v.insuranceRenewalDate) <= today;
          const registrationDue = v.registrationRenewalDate && String(v.registrationRenewalDate) <= today;

          const alerts = [];
          if (oilRemaining <= 0) alerts.push({ label: 'Oil Change', icon: 'warning' });
          if (treadAlert) alerts.push({ label: 'Low Tread', icon: 'warning' });
          if (insuranceDue) alerts.push({ label: 'Insurance', icon: 'clock' });
          if (registrationDue) alerts.push({ label: 'Registration', icon: 'clock' });

          const maintenanceRecent = vMaintenance
            .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
            .slice(0, 2);

          const typeIcon = v.type === 'ev' ? 'bolt' : v.type === 'bicycle' ? 'parking' : 'car';

          // The card rides inside an ion-item-sliding so touch users swipe left for
          // edit/archive (mirrors the shift-sliding pattern in shifts-view.js); the in-card
          // buttons stay for mouse users and are hidden on coarse pointers in vehicles.css.
          // data-vehicle-id lives on the sliding host so the existing click delegation
          // resolves the id for option taps too.
          return `
            <ion-item-sliding class="vehicles-sliding" data-vehicle-id="${esc(v.id)}">
              <ion-item class="vehicles-ion-item" lines="none">
            <article class="card vehicle-card" data-vehicle-id="${esc(v.id)}">
              <div class="vehicle-card-header">
                <div class="vehicle-card-identity">
                  <h3>${esc(vehicleLabel(v))}</h3>
                  <span class="type-badge">${esc(v.type)}</span>
                </div>
                ${getIcon(typeIcon, 24, 'text-muted')}
              </div>

              <div class="vehicle-alerts">
                ${alerts.length > 0 
                  ? alerts.map(a => `<span class="vehicle-alert-pill">${getIcon(a.icon, 12)} ${esc(a.label)}</span>`).join('')
                  : `<span class="vehicle-alert-pill is-ok">${getIcon('check', 12)} All Clear</span>`
                }
              </div>

              <div class="vehicle-stats-grid">
                <div class="vehicle-stat-item">
                  <span class="vehicle-stat-label">Cost / km</span>
                  <span class="vehicle-stat-value">${esc(money(stats.costPerKm))}</span>
                </div>
                <div class="vehicle-stat-item">
                  <span class="vehicle-stat-label">Odometer</span>
                  <span class="vehicle-stat-value">${esc(num(v.totalKmLogged))} km</span>
                </div>
                <div class="vehicle-stat-item">
                  <span class="vehicle-stat-label">Efficiency</span>
                  <span class="vehicle-stat-value">${esc(v.type === 'ev' ? `${num(v.kwPer100km)} kWh` : `${num(v.fuelEfficiency)} L`)}</span>
                </div>
                <div class="vehicle-stat-item">
                  <span class="vehicle-stat-label">Depreciation</span>
                  <span class="vehicle-stat-value">${esc(money(stats.depreciation))}</span>
                </div>
              </div>

              <div class="vehicle-maintenance-summary">
                <span class="vehicle-maintenance-title">Latest Maintenance</span>
                ${maintenanceRecent.length > 0 
                  ? maintenanceRecent.map(m => `
                      <div class="vehicle-maintenance-row">
                        <span class="vehicle-maintenance-service">${esc(m.type)}</span>
                        <span class="vehicle-maintenance-date">${esc(m.date)}</span>
                      </div>
                    `).join('')
                  : '<p class="text-xs text-muted">No records found</p>'
                }
              </div>

              <div class="vehicle-actions">
                <ion-button size="small" fill="outline" data-action="odometer">${getIcon('trending-up', 14)} Mileage</ion-button>
                <ion-button size="small" fill="outline" data-action="maintenance">${getIcon('maintenance', 14)} Upkeep</ion-button>
                <ion-button size="small" fill="clear" data-action="edit">${getIcon('edit', 14)}</ion-button>
                <ion-button size="small" fill="clear" color="danger" data-action="archive">${getIcon('trash', 14)}</ion-button>
              </div>
            </article>
              </ion-item>
              <ion-item-options side="end">
                <ion-item-option color="medium" data-action="edit">${esc(t('common.edit'))}</ion-item-option>
                <ion-item-option color="danger" data-action="archive">Archive</ion-item-option>
              </ion-item-options>
            </ion-item-sliding>
          `;
        }),
      )
    ).join('');

    if (compareSlot && vehicles.length > 1) {
      statsRows.sort((a, b) => a.costPerKm - b.costPerKm);
      compareSlot.innerHTML = `
        <div class="vehicles-compare-heading">
          ${getIcon('trending-up', 20, 'text-brand')}
          <h2>Fleet Efficiency Comparison</h2>
        </div>
        <table class="comparison-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Vehicle</th>
              <th>Cost / km</th>
              <th>Annual Costs</th>
              <th>km / Shift</th>
            </tr>
          </thead>
          <tbody>
            ${statsRows.map((s, idx) => `
              <tr>
                <td class="comparison-rank">#${idx + 1}</td>
                <td class="comparison-vehicle-name">${esc(s.label)}</td>
                <td class="${idx === 0 ? 'comparison-best' : ''}">${esc(money(s.costPerKm))}</td>
                <td>${esc(money(s.annualExpenses))}</td>
                <td>${esc(fixed(s.shiftCount ? s.shiftKm / Math.max(1, s.shiftCount) : 0, 1))} km</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (compareSlot) {
      compareSlot.innerHTML = '';
    }
  };

  root.addEventListener('click', async (e) => {
    const el = /** @type {HTMLElement | null} */ (e.target instanceof Element ? e.target.closest('[data-action],[data-vehicle-id]') : null);
    if (!el) return;
    const action = el.getAttribute('data-action');
    if (action === 'add-vehicle') {
      const payload = await openVehicleEditor();
      if (!payload) return;
      const id = await db.vehicles.add(normalizeVehicleInput(payload));
      await syncRecurringExpense(id, 'insurance', String(payload.insuranceRenewalDate || ''), num(payload.insuranceAmount, 0));
      await syncRecurringExpense(
        id,
        'registration',
        String(payload.registrationRenewalDate || ''),
        num(payload.registrationAmount, 0),
      );
      showToast({ type: 'success', message: 'Vehicle saved', duration: 1800 });
      await store.refresh('vehicles');
      await refresh();
      return;
    }

    const card = el.closest('[data-vehicle-id]');
    const id = card?.getAttribute('data-vehicle-id') || null;
    if (!id) return;

    // Swipe-action taps come from inside an open ion-item-sliding — snap it shut before acting.
    const slider = /** @type {{ close?: () => Promise<void> } | null} */ (el.closest('ion-item-sliding'));
    if (slider && typeof slider.close === 'function') void slider.close();

    const row = await db.vehicles.get(id);
    if (!row) return;

    if (action === 'edit') {
      const payload = await openVehicleEditor(row);
      if (!payload) return;
      const normalized = normalizeVehicleInput({ ...row, ...payload, createdAt: row.createdAt });
      await db.vehicles.put({ ...normalized, id });
      await syncRecurringExpense(id, 'insurance', String(normalized.insuranceRenewalDate || ''), num(normalized.insuranceAmount, 0));
      await syncRecurringExpense(
        id,
        'registration',
        String(normalized.registrationRenewalDate || ''),
        num(normalized.registrationAmount, 0),
      );
      showToast({ type: 'success', message: 'Vehicle updated', duration: 1800 });
      await store.refresh('vehicles');
      await refresh();
      return;
    }

    if (action === 'maintenance') {
      const ok = await addMaintenanceLog(id);
      if (ok) {
        showToast({ type: 'success', message: 'Maintenance saved', duration: 1800 });
        await refresh();
      }
      return;
    }

    if (action === 'odometer') {
      const ok = await addOdometerEntry(id);
      if (ok) {
        showToast({ type: 'success', message: 'Odometer updated', duration: 1800 });
        await refresh();
      }
      return;
    }

    if (action === 'efficiency') {
      const wrap = document.createElement('div');
      const unit = String(row.type) === 'ev' ? 'kWh/100km' : 'L/100km';
      const currentVal = String(row.type) === 'ev' ? row.kwPer100km : row.fuelEfficiency;
      
      wrap.innerHTML = `
        <div class="vehicles-modal-body">
          <p class="vehicles-modal-hint">
            Update the rated fuel or electricity efficiency for this vehicle (${unit}).
          </p>
          <form class="vehicles-form-simple">
            <label class="field">
              <span class="field-label">Efficiency (${unit})</span>
              <input class="input" type="number" name="efficiency" step="0.1" value="${esc(currentVal)}" autofocus required />
            </label>
          </form>
        </div>
      `;
      const form = /** @type {HTMLFormElement} */ (wrap.querySelector('form'));

      showModal({
        title: t('vehicles.efficiency'),
        content: wrap,
        size: 'sm',
        actions: [
          { label: t('common.cancel'), class: 'btn btn-ghost' },
          {
            label: t('common.save'),
            class: 'btn btn-primary',
            onClick: async () => {
              const fd = new FormData(form);
              const n = Math.max(0, num(fd.get('efficiency')));
              if (String(row.type) === 'ev') await db.vehicles.update(id, { kwPer100km: n, updatedAt: nowIso(), syncUpdatedAt: Date.now() });
              else await db.vehicles.update(id, { fuelEfficiency: n, updatedAt: nowIso(), syncUpdatedAt: Date.now() });
              showToast({ type: 'success', message: 'Efficiency updated', duration: 1800 });
              await refresh();
            },
          },
        ],
      });
      return;
    }

    if (action === 'archive') {
      await db.vehicles.update(id, { active: false, updatedAt: nowIso() });
      showToast({ type: 'success', message: 'Vehicle archived', duration: 1800 });
      // Drop just this vehicle from the filter — a subset must survive losing one member, and
      // only fall back to "all" when nothing selectable is left. Same rule deactivatePlatform()
      // applies for platforms.
      const remaining = filterIds(store.get('activeVehicleId')).filter((x) => x !== id);
      store.set('activeVehicleId', remaining.length ? remaining.join(',') : 'all');
      await store.refresh('vehicles');
      await refresh();
    }
  });

  await refresh();
}
