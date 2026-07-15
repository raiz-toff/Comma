import { db, saveUser } from '../../core/db.js';
import {
  calcCPPContribution,
  calcHSTRemittable,
  calcSEtax,
  calcTaxSetAside,
} from '../../utils/calculations.js';
import { formatCurrency, formatLargeNumber, formatPercent } from '../../utils/formatters.js';
import { getAllTaxDeadlines, getLocaleConfig } from '../../utils/locale.js';
import { getCountryTaxProfile } from '../../registry/countries/index.js';
import { getVehicleMileageEligibility } from '../../registry/countries/mileageRates.js';
import { getEffectiveMileageRate, calculateMileageWriteOff, upsertTaxProfile } from '../vehicles/taxProfiles.js';
import { WITHHOLDING_PRESETS_CA } from '../../registry/tax/withholding-presets.js';
import { t } from '../../utils/strings.js';
import { showToast } from '../../ui/components.js';
import { getIcon } from '../../ui/icons.js';

const DEFAULT_CA_REGION = 'ON';
const TAX_VIRTUAL_JAR_KEY = 'tax_virtual_jar';

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

function toYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function parseAppStateValue(row, fallback = 0) {
  if (!row || typeof row.value !== 'string') return fallback;
  try {
    return JSON.parse(row.value);
  } catch {
    return fallback;
  }
}

// Tax Jar balance lives in the SYNCED `db.profile` table (key `taxJar_{year}`) rather than the
// device-local `db.appState`, so the amount you've set aside for taxes carries over between
// web and phone instead of tracking two separate balances per device. Mirrors mobile's
// src/database/queries/tax.ts getTaxJarBalance/setTaxJarBalance — same key scheme, same table
// role (profile is already a generically-synced per-key KV table on both sides).
function taxJarKey(year) {
  return `taxJar_${year}`;
}

/** One-time upgrade path: pulls a balance saved under the old device-local appState key(s)
 *  into the synced profile row, so existing users don't see their jar reset to $0. */
async function migrateLegacyJarBalance(year) {
  const legacyKey = `${TAX_VIRTUAL_JAR_KEY}_${year}`;
  let legacyRecord = await db.appState.get(legacyKey);
  if (!legacyRecord) {
    const veryLegacy = await db.appState.get(TAX_VIRTUAL_JAR_KEY);
    if (veryLegacy) {
      legacyRecord = veryLegacy;
      await db.appState.put({ ...veryLegacy, key: legacyKey });
      await db.appState.delete(TAX_VIRTUAL_JAR_KEY);
    }
  }
  if (!legacyRecord) return 0;
  const legacyValue = num(parseAppStateValue(legacyRecord, 0), 0);
  await setTaxJarBalance(year, legacyValue);
  return legacyValue;
}

async function getTaxJarBalance(year) {
  const row = await db.profile.get(taxJarKey(year));
  if (row && row.syncDeletedAt == null) {
    try {
      return num(JSON.parse(row.value), 0);
    } catch {
      return 0;
    }
  }
  return migrateLegacyJarBalance(year);
}

async function setTaxJarBalance(year, amount) {
  const jarKey = taxJarKey(year);
  const existing = await db.profile.get(jarKey);
  await db.profile.put({
    ...(existing || {}),
    key: jarKey,
    value: JSON.stringify(Math.max(0, amount)),
    syncUpdatedAt: Date.now(),
    syncDeletedAt: null,
  });
}

function downloadTextFile(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 150);
}

/**
 * @param {ReturnType<typeof getCountryTaxProfile>} taxProfile
 */
function buildRegionOptions(taxProfile) {
  if (taxProfile.regionPresetType === 'CA') {
    const map = WITHHOLDING_PRESETS_CA;
    return Object.entries(map).map(([code, rate]) => ({ code, rate }));
  }
  return [];
}

/**
 * @param {ReturnType<typeof getCountryTaxProfile>} taxProfile
 */
function defaultRegionCode(taxProfile) {
  return taxProfile.defaultRegionCode || DEFAULT_CA_REGION;
}

/**
 * @param {ReturnType<typeof getCountryTaxProfile>} taxProfile
 */
function getTaxRatePresets(taxProfile) {
  if (taxProfile.regionPresetType === 'CA') return WITHHOLDING_PRESETS_CA;
  return /** @type {Record<string, number>} */ ({});
}

