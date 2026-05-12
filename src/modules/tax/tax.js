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
import { WITHHOLDING_PRESETS_CA, WITHHOLDING_PRESETS_US } from '../../registry/tax/withholding-presets.js';
import { ProvinceRegistry } from '../../registry/provinces/index.js';
import { t } from '../../utils/strings.js';
import { renderProgressRing, showToast } from '../../ui/components.js';

const DEFAULT_CA_REGION = 'ON';
const DEFAULT_US_REGION = 'CA';
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

function downloadTextFile(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * @param {ReturnType<typeof getCountryTaxProfile>} taxProfile
 */
function buildRegionOptions(taxProfile) {
  if (taxProfile.regionPresetType === 'CA') {
    const map = WITHHOLDING_PRESETS_CA;
    return Object.entries(map).map(([code, rate]) => ({ code, rate }));
  }
  if (taxProfile.regionPresetType === 'US') {
    const provs = ProvinceRegistry.getByCountry('US');
    return provs
      .map((p) => {
        const code = p.id;
        const rate = WITHHOLDING_PRESETS_US[code];
        return Number.isFinite(rate) ? { code, rate } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.code.localeCompare(b.code));
  }
  return [];
}

/**
 * @param {ReturnType<typeof getCountryTaxProfile>} taxProfile
 */
function defaultRegionCode(taxProfile) {
  return taxProfile.defaultRegionCode || (taxProfile.regionPresetType === 'CA' ? DEFAULT_CA_REGION : DEFAULT_US_REGION);
}

/**
 * @param {ReturnType<typeof getCountryTaxProfile>} taxProfile
 */
function getTaxRatePresets(taxProfile) {
  if (taxProfile.regionPresetType === 'CA') return WITHHOLDING_PRESETS_CA;
  if (taxProfile.regionPresetType === 'US') {
    const out = /** @type {Record<string, number>} */ ({});
    for (const p of ProvinceRegistry.getByCountry('US')) {
      const v = WITHHOLDING_PRESETS_US[p.id];
      if (Number.isFinite(v)) out[p.id] = v;
    }
    return out;
  }
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

  const grossCents = shifts.reduce((sum, s) => sum + num(s.grossEarnings ?? s.gross), 0);
  const gross = grossCents / 100;
  const businessExpensesCents = expenses.reduce(
    (sum, e) => sum + num(e.amount) * (num(e.businessPct, 100) / 100),
    0,
  );
  const businessExpenses = businessExpensesCents / 100;
  const netIncome = Math.max(0, gross - businessExpenses);
  const taxRatePct = num(user?.taxWithholdingPct, taxProfile.defaultWithholdingPct);
  const taxSetAside = calcTaxSetAside(gross, taxRatePct);
  const virtualJar = num(parseAppStateValue(await db.appState.get(TAX_VIRTUAL_JAR_KEY), 0), 0);
  const setAsideCoveragePct = taxSetAside > 0 ? Math.min(100, (virtualJar / Math.max(1, taxSetAside)) * 100) : 0;

  const hstRate = taxProfile.hstRateWhenRegistered || 0;
  const hstCollected = user?.hstRegistered ? gross * hstRate : 0;
  const itcTotalCents = expenses.reduce((sum, e) => sum + num(e.hstPaid ?? e.hstItcAmount), 0);
  const itcTotal = itcTotalCents / 100;
  const hstRemittable = calcHSTRemittable(hstCollected, itcTotal);

  const distanceKm = shifts.reduce((sum, s) => sum + num(s.distanceKm), 0);
  const totalMiles = distanceKm * 0.621371192;
  const actualCostDeduction = businessExpenses;

  const cppEstimate = taxProfile.calcCpp ? calcCPPContribution(netIncome, year) : 0;
  const seTaxEstimate = taxProfile.calcSeTax ? calcSEtax(netIncome) : 0;
  const deadlines = getAllTaxDeadlines(country, year);

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
    cppEstimate,
    seTaxEstimate,
    user,
    deadlines,
    distanceUnit: getLocaleConfig(country).distanceUnit === 'mi' ? 'mi' : 'km',
    generatedAt: new Date().toISOString(),
  };
}

/**
 * @param {ReturnType<typeof getCountryTaxProfile>} taxProfile
 */
function renderTaxHelpers(taxProfile) {
  const t2125Rows = [
    t('tax.t2125.grossIncome'),
    t('tax.t2125.advertising'),
    t('tax.t2125.meals'),
    t('tax.t2125.motorVehicle'),
    t('tax.t2125.supplies'),
    t('tax.t2125.other'),
    t('tax.t2125.netIncome'),
  ];
  const scheduleCRows = [
    t('tax.scheduleC.partIIncome'),
    t('tax.scheduleC.partIIExpenses'),
    t('tax.scheduleC.carTruck'),
    t('tax.scheduleC.depreciation'),
    t('tax.scheduleC.homeOffice'),
    t('tax.scheduleC.other'),
    t('tax.scheduleC.netProfit'),
  ];
  return `
    <div class="bento-grid" style="margin-top: var(--space-4);">
      <article class="card bento-cell-1x1">
        <h3>${esc(t('tax.t2125.title'))}</h3>
        <ol style="padding-left: var(--space-4); margin: var(--space-3) 0 0;">
          ${t2125Rows.map((row) => `<li>${esc(row)}</li>`).join('')}
        </ol>
      </article>
      <article class="card bento-cell-1x1">
        <h3>${esc(t('tax.scheduleC.title'))}</h3>
        <ol style="padding-left: var(--space-4); margin: var(--space-3) 0 0;">
          ${scheduleCRows.map((row) => `<li>${esc(row)}</li>`).join('')}
        </ol>
      </article>
      <article class="card bento-cell-1x1">
        <h3>${esc(t('tax.referenceLinks'))}</h3>
        <ul style="padding-left: var(--space-4); margin: var(--space-3) 0 0;">
          <li><a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/sole-proprietorships-partnerships/report-business-income-expenses.html" target="_blank" rel="noopener noreferrer">CRA — ${esc(
            t('tax.links.businessIncomeGuide'),
          )}</a></li>
          <li><a href="https://www.irs.gov/forms-pubs/about-schedule-c-form-1040" target="_blank" rel="noopener noreferrer">IRS — ${esc(
            t('tax.links.scheduleCGuide'),
          )}</a></li>
          <li><a href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses.html" target="_blank" rel="noopener noreferrer">CRA — ${esc(
            t('tax.links.hstGuide'),
          )}</a></li>
          <li><a href="https://www.irs.gov/businesses/small-businesses-self-employed/estimated-taxes" target="_blank" rel="noopener noreferrer">IRS — ${esc(
            t('tax.links.estimatedTaxes'),
          )}</a></li>
        </ul>
        <p style="margin-top: var(--space-3); color: var(--color-text-secondary);">
          ${esc(
            taxProfile.footnote === 'canada'
              ? t('tax.footnoteCanada')
              : taxProfile.footnote === 'us'
                ? t('tax.footnoteUs')
                : t('tax.footnoteGeneric'),
          )}
        </p>
      </article>
    </div>
  `;
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
      cppEstimate: summary.cppEstimate,
      seTaxEstimate: summary.seTaxEstimate,
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
    ['cpp_estimate', summary.cppEstimate],
    ['se_tax_estimate', summary.seTaxEstimate],
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
      `macadam-tax-summary-${fileSafeCountry}-${summary.year}.json`,
      toTaxSummaryJson(summary),
      'application/json;charset=utf-8',
    );
  } else {
    downloadTextFile(
      `macadam-tax-summary-${fileSafeCountry}-${summary.year}.csv`,
      toTaxSummaryCsv(summary),
      'text/csv;charset=utf-8',
    );
  }
}

