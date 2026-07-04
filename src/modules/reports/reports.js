import { db, CURRENT_LOGICAL_SCHEMA_VERSION } from '../../core/db.js';
import { bus, DATA_IMPORTED } from '../../core/events.js';
import { ReportRegistry } from '../../registry/reports/index.js';
import { formatCurrency, formatDate } from '../../utils/formatters.js';
import { store } from '../../core/store.js';

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function ymd(d) {
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

function fileSafeDate(date = new Date()) {
  return ymd(date).replaceAll('-', '');
}

/** HH:mm (local time-of-day) from a shift's epoch-ms startTime/endTime (Fix 1 — interop plan). */
function fmtHm(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '';
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function toStartOfWeek(input, weekStartDay = 0) {
  const d = new Date(input.getFullYear(), input.getMonth(), input.getDate());
  const delta = (d.getDay() - weekStartDay + 7) % 7;
  d.setDate(d.getDate() - delta);
  return d;
}

function toEndOfWeek(input, weekStartDay = 0) {
  const s = toStartOfWeek(input, weekStartDay);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  return e;
}

function toMonthRange(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: ymd(start), end: ymd(end) };
}

function toYearRange(year) {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

async function listShifts(startDate, endDate) {
  return db.shifts
    .where('date')
    .between(startDate, endDate, true, true)
    .filter((row) => row.deletedAt == null)
    .toArray();
}

async function listExpenses(startDate, endDate) {
  return db.expenses
    .where('date')
    .between(startDate, endDate, true, true)
    .filter((row) => row.deletedAt == null)
    .toArray();
}

function summarize(shifts, expenses) {
  let gross = 0;
  let tips = 0;
  let bonus = 0;
  let orders = 0;
  let clockMinutes = 0;
  let activeMinutes = 0;
  let distanceKm = 0;

  for (const s of shifts) {
    const durationMin = s.durationSeconds != null ? Math.round(num(s.durationSeconds) / 60) : undefined;
    gross += num(s.grossRevenue);
    tips  += num(s.tipsRevenue);
    bonus += Number(s.bonusAmount) || 0;
    orders += num(s.deliveryCount);
    clockMinutes += num(durationMin ?? s.onlineMinutes ?? s.activeMinutes);
    activeMinutes += num(s.activeMinutes ?? durationMin ?? s.onlineMinutes);
    distanceKm += num(s.activeMileage);
  }

  let expenseTotal = 0;
  for (const e of expenses) {
    const deductiblePct = num(e.deductiblePct, 100) / 100;
    expenseTotal += num(e.amount) * deductiblePct;
  }

  // CONFIRMATION (Bug D): Shift raw gross (s.grossRevenue) is base platform earnings only
  // and does NOT include tips/bonuses. Therefore, actual take-home is base gross + tips + bonuses.
  const totalEarnings = gross + tips + bonus;
  const net = totalEarnings - expenseTotal;

  const clockHours = clockMinutes > 0 ? clockMinutes / 60 : 0;
  const activeHours = activeMinutes > 0 ? activeMinutes / 60 : 0;

  return {
    shiftCount: shifts.length,
    expenseCount: expenses.length,
    gross, // base earnings
    tips,
    bonus,
    totalEarnings, // true gross take-home
    orders,
    minutes: clockMinutes,
    hours: clockHours,
    activeMinutes,
    activeHours,
    distanceKm,
    expenseTotal,
    net,
    isNetNegative: net < 0, // Flag for warning banner support
    hasData: shifts.length > 0 || expenses.length > 0, // State flag for empty reports
    hourly: clockHours > 0 ? gross / clockHours : 0, // Keep base clock hourly
    activeHourly: activeHours > 0 ? gross / activeHours : 0, // Expose base active hourly
    netHourly: clockHours > 0 ? net / clockHours : 0, // True take-home net hourly
  };
}

async function reportForRange(startDate, endDate, options = {}) {
  const [shifts, expenses] = await Promise.all([listShifts(startDate, endDate), listExpenses(startDate, endDate)]);
  let rows = shifts;
  if (options.platformId && options.platformId !== 'all') {
    rows = rows.filter((s) => String(s.platformId || '') === String(options.platformId));
  }
  const visibleExpenses =
    options.platformId && options.platformId !== 'all'
      ? expenses.filter((e) => String(e.platformId || '') === String(options.platformId))
      : expenses;
  const summary = summarize(rows, visibleExpenses);
  return {
    startDate,
    endDate,
    platformId: options.platformId || 'all',
    shifts: rows,
    expenses: visibleExpenses,
    summary,
    hasData: summary.hasData,
  };
}

export async function getWeeklyReportCard(referenceDate = new Date(), weekStartDay = 0) {
  const start = toStartOfWeek(referenceDate, weekStartDay);
  const end = toEndOfWeek(referenceDate, weekStartDay);
  return reportForRange(ymd(start), ymd(end));
}

export async function getMonthlyReportCard(referenceDate = new Date()) {
  const { start, end } = toMonthRange(referenceDate);
  return reportForRange(start, end);
}

export async function getAnnualReport(year = new Date().getFullYear()) {
  const { start, end } = toYearRange(Math.floor(num(year, new Date().getFullYear())));
  return reportForRange(start, end);
}

export async function getPlatformReport(platformId, range = {}) {
  const startDate = range.startDate || `${new Date().getFullYear()}-01-01`;
  const endDate = range.endDate || ymd(new Date());
  return reportForRange(startDate, endDate, { platformId });
}

export async function getCustomDateRangeReport(startDate, endDate, options = {}) {
  return reportForRange(startDate, endDate, options);
}

export function buildSummaryText(report, user) {
  const lines = [];
  for (const sec of ReportRegistry.getAll()) {
    if (sec.id === 'placeholder') continue;
    const chunk = sec.renderText(report, user);
    if (chunk) lines.push(chunk);
  }
  return lines.join('\n\n');
}

function downloadTextFile(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 150);
}

export async function exportAllShiftsCsv() {
  const user = store.get('user') || {};
  const currency = user.locale?.currency || 'USD';
  const country = user.locale?.country || 'US';
  const province = user.locale?.province || '';
  const region = province ? `${province}-${country}` : country;

  const shifts = await db.shifts.filter((s) => s.deletedAt == null).toArray();
  const header = [
    'id',
    'date',
    'provinceId',
    'platformId',
    'startTime',
    'endTime',
    'durationMinutes',
    'gross',
    'tips',
    'bonus',
    'orders',
    'distanceKm',
    'deadMilesKm',
    'notes',
  ];
  
  const rows = shifts.map((s) => [
    s.id,
    s.date,
    s.provinceId || '',
    s.platformId || '',
    fmtHm(s.startTime),
    fmtHm(s.endTime),
    Number(s.durationSeconds != null ? Math.round(s.durationSeconds / 60) : (s.onlineMinutes ?? 0)),
    num(s.grossRevenue),
    num(s.tipsRevenue),
    Number(s.bonusAmount) || 0,
    num(s.deliveryCount),
    num(s.activeMileage),
    num(s.deadMileage),
    s.notes || '',
  ]);

  const metadata = `# COMMA Export | Generated: ${ymd(new Date())} | Currency: ${currency} | Region: ${region}`;
  const csv = [metadata, header.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
  downloadTextFile(`comma-shifts-${fileSafeDate()}.csv`, csv, 'text/csv;charset=utf-8');
  return shifts.length;
}

export async function exportAllExpensesCsv() {
  const user = store.get('user') || {};
  const currency = user.locale?.currency || 'USD';
  const country = user.locale?.country || 'US';
  const province = user.locale?.province || '';
  const region = province ? `${province}-${country}` : country;

  const expenses = await db.expenses.filter((e) => e.deletedAt == null).toArray();
  const header = [
    'id',
    'date',
    'category',
    'platformId',
    'amount',
    'deductiblePct',
    'notes',
    'hstPaid',
    'confirmedPaid',
    'customCategory',
    'source',
    'businessAmount',
  ];

  const rows = expenses.map((e) => {
    const amount = num(e.amount);
    const pct = num(e.deductiblePct, 100);
    const businessAmount = Math.round(amount * pct) / 100;
    return [
      e.id,
      e.date,
      e.category || '',
      e.platformId || '',
      amount,
      pct,
      e.notes || '',
      num(e.hstPaid),
      e.confirmedPaid ? 'true' : 'false',
      e.customCategory || '',
      e.source || '',
      businessAmount,
    ];
  });

  const metadata = `# COMMA Export | Generated: ${ymd(new Date())} | Currency: ${currency} | Region: ${region}`;
  const csv = [metadata, header.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
  downloadTextFile(`comma-expenses-${fileSafeDate()}.csv`, csv, 'text/csv;charset=utf-8');
  return expenses.length;
}

export async function exportMileageLogCsv() {
  const user = store.get('user') || {};
  const currency = user.locale?.currency || 'USD';
  const country = user.locale?.country || 'US';
  const province = user.locale?.province || '';
  const region = province ? `${province}-${country}` : country;

  const shifts = await db.shifts.filter((s) => s.deletedAt == null).toArray();
  const header = ['date', 'platformId', 'startTime', 'endTime', 'businessKm', 'deadKm', 'totalKm', 'notes'];
  
  const rows = shifts.map((s) => {
    const businessKm = num(s.activeMileage);
    const deadKm = num(s.deadMileage);
    const totalKm = Math.round((businessKm + deadKm) * 100) / 100;
    return [
      s.date,
      s.platformId || '',
      fmtHm(s.startTime),
      fmtHm(s.endTime),
      businessKm,
      deadKm,
      totalKm,
      s.notes || '',
    ];
  });

  const metadata = `# COMMA Export | Generated: ${ymd(new Date())} | Currency: ${currency} | Region: ${region}`;
  const csv = [metadata, header.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
  
  downloadTextFile(`comma-mileage-log-${fileSafeDate()}.csv`, csv, 'text/csv;charset=utf-8');
  return shifts.length;
}

export async function buildVaultBackup() {
  const tableNames = db.tables.map((t) => t.name);
  const tables = {};
  for (const name of tableNames) {
    tables[name] = await db.table(name).toArray();
  }

  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(tables)));
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2,'0')).join('');
  const rowCounts = {};
  for (const [name, list] of Object.entries(tables)) {
    rowCounts[name] = Array.isArray(list) ? list.length : 0;
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    schemaVersion: CURRENT_LOGICAL_SCHEMA_VERSION,
    tables,
    integrity: { sha256: hashHex, rowCounts }
  };
  return payload;
}