async function loadTaxSummary(year) {
  const user = (await db.users.get(1)) || null;
  const country = String(user?.locale?.country || 'US').toUpperCase();
  const taxProfile = getCountryTaxProfile(country);
  const currency = user?.locale?.currency || taxProfile.fallbackCurrency;
  const localeTag = taxProfile.intlLocaleTag;
  const shifts = await db.shifts
    .where('date')
    .between(`${year}-01-01`, `${year}-12-31`, true, true)
    .filter((row) => row.deletedAt == null)
    .toArray();
  const expenses = await db.expenses
    .where('date')
    .between(`${year}-01-01`, `${year}-12-31`, true, true)
    .filter((row) => row.deletedAt == null)
    .toArray();

  const gross = shifts.reduce(
    (sum, s) => sum + num(s.grossRevenue) + num(s.tipsRevenue) + (Number(s.bonusAmount) || 0),
    0,
  );
  // Only count a vehicle-tagged expense (fuel, insurance, ...) if that vehicle was actually
  // driven this year — otherwise a car expense gets deducted from a bike-only year's earnings.
  // General expenses (no vehicleId) always count. Mirrors mobile's tax queries.
  const vehicleIdsUsedThisYear = new Set(shifts.map((s) => s.vehicleId).filter(Boolean));
  const businessExpenses = expenses.reduce((sum, e) => {
    if (e.vehicleId && !vehicleIdsUsedThisYear.has(e.vehicleId)) return sum;
    return sum + num(e.amount) * (num(e.deductiblePct, 100) / 100);
  }, 0);
  const netIncome = Math.max(0, gross - businessExpenses);
  const taxRatePct = num(user?.taxWithholdingPct, taxProfile.defaultWithholdingPct);
  const taxSetAside = calcTaxSetAside(gross, taxRatePct);
  const virtualJar = await getTaxJarBalance(year);
  const setAsideCoveragePct = taxSetAside > 0 ? Math.min(100, (virtualJar / Math.max(1, taxSetAside)) * 100) : 0;

  const hstRate = taxProfile.hstRateWhenRegistered || 0;
  const hstCollected = user?.hstRegistered ? gross * hstRate : 0;
  const itcTotal = expenses.reduce((sum, e) => sum + num(e.hstPaid ?? e.hstItcAmount), 0);
  const hstRemittable = calcHSTRemittable(hstCollected, itcTotal);

  const distanceKm = shifts.reduce((sum, s) => sum + num(s.activeMileage), 0);
  const totalMiles = distanceKm * 0.621371192;
  const actualCostDeduction = businessExpenses;

  // Eligibility-aware standard-mileage estimate: a saved tax profile (custom rate or explicit
  // opt-out) always wins over the researched country/vehicle-type default, and the default
  // itself only applies when this vehicle type is actually eligible (e.g. a bicycle isn't
  // eligible for the CRA/IRS automobile mileage rate). Mirrors mobile's tax screen. `vehicle`/
  // `mileageRate` stay a single vehicle — that's what the editable rate/opt-out panel below
  // edits — but the deduction TOTAL is resolved per-vehicle and summed (see mileageDeduction),
  // so a multi-vehicle driver's write-off isn't computed off just one vehicle's rate.
  const vehicle = (await db.vehicles.toArray()).find((v) => v.isActive && v.syncDeletedAt == null) ?? null;
  let mileageRate = null;
  if (vehicle) {
    mileageRate = await getEffectiveMileageRate(vehicle.id, year, country, vehicle.type);
  }

  let mileageDeduction = 0;
  {
    const mileageByVehicle = new Map();
    for (const s of shifts) {
      const vehicleId = s.vehicleId ?? null;
      const row = mileageByVehicle.get(vehicleId) ?? 0;
      mileageByVehicle.set(vehicleId, row + num(s.activeMileage));
    }
    const allVehicles = await db.vehicles.toArray();
    for (const [vehicleId, km] of mileageByVehicle) {
      if (!vehicleId) continue;
      const v = allVehicles.find((x) => x.id === vehicleId);
      if (!v) continue;
      const rate = await getEffectiveMileageRate(vehicleId, year, country, v.type);
      // Rates (default or custom) are entered/researched in the country's native distance
      // unit — US is per-mile, CA is per-km.
      const distanceForRate = country === 'US' ? km * 0.621371192 : km;
      mileageDeduction += calculateMileageWriteOff(distanceForRate, rate);
    }
  }

  // Mileage reduces taxable income the same way logged expenses do — CPP/SE-tax must be based
  // on income AFTER the mileage deduction, not just after expenses (previously mileageDeduction
  // was computed here and only ever displayed, never actually subtracted before these ran).
  const taxableIncome = Math.max(0, netIncome - mileageDeduction);
  const cppEstimate = taxProfile.calcCpp ? calcCPPContribution(taxableIncome, year) : 0;
  const seTaxEstimate = taxProfile.calcSeTax ? calcSEtax(taxableIncome) : 0;
  const deadlines = getAllTaxDeadlines(country, year);
  const totalEstimatedTax = cppEstimate + seTaxEstimate + hstRemittable;

  return {
    year,
    country,
    taxProfile,
    currency,
    localeTag,
    taxRatePct,
    gross,
    businessExpenses,
    netIncome,
    taxSetAside,
    virtualJar,
    setAsideCoveragePct,
    hstCollected,
    itcTotal,
    hstRemittable,
    distanceKm,
    totalMiles,
    actualCostDeduction,
    vehicle,
    mileageRate,
    mileageDeduction,
    cppEstimate,
    seTaxEstimate,
    totalEstimatedTax,
    user,
    deadlines,
    distanceUnit: getLocaleConfig(country).distanceUnit === 'mi' ? 'mi' : 'km',
    generatedAt: new Date().toISOString(),
  };
}

