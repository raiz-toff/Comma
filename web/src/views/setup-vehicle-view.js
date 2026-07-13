/**
 * "Tell us your real vehicle" — the dashboard checklist's vehicle step. Web mirror of the
 * phone app's `app/setup/vehicle.tsx`.
 *
 * Edits the placeholder vehicle onboarding created, rather than sending the driver to the
 * vehicle list to add a *second* one — that never satisfied the checklist, since the
 * placeholder stayed there with no make on it and the item could never tick no matter how
 * many vehicles they added.
 *
 * Saving also re-derives the mileage write-off profile from the chosen type. Without that,
 * switching a gas car to a bicycle would leave the seeded car rate in place and keep
 * claiming a write-off the driver isn't entitled to.
 */

import { db } from '../core/db.js';
import { store } from '../core/store.js';
import { showToast } from '../ui/components.js';
import { getIcon } from '../ui/icons.js';
import { getVehicleMileageEligibility } from '../registry/countries/mileageRates.js';
import { upsertTaxProfile } from '../modules/vehicles/taxProfiles.js';
import { markActivationDone } from '../modules/onboarding/activation.js';

const VEHICLE_TYPES = [
  { id: 'gas', label: 'Gas' },
  { id: 'hybrid', label: 'Hybrid' },
  { id: 'ev', label: 'Electric' },
  { id: 'scooter', label: 'Scooter' },
  { id: 'ebike', label: 'E-bike' },
  { id: 'bicycle', label: 'Bicycle' },
];

function esc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function goBack() {
  if (window.history.length > 1) window.history.back();
  else window.location.hash = '#/dashboard';
}

