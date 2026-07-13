import { db } from '../core/db.js';
import { store } from '../core/store.js';
import { showToast } from '../ui/components.js';
import { t } from '../utils/strings.js';
import { getIcon } from '../ui/icons.js';
import {
  buildPrintDocument,
  copySummaryToClipboard,
  exportAllExpensesCsv,
  exportAllShiftsCsv,
  exportMileageLogCsv,
  exportTaxSummaryCsv,
  exportTaxSummaryJson,
  exportVaultBackupJson,
  exportYearInReviewPng,
  getAnnualReport,
  getCustomDateRangeReport,
  getDefaultReportTemplate,
  getMonthlyReportCard,
  getPlatformReport,
  getWeeklyReportCard,
  getYearInReviewModel,
} from '../modules/reports/reports.js';
import { ReportRegistry } from '../registry/reports/index.js';
import '../css/views/reports.css';

function generateYirSvg(yir) {
  const grossStr = formatMoney(yir.summary.gross);
  const netStr = formatMoney(yir.summary.net);
  const shiftsStr = String(yir.summary.shiftCount);
  const hoursStr = `${yir.summary.hours.toFixed(1)}h`;
  
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 350" width="600" height="350">
  <defs>
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0066ff" stop-opacity="1" />
      <stop offset="100%" stop-color="#f7931e" stop-opacity="1" />
    </linearGradient>
    <style>
      .title { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 28px; font-weight: 800; fill: #ffffff; }
      .meta { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; fill: rgba(255, 255, 255, 0.7); }
      .divider { stroke: rgba(255, 255, 255, 0.2); stroke-width: 1px; }
      .stat-label { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 700; fill: rgba(255, 255, 255, 0.65); letter-spacing: 1px; text-transform: uppercase; }
      .stat-val { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 32px; font-weight: 900; fill: #ffffff; }
    </style>
  </defs>
  
  <!-- Card Background -->
  <rect width="600" height="350" rx="24" fill="url(#cardGrad)" />
  
  <!-- Decorative Accent Glows -->
  <circle cx="550" cy="50" r="100" fill="#ffffff" fill-opacity="0.05" />
  <circle cx="50" cy="300" r="150" fill="#000000" fill-opacity="0.1" />

  <!-- Header -->
  <text x="40" y="65" class="title">${yir.title}</text>
  <text x="40" y="98" class="meta">Generated on ${yir.generatedAt}</text>
  
  <!-- Divider -->
  <line x1="40" y1="120" x2="560" y2="120" class="divider" />
  
  <!-- Stats Grid -->
  <!-- Row 1 Left: Gross -->
  <text x="40" y="165" class="stat-label">Gross Earnings</text>
  <text x="40" y="208" class="stat-val">${grossStr}</text>
  
  <!-- Row 1 Right: Net -->
  <text x="320" y="165" class="stat-label">Net Profit</text>
  <text x="320" y="208" class="stat-val">${netStr}</text>
  
  <!-- Row 2 Left: Shifts -->
  <text x="40" y="270" class="stat-label">Shifts Logged</text>
  <text x="40" y="310" class="stat-val">${shiftsStr}</text>
  
  <!-- Row 2 Right: Hours -->
  <text x="320" y="270" class="stat-label">Road Hours</text>
  <text x="320" y="310" class="stat-val">${hoursStr}</text>
</svg>
  `.trim();
}

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMoney(v) {
  const user = store.get('user');
  const sym = user?.locale?.currencySymbol || '$';
  return `${sym}${Number(v || 0).toFixed(2)}`;
}

function summaryRows(report) {
  const ov = ReportRegistry.getById('overview');
  const fn = /** @type {{ buildSummaryRows?: (r: unknown, u: unknown) => [string, string][] }} */ (ov)?.buildSummaryRows;
  return typeof fn === 'function' ? fn(report, store.get('user')) : [];
}

function periodPayload(period, form) {
  const now = new Date();
  if (period === 'monthly') return getMonthlyReportCard(now);
  if (period === 'annual') return getAnnualReport(now.getFullYear());
  if (period === 'platform') return getPlatformReport(form.platformId.value || 'all');
  if (period === 'custom') {
    return getCustomDateRangeReport(form.startDate.value || `${now.getFullYear()}-01-01`, form.endDate.value || `${now.getFullYear()}-12-31`, {
      platformId: form.platformId.value || 'all',
    });
  }
  return getWeeklyReportCard(now, Number(store.get('user')?.locale?.weekStartDay || 0));
}

function buildTemplateState(root) {
  const tpl = getDefaultReportTemplate();
  root.querySelectorAll('[data-template-section]').forEach((input) => {
    if (!(input instanceof HTMLInputElement)) return;
    const key = input.getAttribute('data-template-section');
    if (!key) return;
    input.checked = Boolean(tpl.sections[key]);
  });
  return tpl;
}

/** @param {HTMLElement} root @param {Record<string, unknown>} ctx */
export async function render(root, ctx) {
  void ctx;
  const container = document.createElement('div');
  container.className = 'reports-view-container';
  root.appendChild(container);

  container.innerHTML = `
    <section class="reports-view">
      <header class="reports-header">
        <h1>${esc(t('reports.title'))}</h1>
        <p>${esc(t('reports.subtitle'))}</p>
      </header>

      <div class="reports-toolbar">
        <ion-segment class="reports-period-segment" value="weekly" data-reports-period>
          <ion-segment-button value="weekly">${esc(t('reports.weekly'))}</ion-segment-button>
          <ion-segment-button value="monthly">${esc(t('reports.monthly'))}</ion-segment-button>
          <ion-segment-button value="annual">${esc(t('reports.annual'))}</ion-segment-button>
          <ion-segment-button value="platform">${esc(t('reports.platform'))}</ion-segment-button>
          <ion-segment-button value="custom">${esc(t('reports.custom'))}</ion-segment-button>
        </ion-segment>

        <div class="reports-filters is-hidden" data-slot="filters">
          <label class="field reports-filter-platform" data-slot="platform-filter">
            <span class="field-label">Platform</span>
            <select class="input" name="platformId">
              <option value="all">All platforms</option>
            </select>
          </label>
          <div class="reports-filter-dates" data-slot="date-filter">
            <label class="field">
              <span class="field-label">Start</span>
              <input class="input" type="date" name="startDate" />
            </label>
            <label class="field">
              <span class="field-label">End</span>
              <input class="input" type="date" name="endDate" />
            </label>
          </div>
        </div>
      </div>

      <section class="card report-card" data-slot="report-card"></section>

      <section class="card" data-slot="yir"></section>

      <section class="card reports-exports">
        <div class="reports-exports-head">
          ${getIcon('download', 18, 'text-brand')}
          <h2>Export &amp; share</h2>
        </div>

        <div class="reports-export-groups">
          <div class="reports-export-group">
            <span class="reports-export-group-label">This period</span>
            <div class="reports-export-buttons">
              <ion-button size="small" data-action="copy"><span slot="start">${getIcon('copy', 16)}</span>Copy summary</ion-button>
              <ion-button size="small" fill="outline" data-action="share-native"><span slot="start">${getIcon('share-2', 16)}</span>Share stats</ion-button>
              <ion-button size="small" fill="outline" data-action="print"><span slot="start">${getIcon('printer', 16)}</span>Print</ion-button>
            </div>
          </div>

          <div class="reports-export-group">
            <span class="reports-export-group-label">Your data</span>
            <div class="reports-export-buttons">
              <ion-button size="small" fill="outline" data-action="csv-shifts"><span slot="start">${getIcon('file-text', 16)}</span>Shifts CSV</ion-button>
              <ion-button size="small" fill="outline" data-action="csv-expenses"><span slot="start">${getIcon('file-text', 16)}</span>Expenses CSV</ion-button>
              <ion-button size="small" fill="outline" data-action="csv-mileage"><span slot="start">${getIcon('map', 16)}</span>Mileage CSV</ion-button>
            </div>
          </div>

          <div class="reports-export-group">
            <span class="reports-export-group-label">Tax</span>
            <div class="reports-export-buttons">
              <ion-button size="small" fill="outline" data-action="tax-csv"><span slot="start">${getIcon('chart-donut', 16)}</span>Tax CSV</ion-button>
              <ion-button size="small" fill="outline" data-action="tax-json"><span slot="start">${getIcon('code', 16)}</span>Tax JSON</ion-button>
            </div>
          </div>

          <div class="reports-export-group">
            <span class="reports-export-group-label">Backup</span>
            <div class="reports-export-buttons">
              <ion-button size="small" fill="outline" data-action="json-backup"><span slot="start">${getIcon('shield', 16)}</span>Vault backup</ion-button>
            </div>
          </div>
        </div>

        <p class="reports-disclaimer">
          Planning-grade exports. Verify all calculations and your contemporaneous mileage log with a certified accountant before final filing.
        </p>
      </section>

      <details class="card reports-template">
        <summary class="reports-template-summary">
          ${getIcon('settings', 16, 'text-muted')}
          <span>${esc(t('reports.templateBuilder'))}</span>
        </summary>
        <div class="reports-template-grid">
          <label class="template-check"><input data-template-section="overview" type="checkbox" /> Overview</label>
          <label class="template-check"><input data-template-section="platform_breakdown" type="checkbox" /> Platforms</label>
          <label class="template-check"><input data-template-section="shifts" type="checkbox" /> Shifts</label>
          <label class="template-check"><input data-template-section="expenses" type="checkbox" /> Expenses</label>
          <label class="template-check"><input data-template-section="chart" type="checkbox" /> Review</label>
          <label class="template-check"><input data-template-section="qr" type="checkbox" /> Share stats</label>
          <label class="template-check"><input data-template-section="notes" type="checkbox" /> Notes</label>
        </div>
      </details>
    </section>
  `;

  const form = {
    platformId: /** @type {HTMLSelectElement} */ (container.querySelector('[name="platformId"]')),
    startDate: /** @type {HTMLInputElement} */ (container.querySelector('[name="startDate"]')),
    endDate: /** @type {HTMLInputElement} */ (container.querySelector('[name="endDate"]')),
  };
  const reportSlot = /** @type {HTMLElement} */ (container.querySelector('[data-slot="report-card"]'));
  const yirSlot = /** @type {HTMLElement} */ (container.querySelector('[data-slot="yir"]'));
  const filtersSlot = /** @type {HTMLElement} */ (container.querySelector('[data-slot="filters"]'));
  const platformField = /** @type {HTMLElement} */ (container.querySelector('[data-slot="platform-filter"]'));
  const dateField = /** @type {HTMLElement} */ (container.querySelector('[data-slot="date-filter"]'));
  const template = buildTemplateState(container);

  let currentPeriod = 'weekly';
  let currentReport = await getWeeklyReportCard(new Date(), Number(store.get('user')?.locale?.weekStartDay || 0));

  /** Reveal only the filters the active period actually uses (dates for custom, platform for
   *  platform/custom) instead of always showing an empty filter row. */
  function syncFilterVisibility(period) {
    const showPlatform = period === 'platform' || period === 'custom';
    const showDates = period === 'custom';
    platformField.classList.toggle('is-hidden', !showPlatform);
    dateField.classList.toggle('is-hidden', !showDates);
    filtersSlot.classList.toggle('is-hidden', !showPlatform && !showDates);
  }

  async function refreshReport() {
    currentReport = await periodPayload(currentPeriod, form);
    const rows = summaryRows(currentReport);
    syncFilterVisibility(currentPeriod);

    // Synchronize UI date inputs with the dynamically computed preset range
    if (currentPeriod !== 'custom') {
      if (form.startDate._fp) {
        form.startDate._fp.setDate(currentReport.startDate, false);
      } else {
        form.startDate.value = currentReport.startDate;
      }
      if (form.endDate._fp) {
        form.endDate._fp.setDate(currentReport.endDate, false);
      } else {
        form.endDate.value = currentReport.endDate;
      }
    }

    if (!currentReport.hasData) {
      reportSlot.innerHTML = `
        <div class="report-empty">
          <div class="report-empty-icon">📊</div>
          <h3>No activity this period</h3>
          <p>You haven't logged any shifts or expenses for the selected dates.</p>
        </div>
      `;
      yirSlot.hidden = true;
      return;
    }
    yirSlot.hidden = false;

    let metricsHtml = `
      <div class="report-card-head">
        <h2>${esc(t('reports.reportCard'))}</h2>
        <span class="report-range">${esc(currentReport.startDate)} — ${esc(currentReport.endDate)}</span>
      </div>
      <div class="reports-metrics-grid">
        ${rows.map(([k, v]) => `
          <article class="report-metric-card">
            <span class="report-metric-label">${esc(k)}</span>
            <span class="report-metric-value">${esc(v)}</span>
          </article>
        `).join('')}
      </div>
    `;

    if (currentReport.summary.isNetNegative) {
      metricsHtml += `
        <div class="report-warning">
          <span>⚠️</span>
          <span>Expenses exceeded gross this period — see the expense breakdown.</span>
        </div>
      `;
    }

    if (template.sections.platform_breakdown) {
      const pbSection = ReportRegistry.getById('platform_breakdown');
      if (pbSection) {
        const pbHtml = await pbSection.renderHTML(currentReport, store.get('user'));
        metricsHtml += `
          <div class="report-breakdown">
            <h3>Platform breakdown</h3>
            ${pbHtml}
          </div>
        `;
      }
    }

    reportSlot.innerHTML = metricsHtml;

    const year = new Date(currentReport.endDate).getFullYear();
    const annual = await getAnnualReport(year);
    const yir = getYearInReviewModel(year, annual);
    yirSlot.innerHTML = `
      <div class="yir-head">
        <h2>Year in review</h2>
        ${getIcon('award', 20, 'text-brand')}
      </div>
      <div data-yir-card class="yir-card">
        <h3>${esc(yir.title)}</h3>
        <div class="yir-meta">
          <p>Generated on ${esc(yir.generatedAt)}</p>
          <div class="yir-divider"></div>
          <div class="yir-grid">
            <div>
              <div class="yir-stat-label">Gross earnings</div>
              <div class="yir-stat-value">${esc(formatMoney(yir.summary.gross))}</div>
            </div>
            <div>
              <div class="yir-stat-label">Net profit</div>
              <div class="yir-stat-value">${esc(formatMoney(yir.summary.net))}</div>
            </div>
            <div>
              <div class="yir-stat-label">Shifts logged</div>
              <div class="yir-stat-value">${esc(String(yir.summary.shiftCount))}</div>
            </div>
            <div>
              <div class="yir-stat-label">Road hours</div>
              <div class="yir-stat-value">${esc(yir.summary.hours.toFixed(1))}h</div>
            </div>
          </div>
        </div>
      </div>
      <ion-button fill="outline" expand="block" data-action="capture-yir" class="yir-export-btn">
        <span slot="start">${getIcon('camera', 14)}</span>Export shareable PNG
      </ion-button>
    `;
  }

  await refreshReport();

  // Populate dynamic platform filter
  const allShifts = await db.shifts.toArray();
  const allExpenses = await db.expenses.toArray();
  const activePlatforms = new Set();
  for (const s of allShifts) if (s.platformId) activePlatforms.add(s.platformId);
  for (const e of allExpenses) if (e.platformId) activePlatforms.add(e.platformId);
  const platformsArray = Array.from(activePlatforms).sort();
  
  if (platformsArray.length > 0) {
    form.platformId.innerHTML = `
      <option value="all">All Platforms</option>
      ${platformsArray.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('')}
    `;
  }

  const periodSegment = /** @type {(HTMLElement & { value?: string }) | null} */ (
    container.querySelector('[data-reports-period]')
  );

  const switchToCustomAndRefresh = async () => {
    currentPeriod = 'custom';
    // Reflect the implicit switch in the segment; a programmatic value set does not
    // re-fire ionChange, so this cannot double-trigger refreshReport.
    if (periodSegment) periodSegment.value = 'custom';
    await refreshReport();
  };

  form.startDate.addEventListener('change', switchToCustomAndRefresh);
  form.endDate.addEventListener('change', switchToCustomAndRefresh);
  form.platformId.addEventListener('change', switchToCustomAndRefresh);

  periodSegment?.addEventListener('ionChange', async (e) => {
    const detail = /** @type {CustomEvent<{ value?: string | number }>} */ (e).detail;
    currentPeriod = String(detail?.value || 'weekly');
    await refreshReport();
  });

  container.querySelectorAll('[data-template-section]').forEach((input) => {
    input.addEventListener('change', async () => {
      if (!(input instanceof HTMLInputElement)) return;
      const key = input.getAttribute('data-template-section');
      if (!key) return;
      template.sections[key] = input.checked;
      await refreshReport();
    });
  });

  container.addEventListener('click', async (e) => {
    const target = e.target instanceof Element ? e.target.closest('[data-action]') : null;
    if (!target) return;
    const action = target.getAttribute('data-action');
    if (action === 'copy') {
      await copySummaryToClipboard(currentReport, store.get('user'));
      showToast({ type: 'success', message: 'Summary copied.', duration: 1600 });
    }
    if (action === 'print') {
      const doc = buildPrintDocument(currentReport, template, store.get('user'));
      sessionStorage.setItem('comma_print_payload', JSON.stringify(doc));
      window.open('#/print', '_blank');
    }
    if (action === 'csv-shifts') {
      const count = await exportAllShiftsCsv();
      showToast({ type: 'success', message: `Exported ${count} shifts.`, duration: 1800 });
    }
    if (action === 'csv-expenses') {
      const count = await exportAllExpensesCsv();
      showToast({ type: 'success', message: `Exported ${count} expenses.`, duration: 1800 });
    }
    if (action === 'csv-mileage') {
      const count = await exportMileageLogCsv();
      showToast({ type: 'success', message: `Exported mileage log for ${count} shifts.`, duration: 1800 });
    }
    if (action === 'json-backup') {
      await exportVaultBackupJson();
      showToast({ type: 'success', message: 'Vault backup exported.', duration: 1800 });
    }
    if (action === 'tax-json') {
      await exportTaxSummaryJson(new Date(currentReport.endDate).getFullYear());
      showToast({ type: 'success', message: 'Tax JSON exported.', duration: 1800 });
    }
    if (action === 'tax-csv') {
      await exportTaxSummaryCsv(new Date(currentReport.endDate).getFullYear());
      showToast({ type: 'success', message: 'Tax CSV exported.', duration: 1800 });
    }
    if (action === 'share-native') {
      if (navigator.share) {
        try {
          await navigator.share({
            title: `COMMA Weekly Stats: ${currentReport.startDate} to ${currentReport.endDate}`,
            text: `COMMA Performance Report (${currentReport.startDate} to ${currentReport.endDate}):\n` +
                  `- Gross Earnings: ${formatMoney(currentReport.summary.gross)}\n` +
                  `- Net Profit: ${formatMoney(currentReport.summary.net)}\n` +
                  `- Shifts Logged: ${currentReport.summary.shiftCount}\n` +
                  `- Road Hours: ${currentReport.summary.hours.toFixed(1)}h\n` +
                  `- Distance: ${currentReport.summary.distanceKm.toFixed(1)} km`,
          });
          showToast({ type: 'success', message: 'Stats shared successfully.', duration: 1800 });
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.error('Share failed:', err);
            showToast({ type: 'error', message: 'Sharing failed.', duration: 1800 });
          }
        }
      } else {
        // Fallback: copy to clipboard
        const copied = await copySummaryToClipboard(currentReport, store.get('user'));
        if (copied) {
          showToast({ type: 'success', message: 'Share sheet not supported. Summary copied to clipboard!', duration: 2500 });
        }
      }
    }
    if (action === 'capture-yir') {
      const year = new Date(currentReport.endDate).getFullYear();
      const annual = await getAnnualReport(year);
      const yir = getYearInReviewModel(year, annual);
      
      const svgText = generateYirSvg(yir);
      
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 350;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const img = new Image();
      const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      
      try {
        await new Promise((resolve, reject) => {
          img.onload = () => {
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
            resolve();
          };
          img.onerror = (e) => {
            URL.revokeObjectURL(url);
            reject(new Error('SVG Image loading failed'));
          };
          img.src = url;
        });
        
        exportYearInReviewPng(canvas.toDataURL('image/png'), year);
        showToast({ type: 'success', message: 'Year in review exported.', duration: 1800 });
      } catch (err) {
        console.error('PNG Capture failed:', err);
        showToast({ type: 'error', message: 'Failed to export Year in Review image.', duration: 1800 });
      }
    }
  });
}


