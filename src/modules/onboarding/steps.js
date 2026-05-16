/**
 * F9 — Onboarding step bodies (plain HTML strings). Chrome lives in `onboarding.js`.
 * Plan v3: **11 steps** — country, province/state/region, **platforms (filtered by province `availablePlatforms`)**, profile, vehicle → complete.
 *
 * Category D (docs/feature_modularity.md): a new **global** onboarding step still lands here —
 * bump `TOTAL_STEPS`, extend `renderStepInner` / `validateStep`, and persist fields via `onboarding.js`.
 */

/**
 * @typedef {Object} OnboardingDraft
 * @property {number} step
 * @property {string[]} selectedPlatforms
 * @property {string} displayName
 * @property {'emoji'|'initials'|'custom'} avatarType
 * @property {string|null} avatarData
 * @property {string} country
 * @property {{ nickname: string; type: string; make: string; model: string; year: string }[]} vehicles
 * @property {boolean} addSecondVehicle
 * @property {string} workSchedulePreset
 * @property {number} weeklyGoal
 * @property {number} monthlyGoal
 * @property {number} annualGoal
 * @property {string} taxRegion
 * @property {number} taxWithholdingPct
 * @property {boolean} hstRegistered
 * @property {'km'|'mi'} distanceUnit
 * @property {'light'|'dark'|'auto'} theme
 * @property {{ shiftReminders: boolean; goalAlerts: boolean; taxReminders: boolean; weeklyDigest: boolean }} notificationPrefs
 * @property {boolean} landingComplete After the welcome hero, step 0 shows country selection.
 */

import { t } from '../../utils/strings.js';
import { getLocaleConfig, getProvinceDef } from '../../utils/locale.js';
import { CountryRegistry, getCountryTaxProfile } from '../../registry/countries/index.js';
import { ProvinceRegistry } from '../../registry/provinces/index.js';
import { getWithholdingPresetPct } from '../../registry/tax/withholding-presets.js';
import { resolveAvailablePlatformIds } from '../../registry/market/resolve.js';
import { getPlatformColor, renderPlatformBadge } from '../../ui/components.js';
import { getIcon } from '../../ui/icons.js';

export const TOTAL_STEPS = 11;

const VEHICLE_TYPES = ['gas', 'hybrid', 'ev', 'motorcycle', 'bicycle', 'ebike', 'scooter', 'walking'];

/** @param {unknown} s */
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** @param {unknown} cents @param {number} fallbackDollars */
function goalDollarsFromCents(cents, fallbackDollars) {
  const c = Number(cents);
  if (!Number.isFinite(c) || c <= 0) return fallbackDollars;
  return Math.round(c / 100);
}

/** Human-readable label for a province / state row (US uses region display names). */
function subdivisionOptionLabel(p) {
  if (String(p.countryId || '').toUpperCase() === 'US') {
    try {
      const dn = new Intl.DisplayNames(['en-US'], { type: 'region' });
      return dn.of(`US-${p.id}`) || p.id;
    } catch {
      return p.id;
    }
  }
  const def = getProvinceDef(p.id);
  return typeof def?.labelKey === 'string' ? t(def.labelKey) : p.id;
}

/**
 * @param {Record<string, unknown>} user
 * @returns {OnboardingDraft}
 */
