import Papa from '../libs/papaparse.min.js';
import { getIcon } from '../ui/icons.js';
import { t } from '../utils/strings.js';
import { showToast, showModal } from '../ui/components.js';
import { db } from '../core/db.js';
import { saveShift, checkConflict, normalizeShiftInput } from '../modules/shifts/shifts.js';

/**
 * Format an epoch-ms shift startTime/endTime (Fix 1 — interop plan) as HH:mm for display —
 * `item.obj.startTime`/`endTime` are real timestamps post-`normalizeShiftInput`, not the HH:mm
 * strings the CSV column originally supplied.
 * @param {unknown} ms
 */
function fmtHm(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '—';
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
import { saveExpense, normalizeExpenseInput } from '../modules/expenses/expenses.js';
import '../css/views/import.css';

/**
 * High-fidelity, premium CSV Import Wizard Page View (route #/import).
 * @param {HTMLElement} root
 * @param {Record<string, unknown>} ctx
 */
export function render(root, ctx) {
  root.textContent = '';
  
  const container = document.createElement('div');
  container.className = 'import-view-container';
  root.appendChild(container);

  // Local reactive wizard state
  const state = {
    importType: 'shifts', // 'shifts' | 'expenses' | 'incomes'
    file: null,          // Uploaded File object
    rawRows: [],         // 2D Array of raw CSV cells (Papa.parse results)
    step: 1,             // 1 to 5
    hasHeader: true,
    headerRowIndex: 0,
    lastRowIndex: 0,
    mappings: {},        // Model property -> CSV Column Index (e.g. grossRevenue -> 4)
    
    // Step 5 Preview Stats
    parsedObjects: [],
    conflictingObjects: [],
    validationErrors: [],
    conflictErrors: [],
    notices: [],
  };

  // Convert column index to Spreadsheet Letters (A, B, C...)
  function colLetter(index) {
    let temp = index;
    let letter = '';
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  }

  // Get human name for mapped columns
  function getColumnLabel(index) {
    const letter = colLetter(index);
    if (state.hasHeader && state.rawRows[state.headerRowIndex]) {
      const name = state.rawRows[state.headerRowIndex][index];
      if (name) return `Column ${letter} (${String(name).trim()})`;
    }
    return `Column ${letter}`;
  }

  // Build column selector dropdown options
  function renderColumnOptions(selectedVal, currentMapKey) {
    if (!state.rawRows.length || !state.rawRows[0]) return '<option value="">-- Map Column --</option>';
    const colCount = state.rawRows[0].length;
    let html = '<option value="">-- Map Column --</option>';
    for (let i = 0; i < colCount; i++) {
      const isMappedElsewhere = Object.entries(state.mappings).some(([k, val]) => val === i && k !== currentMapKey && val !== undefined && val !== null);
      if (!isMappedElsewhere) {
        const selected = String(selectedVal) === String(i) ? 'selected' : '';
        html += `<option value="${i}" ${selected}>${getColumnLabel(i)}</option>`;
      }
    }
    return html;
  }

  // Formatter for preview money
  function formatMoney(amount) {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(amount) || 0);
  }

  // Helper to escape HTML safely
  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── RE-PAINT MAIN VIEW CONTROLLER ──────────────────────────────────────
  function paint() {
    container.innerHTML = '';

    // Title Section
    const titleSec = document.createElement('div');
    titleSec.className = 'import-title-section';
    titleSec.innerHTML = `
      ${getIcon('file-plus', 24, 'text-brand')}
      <h1>${esc(t('shifts.bulkImport'))}</h1>
    `;
    container.appendChild(titleSec);

    if (!state.file) {
      // ── STATE A: INITIAL UPLOAD PAGE ───────────────────────────────────
      const uploadLayout = document.createElement('div');
      uploadLayout.className = 'import-upload-layout';
      
      const leftPanel = document.createElement('div');
      leftPanel.className = 'import-upload-panel';
      leftPanel.innerHTML = `
        <div class="import-upload-card">
          <div class="import-field-group">
            <label class="import-upload-label">Import Type</label>
            <select class="import-upload-select" data-import-type>
              <option value="shifts" ${state.importType === 'shifts' ? 'selected' : ''}>Shifts (CSV)</option>
              <option value="expenses" ${state.importType === 'expenses' ? 'selected' : ''}>Expenses (CSV)</option>
              <option value="incomes" ${state.importType === 'incomes' ? 'selected' : ''}>Platform Incomes (CSV)</option>
            </select>
          </div>
          
          <div class="import-drag-zone" data-drag-zone>
            <div class="import-drag-zone-icon">${getIcon('file-plus', 36)}</div>
            <p>Choose CSV file or drag and drop it here</p>
            <button type="button" class="import-drag-zone-btn" data-trigger-file>Choose file</button>
            <input type="file" accept=".csv,text/csv" style="display:none" data-file-input />
          </div>
        </div>
      `;

      const rightPanel = document.createElement('div');
      rightPanel.className = 'import-empty-panel';
      rightPanel.innerHTML = `
        <div class="import-empty-icon">${getIcon('file-text', 48)}</div>
        <h3>You have no imports yet</h3>
        <p>Once you select a CSV statement, your spreadsheet wizard will appear here to map and validate your columns.</p>
        <a class="import-empty-btn btn" href="#/import-guide" style="text-decoration:none; display:inline-flex; align-items:center; justify-content:center;">Learn how to import</a>
      `;

      uploadLayout.appendChild(leftPanel);
      uploadLayout.appendChild(rightPanel);
      container.appendChild(uploadLayout);
      bindUploadEvents(leftPanel);
      return;
    }

    // ── STATE B: INTERACTIVE WIZARD PROGRESS ─────────────────────────────
    const wizardLayout = document.createElement('div');
    wizardLayout.className = 'import-wizard-layout';

    // Breadcrumbs Circular Steps Navigation
    const stepsBar = document.createElement('div');
    stepsBar.className = 'import-wizard-steps';
    stepsBar.innerHTML = `
      <div class="import-step-item ${state.step === 1 ? 'active' : state.step > 1 ? 'completed' : ''}">
        <div class="import-step-circle">1</div>
        <span class="import-step-label">Select Header</span>
      </div>
      <div class="import-step-connector ${state.step > 1 ? 'completed' : ''}"></div>
      <div class="import-step-item ${state.step === 2 ? 'active' : state.step > 2 ? 'completed' : ''}">
        <div class="import-step-circle">2</div>
        <span class="import-step-label">Map Amounts</span>
      </div>
      <div class="import-step-connector ${state.step > 2 ? 'completed' : ''}"></div>
      <div class="import-step-item ${state.step === 3 ? 'active' : state.step > 3 ? 'completed' : ''}">
        <div class="import-step-circle">3</div>
        <span class="import-step-label">Map Date</span>
      </div>
      <div class="import-step-connector ${state.step > 3 ? 'completed' : ''}"></div>
      <div class="import-step-item ${state.step === 4 ? 'active' : state.step > 4 ? 'completed' : ''}">
        <div class="import-step-circle">4</div>
        <span class="import-step-label">Additional Columns</span>
      </div>
      <div class="import-step-connector ${state.step > 4 ? 'completed' : ''}"></div>
      <div class="import-step-item ${state.step === 5 ? 'active' : ''}">
        <div class="import-step-circle">5</div>
        <span class="import-step-label">Preview & Import</span>
      </div>
    `;
    wizardLayout.appendChild(stepsBar);

    // Main workspace
    const workspace = document.createElement('div');
    workspace.className = 'import-workspace';

    // Sidebar panel controls
    const sidebar = document.createElement('div');
    sidebar.className = 'import-sidebar-controls';
    
    // Right panel grid viewer
    const gridViewer = document.createElement('div');
    gridViewer.className = 'import-spreadsheet-container';

    if (state.step === 1) {
      // ── STEP 1: HEADER & ROW BOUNDARIES ────────────────────────────────
      sidebar.innerHTML = `
        <h2>Select Header Row</h2>
        <p>Choose which row acts as the column labels. Standard CSVs usually have labels on row 1.</p>
        
        <div class="import-sidebar-fields">
          <div class="import-toggle-row">
            <span class="import-toggle-label">Has Header row</span>
            <label class="switch" style="position:relative; display:inline-block; width:44px; height:24px;">
              <input type="checkbox" data-has-header ${state.hasHeader ? 'checked' : ''} style="opacity:0; width:0; height:0;" />
              <span class="slider" style="position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background-color:#ccc; transition:.4s; border-radius:34px;"></span>
            </label>
          </div>
          
          <div class="import-field-group">
            <label>Header row index</label>
            <input type="number" class="input" data-header-row min="0" max="${state.rawRows.length - 1}" value="${state.headerRowIndex}" />
          </div>
          
          <div class="import-field-group">
            <label>Last row to import</label>
            <input type="number" class="input" data-last-row min="0" max="${state.rawRows.length - 1}" value="${state.lastRowIndex}" />
          </div>
        </div>
      `;

      // Render CSV table
      let tableHtml = `<table class="import-spreadsheet-table"><thead><tr><th>#</th>`;
      if (state.rawRows[0]) {
        for (let c = 0; c < state.rawRows[0].length; c++) {
          tableHtml += `<th>${colLetter(c)}</th>`;
        }
      }
      tableHtml += `</tr></thead><tbody>`;

      // Show first 150 rows for performance
      const previewRows = state.rawRows.slice(0, 150);
      previewRows.forEach((row, rIdx) => {
        const isHeader = state.hasHeader && rIdx === state.headerRowIndex;
        tableHtml += `<tr class="${isHeader ? 'is-header-row' : ''}" data-row-index="${rIdx}" style="cursor:pointer;">`;
        tableHtml += `<td>${rIdx + 1}</td>`;
        row.forEach((cell) => {
          tableHtml += `<td>${esc(cell)}</td>`;
        });
        tableHtml += `</tr>`;
      });
      tableHtml += `</tbody></table>`;
      gridViewer.innerHTML = tableHtml;

      // Add slider CSS styling programmatically
      const style = document.createElement('style');
      style.textContent = `
        .switch input:checked + .slider { background-color: var(--color-brand); }
        .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 4px; bottom: 4px; background-color: white; transition: .4s; border-radius: 50%; }
        .switch input:checked + .slider:before { transform: translateX(20px); }
      `;
      document.head.appendChild(style);

    } else if (state.step === 2) {
      // ── STEP 2: FINANCIAL AMOUNTS ──────────────────────────────────────
      if (state.importType === 'shifts' || state.importType === 'incomes') {
        sidebar.innerHTML = `
          <h2>Map Amounts</h2>
          <p>Please map columns that contain your shift earnings details. Standard amounts should be numbers.</p>
          
          <div class="import-sidebar-fields">
            <div class="import-field-group">
              <label>Gross Revenue (Required)</label>
              <select class="import-upload-select" data-map="grossRevenue">
                ${renderColumnOptions(state.mappings.grossRevenue, 'grossRevenue')}
              </select>
            </div>
            <div class="import-field-group">
              <label>Tips Amount</label>
              <select class="import-upload-select" data-map="tipsRevenue">
                ${renderColumnOptions(state.mappings.tipsRevenue, 'tipsRevenue')}
              </select>
            </div>
            <div class="import-field-group">
              <label>Bonus / Incentive</label>
              <select class="import-upload-select" data-map="bonus">
                ${renderColumnOptions(state.mappings.bonus, 'bonus')}
              </select>
            </div>
          </div>
        `;
      } else {
        sidebar.innerHTML = `
          <h2>Map Amounts</h2>
          <p>Please map columns relating to your expenses details.</p>
          
          <div class="import-sidebar-fields">
            <div class="import-field-group">
              <label>Expense Amount (Required)</label>
              <select class="import-upload-select" data-map="amount">
                ${renderColumnOptions(state.mappings.amount, 'amount')}
              </select>
            </div>
            <div class="import-field-group">
              <label>HST/VAT Paid</label>
              <select class="import-upload-select" data-map="hstPaid">
                ${renderColumnOptions(state.mappings.hstPaid, 'hstPaid')}
              </select>
            </div>
          </div>
        `;
      }
      renderSpreadsheetGrid(gridViewer, ['grossRevenue', 'tipsRevenue', 'bonus', 'amount', 'hstPaid']);

    } else if (state.step === 3) {
      // ── STEP 3: MAPPING DATE ───────────────────────────────────────────
      sidebar.innerHTML = `
        <h2>Map Date Column</h2>
        <p>Please select the primary date column. COMMA expects dates in standard formats like YYYY-MM-DD.</p>
        
        <div class="import-sidebar-fields">
          <div class="import-field-group">
            <label>Date (Required)</label>
            <select class="import-upload-select" data-map="date">
              ${renderColumnOptions(state.mappings.date, 'date')}
            </select>
          </div>
        </div>
      `;
      renderSpreadsheetGrid(gridViewer, ['date']);

    } else if (state.step === 4) {
      // ── STEP 4: MAPPING ADDITIONAL ─────────────────────────────────────
      if (state.importType === 'shifts') {
        sidebar.innerHTML = `
          <h2>Map Additional Fields</h2>
          <p>Optionally map times, platform, and delivery details to get comprehensive weekly analysis insights.</p>
          
          <div class="import-sidebar-fields">
            <div class="import-field-group">
              <label>Start Time (HH:mm)</label>
              <select class="import-upload-select" data-map="startTime">
                ${renderColumnOptions(state.mappings.startTime, 'startTime')}
              </select>
            </div>
            <div class="import-field-group">
              <label>End Time (HH:mm)</label>
              <select class="import-upload-select" data-map="endTime">
                ${renderColumnOptions(state.mappings.endTime, 'endTime')}
              </select>
            </div>
            <div class="import-field-group">
              <label>Platform Name</label>
              <select class="import-upload-select" data-map="platformId">
                ${renderColumnOptions(state.mappings.platformId, 'platformId')}
              </select>
            </div>
            <div class="import-field-group">
              <label>Orders / Deliveries Count</label>
              <select class="import-upload-select" data-map="orders">
                ${renderColumnOptions(state.mappings.orders, 'orders')}
              </select>
            </div>
            <div class="import-field-group">
              <label>Distance Traveled (km)</label>
              <select class="import-upload-select" data-map="activeMileage">
                ${renderColumnOptions(state.mappings.activeMileage, 'activeMileage')}
              </select>
            </div>
            <div class="import-field-group">
              <label>Dead Mileage (km)</label>
              <select class="import-upload-select" data-map="deadMileage">
                ${renderColumnOptions(state.mappings.deadMileage, 'deadMileage')}
              </select>
            </div>
            <div class="import-field-group">
              <label>Out-of-pocket Order Cost</label>
              <select class="import-upload-select" data-map="outOfPocketExpense">
                ${renderColumnOptions(state.mappings.outOfPocketExpense, 'outOfPocketExpense')}
              </select>
            </div>
            <div class="import-field-group">
              <label>Custom Notes</label>
              <select class="import-upload-select" data-map="notes">
                ${renderColumnOptions(state.mappings.notes, 'notes')}
              </select>
            </div>
          </div>
        `;
      } else if (state.importType === 'expenses') {
        sidebar.innerHTML = `
          <h2>Map Additional Fields</h2>
          <p>Customize expense metadata mapping fields.</p>
          
          <div class="import-sidebar-fields">
            <div class="import-field-group">
              <label>Category (e.g. Fuel, Maintenance)</label>
              <select class="import-upload-select" data-map="category">
                ${renderColumnOptions(state.mappings.category, 'category')}
              </select>
            </div>
            <div class="import-field-group">
              <label>Platform Name</label>
              <select class="import-upload-select" data-map="platformId">
                ${renderColumnOptions(state.mappings.platformId, 'platformId')}
              </select>
            </div>
            <div class="import-field-group">
              <label>Business Allocation %</label>
              <select class="import-upload-select" data-map="deductiblePct">
                ${renderColumnOptions(state.mappings.deductiblePct, 'deductiblePct')}
              </select>
            </div>
            <div class="import-field-group">
              <label>Recurring Expense (true/false)</label>
              <select class="import-upload-select" data-map="isRecurring">
                ${renderColumnOptions(state.mappings.isRecurring, 'isRecurring')}
              </select>
            </div>
            <div class="import-field-group">
              <label>Expense Notes</label>
              <select class="import-upload-select" data-map="notes">
                ${renderColumnOptions(state.mappings.notes, 'notes')}
              </select>
            </div>
          </div>
        `;
      } else {
        // incomes
        sidebar.innerHTML = `
          <h2>Map Additional Fields</h2>
          <p>Map extra statement metadata columns.</p>
          
          <div class="import-sidebar-fields">
            <div class="import-field-group">
              <label>Platform Name</label>
              <select class="import-upload-select" data-map="platformId">
                ${renderColumnOptions(state.mappings.platformId, 'platformId')}
              </select>
            </div>
            <div class="import-field-group">
              <label>Orders / Deliveries Count</label>
              <select class="import-upload-select" data-map="orders">
                ${renderColumnOptions(state.mappings.orders, 'orders')}
              </select>
            </div>
            <div class="import-field-group">
              <label>Custom Notes</label>
              <select class="import-upload-select" data-map="notes">
                ${renderColumnOptions(state.mappings.notes, 'notes')}
              </select>
            </div>
          </div>
        `;
      }
      renderSpreadsheetGrid(gridViewer, ['startTime', 'endTime', 'platformId', 'orders', 'activeMileage', 'deadMileage', 'outOfPocketExpense', 'notes', 'category', 'deductiblePct', 'isRecurring']);

    } else if (state.step === 5) {
      // ── STEP 5: SMART PREVIEW & STRICTION VALIDATION ───────────────────
      sidebar.innerHTML = `
        <h2>Validation Summary</h2>
        <p>Review resolved rows and database checks before final import.</p>
        
        <div class="import-sidebar-fields" style="gap:var(--space-3); margin-top:var(--space-4);">
          ${
            state.validationErrors.length
              ? `
            <div class="import-warning-card">
              <div class="import-warning-header">${getIcon('alert-triangle', 18)} Attention Required</div>
              <p style="font-size:var(--text-xs); color:var(--color-danger); margin:0;">
                Your CSV mapping contains errors. You MUST fix mapping or data columns before proceeding.
              </p>
            </div>
          `
              : state.conflictErrors.length
              ? `
            <div class="import-warning-card" style="border-color:#f59e0b; background:color-mix(in srgb, #f59e0b 6%, var(--color-surface));">
              <div class="import-warning-header" style="color:#d97706;">${getIcon('alert-circle', 18)} Conflicts Detected</div>
              <p style="font-size:var(--text-xs); color:var(--color-text); margin:0;">
                Some rows overlap or are duplicates. You can skip conflicting rows and import the remaining valid records.
              </p>
            </div>
          `
              : `
            <div style="background:color-mix(in srgb, var(--color-brand) 6%, var(--color-surface)); padding:var(--space-4); border-radius:var(--radius-md); border:1px solid var(--color-brand); display:flex; align-items:center; gap:var(--space-2); color:var(--color-brand); font-weight:700; font-size:var(--text-sm);">
              ${getIcon('check', 18)} Ready to Import
            </div>
          `
          }
        </div>
      `;

      // Render Summary, Warning Banners, and Row Samples
      let totalAmount = 0;
      let minDate = '';
      let maxDate = '';

      state.parsedObjects.forEach((item) => {
        const obj = item.obj;
        const val = Number(obj.grossRevenue ?? obj.amount ?? 0);
        totalAmount += val;
        if (obj.date) {
          if (!minDate || obj.date < minDate) minDate = obj.date;
          if (!maxDate || obj.date > maxDate) maxDate = obj.date;
        }
      });

      let previewHtml = `
        <div style="padding:var(--space-6); display:flex; flex-direction:column; gap:var(--space-5);">
          
          <!-- Summary Cards -->
          <div class="import-summary-grid">
            <div class="import-summary-card">
              <label>Rows Found</label>
              <span>${state.parsedObjects.length} Rows</span>
            </div>
            <div class="import-summary-card">
              <label>${state.importType === 'expenses' ? 'Total Cost' : 'Total Gross'}</label>
              <span class="${state.importType === 'expenses' ? 'text-danger' : 'text-brand'}" style="${state.importType === 'expenses' ? 'color:#ef4444' : ''}">${formatMoney(totalAmount)}</span>
            </div>
            <div class="import-summary-card">
              <label>Date Range</label>
              <span>${minDate ? `${minDate} — ${maxDate}` : '—'}</span>
            </div>
          </div>
      `;

      // Warnings & Notices
      if (state.notices.length) {
        previewHtml += `
          <div class="import-warning-card" style="margin-bottom:var(--space-4); border-color:var(--color-brand); background:color-mix(in srgb, var(--color-brand) 6%, var(--color-surface));">
            <div class="import-warning-header" style="color:var(--color-brand);">${getIcon('info', 20)} Import Notice</div>
            <ul class="import-warning-list">
              ${state.notices.map((n) => `<li style="color:var(--color-text); font-weight:600;">${esc(n)}</li>`).join('')}
            </ul>
          </div>
        `;
      }
      if (state.validationErrors.length || state.conflictErrors.length) {
        previewHtml += `
          <div class="import-warning-card" style="margin-bottom:var(--space-4);">
            <div class="import-warning-header">${getIcon('alert-triangle', 20)} Mappings and Conflicts Warnings (${state.validationErrors.length + state.conflictErrors.length})</div>
            <ul class="import-warning-list">
              ${state.validationErrors.map((err) => `<li style="color:var(--color-danger); font-weight:600;">${esc(err)}</li>`).join('')}
              ${state.conflictErrors.map((err) => `<li style="color:var(--color-danger); font-weight:600;">${esc(err)}</li>`).join('')}
            </ul>
          </div>
        `;
      }

      // Sample Row Table
      previewHtml += `
          <div class="preview-sample">
            <label style="font-weight:700; font-size:var(--text-sm); color:var(--color-text-secondary); text-transform:uppercase; margin-bottom:var(--space-2); display:block;">Sample Mapped Rows</label>
            <table class="import-spreadsheet-table" style="width:100%;">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Date</th>
                  ${state.importType === 'expenses' ? '<th>Category</th><th>Amount</th>' : '<th>Platform</th><th>Gross</th><th>Times</th>'}
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                ${
                  state.parsedObjects.length
                    ? state.parsedObjects
                        .slice(0, 10)
                        .map(
                          (item) => `
                  <tr>
                    <td>${item.lineNum}</td>
                    <td>${esc(item.obj.date)}</td>
                    ${
                      state.importType === 'expenses'
                        ? `
                      <td style="text-transform:capitalize;">${esc(item.obj.category || 'other')}</td>
                      <td class="text-danger" style="color:#ef4444">${formatMoney(item.obj.amount)}</td>
                    `
                        : `
                      <td style="text-transform:capitalize;">${esc(item.obj.platformId || 'other')}</td>
                      <td class="text-brand">${formatMoney(item.obj.grossRevenue)}</td>
                      <td>${item.obj.startTime != null ? `${esc(fmtHm(item.obj.startTime))} — ${esc(fmtHm(item.obj.endTime))}` : '—'}</td>
                    `
                    }
                    <td><span style="font-size:11px; color:var(--color-text-secondary); white-space:nowrap; max-width:200px; display:block; overflow:hidden; text-overflow:ellipsis;" title="${esc(item.obj.notes)}">${esc(item.obj.notes)}</span></td>
                  </tr>
                `,
                        )
                        .join('')
                    : '<tr><td colspan="5" class="text-center text-secondary">No rows resolved</td></tr>'
                }
              </tbody>
            </table>
          </div>
        </div>
      `;
      gridViewer.innerHTML = previewHtml;
    }

    workspace.appendChild(sidebar);
    workspace.appendChild(gridViewer);
    wizardLayout.appendChild(workspace);

    // Wizard actions footer bar
    const actionBar = document.createElement('div');
    actionBar.className = 'import-action-bar';
    actionBar.innerHTML = `
      <div class="import-action-bar-left">
        <button type="button" class="btn btn-ghost" data-wizard-cancel>Cancel</button>
        ${state.step > 1 ? '<button type="button" class="btn btn-secondary" data-wizard-back>Back</button>' : ''}
      </div>
      <div class="import-action-bar-right" style="display: flex; gap: var(--space-2);">
        ${
          state.step === 5
            ? (state.validationErrors.length
                ? `<button type="button" class="btn btn-primary" disabled>Confirm Import</button>`
                : (state.conflictErrors.length
                    ? `<button type="button" class="btn btn-secondary" data-wizard-submit="override">Import All (${state.parsedObjects.length + state.conflictingObjects.length})</button>
                       <button type="button" class="btn btn-primary" data-wizard-submit="skip">Skip Conflicts & Import Rest (${state.parsedObjects.length})</button>`
                    : `<button type="button" class="btn btn-primary" data-wizard-submit="all">Confirm Import (${state.parsedObjects.length})</button>`))
            : '<button type="button" class="btn btn-primary" data-wizard-next>Next Step</button>'
        }
      </div>
    `;
    wizardLayout.appendChild(actionBar);
    container.appendChild(wizardLayout);
    bindWizardEvents(wizardLayout);
  }

  // Render standard spreadsheet layout
  function renderSpreadsheetGrid(gridEl, mapKeys = []) {
    let headerMappingHtml = `<tr class="import-header-mapping-row"><th>Mapping</th>`;
    let colHeaderHtml = `<thead><tr><th>#</th>`;
    
    if (state.rawRows[0]) {
      for (let c = 0; c < state.rawRows[0].length; c++) {
        colHeaderHtml += `<th>${colLetter(c)}</th>`;
        
        // Find if this column has an active mapping in our current step list
        let activeLabel = '—';
        for (const k of mapKeys) {
          if (String(state.mappings[k]) === String(c)) {
            activeLabel = k.toUpperCase();
            break;
          }
        }
        headerMappingHtml += `<th>${esc(activeLabel)}</th>`;
      }
    }
    colHeaderHtml += `</tr>${headerMappingHtml}</thead>`;

    let tbodyHtml = '<tbody>';
    // Display up to 150 rows for preview
    const dataRows = state.rawRows.slice(0, 150);
    dataRows.forEach((row, rIdx) => {
      const isHeader = state.hasHeader && rIdx === state.headerRowIndex;
      tbodyHtml += `<tr class="${isHeader ? 'is-header-row' : ''}">`;
      tbodyHtml += `<td>${rIdx + 1}</td>`;
      row.forEach((cell, cIdx) => {
        let isMapped = false;
        for (const k of mapKeys) {
          if (String(state.mappings[k]) === String(cIdx)) {
            isMapped = true;
            break;
          }
        }
        tbodyHtml += `<td class="${isMapped ? 'is-mapped-column' : ''}">${esc(cell)}</td>`;
      });
      tbodyHtml += `</tr>`;
    });
    tbodyHtml += '</tbody>';

    gridEl.innerHTML = `<table class="import-spreadsheet-table">${colHeaderHtml}${tbodyHtml}</table>`;
  }

  // ── EVENT BINDINGS FOR UPLOAD STATE ────────────────────────────────────
  function bindUploadEvents(panel) {
    const dragZone = container.querySelector('[data-drag-zone]');
    const fileInput = container.querySelector('[data-file-input]');
    const selectType = container.querySelector('[data-import-type]');

    selectType?.addEventListener('change', () => {
      state.importType = selectType.value;
    });

    dragZone?.addEventListener('click', (e) => {
      if (e.target && e.target.closest('[data-import-type]')) return;
      fileInput?.click();
    });

    fileInput?.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (file) await handleFileSelect(file);
    });

    dragZone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dragZone.classList.add('dragover');
    });

    dragZone?.addEventListener('dragleave', () => {
      dragZone.classList.remove('dragover');
    });

    dragZone?.addEventListener('drop', async (e) => {
      e.preventDefault();
      dragZone.classList.remove('dragover');
      const file = e.dataTransfer?.files?.[0];
      if (file) await handleFileSelect(file);
    });
  }

  // Parsing CSV and setting wizard parameters
  async function handleFileSelect(file) {
    if (!file) return;
    try {
      const selectType = container.querySelector('[data-import-type]');
      if (selectType && selectType.value) {
        state.importType = selectType.value;
      }
      const text = await file.text();
      const res = Papa.parse(text, { skipEmptyLines: true });
      if (!res || res.errors?.length) {
        showToast({ type: 'error', message: 'Failed to parse CSV file.', duration: 2400 });
        return;
      }
      state.file = file;
      state.rawRows = (res.data || []).slice(0, 155);
      state.headerRowIndex = 0;
      state.lastRowIndex = state.rawRows.length - 1;
      state.step = 1;
      state.mappings = {};
      
      // Auto-mapping heuristics
      if (state.rawRows[0]) {
        state.rawRows[0].forEach((col, idx) => {
          const norm = String(col).toLowerCase().trim();
          if (norm.includes('date') || norm === 'day') state.mappings.date = idx;
          if (norm.includes('gross') || norm.includes('earning')) state.mappings.grossRevenue = idx;
          if (norm.includes('amount')) state.mappings.amount = idx;
          if (norm.includes('tip')) state.mappings.tipsRevenue = idx;
          if (norm.includes('bonus')) state.mappings.bonus = idx;
          if (norm === 'start' || norm === 'start time' || norm === 'starttime' || norm.startsWith('start_')) state.mappings.startTime = idx;
          if (norm.includes('end')) state.mappings.endTime = idx;
          if (norm.includes('platform') || norm.includes('app')) state.mappings.platformId = idx;
          if (norm.includes('order') || norm.includes('deliver')) state.mappings.orders = idx;
          // 'dead' headers (deadMileage, deadMilesKm) also contain 'mile'/'km' — without the
          // guard they would steal the activeMileage mapping from the real distance column.
          if ((norm.includes('distance') || norm.includes('km') || norm.includes('mile')) && !norm.includes('dead')) state.mappings.activeMileage = idx;
          if (norm.includes('dead')) state.mappings.deadMileage = idx;
          if (norm.includes('out of pocket') || norm.includes('pocket') || norm.includes('oop')) state.mappings.outOfPocketExpense = idx;
          if (norm.includes('note')) state.mappings.notes = idx;
          if (norm.includes('category')) state.mappings.category = idx;
          if (norm.includes('business') || norm.includes('deductible')) state.mappings.deductiblePct = idx;
          if (norm.includes('tax') || norm.includes('hst')) state.mappings.hstPaid = idx;
          if (norm.includes('recurring')) state.mappings.isRecurring = idx;
        });
      }

      paint();
    } catch (err) {
      console.error(err);
      showToast({ type: 'error', message: 'Could not read CSV file.' });
    }
  }

  // ── EVENT BINDINGS FOR WIZARD STATES ───────────────────────────────────
  function bindWizardEvents(wizardEl) {
    // Has header row toggle
    const toggleHeader = wizardEl.querySelector('[data-has-header]');
    toggleHeader?.addEventListener('change', () => {
      state.hasHeader = toggleHeader.checked;
      paint();
    });

    // Header Index changes
    const headerInput = wizardEl.querySelector('[data-header-row]');
    headerInput?.addEventListener('change', () => {
      state.headerRowIndex = Math.max(0, Number(headerInput.value));
      paint();
    });

    // Last Row Index changes
    const lastRowInput = wizardEl.querySelector('[data-last-row]');
    lastRowInput?.addEventListener('change', () => {
      state.lastRowIndex = Math.max(0, Number(lastRowInput.value));
      paint();
    });

    // Clicking row on table sets it as header index
    wizardEl.querySelectorAll('.import-spreadsheet-table tbody tr').forEach((row) => {
      row.addEventListener('click', () => {
        if (!state.hasHeader || state.step !== 1) return;
        const rIdx = Number(row.getAttribute('data-row-index'));
        state.headerRowIndex = rIdx;
        paint();
      });
    });

    // Map selects changes
    wizardEl.querySelectorAll('select[data-map]').forEach((sel) => {
      sel.addEventListener('change', () => {
        const key = sel.getAttribute('data-map');
        if (key) {
          state.mappings[key] = sel.value === '' ? undefined : Number(sel.value);
          paint();
        }
      });
    });

    // Navigation buttons
    wizardEl.querySelector('[data-wizard-cancel]')?.addEventListener('click', () => {
      state.importType = 'shifts';
      state.file = null;
      state.rawRows = [];
      state.mappings = {};
      state.step = 1;
      state.parsedObjects = [];
      state.conflictingObjects = [];
      state.validationErrors = [];
      state.conflictErrors = [];
      state.notices = [];
      state.hasHeader = true;
      state.headerRowIndex = 0;
      state.lastRowIndex = 0;
      paint();
    });

    wizardEl.querySelector('[data-wizard-back]')?.addEventListener('click', () => {
      state.step = Math.max(1, state.step - 1);
      paint();
    });

    wizardEl.querySelector('[data-wizard-next]')?.addEventListener('click', async () => {
      // Validate mapping key requirements before next steps
      if (state.step === 2) {
        if (state.importType === 'expenses' && state.mappings.amount === undefined) {
          showToast({ type: 'warning', message: 'Please map the Expense Amount column.' });
          return;
        }
        if (state.importType !== 'expenses' && state.mappings.grossRevenue === undefined) {
          showToast({ type: 'warning', message: 'Please map the Gross Revenue column.' });
          return;
        }
      }
      if (state.step === 3 && state.mappings.date === undefined) {
        showToast({ type: 'warning', message: 'Please map the Date column.' });
        return;
      }

      state.step++;
      if (state.step === 5) {
        // Pre-validate rows and run database time slot overlap checks
        await runStep5Validation();
      }
      paint();
    });

    // Final wizard submit
    wizardEl.querySelectorAll('[data-wizard-submit]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (btn.hasAttribute('disabled')) return;

        const mode = btn.getAttribute('data-wizard-submit'); // 'skip' | 'override' | 'all'
        wizardEl.querySelectorAll('[data-wizard-submit]').forEach(b => b.setAttribute('disabled', ''));
        const originalText = btn.innerHTML;
        btn.innerHTML = `${getIcon('loader', 14, 'animate-spin')} Importing...`;

        try {
          const accepted = [];
          const failed = [];
          const itemsToImport = mode === 'override' ? [...state.parsedObjects, ...state.conflictingObjects] : state.parsedObjects;

          for (const item of itemsToImport) {
            try {
              if (item.type === 'shift' && item.obj.startTime && item.obj.endTime) {
                if (mode !== 'override') {
                  const lateConflict = await checkConflict(
                    item.obj.date,
                    item.obj.startTime,
                    item.obj.endTime,
                    { platformId: item.obj.platformId }
                  );
                  if (lateConflict) {
                    failed.push({ obj: item.obj, reason: `Conflict detected at commit time on ${item.obj.date}` });
                    continue;
                  }
                }
              }
              if (state.importType === 'expenses') {
                await saveExpense({ ...item.obj, updatedAt: new Date().toISOString() });
              } else {
                await saveShift({
                  ...item.obj,
                  outOfPocketExpense: item.outOfPocketExpense,
                  updatedAt: new Date().toISOString()
                });
              }
              accepted.push(item.obj);
            } catch (err) {
              failed.push({ obj: item.obj, reason: err.message || 'unknown' });
            }
          }

          showToast({
            type: failed.length ? 'warning' : 'success',
            message: failed.length
              ? `Imported ${accepted.length} rows successfully. ${failed.length} failed.`
              : `Success! Successfully imported all ${accepted.length} records into your vault.`,
            duration: 3800,
          });

          // WIPE STATE & RE-PAINT UPLOAD PAGE
          state.importType = 'shifts';
          state.file = null;
          state.rawRows = [];
          state.mappings = {};
          state.step = 1;
          state.parsedObjects = [];
          state.conflictingObjects = [];
          state.validationErrors = [];
          state.conflictErrors = [];
          state.notices = [];
          state.hasHeader = true;
          state.headerRowIndex = 0;
          state.lastRowIndex = 0;
          paint();
        } catch (err) {
          console.error(err);
          showToast({ type: 'error', message: 'Import process crashed.' });
          btn.innerHTML = originalText;
          wizardEl.querySelectorAll('[data-wizard-submit]').forEach(b => b.removeAttribute('disabled'));
        }
      });
    });
  }

  // ── RESOLUTION & STRICT STEP 5 DATABASE VALIDATION ───────────────────
  async function runStep5Validation() {
    state.parsedObjects = [];
    state.conflictingObjects = [];
    state.validationErrors = [];
    state.conflictErrors = [];
    state.notices = [];

    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    const TIME_RE = /^\d{2}:\d{2}$/;

    // Slice rows according to header boundary offsets
    const startIndex = state.hasHeader ? state.headerRowIndex + 1 : state.headerRowIndex;
    let itemsToParse = state.rawRows.slice(startIndex, state.lastRowIndex + 1);

    // Safety limit of 150 data rows per CSV import to prevent system blast
    if (itemsToParse.length > 150) {
      itemsToParse = itemsToParse.slice(0, 150);
      state.notices.push('Notice: To preserve DB vault safety and page performance, COMMA restricts imports to a maximum of 150 rows. Only the first 150 data rows are parsed in this batch.');
    }

    const tempParsed = [];

    for (let i = 0; i < itemsToParse.length; i++) {
      const row = itemsToParse[i];
      const lineNum = startIndex + i + 1; // 1-based index

      // Resolve mapped columns
      const getVal = (prop) => {
        const cIdx = state.mappings[prop];
        if (cIdx === undefined || cIdx === null) return undefined;
        return row[cIdx] !== undefined ? String(row[cIdx]).trim() : undefined;
      };

      const getValOrNull = (prop) => {
        const v = getVal(prop);
        return v === '' || v === undefined ? null : v;
      };

      const dateVal = getVal('date');
      const grossVal = getValOrNull('grossRevenue') ?? getValOrNull('amount') ?? null;
      const tipsVal = getValOrNull('tipsRevenue') ?? '0';
      const bonusVal = getValOrNull('bonus') ?? '0';
      const startVal = getVal('startTime');
      const endVal = getVal('endTime');
      const platformVal = getVal('platformId') || 'other';
      const ordersVal = getVal('orders');
      const distanceVal = getVal('activeMileage');
      const deadMileageVal = getVal('deadMileage');
      const outOfPocketExpenseVal = getValOrNull('outOfPocketExpense') ?? '0';
      const notesVal = getVal('notes') || '';

      const categoryVal = getVal('category') || 'other';
      const businessVal = getValOrNull('deductiblePct') ?? '100';
      const hstVal = getValOrNull('hstPaid') ?? '0';
      const recurringVal = getVal('isRecurring');

      // 1. Verify Date column is populated & valid
      if (!dateVal || !DATE_RE.test(dateVal)) {
        state.validationErrors.push(`Row ${lineNum}: Invalid or missing date "${dateVal || ''}" — expected YYYY-MM-DD format`);
        continue;
      }
      if (state.importType === 'expenses') {
        const expDateObj = new Date(`${dateVal}T00:00:00`);
        const minDate = new Date();
        minDate.setFullYear(minDate.getFullYear() - 5);
        if (expDateObj < minDate) {
          state.validationErrors.push(`Row ${lineNum}: Expense date "${dateVal}" is more than 5 years old (vault archive policy)`);
          continue;
        }
      }

      // 2. Verify Earnings/Amount is present, numeric & non-negative
      if (grossVal === null) {
        state.validationErrors.push(`Row ${lineNum}: Amount column is unmapped or empty`);
        continue;
      }
      if (isNaN(Number(grossVal))) {
        state.validationErrors.push(`Row ${lineNum}: Gross/Amount value "${grossVal}" is not a valid number`);
        continue;
      }
      if (Number(grossVal) < 0) {
        state.validationErrors.push(`Row ${lineNum}: Negative amount "${grossVal}" — refund credits are not supported in this import type`);
        continue;
      }

      // Time format validations
      if (startVal && !TIME_RE.test(startVal)) {
        state.validationErrors.push(`Row ${lineNum}: Invalid Start Time "${startVal}" — expected HH:mm format`);
        continue;
      }
      if (endVal && !TIME_RE.test(endVal)) {
        state.validationErrors.push(`Row ${lineNum}: Invalid End Time "${endVal}" — expected HH:mm format`);
        continue;
      }

      const ordersNum = ordersVal ? Number(ordersVal) : null;
      if (ordersVal && isNaN(ordersNum)) {
        state.validationErrors.push(`Row ${lineNum}: Orders value "${ordersVal}" is not a valid number`);
        continue;
      }
      const distanceNum = distanceVal ? Number(distanceVal) : null;
      if (distanceVal && isNaN(distanceNum)) {
        state.validationErrors.push(`Row ${lineNum}: Distance value "${distanceVal}" is not a valid number`);
        continue;
      }
      const deadMileageNum = deadMileageVal ? Number(deadMileageVal) : null;
      if (deadMileageVal && isNaN(deadMileageNum)) {
        state.validationErrors.push(`Row ${lineNum}: Dead Mileage value "${deadMileageVal}" is not a valid number`);
        continue;
      }
      const outOfPocketNum = outOfPocketExpenseVal ? Number(outOfPocketExpenseVal) : 0;
      if (outOfPocketExpenseVal && isNaN(outOfPocketNum)) {
        state.validationErrors.push(`Row ${lineNum}: Out-of-pocket value "${outOfPocketExpenseVal}" is not a valid number`);
        continue;
      }
      if (outOfPocketNum < 0) {
        state.validationErrors.push(`Row ${lineNum}: Out-of-pocket value "${outOfPocketExpenseVal}" cannot be negative`);
        continue;
      }

      // Build target object and validate with core normalize functions
      if (state.importType === 'expenses') {
        // `|| 100` would coerce an explicit 0% allocation to 100% — only fall back on NaN.
        const businessNum = Number(businessVal);
        const inputObj = {
          date: dateVal,
          amount: Number(grossVal),
          category: categoryVal,
          platformId: platformVal !== 'other' ? platformVal : null,
          notes: notesVal || 'Imported via Wizard',
          deductiblePct: Number.isFinite(businessNum) ? businessNum : 100,
          hstPaid: Number(hstVal) || 0,
          isRecurring: recurringVal ? /^(true|1|yes|y)$/i.test(recurringVal) : false,
          source: 'import',
        };

        try {
          const rowObj = normalizeExpenseInput(inputObj);
          tempParsed.push({ lineNum, type: 'expense', obj: rowObj });
        } catch (err) {
          state.validationErrors.push(`Row ${lineNum}: ${err.message || 'Expense validation error'}`);
        }
      } else {
        const isIncome = state.importType === 'incomes';
        const bonusNum = Number(bonusVal) || 0;
        const inputObj = {
          date: dateVal,
          platformId: platformVal,
          grossRevenue: Number(grossVal),
          tipsRevenue: Number(tipsVal) || 0,
          // Mobile's shifts table has a real top-level bonusAmount column (Dexie v7) — pass it
          // straight through (see shifts.js normalizeShiftInput).
          bonusAmount: bonusNum,
          startTime: startVal ? startVal : null,
          endTime: endVal ? endVal : null,
          deliveryCount: ordersVal !== undefined && ordersVal !== '' ? Number(ordersVal) : null,
          activeMileage: distanceVal !== undefined && distanceVal !== '' ? Number(distanceVal) : null,
          deadMileage: deadMileageVal !== undefined && deadMileageVal !== '' ? Number(deadMileageVal) : null,
          notes: notesVal || (isIncome ? 'Imported via Platform Statement' : 'Imported via Wizard'),
        };

        try {
          const rowObj = normalizeShiftInput(inputObj);

          // Local time order check (validateTimeWindow). rowObj.startTime/endTime are now
          // epoch-ms timestamps (Fix 1 — interop plan); normalizeShiftInput's own overnight
          // rollover already guarantees endTime >= startTime, so only the "too long" bound
          // needs checking here (mirrors the old HH:mm-based 1440-minute check).
          if (typeof rowObj.startTime === 'number' && typeof rowObj.endTime === 'number') {
            if (rowObj.endTime - rowObj.startTime > 24 * 60 * 60 * 1000) {
              throw new Error('shift:time:invalid');
            }
          }

          tempParsed.push({ lineNum, type: 'shift', obj: rowObj, outOfPocketExpense: outOfPocketNum });
        } catch (err) {
          let msg = err.message || 'Shift validation error';
          if (msg === 'shift:date:too_old') msg = 'Shift date is more than 2 years old (vault archive policy)';
          else if (msg === 'shift:platform:required') msg = 'Platform Name is required';
          else if (msg === 'shift:time:invalid') msg = 'Start time cannot be after end time';
          state.validationErrors.push(`Row ${lineNum}: ${msg}`);
        }
      }
    }

    // Now, run the transactional dry-run simulation to catch overlapping times, database level exceptions, and conflict checks!
    if (tempParsed.length > 0) {
      try {
        await db.transaction('rw', db.shifts, db.expenses, async () => {
          for (const item of tempParsed) {
            try {
              if (item.type === 'expense') {
                const existingExpense = await db.expenses
                  .where({ date: item.obj.date, category: item.obj.category })
                  .filter((e) => e.amount === item.obj.amount && e.deletedAt == null)
                  .first();
                if (existingExpense) {
                  state.conflictErrors.push(`Row ${item.lineNum}: Possible duplicate — an expense with the same date, category, and amount already exists`);
                  state.conflictingObjects.push({ lineNum: item.lineNum, type: item.type, obj: item.obj });
                  continue;
                }
                await db.expenses.add(item.obj);
              } else {
                const existingShift = await db.shifts
                  .where({ date: item.obj.date, platformId: item.obj.platformId })
                  .filter((s) => s.grossRevenue === item.obj.grossRevenue && s.deletedAt == null)
                  .first();
                if (existingShift) {
                  state.conflictErrors.push(`Row ${item.lineNum}: Possible duplicate — a shift with the same date, platform, and gross already exists`);
                  state.conflictingObjects.push({ lineNum: item.lineNum, type: item.type, obj: item.obj, outOfPocketExpense: item.outOfPocketExpense });
                  continue;
                }

                // If it is a shift, check conflicts first within the transaction
                if (item.obj.startTime && item.obj.endTime) {
                  const hasConflict = await checkConflict(item.obj.date, item.obj.startTime, item.obj.endTime, { platformId: item.obj.platformId });
                  if (hasConflict) {
                    state.conflictErrors.push(`Row ${item.lineNum}: Shift overlaps with another shift on ${item.obj.date} (${fmtHm(item.obj.startTime)} — ${fmtHm(item.obj.endTime)})`);
                    state.conflictingObjects.push({ lineNum: item.lineNum, type: item.type, obj: item.obj, outOfPocketExpense: item.outOfPocketExpense });
                    continue;
                  }
                }
                await db.shifts.add(item.obj);
              }
              state.parsedObjects.push({ lineNum: item.lineNum, type: item.type, obj: item.obj, outOfPocketExpense: item.outOfPocketExpense });
            } catch (err) {
              state.validationErrors.push(`Row ${item.lineNum}: Database write simulation failed — ${err.message || err}`);
            }
          }
          // Abort the transaction so absolutely nothing is persisted!
          throw new Error('SIMULATION_ABORT');
        });
      } catch (err) {
        if (err.message !== 'SIMULATION_ABORT') {
          console.error('Transaction simulation error:', err);
        }
      }
    }
  }

  // Paint the view initial screen
  paint();
}
