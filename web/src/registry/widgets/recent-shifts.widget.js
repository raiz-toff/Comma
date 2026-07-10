import { t } from '../../utils/strings.js';
import { esc } from './esc.js';
import { getRecentActivity } from '../../modules/analytics/analytics.js';
import { formatCurrency } from '../../utils/formatters.js';

const _IC_CLOCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;

export default {
  id: 'recentShifts',
  label: 'Recent Activity',
  defaultSize: '1x1',
  defaultVisible: false,
  category: 'analytics',

  /** @param {unknown} ctx */
  render: async (ctx) => {
    const c = /** @type {{ localeCountry?: string, currency?: string }} */ (ctx);
    const activity = await getRecentActivity(4);
    const country = String(c?.localeCountry || 'US');
    const currency = String(c?.currency || 'USD');

    const scopedStyles = `
      <style>
        .rs-container { display: flex; flex-direction: column; height: 100%; gap: 10px; padding: 2px; }
        .rs-list { display: flex; flex-direction: column; gap: 8px; flex: 1; overflow: hidden; }
        .rs-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 8px;
          border-radius: 8px;
          background: var(--color-surface-raised);
          font-size: 0.75rem;
          transition: transform 0.2s;
        }
        .rs-item:hover { transform: translateX(4px); }
        .rs-item-left { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .rs-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .rs-date { font-weight: 700; color: var(--color-text-main); white-space: nowrap; }
        .rs-meta { font-size: 0.65rem; color: var(--color-text-muted); font-weight: 600; text-transform: uppercase; }
        .rs-gross { font-weight: 800; color: var(--color-text-main); font-variant-numeric: tabular-nums; }
        .rs-empty { 
          display: flex; flex-direction: column; align-items: center; justify-content: center; 
          height: 100%; color: var(--color-text-muted); font-size: 0.7rem; font-weight: 600; 
          text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6;
        }
      </style>
    `;

    if (!activity.length) {
      return `
        ${scopedStyles}
        <div class="wr">
          <div class="wh">
            <div class="wi">${_IC_CLOCK}</div>
            <span class="wl">Recent Activity</span>
          </div>
          <div class="rs-empty">No shifts logged yet</div>
        </div>
      `;
    }

    const listItems = activity.map(s => {
      const color = `var(--color-${s.platformId}, var(--color-other))`;
      // Format date to "May 12"
      const d = new Date(`${s.date}T12:00:00`);
      const fmtDate = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      
      return `
        <div class="rs-item">
          <div class="rs-item-left">
            <div class="rs-dot" style="background-color: ${color};"></div>
            <div style="display:flex; flex-direction:column;">
              <span class="rs-date">${esc(fmtDate)}</span>
              <span class="rs-meta">${esc(s.platformId)}</span>
            </div>
          </div>
          <span class="rs-gross">${esc(formatCurrency(s.gross, country, { currency }))}</span>
        </div>
      `;
    }).join('');

    return `
      ${scopedStyles}
      <div class="wr">
        <div class="wh" style="margin-bottom: 8px;">
          <div class="wi">${_IC_CLOCK}</div>
          <span class="wl">Recent Activity</span>
          <span class="wb">History</span>
        </div>
        <div class="rs-list">
          ${listItems}
        </div>
      </div>
    `;
  },

  afterRender: (_el, _ctx) => {},
  destroy: (_el) => {},
};