export function defaultDraftFromUser(user) {
  const u = user && typeof user === 'object' ? user : {};
  const loc = /** @type {Record<string, unknown>} */ (u.locale || {});
  const wkDef = goalDollarsFromCents(u.weeklyGoal, 500);
  const locCountry = typeof loc.country === 'string' ? String(loc.country).toUpperCase() : '';
  const fromUser = typeof u.countryId === 'string' && u.countryId ? String(u.countryId).toUpperCase() : locCountry;
  const country = CountryRegistry.getAll().some((c) => c.id === fromUser) ? fromUser : 'CA';
  const cfg = getLocaleConfig(country);
  const taxProf = getCountryTaxProfile(country);
  const provs = ProvinceRegistry.getByCountry(country);
  let taxRegion = typeof u.provinceId === 'string' && u.provinceId ? String(u.provinceId).toUpperCase() : '';
  if (provs.length) {
    const defCode = String(taxProf.defaultRegionCode || '').toUpperCase();
    const pickDefault = () =>
      defCode && provs.some((p) => p.id === defCode) ? defCode : provs.slice().sort((a, b) => a.id.localeCompare(b.id))[0].id;
    if (!taxRegion || !provs.some((p) => p.id === taxRegion)) taxRegion = pickDefault();
  } else {
    taxRegion = String(taxProf.defaultRegionCode || '').toUpperCase();
  }
  const distanceUnit =
    loc.distanceUnit === 'km' || loc.distanceUnit === 'mi' ? /** @type {'km'|'mi'} */ (loc.distanceUnit) : cfg.distanceUnit;
  return {
    step: 0,
    selectedPlatforms: Array.isArray(u.platforms) ? [.../** @type {string[]} */ (u.platforms)] : [],
    displayName: typeof u.displayName === 'string' ? u.displayName : '',
    avatarType: typeof u.avatarType === 'string' ? u.avatarType : 'emoji',
    avatarData: typeof u.avatarData === 'string' ? u.avatarData : '🚗',
    country,
    vehicles: [
      { nickname: '', type: 'gas', make: '', model: '', year: '' },
      { nickname: '', type: 'gas', make: '', model: '', year: '' },
    ],
    addSecondVehicle: false,
    workSchedulePreset: 'flexible',
    weeklyGoal: wkDef,
    monthlyGoal:
      Number(u.monthlyGoal) > 0 ? goalDollarsFromCents(u.monthlyGoal, Math.round(wkDef * 4.33)) : Math.round(wkDef * 4.33),
    annualGoal:
      Number(u.annualGoal) > 0 ? goalDollarsFromCents(u.annualGoal, Math.round(wkDef * 52)) : Math.round(wkDef * 52),
    taxRegion,
    taxWithholdingPct: Number(u.taxWithholdingPct) >= 0 ? Number(u.taxWithholdingPct) : 25,
    hstRegistered: Boolean(u.hstRegistered),
    distanceUnit,
    theme: u.theme === 'light' || u.theme === 'dark' || u.theme === 'auto' ? u.theme : 'auto',
    notificationPrefs: {
      shiftReminders: true,
      goalAlerts: true,
      taxReminders: true,
      weeklyDigest: false,
      ...(typeof u.notificationPrefs === 'object' && u.notificationPrefs ? /** @type {object} */ (u.notificationPrefs) : {}),
    },
    landingComplete: false,
  };
}

function whyBlock(summaryKey, bodyKey) {
  return `<details class="onboarding-why"><summary class="onboarding-why-summary">${esc(t(summaryKey))}</summary><p class="onboarding-why-body">${esc(t(bodyKey))}</p></details>`;
}

/** @param {string} name @param {number} [size] */
function landingIcon(name, size = 22) {
  return getIcon(name, size, 'onboarding-landing-icon');
}

