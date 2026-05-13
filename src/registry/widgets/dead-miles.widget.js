import { t } from '../../utils/strings.js';
import { esc } from './esc.js';

export default {
  id: 'deadMiles',
  label: 'Dead Miles',
  defaultSize: '1x1',
  defaultVisible: false,
  category: 'analytics',
  /** @param {unknown} ctx */
  render: async (ctx) => {
    const c = /** @type {{ data?: { deadMiles?: { ratio?: number; deadKm?: number } } }} */ (ctx);
    const ratio = Number(c?.data?.deadMiles?.ratio) || 0;
    const deadKm = Number(c?.data?.deadMiles?.deadKm) || 0;
    const pct = (ratio * 100).toFixed(1);
    return `
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; background: color-mix(in srgb, var(--widget-accent, #f43f5e) 15%, transparent); color: var(--widget-accent, #f43f5e);">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
            <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
          </svg>
        </div>
        <span class="stat-label">${esc(t('analytics.deadMilesSummary'))}</span>
      </div>
      <div style="margin-top: auto;">
        <span class="stat-value" style="font-size: 1.4rem; font-weight: 800; color: var(--widget-accent, #f43f5e);">${esc(pct)}%</span>
        <p style="font-size: 0.65rem; color: var(--color-text-secondary); font-weight: 600; text-transform: uppercase; margin-top: 2px;">
          ${esc(deadKm.toFixed(1))} ${esc(t('analytics.deadKmUnits'))} Unpaid
        </p>
      </div>
    `;
  },
  afterRender: (_el, _ctx) => {},
  destroy: (_el) => {},
};
