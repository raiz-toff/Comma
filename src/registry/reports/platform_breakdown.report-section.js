import { formatCurrency } from '../../utils/formatters.js';

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getDollars(cents) {
  if (cents == null) return 0;
  const n = Number(cents);
  return Number.isFinite(n) ? n / 100 : 0;
}

/**
 * Group shifts per platform and return detailed summaries.
 * @param {Array<Record<string, any>>} shifts
 * @returns {Array<Record<string, any>>}
 */
function calculatePlatformSummaries(shifts) {
  const map = new Map();
  for (const s of shifts) {
    const pId = s.platformId || 'unknown';
    if (!map.has(pId)) {
      map.set(pId, {
        platformId: pId,
        gross: 0,
        tips: 0,
        bonus: 0,
        clockMinutes: 0,
        activeMinutes: 0,
        orders: 0,
      });
    }
    const data = map.get(pId);
    data.gross += s.grossEarnings != null ? getDollars(s.grossEarnings) : Number(s.gross || 0);
    data.tips += s.tips != null ? getDollars(s.tips) : Number(s.tips || 0);
    data.bonus += s.bonusEarnings != null ? getDollars(s.bonusEarnings) : Number(s.bonus || 0);
    data.clockMinutes += Number(s.durationMinutes ?? s.onlineMinutes ?? s.activeMinutes ?? 0);
    data.activeMinutes += Number(s.activeMinutes ?? s.durationMinutes ?? s.onlineMinutes ?? 0);
    data.orders += Number(s.deliveryCount ?? s.orders ?? 0);
  }

  return Array.from(map.values()).map((p) => {
    const totalEarnings = p.gross + p.tips + p.bonus;
    const clockHours = p.clockMinutes > 0 ? p.clockMinutes / 60 : 0;
    const activeHours = p.activeMinutes > 0 ? p.activeMinutes / 60 : 0;
    return {
      platform: p.platformId,
      gross: p.gross,
      tips: p.tips,
      bonus: p.bonus,
      totalEarnings,
      clockHours,
      activeHours,
      orders: p.orders,
      hourly: clockHours > 0 ? totalEarnings / clockHours : 0,
      activeHourly: activeHours > 0 ? totalEarnings / activeHours : 0,
    };
  });
}

export default {
  id: 'platform_breakdown',
  label: 'Platform breakdown',
  defaultIncluded: true,

  /** @param {unknown} report @param {unknown} user */
  renderHTML: async (report, user) => {
    const r = /** @type {{ shifts?: Array<Record<string, any>> }} */ (report);
    const u = /** @type {{ locale?: { country?: string; currency?: string } }} */ (user);
    const shifts = Array.isArray(r.shifts) ? r.shifts : [];
    if (!shifts.length) {
      return '<p style="color:var(--color-text-secondary); margin-top: var(--space-2);">No shifts found in range for platform breakdown.</p>';
    }

    const locale = u?.locale?.country || 'US';
    const currency = u?.locale?.currency || 'USD';
    const rows = calculatePlatformSummaries(shifts);

    let html = `
      <div style="overflow-x: auto; margin-top: var(--space-4);">
        <table class="table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: var(--text-sm);">
          <thead>
            <tr style="border-bottom: 2px solid var(--color-border); color: var(--color-text-secondary); font-weight: 700;">
              <th style="padding: var(--space-2) var(--space-3);">Platform</th>
              <th style="padding: var(--space-2) var(--space-3); text-align: right;">Gross Pay</th>
              <th style="padding: var(--space-2) var(--space-3); text-align: right;">Tips</th>
              <th style="padding: var(--space-2) var(--space-3); text-align: right;">Total Earnings</th>
              <th style="padding: var(--space-2) var(--space-3); text-align: right;">Clock Hours</th>
              <th style="padding: var(--space-2) var(--space-3); text-align: right;">Active Hours</th>
              <th style="padding: var(--space-2) var(--space-3); text-align: right;">Orders</th>
              <th style="padding: var(--space-2) var(--space-3); text-align: right;">Clock Hourly</th>
              <th style="padding: var(--space-2) var(--space-3); text-align: right;">Active Hourly</th>
            </tr>
          </thead>
          <tbody>
    `;

    for (const row of rows) {
      html += `
        <tr style="border-bottom: 1px solid var(--color-border);">
          <td style="padding: var(--space-3); font-weight: 600; text-transform: capitalize;">${esc(row.platform)}</td>
          <td style="padding: var(--space-3); text-align: right;">${esc(formatCurrency(row.gross, locale, { currency }))}</td>
          <td style="padding: var(--space-3); text-align: right;">${esc(formatCurrency(row.tips, locale, { currency }))}</td>
          <td style="padding: var(--space-3); text-align: right; font-weight: 600; color: var(--color-brand);">${esc(formatCurrency(row.totalEarnings, locale, { currency }))}</td>
          <td style="padding: var(--space-3); text-align: right;">${row.clockHours.toFixed(1)}h</td>
          <td style="padding: var(--space-3); text-align: right;">${row.activeHours.toFixed(1)}h</td>
          <td style="padding: var(--space-3); text-align: right;">${row.orders}</td>
          <td style="padding: var(--space-3); text-align: right;">${esc(formatCurrency(row.hourly, locale, { currency }))}/hr</td>
          <td style="padding: var(--space-3); text-align: right; font-weight: 600;">${esc(formatCurrency(row.activeHourly, locale, { currency }))}/hr</td>
        </tr>
      `;
    }

    html += `
          </tbody>
        </table>
      </div>
    `;

    return html;
  },

  /** @param {unknown} report @param {unknown} user */
  renderText: (report, user) => {
    const r = /** @type {{ shifts?: Array<Record<string, any>> }} */ (report);
    const u = /** @type {{ locale?: { country?: string; currency?: string } }} */ (user);
    const shifts = Array.isArray(r.shifts) ? r.shifts : [];
    if (!shifts.length) return 'Platform Breakdown: No data';

    const locale = u?.locale?.country || 'US';
    const currency = u?.locale?.currency || 'USD';
    const rows = calculatePlatformSummaries(shifts);

    return [
      'Platform Breakdown:',
      ...rows.map((row) => 
        `- ${row.platform.toUpperCase()}: Gross ${formatCurrency(row.gross, locale, { currency })}, Tips ${formatCurrency(row.tips, locale, { currency })}, Total ${formatCurrency(row.totalEarnings, locale, { currency })}, Clock ${row.clockHours.toFixed(1)}h, Active ${row.activeHours.toFixed(1)}h, Orders ${row.orders}, Clock rate ${formatCurrency(row.hourly, locale, { currency })}/hr, Active rate ${formatCurrency(row.activeHourly, locale, { currency })}/hr`
      )
    ].join('\n');
  },

  /** @param {unknown} report @param {unknown} user */
  renderCSV: (report, user) => {
    const r = /** @type {{ shifts?: Array<Record<string, any>> }} */ (report);
    const shifts = Array.isArray(r.shifts) ? r.shifts : [];
    if (!shifts.length) return [];

    const rows = calculatePlatformSummaries(shifts);

    const header = ['platform', 'gross', 'tips', 'bonus', 'totalEarnings', 'clockHours', 'activeHours', 'orders', 'clockHourlyRate', 'activeHourlyRate'];
    const body = rows.map((row) => [
      row.platform,
      row.gross,
      row.tips,
      row.bonus,
      row.totalEarnings,
      row.clockHours,
      row.activeHours,
      row.orders,
      row.hourly,
      row.activeHourly,
    ]);
    return [header, ...body];
  },
};
