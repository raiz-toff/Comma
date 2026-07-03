import { t } from '../../utils/strings.js';
import { esc } from './esc.js';
import { formatCurrency } from '../../utils/formatters.js';

const _IC_PLATFORMS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`;

export default {
  id: 'platformActivity',
  label: 'Platform Mix',
  defaultSize: '1x1',
  defaultVisible: false,
  category: 'analytics',

  /** @param {unknown} ctx */
  render: async (ctx) => {
    const c = /** @type {{ data?: { platformActivity?: { month: string, dominantPlatform: string, platforms: { platformId: string, gross: number }[] }[] }; localeCountry?: string; currency?: string }} */ (ctx);
    const activity = c?.data?.platformActivity || [];
    const latest = activity.length > 0 ? activity[activity.length - 1] : null;

    if (!latest || !latest.platforms || latest.platforms.length === 0) {
      return `
        <div class="wr pa-empty">
          <div class="wh">
            <div class="wi">${_IC_PLATFORMS}</div>
            <span class="wl">${esc(t('analytics.platformMix'))}</span>
          </div>
          <div class="pa-empty-body">
            <p>${esc(t('analytics.noData'))}</p>
          </div>
        </div>
      `;
    }

    const totalGross = latest.platforms.reduce((sum, p) => sum + p.gross, 0) || 1;
    const sortedPlatforms = [...latest.platforms].sort((a, b) => b.gross - a.gross);
    const dominant = sortedPlatforms[0];

    const country = String(c?.localeCountry || 'US');
    const currency = String(c?.currency || 'USD');

    const scopedStyles = `
      <style>
        .pa-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          gap: 12px;
        }
        .pa-bar {
          display: flex;
          height: 12px;
          border-radius: 6px;
          overflow: hidden;
          background: var(--color-surface-raised);
          width: 100%;
        }
        .pa-segment {
          height: 100%;
          transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .pa-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1;
          overflow-y: auto;
        }
        .pa-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.75rem;
        }
        .pa-item-info {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
        }
        .pa-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .pa-name {
          font-weight: 700;
          color: var(--color-text-main);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-transform: capitalize;
        }
        .pa-val {
          font-weight: 800;
          font-variant-numeric: tabular-nums;
          color: var(--color-text-secondary);
        }
        .pa-dominant-badge {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          background: color-mix(in srgb, var(--color-success) 15%, transparent);
          color: var(--color-success);
          padding: 2px 6px;
          border-radius: 4px;
          letter-spacing: 0.02em;
        }
      </style>
    `;

    const segments = sortedPlatforms.map(p => {
      const pct = (p.gross / totalGross) * 100;
      const color = `var(--color-${p.platformId}, var(--color-other))`;
      return `<div class="pa-segment" style="width: ${pct}%; background-color: ${color};" title="${esc(p.platformId)}: ${Math.round(pct)}%"></div>`;
    }).join('');

    const listItems = sortedPlatforms.map(p => {
      const color = `var(--color-${p.platformId}, var(--color-other))`;
      const pct = totalGross > 0 ? Math.round((p.gross / totalGross) * 100) : 0;
      return `
        <div class="pa-item">
          <div class="pa-item-info">
            <div class="pa-dot" style="background-color: ${color};"></div>
            <span class="pa-name">${esc(p.platformId)}</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:0.65rem;color:var(--color-text-muted);font-weight:700;">${pct}%</span>
            <span class="pa-val">${formatCurrency(p.gross, country, { currency })}</span>
          </div>
        </div>
      `;
    }).join('');

    // Format month label e.g. "2026-05" → "May 2026"
    const monthLabel = (() => {
      try {
        const [yr, mo] = latest.month.split('-');
        return new Date(Number(yr), Number(mo) - 1, 1).toLocaleDateString('en', { month: 'short', year: 'numeric' });
      } catch { return latest.month; }
    })();

    return `
      ${scopedStyles}
      <div class="wr">
        <div class="wh">
          <div class="wi">${_IC_PLATFORMS}</div>
          <span class="wl">${esc(t('analytics.platformActivity'))}</span>
          ${dominant ? `<div class="pa-dominant-badge">${esc(dominant.platformId.toUpperCase())}</div>` : ''}
        </div>
        <div style="font-size:0.62rem;color:var(--color-text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:2px;">${esc(monthLabel)}</div>
        <div class="pa-container">
          <div class="pa-bar">
            ${segments}
          </div>
          <div class="pa-list">
            ${listItems}
          </div>
        </div>
      </div>
    `;
  },

  afterRender: (_el, _ctx) => {
    // No Chart.js needed now, CSS transitions handle the bar width
  },

  destroy: (_el) => {},
};