export async function exportVaultBackupJson() {
  const backup = await buildVaultBackup();
  downloadTextFile(`comma-vault-backup-${fileSafeDate()}.json`, JSON.stringify(backup, null, 2), 'application/json');
  return Object.keys(backup.tables).length;
}

export function previewVaultImportDiff(rawText) {
  const parsed = JSON.parse(rawText);
  const incoming = parsed?.tables && typeof parsed.tables === 'object' ? parsed.tables : {};
  const diff = [];
  for (const table of db.tables) {
    const name = table.name;
    const incomingCount = Array.isArray(incoming[name]) ? incoming[name].length : 0;
    diff.push({ table: name, incomingCount });
  }
  return { backup: parsed, tableDiff: diff };
}

export async function restoreVaultBackup(backup) {
  const tables = backup?.tables && typeof backup.tables === 'object' ? backup.tables : null;
  if (!tables) throw new Error('backup:invalid');
  
  if (backup.integrity) {
    try {
      const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(tables)));
      const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2,'0')).join('');
      if (hashHex !== backup.integrity.sha256) {
        throw new Error('Backup integrity validation failed (hash mismatch). File may be corrupted or truncated.');
      }
    } catch (err) {
      if (err.message.includes('hash mismatch')) throw err;
      console.warn('[reports] Skipping integrity check due to crypto error', err);
    }
  }

  const RESTORE_EXCLUDE_TABLES = ['appState'];

  await db.transaction('rw', db.tables.map((t) => t.name), async () => {
    for (const table of db.tables) {
      const name = table.name;
      if (RESTORE_EXCLUDE_TABLES.includes(name)) continue;
      const rows = Array.isArray(tables[name]) ? tables[name] : [];
      await table.clear();
      if (rows.length > 0) await table.bulkPut(rows);
    }
  });
  bus.emit(DATA_IMPORTED, { source: 'reports_backup_restore' });
}