/**
 * The top 2-3 things that make up what you owe, as compact pills under the "estimated taxes"
 * hero — mirrors mobile's obligation pills (biggest line items first). Everything that isn't a
 * pill still shows in the full breakdown below.
 * @param {Awaited<ReturnType<typeof loadTaxSummary>>} summary
 */
function topObligations(summary) {
  const tp = summary.taxProfile;
  const items = [];
  if (tp.secondaryEstimator === 'cpp' && summary.cppEstimate > 0) {
    items.push({ label: t('tax.cppEstimator'), amount: summary.cppEstimate });
  } else if (tp.secondaryEstimator === 'se' && summary.seTaxEstimate > 0) {
    items.push({ label: t('tax.seTaxEstimator'), amount: summary.seTaxEstimate });
  }
  if (tp.hstOnboarding && summary.hstRemittable > 0) {
    items.push({ label: t('tax.remittable'), amount: summary.hstRemittable });
  }
  return items.sort((a, b) => b.amount - a.amount).slice(0, 3);
}

function toTaxSummaryJson(summary) {
  return JSON.stringify(
    {
      generatedAt: summary.generatedAt,
      year: summary.year,
      country: summary.country,
      currency: summary.currency,
      taxRatePct: summary.taxRatePct,
      gross: summary.gross,
      businessExpenses: summary.businessExpenses,
      netIncome: summary.netIncome,
      taxSetAside: summary.taxSetAside,
      virtualJar: summary.virtualJar,
      hstCollected: summary.hstCollected,
      itcTotal: summary.itcTotal,
      hstRemittable: summary.hstRemittable,
      distanceKm: summary.distanceKm,
      totalMiles: summary.totalMiles,
      actualCostDeduction: summary.actualCostDeduction,
      mileageDeduction: summary.mileageDeduction,
      cppEstimate: summary.cppEstimate,
      seTaxEstimate: summary.seTaxEstimate,
      totalEstimatedTax: summary.totalEstimatedTax,
      deadlines: summary.deadlines.map((d) => ({
        label: d.label,
        date: toYmd(d.date),
        daysUntil: d.daysUntil,
      })),
    },
    null,
    2,
  );
}

function toTaxSummaryCsv(summary) {
  const rows = [
    ['metric', 'value'],
    ['generated_at', summary.generatedAt],
    ['tax_year', summary.year],
    ['country', summary.country],
    ['currency', summary.currency],
    ['tax_rate_pct', summary.taxRatePct],
    ['gross', summary.gross],
    ['business_expenses', summary.businessExpenses],
    ['net_income', summary.netIncome],
    ['tax_set_aside', summary.taxSetAside],
    ['virtual_jar', summary.virtualJar],
    ['hst_collected', summary.hstCollected],
    ['itc_total', summary.itcTotal],
    ['hst_remittable', summary.hstRemittable],
    ['distance_km', summary.distanceKm],
    ['distance_miles', summary.totalMiles],
    ['actual_cost_deduction', summary.actualCostDeduction],
    ['mileage_deduction', summary.mileageDeduction],
    ['cpp_estimate', summary.cppEstimate],
    ['se_tax_estimate', summary.seTaxEstimate],
    ['total_estimated_tax', summary.totalEstimatedTax],
  ];
  summary.deadlines.forEach((d, idx) => {
    rows.push([`deadline_${idx + 1}`, `${toYmd(d.date)} (${d.label})`]);
  });
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
}

async function exportTaxSummary(summary, format) {
  const fileSafeCountry = summary.country.toLowerCase();
  if (format === 'json') {
    downloadTextFile(
      `comma-tax-summary-${fileSafeCountry}-${summary.year}.json`,
      toTaxSummaryJson(summary),
      'application/json;charset=utf-8',
    );
  } else {
    downloadTextFile(
      `comma-tax-summary-${fileSafeCountry}-${summary.year}.csv`,
      toTaxSummaryCsv(summary),
      'text/csv;charset=utf-8',
    );
  }
}

