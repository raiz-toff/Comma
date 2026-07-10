import { t } from '../../utils/strings.js';
import { esc } from './esc.js';

const _IC_CLOCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;

export default {
  id: 'hoursCompare',
  label: 'Active vs Total Hours',
  defaultSize: '2x1',
  defaultVisible: true,
  category: 'stats',

  /** @param {unknown} ctx */
  render: async (ctx) => {
    const c = /** @type {{ data?: { financial?: { activeHours?: number, onlineHours?: number, hours?: number }, rollingTrend?: { activeHoursPoints?: { x: number, y: number }[], onlineHoursPoints?: { x: number, y: number }[] } } }} */ (ctx);
    
    const activeHrs = Number(c?.data?.financial?.activeHours) || Number(c?.data?.financial?.hours) || 0;
    const onlineHrs = Number(c?.data?.financial?.onlineHours) || Number(c?.data?.financial?.hours) || 0;

    const ratio = onlineHrs > 0 ? Math.min(100, Math.round((activeHrs / onlineHrs) * 100)) : 0;

    // Efficiency tier
    let tier = 'Standard';
    let tierColor = 'var(--color-info)';
    if (ratio >= 85) { tier = 'Ultra Efficient'; tierColor = '#10b981'; }
    else if (ratio >= 70) { tier = 'Highly Active'; tierColor = '#3b82f6'; }
    else if (ratio >= 50) { tier = 'Moderate Wait'; tierColor = '#f59e0b'; }
    else { tier = 'High Wait Time'; tierColor = '#ef4444'; }

    const activePts = c?.data?.rollingTrend?.activeHoursPoints?.slice(-14).map(p => Number(p.y) || 0) || [1, 2, 3, 2, 4, 3, 5];
    const onlinePts = c?.data?.rollingTrend?.onlineHoursPoints?.slice(-14).map(p => Number(p.y) || 0) || [2, 3, 4, 3, 5, 4, 6];

    const maxH = Math.max(...onlinePts, ...activePts, 1);
    const minH = Math.min(...onlinePts, ...activePts, 0);
    const rng = (maxH - minH) || 1;

    const getPath = (pts) => pts.map((p, i) => {
      const x = (i / (pts.length - 1)) * 100;
      const y = 35 - ((p - minH) / rng) * 28;
      return `${x},${y}`;
    }).join(' L ');

    const activeSpark = getPath(activePts);
    const onlineSpark = getPath(onlinePts);

    const scopedStyles = `
      <style>
        .hc-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          padding: 4px;
        }

        .hc-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .hc-title-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .hc-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: color-mix(in srgb, #6366f1 15%, var(--color-surface-raised));
          color: #6366f1;
        }

        .hc-title {
          font-size: 13px;
          font-weight: 800;
          color: var(--color-text-main);
          letter-spacing: 0.02em;
        }

        .hc-body {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-top: 4px;
        }

        .hc-stat-box {
          background: var(--color-surface-raised);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          padding: 10px 14px;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
        }

        .hc-stat-label {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-muted);
          margin-bottom: 2px;
        }

        .hc-stat-val {
          font-size: 1.6rem;
          font-weight: 900;
          color: var(--color-text-main);
          display: flex;
          align-items: baseline;
          gap: 4px;
        }

        .hc-stat-unit {
          font-size: 0.45em;
          font-weight: 800;
          opacity: 0.7;
        }

        .hc-comparison-bar {
          height: 10px;
          background: color-mix(in srgb, #6366f1 15%, var(--color-border));
          border-radius: 10px;
          overflow: hidden;
          margin-top: 16px;
          position: relative;
        }

        .hc-comparison-fill {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #6366f1);
          border-radius: 10px;
          width: ${ratio}%;
          transition: width 0.8s cubic-bezier(0.22, 1, 0.36, 1);
        }

        .hc-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: auto;
          padding-top: 12px;
          font-size: 11px;
          font-weight: 800;
        }

        .hc-ratio-badge {
          background: color-mix(in srgb, ${tierColor} 15%, var(--color-surface-raised));
          color: ${tierColor};
          padding: 4px 10px;
          border-radius: 6px;
          border: 1px solid color-mix(in srgb, ${tierColor} 30%, transparent);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .hc-chart-wrap {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 35px;
          pointer-events: none;
          opacity: 0.15;
        }
      </style>
    `;

    return `
      ${scopedStyles}
      <div class="hc-container">
        <div class="hc-header">
          <div class="hc-title-wrap">
            <div class="hc-icon">${_IC_CLOCK}</div>
            <div class="hc-title">${esc(t('views.dashboard.financial.totalHours') || 'Hours Breakdown')}</div>
          </div>
        </div>

        <div class="hc-body">
          <div class="hc-stat-box" style="border-left: 3px solid #3b82f6;">
            <div class="hc-stat-label">Active Time</div>
            <div class="hc-stat-val">
              <span>${activeHrs.toFixed(1)}</span>
              <span class="hc-stat-unit">HRS</span>
            </div>
            <svg class="hc-chart-wrap" viewBox="0 0 100 35" preserveAspectRatio="none" style="color: #3b82f6;">
              <path fill="none" stroke="currentColor" stroke-width="2.5" d="M ${activeSpark}" />
            </svg>
          </div>

          <div class="hc-stat-box" style="border-left: 3px solid #6366f1;">
            <div class="hc-stat-label">Total Online</div>
            <div class="hc-stat-val">
              <span>${onlineHrs.toFixed(1)}</span>
              <span class="hc-stat-unit">HRS</span>
            </div>
            <svg class="hc-chart-wrap" viewBox="0 0 100 35" preserveAspectRatio="none" style="color: #6366f1;">
              <path fill="none" stroke="currentColor" stroke-width="2.5" d="M ${onlineSpark}" />
            </svg>
          </div>
        </div>

        <div class="hc-comparison-bar">
          <div class="hc-comparison-fill"></div>
        </div>

        <div class="hc-footer">
          <span style="color: var(--color-text-muted);">Active / Online Ratio</span>
          <div class="hc-ratio-badge">
            <span>${ratio}%</span>
            <span style="opacity: 0.8; font-size: 9px; text-transform: uppercase;">${esc(tier)}</span>
          </div>
        </div>
      </div>
    `;
  },

  afterRender: (_el, _ctx) => {},
  destroy: (_el) => {},
};
