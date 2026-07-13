import PapaMod from '../libs/papaparse.min.js';
import { db } from '../core/db.js';
import { store } from '../core/store.js';
import { showToast, showModal } from '../ui/components.js';
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
  previewVaultImportDiff,
  restoreVaultBackup,
} from '../modules/reports/reports.js';
import { saveShift } from '../modules/shifts/shifts.js';
import { saveExpense } from '../modules/expenses/expenses.js';
import { ReportRegistry } from '../registry/reports/index.js';
import '../css/views/reports.css';

const Papa = /** @type {any} */ (PapaMod).default || PapaMod;

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
      <header class="card card-raised tax-header" style="padding: var(--space-4);">
        <div class="tax-header-title">
          <h1>${esc(t('reports.title'))}</h1>
          <p>${esc(t('reports.subtitle'))}</p>
        </div>
      </header>

      <div class="reports-config-grid">
        <section class="card">
          <div style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-4);">
            ${getIcon('calendar', 18, 'text-brand')}
            <h2 style="margin: 0; font-size: var(--text-md);">${esc(t('reports.periodTitle'))}</h2>
          </div>
          
          <ion-segment class="reports-period-segment" value="weekly" data-reports-period>
            <ion-segment-button value="weekly">${esc(t('reports.weekly'))}</ion-segment-button>
            <ion-segment-button value="monthly">${esc(t('reports.monthly'))}</ion-segment-button>
            <ion-segment-button value="annual">${esc(t('reports.annual'))}</ion-segment-button>
            <ion-segment-button value="platform">${esc(t('reports.platform'))}</ion-segment-button>
            <ion-segment-button value="custom">${esc(t('reports.custom'))}</ion-segment-button>
          </ion-segment>

          <div class="reports-filter-grid">
            <label class="field" data-slot="platform-filter">
              <span class="field-label">Platform Filter</span>
              <select class="input" name="platformId">
                <option value="all">All Platforms</option>
              </select>
            </label>
            <div class="reports-date-grid">
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
        </section>

        <section class="card">
          <div style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-4);">
            ${getIcon('settings', 18, 'text-muted')}
            <h2 style="margin: 0; font-size: var(--text-md);">${esc(t('reports.templateBuilder'))}</h2>
          </div>
          <div class="reports-template-grid">
            <label class="template-check"><input data-template-section="overview" type="checkbox" /> Overview</label>
            <label class="template-check"><input data-template-section="platform_breakdown" type="checkbox" /> Platforms</label>
            <label class="template-check"><input data-template-section="shifts" type="checkbox" /> Shifts</label>
            <label class="template-check"><input data-template-section="expenses" type="checkbox" /> Expenses</label>
            <label class="template-check"><input data-template-section="chart" type="checkbox" /> Review</label>
            <label class="template-check"><input data-template-section="qr" type="checkbox" /> Share Stats</label>
            <label class="template-check"><input data-template-section="notes" type="checkbox" /> Notes</label>
          </div>
        </section>
      </div>

      <section class="card" data-slot="report-card"></section>

      <div class="reports-visuals-grid">
        <section class="card" data-slot="qr"></section>
        <section class="card" data-slot="yir"></section>
      </div>

      <section class="card">
        <div style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-6);">
          ${getIcon('download', 20, 'text-brand')}
          <h2 style="margin: 0; font-size: var(--text-lg); font-weight: 800;">Data Management & Exports</h2>
        </div>
        
        <div class="reports-actions-grid">
          <div class="export-btn-group">
            <ion-button data-action="copy"><span slot="start">${getIcon('copy', 16)}</span>Copy Summary</ion-button>
            <ion-button fill="outline" data-action="print"><span slot="start">${getIcon('printer', 16)}</span>Print View</ion-button>
          </div>

          <div class="export-btn-group">
            <ion-button fill="outline" data-action="csv-shifts"><span slot="start">${getIcon('file-text', 16)}</span>Export Shifts CSV</ion-button>
            <ion-button fill="outline" data-action="csv-expenses"><span slot="start">${getIcon('file-text', 16)}</span>Export Expenses CSV</ion-button>
            <ion-button fill="outline" data-action="csv-mileage"><span slot="start">${getIcon('map', 16)}</span>Export Mileage Log CSV</ion-button>
          </div>

          <div class="export-btn-group">
            <ion-button fill="outline" data-action="tax-csv"><span slot="start">${getIcon('chart-donut', 16)}</span>Export Tax CSV</ion-button>
            <ion-button fill="outline" data-action="tax-json"><span slot="start">${getIcon('code', 16)}</span>Export Tax JSON</ion-button>
          </div>

          <div class="export-btn-group">
            <ion-button fill="outline" data-action="json-backup"><span slot="start">${getIcon('shield', 16)}</span>Vault Backup</ion-button>
          </div>

          <div style="grid-column: 1 / -1; margin-top: var(--space-2); padding: var(--space-3); background-color: var(--color-surface-raised); border: 1px solid var(--color-border); border-radius: var(--radius-md); font-size: var(--text-xs); color: var(--color-text-secondary); display: flex; gap: var(--space-2); align-items: flex-start;">
            <span style="font-size: 1.1rem; line-height: 1;">⚠️</span>
            <span><strong>Disclaimers & Compliance:</strong> All exported reports, CSVs, and JSON files are planning-grade tools. Please verify all calculations and contemporaneous mileage logs with a certified accountant before final filing.</span>
          </div>
        </div>

            <pre data-slot="import-diff" style="margin-top:var(--space-2); white-space:pre-wrap; font-size: 11px; color: var(--color-text-secondary);"></pre>
          </div>
        </div>


      </section>
    </section>
  `;

  const form = {
    platformId: /** @type {HTMLSelectElement} */ (container.querySelector('[name="platformId"]')),
    startDate: /** @type {HTMLInputElement} */ (container.querySelector('[name="startDate"]')),
    endDate: /** @type {HTMLInputElement} */ (container.querySelector('[name="endDate"]')),
  };
  const reportSlot = /** @type {HTMLElement} */ (container.querySelector('[data-slot="report-card"]'));
  const qrSlot = /** @type {HTMLElement} */ (container.querySelector('[data-slot="qr"]'));
  const yirSlot = /** @type {HTMLElement} */ (container.querySelector('[data-slot="yir"]'));
  const diffSlot = /** @type {HTMLElement} */ (container.querySelector('[data-slot="import-diff"]'));
  const template = buildTemplateState(container);

  let currentPeriod = 'weekly';
  let currentReport = await getWeeklyReportCard(new Date(), Number(store.get('user')?.locale?.weekStartDay || 0));

  async function refreshReport() {
    currentReport = await periodPayload(currentPeriod, form);
    const rows = summaryRows(currentReport);

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
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--space-8) var(--space-4); text-align: center;">
          <div style="font-size: 3rem; margin-bottom: var(--space-4);">📊</div>
          <h3 style="margin: 0 0 var(--space-2) 0; font-size: var(--text-lg); font-weight: 700;">No Activity This Period</h3>
          <p style="color: var(--color-text-secondary); max-width: 320px; margin: 0; font-size: var(--text-sm);">
            You haven't logged any shifts or expenses for the selected dates.
          </p>
        </div>
      `;
      qrSlot.style.display = 'none';
      yirSlot.style.display = 'none';
      return;
    }

    qrSlot.style.display = 'block';
    yirSlot.style.display = 'block';

    let metricsHtml = `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-2);">
        <h2 style="margin: 0;">${esc(t('reports.reportCard'))}</h2>
        <span style="font-size: var(--text-xs); color: var(--color-text-secondary); font-weight: 700; text-transform: uppercase;">
          ${esc(currentReport.startDate)} — ${esc(currentReport.endDate)}
        </span>
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
        <div class="warning-banner" style="margin-top: var(--space-4); padding: var(--space-3); background-color: color-mix(in srgb, var(--color-danger) 15%, transparent); border: 1px solid var(--color-warning); border-radius: var(--radius-md); color: var(--color-danger); display: flex; align-items: center; gap: var(--space-2); font-weight: 600; font-size: var(--text-sm);">
          <span style="font-size: 1.2rem;">⚠️</span>
          <span>Expenses exceeded gross this period — see expense breakdown</span>
        </div>
      `;
    }

    if (template.sections.platform_breakdown) {
      const pbSection = ReportRegistry.getById('platform_breakdown');
      if (pbSection) {
        const pbHtml = await pbSection.renderHTML(currentReport, store.get('user'));
        metricsHtml += `
          <div style="margin-top: var(--space-6); border-top: 1px solid var(--color-border); padding-top: var(--space-4);">
            <h3 style="margin: 0 0 var(--space-2) 0; font-size: var(--text-md); font-weight: 700;">Platform Breakdown</h3>
            ${pbHtml}
          </div>
        `;
      }
    }

    reportSlot.innerHTML = metricsHtml;

    if (template.sections.qr) {
      qrSlot.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:flex-start; gap:var(--space-3); width:100%;">
          <h2 style="margin:0; font-size: var(--text-md); font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-text-secondary);">Share Stats</h2>
          <p style="font-size: var(--text-xs); color: var(--color-text-secondary); margin: 0; line-height: 1.4;">Export this period's performance metrics securely using your device's native sharing capabilities.</p>
          <ion-button expand="block" data-action="share-native" style="width:100%; margin-top:var(--space-2);">
            <span slot="start">${getIcon('share-2', 16)}</span>Share Stats via OS Sheet
          </ion-button>
        </div>
      `;
    } else {
      qrSlot.innerHTML = '<h2 style="margin:0; font-size: var(--text-md); font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-text-secondary);">Share Stats</h2><p style="color:var(--color-text-secondary); margin-top: var(--space-4); font-size: var(--text-xs);">Disabled by template builder.</p>';
    }

    const year = new Date(currentReport.endDate).getFullYear();
    const annual = await getAnnualReport(year);
    const yir = getYearInReviewModel(year, annual);
    yirSlot.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4); flex-wrap: wrap; gap: var(--space-2);">
        <h2 style="margin:0;">Year in Review</h2>
        ${getIcon('award', 20, 'text-brand')}
      </div>
      <div data-yir-card class="yir-card">
        <h3 style="font-size: var(--text-xl); font-weight: 800; margin: 0 0 var(--space-4) 0;">${esc(yir.title)}</h3>
        <div style="display:flex; flex-direction:column; gap: var(--space-1); opacity: 0.9; font-size: var(--text-sm);">
          <p>Generated on ${esc(yir.generatedAt)}</p>
          <div style="height: 1px; background: rgba(255,255,255,0.2); margin: var(--space-2) 0;"></div>
          <div class="yir-grid">
            <div>
              <p style="font-size: 10px; text-transform: uppercase; font-weight: 700;">Gross Earnings</p>
              <p style="font-size: var(--text-lg); font-weight: 800;">${esc(formatMoney(yir.summary.gross))}</p>
            </div>
            <div>
              <p style="font-size: 10px; text-transform: uppercase; font-weight: 700;">Net Profit</p>
              <p style="font-size: var(--text-lg); font-weight: 800;">${esc(formatMoney(yir.summary.net))}</p>
            </div>
            <div>
              <p style="font-size: 10px; text-transform: uppercase; font-weight: 700;">Shifts Logged</p>
              <p style="font-size: var(--text-lg); font-weight: 800;">${esc(String(yir.summary.shiftCount))}</p>
            </div>
            <div>
              <p style="font-size: 10px; text-transform: uppercase; font-weight: 700;">Road Hours</p>
              <p style="font-size: var(--text-lg); font-weight: 800;">${esc(yir.summary.hours.toFixed(1))}h</p>
            </div>
          </div>
        </div>
      </div>
      <ion-button fill="outline" expand="block" data-action="capture-yir" style="margin-top:var(--space-4); width: 100%;">
        <span slot="start">${getIcon('camera', 14)}</span>Export Shareable PNG
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

  let importPreview = null;
  let importText = '';
  const importInput = /** @type {HTMLInputElement|null} */ (container.querySelector('[data-action="import-file"]'));
  importInput?.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    importText = await file.text();
    try {
      importPreview = previewVaultImportDiff(importText);
      diffSlot.textContent = importPreview.tableDiff.map((row) => `${row.table}: ${row.incomingCount} incoming rows`).join('\n');
    } catch {
      importPreview = null;
      diffSlot.textContent = 'Could not parse backup JSON.';
    }
  });



  container.addEventListener('click', async (e) => {
    const target = e.target instanceof HTMLElement ? e.target.closest('[data-action]') : null;
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
    if (action === 'import-json') {
      if (!importPreview) {
        showToast({ type: 'warning', message: 'Select a backup file first.', duration: 1800 });
        return;
      }
      await restoreVaultBackup(importPreview.backup);
      showToast({ type: 'success', message: 'Backup restored.', duration: 1800 });
      await refreshReport();
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


