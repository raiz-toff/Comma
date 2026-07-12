/**
 * Onboarding step bodies (plain HTML strings). Chrome lives in `onboarding.js`.
 *
 * **2 steps**: where you drive → your last shift → the reveal. Everything the app used to ask
 * here (name, vehicle, goals, schedule, tax %, HST, theme, sync) is derived, defaulted, or
 * deferred to the dashboard checklist — none of it is an input to the number the reveal shows,
 * and all of it was sitting in front of the value.
 *
 * Mirrors the phone app's `components/OnboardingWizard.tsx`. Keep the two flows in step.
 */

/**
 * @typedef {Object} OnboardingDraft
 * @property {number} step
 * @property {string[]} selectedPlatforms
 * @property {string} displayName
 * @property {'emoji'|'initials'|'custom'} avatarType
 * @property {string|null} avatarData
 * @property {string} country
 * @property {{ nickname: string; type: string; make: string; model: string; year: string; mileageOptOut: boolean; mileageRateOverride: string }[]} vehicles
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

export const TOTAL_STEPS = 2;


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
      { nickname: '', type: 'gas', make: '', model: '', year: '', mileageOptOut: false, mileageRateOverride: '' },
      { nickname: '', type: 'gas', make: '', model: '', year: '', mileageOptOut: false, mileageRateOverride: '' },
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
    // The backfilled shift — the only data (rather than config) onboarding collects.
    lastShift: { platformId: '', hours: '', gross: '', distance: '' },
    noShiftYet: false,
  };
}

function whyBlock(summaryKey, bodyKey) {
  return `<details class="onboarding-why"><summary class="onboarding-why-summary">${esc(t(summaryKey))}</summary><p class="onboarding-why-body">${esc(t(bodyKey))}</p></details>`;
}

function renderOnboardingLanding() {
  // Comma's namesake is the one decorative gesture on this screen: the commas in the
  // lead sentence take the brand color. Done post-escape so it survives any locale.
  const lead = esc(t('onboarding.landing.heroLead')).replace(
    /,/g,
    '<span class="onboarding-landing-comma">,</span>',
  );
  return `
    <div class="onboarding-landing">
      <header class="onboarding-landing-brand">
        <img src="/logo.png" alt="" class="onboarding-landing-logo" />
        <span class="onboarding-landing-wordmark">COMMA</span>
      </header>

      <div class="onboarding-landing-hero">
        <h1 class="onboarding-landing-title">${esc(t('onboarding.landing.heroTitle'))}</h1>
        <p class="onboarding-landing-lead">${lead}</p>
      </div>

      <div class="onboarding-landing-actions">
        <button type="button" class="btn btn-primary btn-lg onboarding-landing-primary" data-start-onboarding>${esc(t('onboarding.landing.startCta'))}</button>
        <button type="button" class="onboarding-landing-link" data-demo>${esc(t('onboarding.tryDemo'))}</button>
        <button type="button" class="onboarding-landing-link" data-action="restore-sync">${esc(t('onboarding.landing.restoreLink'))}</button>
        <p class="onboarding-landing-trust">${esc(t('onboarding.landing.trustLine'))}</p>
      </div>

      <footer class="onboarding-landing-footer">
        <nav class="onboarding-landing-footer-nav">
          <a href="https://comma-docs.vercel.app/privacy" target="_blank" rel="noopener noreferrer" class="onboarding-landing-footer-link">${esc(t('onboarding.landing.privacyLink'))}</a>
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
      const country = String(draft.country || 'CA').toUpperCase();
      const provs = ProvinceRegistry.getByCountry(country);
      const tax = getCountryTaxProfile(country);
      const regionLabel =
        tax.regionLabel === 'province'
          ? t('onboarding.steps.province')
          : tax.regionLabel === 'state'
            ? t('onboarding.steps.state')
            : t('onboarding.steps.regionShortLabel');

      // Region lives on the same screen as country — it was never a decision worth its own step,
      // and it's a real input to the tax rate and mileage rate we're about to show them.
      const regionBlock = provs.length
        ? `<div class="input-group">
            <label class="input-label" for="ob-region-input">${esc(regionLabel)}</label>
            <select id="ob-region-input" class="input" data-field="taxRegion" aria-label="${esc(regionLabel)}">
              ${provs
                .map((p) => {
                  const lab = subdivisionOptionLabel(p);
                  const sel = String(draft.taxRegion || '').toUpperCase() === p.id ? 'selected' : '';
                  return `<option value="${esc(p.id)}" ${sel}>${esc(lab)}</option>`;
                })
                .join('')}
            </select>
          </div>`
        : '';

      return `
        <h1 class="onboarding-step-title">${esc(t('onboarding.steps.locationTitle'))}</h1>
        <p class="onboarding-step-lead">${esc(t('onboarding.steps.locationLead'))}</p>
        <div class="input-group">
          <label class="input-label" for="ob-country">${esc(t('onboarding.steps.country'))}</label>
          <select id="ob-country" class="input" data-field="country">
            ${countries
              .map(
                (c) =>
                  `<option value="${esc(c.id)}" ${country === c.id ? 'selected' : ''}>${esc(t(c.labelKey))}</option>`,
              )
              .join('')}
          </select>
        </div>
        ${regionBlock}
        <p class="onboarding-hint">${esc(t('onboarding.steps.currencyHint'))}: <strong>${esc(cfg.currency)}</strong> (${esc(cfg.symbol)}) · ${
          cfg.distanceUnit === 'mi' ? esc(t('onboarding.steps.unitMi')) : esc(t('onboarding.steps.unitKm'))
        }</p>`;
    }

    case 1: {
      // The only screen in the flow that produces data rather than configuration.
      const cfg = getLocaleConfig(draft.country);
      const filtered = filterPlatformRowsForOnboarding(draft, platformRows);
      const ls = draft.lastShift || {};
      return `
        <h1 class="onboarding-step-title">${esc(t('onboarding.steps.lastShiftTitle'))}</h1>
        <p class="onboarding-step-lead">${esc(t('onboarding.steps.lastShiftLead'))}</p>

        <div class="input-group">
          <label class="input-label">${esc(t('onboarding.steps.lastShiftWhichApp'))}</label>
          <div class="onboarding-platform-grid" role="radiogroup" aria-label="${esc(t('onboarding.steps.lastShiftWhichApp'))}">
            ${filtered
              .map((p) => {
                const sel = String(ls.platformId || '') === p.id;
                const col = getPlatformColor(p.id);
                return `<button type="button" role="radio" aria-checked="${sel ? 'true' : 'false'}" class="onboarding-platform-card card card-interactive${sel ? ' is-selected' : ''}" data-last-shift-platform="${esc(p.id)}" style="--platform-color:${esc(col)}">
                  <span class="onboarding-platform-badge">${renderPlatformBadge(p.id, p.name)}</span>
                  <span class="onboarding-platform-name">${esc(p.name)}</span>
                </button>`;
              })
              .join('')}
          </div>
        </div>

        <div class="input-group">
          <label class="input-label" for="ob-ls-hours">${esc(t('onboarding.steps.lastShiftHours'))}</label>
          <input id="ob-ls-hours" class="input" type="number" inputmode="decimal" min="0" step="0.25"
                 placeholder="5" data-field="lastShiftHours" value="${esc(ls.hours ?? '')}" autocomplete="off" />
        </div>

        <div class="input-group">
          <label class="input-label" for="ob-ls-gross">${esc(t('onboarding.steps.lastShiftGross'))} (${esc(cfg.symbol)})</label>
          <input id="ob-ls-gross" class="input" type="number" inputmode="decimal" min="0" step="0.01"
                 placeholder="142" data-field="lastShiftGross" value="${esc(ls.gross ?? '')}" autocomplete="off" />
        </div>

        <div class="input-group">
          <label class="input-label" for="ob-ls-distance">${esc(t('onboarding.steps.lastShiftDistance'))} (${esc(cfg.distanceUnit)})</label>
          <input id="ob-ls-distance" class="input" type="number" inputmode="decimal" min="0" step="0.1"
                 placeholder="47" data-field="lastShiftDistance" value="${esc(ls.distance ?? '')}" autocomplete="off" />
          <p class="onboarding-hint">${esc(t('onboarding.steps.lastShiftDistanceHint'))}</p>
        </div>

        <button type="button" class="btn btn-ghost onboarding-skip-shift" data-no-shift-yet>
          ${esc(t('onboarding.steps.lastShiftNone'))}
        </button>`;
    }

    default:
      return `<p>${esc(t('errors.generic'))}</p>`;
  }
}

/**
 * The activation moment — sequences three numbers the app already computes into the one
 * realisation gig drivers never get from the platforms themselves: gross is not take-home.
 * @param {ReturnType<import('./firstShift.js').computeFirstShift>} m
 */