/** @param {HTMLElement} root */
export async function render(root) {
  const user = store.get('user');
  const country = user?.locale?.country || 'CA';
  const distanceUnit = user?.locale?.distanceUnit || 'km';

  root.innerHTML = `
    <div class="setup-view">
      <button type="button" class="setup-back" data-setup-back>${getIcon('chevron-left', 16)} Back</button>
      <div class="setup-head">
        <h1 class="setup-title">What do you drive?</h1>
        <p class="setup-sub">We assumed a gas car to get you started. Your real one sets the correct write-off rate per ${esc(distanceUnit)}.</p>
      </div>
      <div class="setup-type-row" data-setup-types>
        ${VEHICLE_TYPES.map((v) => `<button type="button" class="setup-type-chip" data-type="${v.id}">${esc(v.label)}</button>`).join('')}
      </div>
      <div class="setup-elig-box" data-setup-elig></div>
      <div class="setup-field">
        <label class="input-label">MAKE</label>
        <input type="text" class="input" data-field="make" placeholder="Toyota" />
      </div>
      <div class="setup-field">
        <label class="input-label">MODEL (OPTIONAL)</label>
        <input type="text" class="input" data-field="model" placeholder="Corolla" />
      </div>
      <div class="setup-field">
        <label class="input-label">YEAR (OPTIONAL)</label>
        <input type="text" inputmode="numeric" class="input" data-field="year" placeholder="2020" />
      </div>
      <div class="setup-field">
        <label class="input-label">NICKNAME (OPTIONAL)</label>
        <input type="text" class="input" data-field="nickname" placeholder="My Car" />
      </div>
      <div class="setup-error" data-setup-error hidden></div>
      <div class="setup-cta-row">
        <ion-button data-setup-save>Save my vehicle</ion-button>
      </div>
    </div>
  `;

  root.querySelector('[data-setup-back]')?.addEventListener('click', goBack);

  const typesEl = /** @type {HTMLElement} */ (root.querySelector('[data-setup-types]'));
  const eligEl = /** @type {HTMLElement} */ (root.querySelector('[data-setup-elig]'));
  const makeEl = /** @type {HTMLInputElement} */ (root.querySelector('[data-field="make"]'));
  const modelEl = /** @type {HTMLInputElement} */ (root.querySelector('[data-field="model"]'));
  const yearEl = /** @type {HTMLInputElement} */ (root.querySelector('[data-field="year"]'));
  const nicknameEl = /** @type {HTMLInputElement} */ (root.querySelector('[data-field="nickname"]'));
  const errorEl = /** @type {HTMLElement} */ (root.querySelector('[data-setup-error]'));
  const saveBtn = /** @type {HTMLElement} */ (root.querySelector('[data-setup-save]'));

  let vehicleId = null;
  let type = 'gas';

  try {
    const list = await db.vehicles.toArray();
    const v = list.find((x) => x.active) || list[0] || null;
    if (v) {
      vehicleId = v.id;
      type = String(v.type || 'gas');
      makeEl.value = String(v.make || '');
      modelEl.value = String(v.model || '');
      yearEl.value = v.year ? String(v.year) : '';
      nicknameEl.value = String(v.nickname || v.name || '');
    }
  } catch (err) {
    console.warn('[comma setup] vehicle lookup failed', err);
  }

  function paintType() {
    typesEl.querySelectorAll('[data-type]').forEach((chip) => {
      chip.classList.toggle('is-on', chip.getAttribute('data-type') === type);
    });
    const eligibility = getVehicleMileageEligibility(country, type);
    eligEl.classList.toggle('is-eligible', eligibility.eligible);
    eligEl.innerHTML = `
      <p class="setup-elig-headline">${
        eligibility.eligible
          ? `Write-off: ${esc(eligibility.ratePrimary)} per ${esc(distanceUnit)}`
          : 'No standard mileage write-off'
      }</p>
      <p class="setup-elig-detail">${esc(eligibility.label)}</p>
    `;
  }

  typesEl.addEventListener('click', (e) => {
    const chip = /** @type {HTMLElement | null} */ (e.target instanceof Element ? e.target.closest('[data-type]') : null);
    if (!chip) return;
    type = chip.getAttribute('data-type') || 'gas';
    paintType();
  });

  makeEl.addEventListener('input', () => {
    errorEl.hidden = true;
  });

  saveBtn.addEventListener('click', async () => {
    if (!vehicleId) return;
    if (!makeEl.value.trim()) {
      errorEl.textContent = 'Add the make (Toyota, Honda…) so we can set the right rate.';
      errorEl.hidden = false;
      return;
    }
    errorEl.hidden = true;
    /** @type {any} */ (saveBtn).disabled = true;
    try {
      const parsedYear = yearEl.value.trim() ? Number(yearEl.value.trim()) : null;
      const nickname = nicknameEl.value.trim() || 'My Vehicle';
      await db.vehicles.update(vehicleId, {
        name: nickname,
        nickname,
        isActive: true,
        type,
        make: makeEl.value.trim(),
        model: modelEl.value.trim(),
        year: Number.isFinite(parsedYear) ? parsedYear : null,
        updatedAt: new Date().toISOString(),
        syncUpdatedAt: Date.now(),
      });

      // Re-derive the write-off rate from the type they just chose.
      const eligibility = getVehicleMileageEligibility(country, type);
      const taxYear = new Date().getFullYear();
      await upsertTaxProfile({
        vehicleId,
        taxYear,
        country,
        deductionMethod: eligibility.eligible ? 'standard_mileage' : 'actual_expenses',
        standardRatePrimary: eligibility.ratePrimary,
        standardRateSecondary: eligibility.rateSecondary,
        rateThreshold: eligibility.rateThreshold,
      });

      await markActivationDone('vehicle');
      showToast({ type: 'success', message: 'Vehicle saved', duration: 1800 });
      goBack();
    } catch (err) {
      console.warn('[comma setup] vehicle save failed', err);
      errorEl.textContent = "Couldn't save that. Try again.";
      errorEl.hidden = false;
    } finally {
      /** @type {any} */ (saveBtn).disabled = false;
    }
  });

  paintType();
}