function renderOnboardingLanding() {
  return `
    <div class="onboarding-landing">
      <!-- Hero Section -->
      <header class="onboarding-landing-hero">
        <div class="hero-content">
          <p class="onboarding-landing-kicker">${esc(t('onboarding.landing.kicker'))}</p>
          <h1 class="onboarding-landing-title">${esc(t('onboarding.landing.heroTitle'))}</h1>
          <p class="onboarding-landing-lead">${esc(t('onboarding.landing.heroLead'))}</p>
          
          <div class="onboarding-landing-actions">
            <button type="button" class="btn btn-primary btn-lg onboarding-landing-primary" data-start-onboarding>${esc(t('onboarding.landing.startCta'))}</button>
            <button type="button" class="btn btn-secondary btn-lg" data-demo>${esc(t('onboarding.tryDemo'))}</button>
          </div>
          
          <div class="onboarding-landing-restore">
            <button type="button" class="btn btn-ghost btn-sm onboarding-restore-link" data-action="restore-vault">
              ${getIcon('database', 18)} <span>${esc(t('onboarding.landing.restoreLink'))}</span>
            </button>
          </div>
        </div>
        
        <div class="hero-visual">
          <div class="hero-browser-frame">
            <img src="/image.png" alt="COMMA Dashboard" class="hero-screenshot" />
          </div>
        </div>
      </header>

      <!-- Section 1: Dashboard -->
      <section class="onboarding-feature-row">
        <div class="feature-text">
          <span class="feature-kicker">Analytics</span>
          <h2 class="feature-title">${esc(t('onboarding.landing.featShiftsTitle'))}</h2>
          <p class="feature-body">${esc(t('onboarding.landing.featShiftsBody'))}</p>
        </div>
        <div class="feature-visual">
          <div class="feature-browser-frame">
            <img src="/image.png" alt="Statistics" class="feature-screenshot" />
          </div>
        </div>
      </section>

      <!-- Section 2: Expenses (Reversed) -->
      <section class="onboarding-feature-row is-reversed">
        <div class="feature-text">
          <span class="feature-kicker">Finance</span>
          <h2 class="feature-title">${esc(t('onboarding.landing.featTaxTitle'))}</h2>
          <p class="feature-body">${esc(t('onboarding.landing.featTaxBody'))}</p>
        </div>
        <div class="feature-visual">
          <div class="feature-browser-frame">
            <img src="/image-1.png" alt="Expenses" class="feature-screenshot" />
          </div>
        </div>
      </section>

      <!-- Section 3: Platforms -->
      <section class="onboarding-feature-row">
        <div class="feature-text">
          <span class="feature-kicker">Workflow</span>
          <h2 class="feature-title">Multi-Platform Mastery</h2>
          <p class="feature-body">Switch between platforms effortlessly. COMMA adapts its terminology and tracking to match exactly how you work.</p>
        </div>
        <div class="feature-visual">
          <div class="feature-browser-frame">
            <img src="/image-2.png" alt="Platforms" class="feature-screenshot" />
          </div>
        </div>
      </section>

      <!-- Section 4: Drive (Bento Style) -->
      <section class="onboarding-bento-section">
        <div class="bento-card">
          <div class="bento-content">
            <span class="feature-kicker">Privacy First</span>
            <h2 class="feature-title">${esc(t('onboarding.landing.featVaultTitle'))}</h2>
            <p class="feature-body">${esc(t('onboarding.landing.featVaultBody'))}</p>
          </div>
          <div class="bento-visual">
            <img src="/image-3.png" alt="Google Drive" class="bento-screenshot" />
          </div>
        </div>
      </section>

      <footer class="onboarding-landing-footer">
        <nav class="onboarding-landing-footer-nav">
          <a href="/privacy.html" target="_blank" class="onboarding-landing-footer-link">${esc(t('onboarding.landing.privacyLink'))}</a>
          <span class="onboarding-landing-footer-sep">&bull;</span>
          <span class="onboarding-landing-footer-copy">&copy; 2026 COMMA</span>
        </nav>
      </footer>
    </div>`;
}

/**
 * After `country` changes, keep `taxRegion` consistent with the subdivision catalog (`ProvinceRegistry.getByCountry`).
 * @param {OnboardingDraft} draft
 */
export function normalizeTaxRegionForCountry(draft) {
  const country = String(draft.country || 'CA').toUpperCase();
  draft.country = country;
  const provs = ProvinceRegistry.getByCountry(country);
  if (provs.length === 1) {
    draft.taxRegion = provs[0].id;
    return;
  }
  if (provs.length > 1) {
    const r = String(draft.taxRegion || '').toUpperCase();
    draft.taxRegion = provs.some((p) => p.id === r) ? r : '';
    return;
  }
  draft.taxRegion = String(draft.taxRegion || '').trim().toUpperCase();
}