/**
 * Everything that adds up to what the user owes, in one place — previously split across a
 * standalone CPP/SE-tax card and a separate HST card with no combined total shown anywhere.
 * @param {Awaited<ReturnType<typeof loadTaxSummary>>} summary
 */
function renderObligationsCard(summary) {
  const tp = summary.taxProfile;
  const loc = summary.localeTag;
  const cur = summary.currency;
  const fmt = (v) => formatCurrency(v, loc, { currency: cur });

  let secondaryTitle = t('tax.genericEstimatorTitle');
  let secondaryValue = 0;
  let secondaryNote = t('tax.genericEstimatorNote');

  if (tp.secondaryEstimator === 'cpp') {
    secondaryTitle = t('tax.cppEstimator');
    secondaryValue = summary.cppEstimate;
    secondaryNote = t('tax.cppNote');
  } else if (tp.secondaryEstimator === 'se') {
    secondaryTitle = t('tax.seTaxEstimator');
    secondaryValue = summary.seTaxEstimate;
    secondaryNote = t('tax.seTaxNote');
  }

  const hstRows = tp.hstOnboarding
    ? `
        <div class="tax-metric-item">
          <span class="tax-metric-label">${esc(t('tax.hstCollectedTracker'))}</span>
          <span class="tax-metric-value">${esc(fmt(summary.hstCollected))}</span>
        </div>
        <div class="tax-metric-item">
          <span class="tax-metric-label">${esc(t('tax.itcTracker'))}</span>
          <span class="tax-metric-value is-negative">${esc(fmt(summary.itcTotal))}</span>
        </div>
        <div class="tax-metric-item">
          <span class="tax-metric-label">${esc(t('tax.remittable'))}</span>
          <span class="tax-metric-value">${esc(fmt(summary.hstRemittable))}</span>
        </div>`
    : '';

  return `
    <div class="tax-metric-row" style="margin-top: 0;">
      <div class="tax-metric-item">
        <span class="tax-metric-label">${esc(secondaryTitle)}</span>
        <span class="tax-metric-value">${esc(fmt(secondaryValue))}</span>
      </div>
      ${hstRows}
      <div class="tax-metric-item is-total">
        <span class="tax-metric-label">${esc(t('tax.totalEstimatedTax'))}</span>
        <span class="tax-metric-value" style="font-size: var(--text-lg);">${esc(fmt(summary.totalEstimatedTax))}</span>
      </div>
    </div>
    <p style="color:var(--color-text-secondary); font-size: var(--text-xs); margin-top: var(--space-3); line-height: 1.4;">
      ${esc(secondaryNote)}
    </p>`;
}

/**
 * Closed-by-default accordion row: header shows the title + an at-a-glance preview value so the
 * page stays scannable with everything collapsed; body holds the existing detailed content.
 */
function renderAccordionItem(key, title, preview, bodyHtml) {
  return `
    <div class="tax-accordion-item" data-accordion-item="${key}">
      <button type="button" class="tax-accordion-header" data-accordion-toggle="${key}" aria-expanded="false">
        <span class="tax-accordion-title">${esc(title)}</span>
        <span class="tax-accordion-right">
          ${preview ? `<span class="tax-accordion-preview">${esc(preview)}</span>` : ''}
          <span class="tax-accordion-chevron">${getIcon('chevron-down', 16)}</span>
        </span>
      </button>
      <div class="tax-accordion-body" data-accordion-body="${key}" hidden>
        ${bodyHtml}
      </div>
    </div>`;
}

