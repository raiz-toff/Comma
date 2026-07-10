import { formatCurrency } from '../../utils/formatters.js';

/**
 * @param {unknown} report
 * @param {unknown} user
 * @returns {[string, string][]}
 */
function buildSummaryRows(report, user) {
  const r = /** @type {{ summary?: Record<string, any> }} */ (report);
  const u = /** @type {{ locale?: { country?: string; currency?: string } }} */ (user);
  const s = r.summary || {};
  const locale = u?.locale?.country || 'US';
  const currency = u?.locale?.currency || 'USD';
  return [
    ['Base Earnings', formatCurrency(s.gross, locale, { currency })],
    ['Tips', formatCurrency(s.tips, locale, { currency })],
    ['Bonuses', formatCurrency(s.bonus, locale, { currency })],
    ['Total Earnings', formatCurrency(s.totalEarnings, locale, { currency })],
    ['Expenses', formatCurrency(s.expenseTotal, locale, { currency })],
    ['Net', formatCurrency(s.net, locale, { currency })],
    ['Shifts', String(s.shiftCount)],
    ['Clock Hours', (s.hours ?? 0).toFixed(1)],
    ['Active Hours', (s.activeHours ?? 0).toFixed(1)],
    ['Orders', String(s.orders)],
    ['Clock hourly', formatCurrency(s.hourly, locale, { currency })],
    ['Active hourly', formatCurrency(s.activeHourly, locale, { currency })],
    ['Net hourly', s.isNetNegative ? 'Exceeded gross' : formatCurrency(s.netHourly, locale, { currency })],
  ];
}

export default {
  id: 'overview',
  label: 'Overview',
  defaultIncluded: true,
  /** @param {unknown} report @param {unknown} user */
  renderHTML: async (report, user) => {
    const r = /** @type {{ summary?: Record<string, any> }} */ (report);
    const s = r?.summary || {};
    const rows = buildSummaryRows(report, user);
    let html = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:var(--space-2);">
      ${rows
        .map(
          ([k, v]) =>
            `<article class="card"><p>${String(k).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p><strong>${String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</strong></article>`,
        )
        .join('')}
    </div>`;

    if (s.isNetNegative) {
      html += `
        <div class="warning-banner" style="margin-top: var(--space-4); padding: var(--space-3); background-color: var(--color-warning-light, rgba(239, 68, 68, 0.15)); border: 1px solid var(--color-warning, #ef4444); border-radius: var(--radius-md); color: var(--color-warning-dark, #ef4444); display: flex; align-items: center; gap: var(--space-2); font-weight: 600; font-size: var(--text-sm);">
          <span style="font-size: 1.2rem;">⚠️</span>
          <span>Expenses exceeded gross this period — see expense breakdown</span>
        </div>
      `;
    }
    return html;
  },
  /** @param {unknown} report @param {unknown} user */
  renderText: (report, user) => {
    const r = /** @type {{ startDate?: string; endDate?: string }} */ (report);
    const rows = buildSummaryRows(report, user);
    return [`Report: ${r.startDate} to ${r.endDate}`, ...rows.map(([k, v]) => `${k}: ${v}`)].join('\n');
  },
  /** @param {unknown} report @param {unknown} user */
  renderCSV: (report, user) => {
    const rows = buildSummaryRows(report, user);
    return [['metric', 'value'], ...rows];
  },
  buildSummaryRows,
};