export function renderReveal(m) {
  const money = (n) =>
    `${m.currencySymbol}${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const writeOff =
    m.hasMileageDeduction && m.mileageWriteOff > 0
      ? `<div class="onboarding-reveal-writeoff">
          <strong>+ ${esc(money(m.mileageWriteOff))} ${esc(t('onboarding.reveal.writeOffLabel'))}</strong>
          <p>${esc(
            t('onboarding.reveal.writeOffBody')
              .replace('{distance}', String(m.distance))
              .replace('{unit}', m.distanceUnit)
              .replace('{rate}', m.mileageRateLabel),
          )}</p>
        </div>`
      : '';

  return `
    <div class="onboarding-reveal">
      <p class="onboarding-reveal-kicker">${esc(t('onboarding.reveal.kicker'))}</p>
      <p class="onboarding-reveal-intro">${esc(
        t('onboarding.reveal.intro')
          .replace('{gross}', money(m.gross))
          .replace('{hours}', String(m.hours))
          .replace('{grossHourly}', money(m.grossHourly)),
      )}</p>

      <div class="onboarding-reveal-hero card">
        <span class="onboarding-reveal-hero-label">${esc(t('onboarding.reveal.heroLabel'))}</span>
        <span class="onboarding-reveal-hero-value" data-reveal-hourly
              data-from="${esc(String(m.grossHourly))}" data-to="${esc(String(m.realHourly))}"
              data-symbol="${esc(m.currencySymbol)}">${esc(money(m.grossHourly))}<small>/hr</small></span>
        <span class="onboarding-reveal-hero-sub">${esc(
          t('onboarding.reveal.heroSub')
            .replace('{takeHome}', money(m.takeHome))
            .replace('{taxSetAside}', money(m.taxSetAside)),
        )}</span>
      </div>

      <dl class="onboarding-reveal-receipt">
        <div><dt>${esc(t('onboarding.reveal.earned'))}</dt><dd>${esc(money(m.gross))}</dd></div>
        <div><dt>${esc(t('onboarding.reveal.taxRow').replace('{pct}', String(m.withholdingPct)))}</dt><dd>− ${esc(money(m.taxSetAside))}</dd></div>
        <div class="is-total"><dt>${esc(t('onboarding.reveal.keep'))}</dt><dd>${esc(money(m.takeHome))}</dd></div>
      </dl>

      ${writeOff}

      <div class="onboarding-completion-actions">
        <button type="button" class="btn btn-primary btn-lg" data-enter-vault>${getIcon('vault', 20)} ${esc(t('onboarding.reveal.enter'))}</button>
      </div>
      <p class="onboarding-hint onboarding-reveal-footnote">${esc(t('onboarding.reveal.footnote'))}</p>
    </div>`;
}

/** Shown instead of the reveal when the driver hasn't worked yet. The dashboard empty state takes over. */
export function renderNoShiftYet() {
  return `
    <div class="onboarding-reveal">
      <p class="onboarding-reveal-kicker">${esc(t('onboarding.noShift.kicker'))}</p>
      <h1 class="onboarding-step-title">${esc(t('onboarding.noShift.title'))}</h1>
      <p class="onboarding-step-lead">${esc(t('onboarding.noShift.body'))}</p>
      <div class="onboarding-completion-actions">
        <button type="button" class="btn btn-primary btn-lg" data-enter-vault>${getIcon('vault', 20)} ${esc(t('onboarding.reveal.enter'))}</button>
      </div>
    </div>`;
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
      if (!CountryRegistry.getAll().some((x) => x.id === c)) return 'onboarding.validation.country';
      const provs = ProvinceRegistry.getByCountry(c);
      if (provs.length) {
        const r = String(draft.taxRegion || '').toUpperCase();
        if (!provs.some((p) => p.id === r)) return 'onboarding.validation.region';
      }
      return null;
    }
    case 1: {
      const ls = draft.lastShift || {};
      const filtered = filterPlatformRowsForOnboarding(draft, platformRows);
      if (!filtered.length) return 'onboarding.validation.platformsNone';
      if (!ls.platformId) return 'onboarding.validation.lastShiftPlatform';
      if (!(Number(ls.hours) > 0)) return 'onboarding.validation.lastShiftHours';
      if (!(Number(ls.gross) > 0)) return 'onboarding.validation.lastShiftGross';
      return null;
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