/**
 * DB platform rows shown on onboarding after country/region (province `availablePlatforms`, else union for country, else catalog ∩ DB).
 * @param {OnboardingDraft} draft
 * @param {Array<{ id: string; name: string; color?: string }>} platformRows
 */
export function filterPlatformRowsForOnboarding(draft, platformRows) {
  const country = String(draft.country || 'CA').toUpperCase();
  const region = String(draft.taxRegion || '').trim().toUpperCase();
  const allow = new Set(resolveAvailablePlatformIds(country, region));
  return platformRows.filter((row) => allow.has(String(row.id).toLowerCase()));
}

/**
 * Drop selections that are not allowed for the current country/region.
 * @param {OnboardingDraft} draft
 * @param {Array<{ id: string; name: string; color?: string }>} platformRows
 */
export function pruneSelectedPlatformsForRegion(draft, platformRows) {
  const allowed = new Set(filterPlatformRowsForOnboarding(draft, platformRows).map((r) => String(r.id).toLowerCase()));
  draft.selectedPlatforms = draft.selectedPlatforms.filter((id) => allowed.has(String(id).toLowerCase()));
}

/**
 * @param {number} step 0..TOTAL_STEPS-1
 * @param {OnboardingDraft} draft
 * @param {Array<{ id: string; name: string; color?: string }>} platformRows
 */
