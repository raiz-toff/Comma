import { db } from '../../core/db.js';
import { bus, EXPENSE_SAVED } from '../../core/events.js';
import { store } from '../../core/store.js';
import { calcDepreciation, calcVehicleCostPerKm } from '../../utils/calculations.js';
import { t } from '../../utils/strings.js';
import { renderEmptyState, showModal, showToast } from '../../ui/components.js';
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

async function listVehicles() {
  const rows = await db.vehicles.toArray();
  // ids are opaque client-generated strings (Fix 2 — interop plan), not sortable numbers —
  // sort by createdAt (ISO string) instead, preserving insertion order.
  return rows
    .filter((v) => v.active !== false && v.syncDeletedAt == null)
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
}

async function syncRecurringExpense(vehicleId, kind, date, amount) {
  if (!date || amount <= 0) return;
  const cat = kind === 'insurance' ? 'insurance' : 'registration';
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
    <div style="padding: var(--space-2) 0;">
      <p style="margin-bottom: var(--space-4); color: var(--color-text-secondary); font-size: var(--text-sm);">
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
      <header class="card card-raised tax-header" style="padding: var(--space-4);">
        <div class="tax-header-title">
          <h1>${esc(t('vehicles.title'))}</h1>
          <p>${esc(t('vehicles.subtitle'))}</p>
        </div>
        <div class="expenses-view-header-actions">
          <button type="button" class="btn btn-primary" data-action="add-vehicle">
            ${getIcon('plus', 18)}
            ${esc(t('vehicles.add'))}
          </button>
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

          return `
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
                <button type="button" class="btn btn-secondary btn-sm" data-action="odometer">${getIcon('trending-up', 14)} Mileage</button>
                <button type="button" class="btn btn-secondary btn-sm" data-action="maintenance">${getIcon('maintenance', 14)} Upkeep</button>
                <button type="button" class="btn btn-ghost btn-sm" data-action="edit">${getIcon('edit', 14)}</button>
                <button type="button" class="btn btn-ghost btn-sm btn-danger" data-action="archive">${getIcon('trash', 14)}</button>
              </div>
            </article>
          `;
        }),
      )
    ).join('');

    if (compareSlot && vehicles.length > 1) {
      statsRows.sort((a, b) => a.costPerKm - b.costPerKm);
      compareSlot.innerHTML = `
        <div style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-4);">
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
                <td style="font-weight: 600;">${esc(s.label)}</td>
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
    const el = /** @type {HTMLElement | null} */ (e.target instanceof HTMLElement ? e.target.closest('[data-action],[data-vehicle-id]') : null);
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
      await refresh();
      return;
    }

    const card = el.closest('[data-vehicle-id]');
    const id = card?.getAttribute('data-vehicle-id') || null;
    if (!id) return;
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
        <div style="padding: var(--space-2) 0;">
          <p style="margin-bottom: var(--space-4); color: var(--color-text-secondary); font-size: var(--text-sm);">
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
      await refresh();
    }
  });

  await refresh();
}