export function getDefaultReportTemplate() {
  /** @type {Record<string, boolean>} */
  const sections = {};
  for (const s of ReportRegistry.getAll()) {
    if (s.id === 'placeholder') continue;
    sections[s.id] = s.defaultIncluded !== false;
  }
  return { sections };
}

export async function copySummaryToClipboard(report, user) {
  const text = buildSummaryText(report, user);
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCOMMAnd('copy');
  textarea.remove();
  return true;
}



export function buildPrintDocument(report, template, user) {
  return {
    createdAt: new Date().toISOString(),
    report,
    template,
    summaryText: buildSummaryText(report, user),
  };
}

export function getYearInReviewModel(year, annualReport) {
  return {
    title: `Year in Review ${year}`,
    year,
    generatedAt: formatDate(new Date(), 'YYYY-MM-DD HH:mm'),
    summary: annualReport.summary,
  };
}

export function exportYearInReviewPng(dataUrl, year) {
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = `comma-year-in-review-${year}.png`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export async function exportTaxSummaryJson(year = new Date().getFullYear()) {
  const report = await getAnnualReport(year);
  
  const user = store.get('user') || {};
  const currency = user.locale?.currency || 'USD';
  const country = user.locale?.country || 'US';
  const locale = user.locale?.locale || `en-${country}`;
  const province = user.locale?.province || '';

  const hstPaidOnExpenses = Math.round(
    report.expenses.reduce((sum, e) => {
      const deductiblePct = num(e.deductiblePct, 100) / 100;
      return sum + num(e.hstPaid) * deductiblePct;
    }, 0) * 100
  ) / 100;

  const platformBreakdown = {};
  for (const s of report.shifts) {
    const pId = s.platformId || 'unknown';
    if (!platformBreakdown[pId]) {
      platformBreakdown[pId] = { gross: 0, orders: 0, distanceKm: 0 };
    }
    const data = platformBreakdown[pId];
    // Tips and bonus included in total gross for platform breakdown
    data.gross += num(s.grossRevenue) + num(s.tipsRevenue) + (Number(s.bonusAmount) || 0);
    data.orders += num(s.deliveryCount);
    data.distanceKm += num(s.activeMileage);
  }
  for (const key of Object.keys(platformBreakdown)) {
    platformBreakdown[key].gross = Math.round(platformBreakdown[key].gross * 100) / 100;
    platformBreakdown[key].distanceKm = Math.round(platformBreakdown[key].distanceKm * 100) / 100;
  }

  const payload = {
    year,
    currency,
    locale,
    province,
    gross: report.summary.gross,
    tips: report.summary.tips,
    bonuses: report.summary.bonus,
    totalEarnings: report.summary.totalEarnings,
    expenses: report.summary.expenseTotal,
    hstPaidOnExpenses,
    net: report.summary.net,
    distanceKm: report.summary.distanceKm,
    platformBreakdown,
    generatedAt: new Date().toISOString(),
    notes: 'Planning-grade tax export. Verify with accountant.',
  };

  downloadTextFile(`comma-tax-summary-${year}.json`, JSON.stringify(payload, null, 2), 'application/json');
}

export async function exportTaxSummaryCsv(year = new Date().getFullYear()) {
  const report = await getAnnualReport(year);
  
  const user = store.get('user') || {};
  const currency = user.locale?.currency || 'USD';
  const country = user.locale?.country || 'US';
  const province = user.locale?.province || '';
  const region = province ? `${province}-${country}` : country;

  const rows = [
    ['metric', 'value'],
    ['year', year],
    ['gross', report.summary.gross],
    ['tips', report.summary.tips],
    ['bonus', report.summary.bonus],
    ['totalEarnings', report.summary.totalEarnings],
    ['expenses', report.summary.expenseTotal],
    ['net', report.summary.net],
    ['distance_km', report.summary.distanceKm],
  ];

  const metadata = `# COMMA Export | Generated: ${ymd(new Date())} | Currency: ${currency} | Region: ${region}`;
  const csv = [metadata, ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
  downloadTextFile(`comma-tax-summary-${year}.csv`, csv, 'text/csv;charset=utf-8');
}