export function renderStepInner(step, draft, platformRows) {
  switch (step) {
    case 0: {
      if (!draft.landingComplete) {
        return renderOnboardingLanding();
      }
      const cfg = getLocaleConfig(draft.country);
      const countries = CountryRegistry.getAll();
      return `
        <h1 class="onboarding-step-title">${esc(t('onboarding.steps.chooseCountryTitle'))}</h1>
        <p class="onboarding-step-lead">${esc(t('onboarding.steps.chooseCountryLead'))}</p>
        ${whyBlock('onboarding.why.regionSummary', 'onboarding.why.regionBody')}
        <div class="input-group">
          <label class="input-label" for="ob-country">${esc(t('onboarding.steps.country'))}</label>
          <select id="ob-country" class="input" data-field="country">
            ${countries
              .map(
                (c) =>
                  `<option value="${esc(c.id)}" ${String(draft.country).toUpperCase() === c.id ? 'selected' : ''}>${esc(t(c.labelKey))}</option>`,
              )
              .join('')}
          </select>
        </div>
        <p class="onboarding-hint">${esc(t('onboarding.steps.currencyHint'))}: <strong>${esc(cfg.currency)}</strong> (${esc(cfg.symbol)}) · ${
          cfg.distanceUnit === 'mi' ? esc(t('onboarding.steps.unitMi')) : esc(t('onboarding.steps.unitKm'))
        }</p>`;
    }

    case 1: {
      const country = String(draft.country || 'CA').toUpperCase();
      const provs = ProvinceRegistry.getByCountry(country);
      const tax = getCountryTaxProfile(country);
      const regionLabel =
        tax.regionLabel === 'province'
          ? t('onboarding.steps.province')
          : tax.regionLabel === 'state'
            ? t('onboarding.steps.state')
            : t('onboarding.steps.regionShortLabel');
      let control = '';
      if (provs.length) {
        control = `<select id="ob-region-input" class="input" data-field="taxRegion" aria-label="${esc(regionLabel)}">
          ${provs
            .map((p) => {
              const lab = subdivisionOptionLabel(p);
              const sel = String(draft.taxRegion || '').toUpperCase() === p.id ? 'selected' : '';
              return `<option value="${esc(p.id)}" ${sel}>${esc(lab)}</option>`;
            })
            .join('')}
        </select>`;
      } else {
        control = `
          <p class="onboarding-hint">${esc(t('onboarding.steps.regionOptionalLead'))}</p>
          <input id="ob-region-input" class="input" type="text" maxlength="12" data-field="taxRegion" value="${esc(draft.taxRegion)}" autocomplete="off" />`;
      }
      return `
        <h1 class="onboarding-step-title">${esc(t('onboarding.steps.chooseRegionTitle'))}</h1>
        <p class="onboarding-step-lead">${esc(t('onboarding.steps.chooseRegionLead'))}</p>
        ${whyBlock('onboarding.why.regionSummary', 'onboarding.why.regionBody')}
        <div class="input-group">
          <label class="input-label" for="ob-region-input">${esc(regionLabel)}</label>
          ${control}
        </div>`;
    }

    case 2: {
      const filtered = filterPlatformRowsForOnboarding(draft, platformRows);
      if (!filtered.length) {
        return `
        <h1 class="onboarding-step-title">${esc(t('onboarding.steps.platformsTitle'))}</h1>
        <p class="onboarding-step-lead">${esc(t('onboarding.steps.noPlatformsForRegion'))}</p>`;
      }
      return `
        <h1 class="onboarding-step-title">${esc(t('onboarding.steps.platformsTitle'))}</h1>
        <p class="onboarding-step-lead">${esc(t('onboarding.steps.platformsLeadFiltered'))}</p>
        ${whyBlock('onboarding.why.platformsSummary', 'onboarding.why.platformsBody')}
        <div class="onboarding-platform-grid" role="group" aria-label="${esc(t('onboarding.steps.platformsTitle'))}">
          ${filtered
            .map((p) => {
              const sel = draft.selectedPlatforms.includes(p.id);
              const col = getPlatformColor(p.id);
              return `<button type="button" class="onboarding-platform-card card card-interactive${sel ? ' is-selected' : ''}" data-platform-id="${esc(p.id)}" style="--platform-color:${esc(col)}">
                <span class="onboarding-platform-badge">${renderPlatformBadge(p.id, p.name)}</span>
                <span class="onboarding-platform-name">${esc(p.name)}</span>
              </button>`;
            })
            .join('')}
        </div>`;
    }

    case 3:
      return `
        <h1 class="onboarding-step-title">${esc(t('onboarding.steps.profileTitle'))}</h1>
        <p class="onboarding-step-lead">${esc(t('onboarding.steps.profileLead'))}</p>
        ${whyBlock('onboarding.why.profileSummary', 'onboarding.why.profileBody')}
        <div class="input-group">
          <label class="input-label" for="ob-display-name">${esc(t('onboarding.steps.driverName'))}</label>
          <input id="ob-display-name" class="input" type="text" autocomplete="name" maxlength="80" value="${esc(draft.displayName)}" data-field="displayName" />
        </div>
        <fieldset class="onboarding-fieldset">
          <legend class="input-label">${esc(t('onboarding.steps.avatarPick'))}</legend>
          <div class="onboarding-avatar-grid">
            ${['🚗', '🛵', '🚲', '📦', '⭐', '🔥', '💼', '🤑']
              .map(
                (em) =>
                  `<button type="button" class="onboarding-avatar-btn${draft.avatarType === 'emoji' && draft.avatarData === em ? ' is-selected' : ''}" data-avatar-emoji="${esc(em)}">${em}</button>`,
              )
              .join('')}
          </div>
          <div class="input-group">
            <label class="input-label"><input type="radio" name="ob-avatar-type" value="initials" ${draft.avatarType === 'initials' ? 'checked' : ''} data-avatar-type /> ${esc(t('onboarding.steps.avatarInitials'))}</label>
            <label class="input-label"><input type="radio" name="ob-avatar-type" value="custom" ${draft.avatarType === 'custom' ? 'checked' : ''} data-avatar-type /> ${esc(t('onboarding.steps.avatarCustom'))}</label>
          </div>
          <div class="input-group" data-custom-avatar-wrap ${draft.avatarType === 'custom' ? '' : 'hidden'}>
            <label class="input-label" for="ob-avatar-file">${esc(t('onboarding.steps.avatarUpload'))}</label>
            <input id="ob-avatar-file" type="file" accept="image/*" class="input" data-avatar-file />
            <p class="onboarding-hint">${esc(t("onboarding.steps.avatarUploadHint"))}</p>
          </div>
        </fieldset>`;

    case 4: {
      const v = draft.vehicles[0] || { nickname: '', type: 'gas', make: '', model: '', year: '' };
      return `
        <h1 class="onboarding-step-title">${esc(t('onboarding.steps.vehicleTitle'))}</h1>
        <p class="onboarding-step-lead">${esc(t('onboarding.steps.vehicleLead'))}</p>
        ${whyBlock('onboarding.why.vehicleSummary', 'onboarding.why.vehicleBody')}
        <div class="input-group">
          <label class="input-label" for="ob-v0-nick">${esc(t('onboarding.steps.vehicleNickname'))}</label>
          <input id="ob-v0-nick" class="input" type="text" data-vehicle-idx="0" data-vehicle-field="nickname" value="${esc(v.nickname)}" maxlength="60" />
        </div>
        <div class="input-group">
          <label class="input-label" for="ob-v0-type">${esc(t('onboarding.steps.vehicleType'))}</label>
          <select id="ob-v0-type" class="input" data-vehicle-idx="0" data-vehicle-field="type">
            ${VEHICLE_TYPES.map((ty) => `<option value="${ty}" ${v.type === ty ? 'selected' : ''}>${esc(t(`onboarding.vehicleTypes.${ty}`))}</option>`).join('')}
          </select>
        </div>
        <div class="onboarding-row-2">
          <div class="input-group">
            <label class="input-label" for="ob-v0-make">${esc(t('onboarding.steps.make'))}</label>
            <input id="ob-v0-make" class="input" type="text" data-vehicle-idx="0" data-vehicle-field="make" value="${esc(v.make)}" />
          </div>
          <div class="input-group">
            <label class="input-label" for="ob-v0-model">${esc(t('onboarding.steps.model'))}</label>
            <input id="ob-v0-model" class="input" type="text" data-vehicle-idx="0" data-vehicle-field="model" value="${esc(v.model)}" />
          </div>
        </div>
        <div class="input-group">
          <label class="input-label" for="ob-v0-year">${esc(t('onboarding.steps.year'))}</label>
          <input id="ob-v0-year" class="input" type="number" inputmode="numeric" min="1980" max="2035" data-vehicle-idx="0" data-vehicle-field="year" value="${esc(v.year)}" />
        </div>`;
    }

    case 5:
      return `
        <h1 class="onboarding-step-title">${esc(t('onboarding.steps.scheduleTitle'))}</h1>
        <p class="onboarding-step-lead">${esc(t('onboarding.steps.scheduleLead'))}</p>
        ${whyBlock('onboarding.why.scheduleSummary', 'onboarding.why.scheduleBody')}
        <div class="onboarding-choice-grid" role="radiogroup" aria-label="${esc(t('onboarding.steps.scheduleTitle'))}">
          ${['flexible', 'weekdays', 'evenings', 'weekends']
            .map(
              (preset) =>
                `<button type="button" class="onboarding-choice card${draft.workSchedulePreset === preset ? ' is-selected' : ''}" data-schedule="${esc(preset)}">${esc(t(`onboarding.schedule.${preset}`))}</button>`,
            )
            .join('')}
        </div>`;

    case 6: {
      const w = draft.weeklyGoal || 0;
      const labelKey =
        w >= 800 ? 'onboarding.motivation.high' : w >= 400 ? 'onboarding.motivation.mid' : w >= 200 ? 'onboarding.motivation.low' : 'onboarding.motivation.start';
      return `
        <h1 class="onboarding-step-title">${esc(t('onboarding.steps.weeklyGoalTitle'))}</h1>
        <p class="onboarding-step-lead">${esc(t('onboarding.steps.weeklyGoalLead'))}</p>
        ${whyBlock('onboarding.why.weeklyGoalSummary', 'onboarding.why.weeklyGoalBody')}
        <div class="input-group">
          <label class="input-label" for="ob-weekly-goal">${esc(t('onboarding.steps.weeklyGoalLabel'))}</label>
          <input id="ob-weekly-goal" class="input onboarding-input-number" type="number" inputmode="decimal" min="0" step="10" data-field="weeklyGoal" value="${esc(w)}" />
        </div>
        <p class="onboarding-motivation" data-motivation>${esc(t(labelKey))}</p>`;
    }

    case 7:
      return `
        <h1 class="onboarding-step-title">${esc(t('onboarding.steps.longTermGoalsTitle'))}</h1>
        <p class="onboarding-step-lead">${esc(t('onboarding.steps.longTermGoalsLead'))}</p>
        ${whyBlock('onboarding.why.longTermGoalsSummary', 'onboarding.why.longTermGoalsBody')}
        <div class="input-group">
          <label class="input-label" for="ob-monthly">${esc(t('onboarding.steps.monthlyGoal'))}</label>
          <input id="ob-monthly" class="input" type="number" min="0" step="50" data-field="monthlyGoal" value="${esc(draft.monthlyGoal)}" />
        </div>
        <div class="input-group">
          <label class="input-label" for="ob-annual">${esc(t('onboarding.steps.annualGoal'))}</label>
          <input id="ob-annual" class="input" type="number" min="0" step="100" data-field="annualGoal" value="${esc(draft.annualGoal)}" />
        </div>`;

    case 8: {
      const tax = getCountryTaxProfile(draft.country);
      const regionLabel = tax.regionLabel === 'province' ? t('onboarding.steps.province') : t('onboarding.steps.state');
      const regionCode = String(draft.taxRegion || '').trim() || '—';
      return `
        <h1 class="onboarding-step-title">${esc(t('onboarding.steps.taxTitle'))}</h1>
        <p class="onboarding-step-lead">${esc(t('onboarding.steps.taxLead'))}</p>
        ${whyBlock('onboarding.why.taxSummary', 'onboarding.why.taxBody')}
        <input type="hidden" data-field="taxRegion" value="${esc(String(draft.taxRegion || '').trim())}" />
        <div class="input-group">
          <label class="input-label">${esc(regionLabel)}</label>
          <p class="onboarding-hint"><strong>${esc(regionCode)}</strong></p>
        </div>
        <div class="input-group">
          <label class="input-label" for="ob-tax-pct">${esc(t('onboarding.steps.taxWithholding'))}</label>
          <input id="ob-tax-pct" class="input" type="number" min="0" max="60" step="0.5" data-field="taxWithholdingPct" value="${esc(draft.taxWithholdingPct)}" />
        </div>
        <button type="button" class="btn btn-secondary btn-sm" data-tax-preset>${esc(t('onboarding.steps.applyPreset'))}</button>`;
    }

    case 9:
      if (!getCountryTaxProfile(draft.country).hstOnboarding) {
        return `<p class="onboarding-step-lead">${esc(t('onboarding.steps.hstSkip'))}</p>`;
      }
      return `
        <h1 class="onboarding-step-title">${esc(t('onboarding.steps.hstTitle'))}</h1>
        <p class="onboarding-step-lead">${esc(t('onboarding.steps.hstLead'))}</p>
        ${whyBlock('onboarding.why.hstSummary', 'onboarding.why.hstBody')}
        <label class="onboarding-check card card-raised">
          <input type="checkbox" data-field="hstRegistered" ${draft.hstRegistered ? 'checked' : ''} />
          <span>${esc(t('onboarding.steps.hstToggle'))}</span>
        </label>`;

    case 10:
      return `
        <div class="onboarding-completion ${'onboarding-completion--celebrate'}">
          <div class="onboarding-confetti" aria-hidden="true"></div>
          <h1 class="onboarding-step-title onboarding-completion-title">${esc(t('onboarding.steps.completeTitle').replace('{name}', draft.displayName.trim() || t('onboarding.steps.completeFallbackName')))}</h1>
          <p class="onboarding-step-lead">${esc(t('onboarding.steps.completeLead'))}</p>
          <div class="onboarding-completion-actions">
            <button type="button" class="btn btn-primary btn-lg" data-enter-vault>${getIcon('vault', 20)} ${esc(t('onboarding.steps.enterVault'))}</button>
            <button type="button" class="btn btn-secondary" data-connect-drive>${getIcon('google-drive', 18)} ${esc(t('settings.backupConnectBtn'))}</button>
            <button type="button" class="btn btn-secondary" data-export-setup>${esc(t('onboarding.steps.exportSetup'))}</button>
            <button type="button" class="btn btn-ghost" data-load-sample>${esc(t('onboarding.sample.load'))}</button>
          </div>
        </div>`;

    default:
      return `<p>${esc(t('errors.generic'))}</p>`;
  }
}

