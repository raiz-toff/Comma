import html2canvasMod from '../libs/html2canvas.min.js';
import QRCodeMod from '../libs/qrcode.min.js';
import { store } from '../core/store.js';
import { showToast } from '../ui/components.js';
import { t } from '../utils/strings.js';
import { getIcon } from '../ui/icons.js';
import {
  buildPrintDocument,
  copySummaryToClipboard,
  exportAllExpensesCsv,
  exportAllShiftsCsv,
  exportTaxSummaryCsv,
  exportTaxSummaryJson,
  exportVaultBackupJson,
  exportYearInReviewPng,
  getAnnualReport,
  getCustomDateRangeReport,
  getDefaultReportTemplate,
  getMonthlyReportCard,
  getPlatformReport,
  getWeeklyQrText,
  getWeeklyReportCard,
  getYearInReviewModel,
  previewVaultImportDiff,
  restoreVaultBackup,
} from '../modules/reports/reports.js';
import { ReportRegistry } from '../registry/reports/index.js';
import '../css/views/reports.css';

const html2canvas = /** @type {any} */ (html2canvasMod).default || html2canvasMod;
const QRCode = /** @type {any} */ (QRCodeMod).default || QRCodeMod;

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
          
          <div class="reports-period-selector">
            <button class="reports-period-btn is-active" data-period="weekly">${esc(t('reports.weekly'))}</button>
            <button class="reports-period-btn" data-period="monthly">${esc(t('reports.monthly'))}</button>
            <button class="reports-period-btn" data-period="annual">${esc(t('reports.annual'))}</button>
            <button class="reports-period-btn" data-period="platform">${esc(t('reports.platform'))}</button>
            <button class="reports-period-btn" data-period="custom">${esc(t('reports.custom'))}</button>
          </div>

          <div class="reports-filter-grid">
            <label class="field">
              <span class="field-label">Platform Filter</span>
              <input class="input" name="platformId" placeholder="e.g. doordash" />
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
            <label class="template-check"><input data-template-section="shifts" type="checkbox" /> Shifts</label>
            <label class="template-check"><input data-template-section="expenses" type="checkbox" /> Expenses</label>
            <label class="template-check"><input data-template-section="chart" type="checkbox" /> Review</label>
            <label class="template-check"><input data-template-section="qr" type="checkbox" /> QR Code</label>
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
            <button class="btn btn-primary" data-action="copy" type="button">${getIcon('copy', 16)} Copy Summary</button>
            <button class="btn btn-secondary" data-action="print" type="button">${getIcon('printer', 16)} Print View</button>
          </div>
          
          <div class="export-btn-group">
            <button class="btn btn-secondary" data-action="csv-shifts" type="button">${getIcon('file-text', 16)} Export Shifts CSV</button>
            <button class="btn btn-secondary" data-action="csv-expenses" type="button">${getIcon('file-text', 16)} Export Expenses CSV</button>
          </div>

          <div class="export-btn-group">
            <button class="btn btn-secondary" data-action="tax-csv" type="button">${getIcon('chart-donut', 16)} Export Tax CSV</button>
            <button class="btn btn-secondary" data-action="tax-json" type="button">${getIcon('code', 16)} Export Tax JSON</button>
          </div>

          <div class="export-btn-group">
            <button class="btn btn-secondary" data-action="json-backup" type="button">${getIcon('shield', 16)} Vault Backup</button>
          </div>
        </div>

        <div style="margin-top: var(--space-8); border-top: 1px solid var(--color-border); padding-top: var(--space-8);">
          <div class="import-section">
            <div style="background: var(--color-brand); color: white; padding: var(--space-4); border-radius: 50%; margin-bottom: var(--space-4); display: inline-flex;">
              ${getIcon('upload-cloud', 32)}
            </div>
            <div>
              <h3 style="margin-bottom: var(--space-1);">Import Vault Backup</h3>
              <p style="color: var(--color-text-secondary); font-size: var(--text-sm); margin-bottom: var(--space-4);">Restore your data from a COMMA JSON export file.</p>
            </div>
            <div class="import-controls">
              <input class="input" type="file" accept="application/json" data-action="import-file" style="max-width: 240px;" />
              <button class="btn btn-danger" data-action="import-json" type="button">Restore Backup</button>
            </div>
            <pre data-slot="import-diff" style="margin-top:var(--space-2); white-space:pre-wrap; font-size: 11px; color: var(--color-text-secondary);"></pre>
          </div>
        </div>
      </section>
    </section>
  `;

  const form = {
    platformId: /** @type {HTMLInputElement} */ (container.querySelector('[name="platformId"]')),
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
    reportSlot.innerHTML = `
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

    if (template.sections.qr) {
      qrSlot.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; gap:var(--space-4);">
          <h2 style="margin:0; width:100%; text-align:left;">Weekly QR Export</h2>
          <div class="qr-container">
            <canvas width="200" height="200" data-qr></canvas>
          </div>
          <p style="font-size: var(--text-xs); color: var(--color-text-secondary); text-align:center;">Scan this on your secondary device to sync the weekly stats.</p>
        </div>
      `;
      const canvas = /** @type {HTMLCanvasElement|null} */ (qrSlot.querySelector('[data-qr]'));
      if (canvas && typeof QRCode === 'function') {
        try {
          const qr = QRCode(0, 'M');
          qr.addData(getWeeklyQrText(currentReport, store.get('user')));
          qr.make();
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const cellSize = 200 / qr.getModuleCount();
            qr.renderTo2dContext(ctx, cellSize);
          }
        } catch (err) {
          console.error('QR Render failed:', err);
        }
      }
    } else {
      qrSlot.innerHTML = '<h2>Weekly QR Export</h2><p style="color:var(--color-text-secondary); margin-top: var(--space-4);">Disabled by template builder.</p>';
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
      <button class="btn btn-secondary" data-action="capture-yir" type="button" style="margin-top:var(--space-4); width: 100%;">
        ${getIcon('camera', 14)} Export Shareable PNG
      </button>
    `;
  }

  await refreshReport();

  container.querySelectorAll('[data-period]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      container.querySelectorAll('[data-period]').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      currentPeriod = String(btn.getAttribute('data-period') || 'weekly');
      await refreshReport();
    });
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
    if (action === 'capture-yir') {
      const card = container.querySelector('[data-yir-card]');
      if (!(card instanceof HTMLElement)) return;
      const canvas = await html2canvas(card, { backgroundColor: '#ffffff', scale: 2 });
      exportYearInReviewPng(canvas.toDataURL('image/png'), new Date(currentReport.endDate).getFullYear());
      showToast({ type: 'success', message: 'Year in review exported.', duration: 1800 });
    }
  });
}