export async function renderTaxDashboard(root, ctx = {}) {
  const selectedYear = Math.floor(num(ctx.taxYear, new Date().getFullYear()));
  const summary = await loadTaxSummary(selectedYear);
  const regionOptions = buildRegionOptions(summary.taxProfile);
  const rateMap = getTaxRatePresets(summary.taxProfile);
  const storedRegion = String(summary.user?.taxRegion || defaultRegionCode(summary.taxProfile));
  const selectedRegion =
    regionOptions.length > 0 && regionOptions.some((r) => r.code === storedRegion)
      ? storedRegion
      : regionOptions.length > 0
        ? defaultRegionCode(summary.taxProfile)
        : '';
  const selectedRegionRate = selectedRegion ? num(rateMap[selectedRegion], summary.taxRatePct) : summary.taxRatePct;
  const netAfterSetAside = summary.netIncome - summary.taxSetAside;
  const mileageUnitLabel = summary.distanceUnit === 'mi' ? t('tax.miles') : t('tax.kilometres');
  const regionLabel = summary.taxProfile.regionLabel === 'province' ? t('tax.province') : t('tax.state');
  const fmt = (v) => formatCurrency(v, summary.localeTag, { currency: summary.currency });

  const nextDeadline =
    summary.deadlines.slice().sort((a, b) => a.daysUntil - b.daysUntil).find((d) => d.daysUntil >= 0) ||
    summary.deadlines[0] ||
    null;
  const deadlinePreview = nextDeadline
    ? `${nextDeadline.label} · ${nextDeadline.daysUntil < 0 ? t('tax.overdue') : `${nextDeadline.daysUntil}d`}`
    : '';

  // Top-of-page "Tax savings jar" hero — the number a driver checks and acts on most. Mirrors
  // mobile's jar card: big "saved" figure, target on the right, a progress bar, and quick chips
  // to log what you set aside. The target follows the region preset the driver has selected.
  const jarTarget = calcTaxSetAside(summary.gross, selectedRegionRate);
  const jarPct = jarTarget > 0 ? Math.min(100, (summary.virtualJar / jarTarget) * 100) : 0;
  const jarCard = `
    <article class="card card-raised tax-hero tax-jar-card">
      <div class="tax-jar-top">
        <div class="tax-jar-saved">
          <span class="tax-hero-label">${esc(t('tax.savedForTaxes'))} · ${selectedYear}</span>
          <span class="tax-hero-value is-positive">${esc(fmt(summary.virtualJar))}</span>
        </div>
        <div class="tax-jar-target">
          <span class="tax-hero-label">${esc(t('tax.targetSetAside'))}</span>
          <span class="tax-jar-target-value">${esc(fmt(jarTarget))}</span>
        </div>
      </div>
      <div class="tax-jar-bar"><div class="tax-jar-bar-fill" style="width:${jarPct.toFixed(0)}%;"></div></div>
      <span class="tax-hero-sub">${esc(`${formatPercent(jarPct, 0)} ${t('tax.ofTargetSaved')}`)}</span>
      <div class="tax-jar-controls">
        <ion-chip data-jar-adjust="-25">-25</ion-chip>
        <ion-chip data-jar-adjust="-10">-10</ion-chip>
        <ion-chip data-jar-adjust="10">+10</ion-chip>
        <ion-chip data-jar-adjust="25">+25</ion-chip>
      </div>
    </article>`;

  // "Estimated taxes you owe" hero — the total plus the 2-3 biggest line items as pills; the
  // full row-by-row breakdown lives in the collapsible below.
  const owedPills = topObligations(summary);
  const owedCard = `
    <article class="card card-raised tax-hero">
      <span class="tax-hero-label">${esc(t('tax.obligationsTitle'))} · ${selectedYear}</span>
      <span class="tax-hero-value">${esc(fmt(summary.totalEstimatedTax))}</span>
      ${owedPills.length > 0 ? `
      <div class="tax-owe-pills">
        ${owedPills.map((p) => `<span class="tax-owe-pill">${esc(p.label)} <strong>${esc(fmt(p.amount))}</strong></span>`).join('')}
      </div>` : ''}
      <span class="tax-hero-sub">${esc(t('tax.grossIncome'))} ${esc(fmt(summary.gross))} · ${esc(t('tax.netAfterSetAside'))} ${esc(fmt(netAfterSetAside))}</span>
    </article>`;

  const nextDeadlineRow = nextDeadline
    ? `
    <div class="tax-next-deadline">
      <span class="tax-next-deadline-icon">${getIcon('clock', 16)}</span>
      <span class="tax-next-deadline-label">${esc(t('tax.nextPayment'))}</span>
      <span class="tax-next-deadline-name">${esc(nextDeadline.label)}</span>
      <span class="tax-next-deadline-days ${nextDeadline.daysUntil < 0 ? 'is-urgent' : ''}">${nextDeadline.daysUntil < 0 ? esc(t('tax.overdue')) : `${nextDeadline.daysUntil}d`}</span>
    </div>`
    : '';

  const incomeBody = `
    <div class="tax-metric-row" style="margin-top: 0;">
      <div class="tax-metric-item">
        <span class="tax-metric-label">${esc(t('tax.grossIncome'))}</span>
        <span class="tax-metric-value">${esc(fmt(summary.gross))}</span>
      </div>
      <div class="tax-metric-item">
        <span class="tax-metric-label">${esc(t('tax.businessExpenses'))}</span>
        <span class="tax-metric-value is-negative">${esc(fmt(summary.businessExpenses))}</span>
      </div>
      <div class="tax-metric-item">
        <span class="tax-metric-label">${esc(t('tax.netIncome'))}</span>
        <span class="tax-metric-value" style="font-size: var(--text-lg);">${esc(fmt(summary.netIncome))}</span>
      </div>
      <div class="tax-metric-item">
        <span class="tax-metric-label">${esc(t('tax.netAfterSetAside'))}</span>
        <span class="tax-metric-value" style="opacity: 0.7;">${esc(fmt(netAfterSetAside))}</span>
      </div>
    </div>
    <p style="margin-top: var(--space-4); color: var(--color-text-secondary); font-size: var(--text-xs); line-height: 1.4;">
      ${esc(t('tax.netIncomeNote'))}
    </p>`;

  const deadlinesBody = `
    <div class="tax-deadline-list" style="margin-top: 0;">
      ${summary.deadlines.map(row => {
        const dt = row.date;
        const urgent = row.daysUntil >= 0 && row.daysUntil <= 14;
        const overdue = row.daysUntil < 0;
        return `
          <div class="tax-deadline-item">
            <div class="tax-deadline-date">
              <span class="tax-deadline-day">${dt.getDate()}</span>
              <span class="tax-deadline-month">${dt.toLocaleDateString(undefined, { month: 'short' })}</span>
            </div>
            <div class="tax-deadline-info">
              <div class="tax-deadline-label">${esc(row.label)}</div>
              <div class="tax-deadline-status ${urgent || overdue ? 'is-urgent' : ''}">
                ${overdue ? esc(t('tax.overdue')) : `${row.daysUntil}d remaining`}
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>`;

  const vehicleBody = `
    <div class="bento-grid" style="margin-top: 0; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
      <div class="tax-metric-item">
        <span class="tax-metric-label">${esc(t('tax.totalDistance'))}</span>
        <span class="tax-metric-value">${esc(`${formatLargeNumber(summary.distanceUnit === 'mi' ? summary.totalMiles : summary.distanceKm)} ${mileageUnitLabel}`)}</span>
      </div>
      <div class="tax-metric-item">
        <span class="tax-metric-label">${esc(t('tax.actualCost'))}</span>
        <span class="tax-metric-value">${esc(fmt(summary.actualCostDeduction))}</span>
      </div>
      ${summary.vehicle ? `
      <div class="tax-metric-item">
        <span class="tax-metric-label">${esc(t('tax.standardMileage'))}</span>
        <span class="tax-metric-value">${esc(fmt(summary.mileageDeduction))}</span>
      </div>` : ''}
    </div>
    <p style="color:var(--color-text-secondary); font-size: var(--text-sm); margin-top: var(--space-3); border-top: 1px solid var(--color-border); padding-top: var(--space-3);">
      ${esc(t('tax.actualCostsNote'))}
    </p>
    ${summary.vehicle ? `
    <div style="border:1px solid var(--color-border); border-radius:10px; padding:12px; margin-top: var(--space-3); display:flex; flex-direction:column; gap:10px;">
      <p style="margin:0; font-size: var(--text-sm); color: var(--color-text-secondary);">
        ${summary.mileageRate?.isUserOverride
          ? summary.mileageRate.deductionMethod === 'standard_mileage'
            ? esc(`${t('tax.standardMileage')} — $${summary.mileageRate.ratePrimary}`)
            : esc(t('tax.mileageWriteOffOptedOut'))
          : summary.mileageRate?.deductionMethod === 'standard_mileage'
            ? esc(`${summary.mileageRate.label} — $${summary.mileageRate.ratePrimary}`)
            : esc(t('tax.mileageWriteOffNotEligible'))}
      </p>
      <ion-toggle class="tax-mileage-optout" label-placement="start" justify="space-between" data-mileage-optout ${summary.mileageRate?.deductionMethod === 'actual_expenses' && summary.mileageRate?.isUserOverride ? 'checked' : ''}>${esc(t('tax.mileageWriteOffOptOut'))}</ion-toggle>
      <div class="input-group" style="margin:0;" data-mileage-rate-wrap ${summary.mileageRate?.deductionMethod === 'actual_expenses' && summary.mileageRate?.isUserOverride ? 'hidden' : ''}>
        <p style="margin:0 0 4px; font-size: var(--text-xs); color: var(--color-text-secondary);">${esc(t('tax.mileageWriteOffHint'))}</p>
        <input class="input" type="number" step="0.001" inputmode="decimal" data-mileage-rate-input
          placeholder="${summary.mileageRate?.ratePrimary != null ? esc(String(summary.mileageRate.ratePrimary)) : '0.67'}"
          value="${summary.mileageRate?.isUserOverride && summary.mileageRate?.deductionMethod === 'standard_mileage' ? esc(String(summary.mileageRate.ratePrimary ?? '')) : ''}" />
        <ion-button size="small" fill="outline" data-mileage-rate-save style="margin-top:8px;">${esc(t('common.save'))}</ion-button>
      </div>
    </div>` : ''}`;

  const settingsBody = `
    <div style="display:flex; flex-wrap:wrap; gap: var(--space-6);">
      ${regionOptions.length > 0 ? `
        <div style="flex: 1 1 220px; display:flex; flex-direction: column; gap: var(--space-3);">
          <label class="input-group" style="margin:0;">
            <span class="input-label">${esc(regionLabel)}</span>
            <select class="select" data-tax-region>
              ${regionOptions.map((row) => `<option value="${row.code}" ${row.code === selectedRegion ? 'selected' : ''}>${row.code} (${row.rate}%)</option>`).join('')}
            </select>
          </label>
          <ion-button data-apply-rate>${esc(t('tax.applyPreset'))}</ion-button>
        </div>
      ` : ''}
      <div class="tax-metric-row" style="flex: 1 1 220px; margin-top: 0;">
        <div class="tax-metric-item">
          <span class="tax-metric-label">${esc(t('tax.currentRate'))}</span>
          <span class="tax-metric-value">${esc(formatPercent(summary.taxRatePct))}</span>
        </div>
        <div class="tax-metric-item">
          <span class="tax-metric-label">${esc(t('tax.country'))}</span>
          <span class="tax-metric-value">${esc(summary.country)}</span>
        </div>
      </div>
    </div>`;

  // Everything that used to be its own top-level accordion row now lives inside one "Full
  // breakdown" body — income, the owe-it row-by-row, and the vehicle/mileage section — so the
  // page opens as just the two hero cards + next deadline, and detail is one tap away.
  const fullBreakdownBody = `
    ${incomeBody}
    <h3 style="margin-top: var(--space-6); font-size: var(--text-sm); font-weight: 700;">${esc(t('tax.sectionObligations'))}</h3>
    ${renderObligationsCard(summary)}
    <h3 style="margin-top: var(--space-6); font-size: var(--text-sm); font-weight: 700;">${esc(t('tax.vehicleActualCosts'))}</h3>
    ${vehicleBody}`;

  root.innerHTML = `
    <section class="tax-view">
      <header class="card card-raised tax-header">
        <div class="tax-header-title">
          <h1>${esc(t('tax.title'))}</h1>
          <p>${esc(t('tax.subtitle'))}</p>
        </div>
        <div style="display: flex; gap: var(--space-3); align-items: center;">
          <label class="input-group" style="margin: 0;">
            <span class="input-label">${esc(t('tax.taxYear'))}</span>
            <select class="select" data-tax-year style="padding-top: 0; padding-bottom: 0; height: 36px;">
              ${[0, 1, 2].map((delta) => {
                const y = new Date().getFullYear() - delta;
                return `<option value="${y}" ${y === selectedYear ? 'selected' : ''}>${y}</option>`;
              }).join('')}
            </select>
          </label>
        </div>
      </header>

      <!-- Two hero cards a driver reads at a glance: what they've set aside, and what they'll owe. -->
      <div class="tax-cards">
        ${jarCard}
        ${owedCard}
      </div>

      ${nextDeadlineRow}

      <!-- Detail is collapsed by default so the page opens on just the numbers that matter. -->
      <div class="tax-accordion">
        ${renderAccordionItem('breakdown', t('tax.fullBreakdown'), fmt(summary.totalEstimatedTax), fullBreakdownBody)}
        ${renderAccordionItem('deadlines', t('tax.installmentDeadlines'), deadlinePreview, deadlinesBody)}
        ${renderAccordionItem('settings', t('tax.withholdingSettings'), `${formatPercent(summary.taxRatePct, 0)} · ${summary.country}`, settingsBody)}
      </div>

      <!-- Export -->
      <footer class="card">
        <div style="display: flex; align-items: center; gap: var(--space-3);">
          ${getIcon('download', 20)}
          <h2>${esc(t('tax.exportSummary'))}</h2>
        </div>
        <p style="color:var(--color-text-secondary); font-size: var(--text-sm); margin-top: var(--space-1);">${esc(t('tax.exportHint'))}</p>
        <div class="tax-export-group">
          <ion-button fill="outline" data-export-tax="json">${esc(t('tax.exportJson'))}</ion-button>
          <ion-button fill="outline" data-export-tax="csv">${esc(t('tax.exportCsv'))}</ion-button>
        </div>
      </footer>
    </section>
  `;

  root.querySelectorAll('[data-accordion-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-accordion-toggle');
      const item = root.querySelector(`[data-accordion-item="${key}"]`);
      const body = root.querySelector(`[data-accordion-body="${key}"]`);
      if (!item || !body) return;
      const isOpen = !body.hidden;
      body.hidden = isOpen;
      item.classList.toggle('is-open', !isOpen);
      btn.setAttribute('aria-expanded', String(!isOpen));
    });
  });

  const yearSelect = root.querySelector('[data-tax-year]');
  if (yearSelect instanceof HTMLSelectElement) {
    yearSelect.addEventListener('change', () => {
      const year = Math.floor(num(yearSelect.value, selectedYear));
      void renderTaxDashboard(root, { taxYear: year });
    });
  }

  const regionSelect = root.querySelector('[data-tax-region]');
  // ion-button hosts are plain custom elements, not HTMLButtonElement — guard on HTMLElement.
  const applyBtn = root.querySelector('[data-apply-rate]');
  if (regionSelect instanceof HTMLSelectElement && applyBtn instanceof HTMLElement) {
    applyBtn.addEventListener('click', async () => {
      const code = regionSelect.value;
      const nextRate = num(rateMap[code], summary.taxRatePct);
      await saveUser({ taxWithholdingPct: nextRate, taxRegion: code });
      showToast({
        type: 'success',
        message: t('tax.presetApplied').replace('{rate}', formatPercent(nextRate, 0)),
        duration: 1800,
      });
      await renderTaxDashboard(root, { taxYear: selectedYear });
    });
  }

  root.querySelectorAll('[data-export-tax]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const format = btn.getAttribute('data-export-tax');
      if (format !== 'json' && format !== 'csv') return;
      await exportTaxSummary(summary, format);
      showToast({
        type: 'success',
        message: format === 'json' ? t('tax.exportedJson') : t('tax.exportedCsv'),
        duration: 1800,
      });
    });
  });

  root.querySelectorAll('[data-jar-adjust]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const delta = num(btn.getAttribute('data-jar-adjust'), 0);
      const next = Math.max(0, summary.virtualJar + delta);
      await setTaxJarBalance(selectedYear, next);
      await renderTaxDashboard(root, { taxYear: selectedYear });
    });
  });

  if (summary.vehicle) {
    const optOutCb = root.querySelector('[data-mileage-optout]');
    if (optOutCb instanceof HTMLElement) {
      // ion-toggle fires `ionChange` (not `change`) and keeps its `checked` property current
      // on user interaction — same read the old checkbox handler did.
      optOutCb.addEventListener('ionChange', async () => {
        if (/** @type {HTMLElement & { checked?: boolean }} */ (optOutCb).checked) {
          await upsertTaxProfile({
            vehicleId: summary.vehicle.id,
            taxYear: selectedYear,
            deductionMethod: 'actual_expenses',
            country: summary.country,
            standardRatePrimary: null,
            standardRateSecondary: null,
            rateThreshold: null,
          });
        } else {
          // Un-checking clears the opt-out back to the researched default (not a stale custom
          // rate) — a fresh call resolves whatever the registry currently says for this vehicle.
          const def = getVehicleMileageEligibility(summary.country, summary.vehicle.type);
          await upsertTaxProfile({
            vehicleId: summary.vehicle.id,
            taxYear: selectedYear,
            deductionMethod: def.eligible ? 'standard_mileage' : 'actual_expenses',
            country: summary.country,
            standardRatePrimary: def.ratePrimary,
            standardRateSecondary: def.rateSecondary,
            rateThreshold: def.rateThreshold,
          });
        }
        showToast({ type: 'success', message: t('tax.mileageWriteOffSaved'), duration: 1800 });
        await renderTaxDashboard(root, { taxYear: selectedYear });
      });
    }

    const rateSaveBtn = root.querySelector('[data-mileage-rate-save]');
    const rateInput = root.querySelector('[data-mileage-rate-input]');
    if (rateSaveBtn instanceof HTMLElement && rateInput instanceof HTMLInputElement) {
      rateSaveBtn.addEventListener('click', async () => {
        const custom = parseFloat(rateInput.value);
        if (Number.isNaN(custom)) return;
        await upsertTaxProfile({
          vehicleId: summary.vehicle.id,
          taxYear: selectedYear,
          deductionMethod: 'standard_mileage',
          country: summary.country,
          standardRatePrimary: custom,
          standardRateSecondary: null,
          rateThreshold: null,
        });
        showToast({ type: 'success', message: t('tax.mileageWriteOffSaved'), duration: 1800 });
        await renderTaxDashboard(root, { taxYear: selectedYear });
      });
    }
  }
}