/**
 * @param {number} step
 * @param {OnboardingDraft} draft
 * @param {Array<{ id: string; name: string; color?: string }>} [platformRows]
 * @returns {string | null} i18n key for validation message
 */
export function validateStep(step, draft, platformRows = []) {
  switch (step) {
    case 0: {
      if (!draft.landingComplete) return null;
      const c = String(draft.country || '').trim().toUpperCase();
      return CountryRegistry.getAll().some((x) => x.id === c) ? null : 'onboarding.validation.country';
    }
    case 1: {
      const country = String(draft.country || '').toUpperCase();
      const provs = ProvinceRegistry.getByCountry(country);
      if (provs.length) {
        const r = String(draft.taxRegion || '').toUpperCase();
        return provs.some((p) => p.id === r) ? null : 'onboarding.validation.region';
      }
      return null;
    }
    case 2: {
      const filtered = filterPlatformRowsForOnboarding(draft, platformRows);
      if (!filtered.length) return 'onboarding.validation.platformsNone';
      if (!draft.selectedPlatforms.length) return 'onboarding.validation.platforms';
      const allow = new Set(filtered.map((r) => String(r.id).toLowerCase()));
      const ok = draft.selectedPlatforms.every((id) => allow.has(String(id).toLowerCase()));
      return ok ? null : 'onboarding.validation.platforms';
    }
    case 3:
      return draft.displayName.trim() ? null : 'onboarding.validation.name';
    case 4: {
      const v = draft.vehicles[0];
      return v && v.nickname.trim() && v.type ? null : 'onboarding.validation.vehicle';
    }
    case 8: {
      const n = Number(draft.taxWithholdingPct);
      return Number.isFinite(n) && n >= 0 && n <= 80 ? null : 'onboarding.validation.tax';
    }
    default:
      return null;
  }
}

/**
 * @param {OnboardingDraft} draft
 */
export function applyTaxPreset(draft) {
  const r = String(draft.taxRegion || '').trim().toUpperCase();
  if (!r || r === '—') return draft.taxWithholdingPct;
  const tax = getCountryTaxProfile(draft.country);
  const v = getWithholdingPresetPct(tax.regionPresetType, r);
  if (v != null) return v;
  if (tax.regionPresetType === 'US') return Number(tax.defaultWithholdingPct) >= 0 ? Number(tax.defaultWithholdingPct) : draft.taxWithholdingPct;
  return draft.taxWithholdingPct;
}