/**
 * @param {Awaited<ReturnType<typeof loadTaxSummary>>} summary
 */
function renderSecondaryEstimatorArticle(summary) {
  const tp = summary.taxProfile;
  const loc = summary.localeTag;
  const cur = summary.currency;
  if (tp.secondaryEstimator === 'cpp') {
    return `
        <article class="card bento-cell-1x1">
          <h2>${esc(t('tax.cppEstimator'))}</h2>
          <p>${esc(t('tax.estimatedValue'))}: <strong>${esc(
            formatCurrency(summary.cppEstimate, loc, { currency: cur }),
          )}</strong></p>
          <p style="color:var(--color-text-secondary);">${esc(t('tax.cppNote'))}</p>
        </article>`;
  }
  if (tp.secondaryEstimator === 'se') {
    return `
        <article class="card bento-cell-1x1">
          <h2>${esc(t('tax.seTaxEstimator'))}</h2>
          <p>${esc(t('tax.estimatedValue'))}: <strong>${esc(
            formatCurrency(summary.seTaxEstimate, loc, { currency: cur }),
          )}</strong></p>
          <p style="color:var(--color-text-secondary);">${esc(t('tax.seTaxNote'))}</p>
        </article>`;
  }
  return `
        <article class="card bento-cell-1x1">
          <h2>${esc(t('tax.genericEstimatorTitle'))}</h2>
          <p>${esc(t('tax.estimatedValue'))}: <strong>${esc(formatCurrency(0, loc, { currency: cur }))}</strong></p>
          <p style="color:var(--color-text-secondary);">${esc(t('tax.genericEstimatorNote'))}</p>
        </article>`;
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
  const regionPresetCard =
    regionOptions.length > 0
      ? `
        <article class="card bento-cell-1x1">
          <h2>${esc(t('tax.provinceStatePresets'))}</h2>
          <label class="input-group">
            <span class="input-label">${esc(regionLabel)}</span>
            <select class="select" data-tax-region>
              ${regionOptions.map((row) => `<option value="${row.code}" ${row.code === selectedRegion ? 'selected' : ''}>${row.code} (${row.rate}%)</option>`).join('')}
            </select>
          </label>
          <button class="btn btn-secondary" type="button" data-apply-rate style="margin-top:var(--space-3);">${esc(
            t('tax.applyPreset'),
          )}</button>
          <p style="margin-top:var(--space-2);color:var(--color-text-secondary);">${esc(t('tax.currentRate'))}: ${esc(
            formatPercent(summary.taxRatePct),
          )}</p>
        </article>`
      : '';

  root.innerHTML = `
    <section class="tax-view">
      <header class="card card-raised">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:var(--space-3);flex-wrap:wrap;">
          <div>
            <h1>${esc(t('tax.title'))}</h1>
            <p style="margin-top:var(--space-2);color:var(--color-text-secondary);">${esc(t('tax.subtitle'))}</p>
          </div>
          <label class="input-group" style="max-width:180px;">
            <span class="input-label">${esc(t('tax.taxYear'))}</span>
            <select class="select" data-tax-year>
              ${[0, 1, 2].map((delta) => {
                const y = new Date().getFullYear() - delta;
                return `<option value="${y}" ${y === selectedYear ? 'selected' : ''}>${y}</option>`;
              }).join('')}
            </select>
          </label>
        </div>
      </header>

      <section class="bento-grid" style="margin-top: var(--space-4);">
        <article class="card bento-cell-1x1">
          <h2>${esc(t('tax.virtualJar'))}</h2>
          <div style="display:flex;gap:var(--space-3);align-items:center;margin-top:var(--space-3);">
            ${renderProgressRing({
              value: summary.virtualJar,
              max: Math.max(summary.taxSetAside, calcTaxSetAside(summary.gross, selectedRegionRate), 1),
              size: 84,
              strokeWidth: 7,
              label: formatPercent(summary.setAsideCoveragePct, 0),
            })}
            <div>
              <p>${esc(t('tax.targetSetAside'))}: <strong>${esc(
                formatCurrency(calcTaxSetAside(summary.gross, selectedRegionRate), summary.localeTag, { currency: summary.currency }),
              )}</strong></p>
              <p>${esc(t('tax.currentSetAside'))}: <strong>${esc(
                formatCurrency(summary.virtualJar, summary.localeTag, { currency: summary.currency }),
              )}</strong></p>
            </div>
          </div>
          <div style="display:flex;gap:var(--space-2);margin-top:var(--space-3);">
            <button class="btn btn-secondary btn-sm" type="button" data-jar-adjust="-25">-25</button>
            <button class="btn btn-secondary btn-sm" type="button" data-jar-adjust="-10">-10</button>
            <button class="btn btn-secondary btn-sm" type="button" data-jar-adjust="10">+10</button>
            <button class="btn btn-secondary btn-sm" type="button" data-jar-adjust="25">+25</button>
          </div>
        </article>

        <article class="card bento-cell-1x1">
          <h2>${esc(t('tax.hstCollectedTracker'))}</h2>
          <p>${esc(t('tax.collected'))}: <strong>${esc(
            formatCurrency(summary.hstCollected, summary.localeTag, { currency: summary.currency }),
          )}</strong></p>
          <p>${esc(t('tax.itcTracker'))}: <strong>${esc(
            formatCurrency(summary.itcTotal, summary.localeTag, { currency: summary.currency }),
          )}</strong></p>
          <p>${esc(t('tax.remittable'))}: <strong>${esc(
            formatCurrency(summary.hstRemittable, summary.localeTag, { currency: summary.currency }),
          )}</strong></p>
        </article>

        <article class="card bento-cell-1x1">
          <h2>${esc(t('tax.incomeSnapshot'))}</h2>
          <p>${esc(t('tax.grossIncome'))}: <strong>${esc(
            formatCurrency(summary.gross, summary.localeTag, { currency: summary.currency }),
          )}</strong></p>
          <p>${esc(t('tax.businessExpenses'))}: <strong>${esc(
            formatCurrency(summary.businessExpenses, summary.localeTag, { currency: summary.currency }),
          )}</strong></p>
          <p>${esc(t('tax.netIncome'))}: <strong>${esc(
            formatCurrency(summary.netIncome, summary.localeTag, { currency: summary.currency }),
          )}</strong></p>
          <p>${esc(t('tax.netAfterSetAside'))}: <strong>${esc(
            formatCurrency(netAfterSetAside, summary.localeTag, { currency: summary.currency }),
          )}</strong></p>
        </article>

        ${regionPresetCard}
      </section>

      <section class="bento-grid" style="margin-top: var(--space-4);">
        <article class="card bento-cell-1x1">
          <h2>${esc(t('tax.vehicleActualCosts'))}</h2>
          <p>${esc(t('tax.totalDistance'))}: <strong>${esc(
            `${formatLargeNumber(summary.distanceUnit === 'mi' ? summary.totalMiles : summary.distanceKm)} ${mileageUnitLabel}`,
          )}</strong></p>
          <p>${esc(t('tax.actualCost'))}: <strong>${esc(
            formatCurrency(summary.actualCostDeduction, summary.localeTag, { currency: summary.currency }),
          )}</strong></p>
          <p style="color:var(--color-text-secondary);">${esc(t('tax.actualCostsNote'))}</p>
        </article>

        ${renderSecondaryEstimatorArticle(summary)}

        <article class="card bento-cell-1x1">
          <h2>${esc(t('tax.installmentDeadlines'))}</h2>
          <ul style="padding-left:var(--space-4);margin:var(--space-3) 0 0;">
            ${summary.deadlines
              .map(
                (row) =>
                  `<li>${esc(
                    `${toYmd(row.date)} · ${row.label} (${row.daysUntil >= 0 ? `${row.daysUntil}d` : t('tax.overdue')})`,
                  )}</li>`,
              )
              .join('')}
          </ul>
        </article>
      </section>

      ${renderTaxHelpers(summary.taxProfile)}

      <section class="card" style="margin-top: var(--space-4);">
        <h3>${esc(t('tax.exportSummary'))}</h3>
        <p style="color:var(--color-text-secondary);">${esc(t('tax.exportHint'))}</p>
        <div style="display:flex;gap:var(--space-2);margin-top:var(--space-3);">
          <button class="btn btn-secondary" type="button" data-export-tax="json">${esc(t('tax.exportJson'))}</button>
          <button class="btn btn-secondary" type="button" data-export-tax="csv">${esc(t('tax.exportCsv'))}</button>
        </div>
      </section>
    </section>
  `;

  const yearSelect = root.querySelector('[data-tax-year]');
  if (yearSelect instanceof HTMLSelectElement) {
    yearSelect.addEventListener('change', () => {
      const year = Math.floor(num(yearSelect.value, selectedYear));
      void renderTaxDashboard(root, { taxYear: year });
    });
  }

  const regionSelect = root.querySelector('[data-tax-region]');
  const applyBtn = root.querySelector('[data-apply-rate]');
  if (regionSelect instanceof HTMLSelectElement && applyBtn instanceof HTMLButtonElement) {
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
      await db.appState.put({
        key: TAX_VIRTUAL_JAR_KEY,
        value: JSON.stringify(next),
        updatedAt: new Date().toISOString(),
      });
      await renderTaxDashboard(root, { taxYear: selectedYear });
    });
  });
}
