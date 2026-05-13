import { t } from '../../utils/strings.js';
import { esc } from './esc.js';

export default {
  id: 'bestHour',
  label: 'Best Hour',
  defaultSize: '1x1',
  defaultVisible: false,
  category: 'analytics',
  /** @param {unknown} ctx */
  render: async (ctx) => {
    const c = /** @type {{ data?: { bestHour?: { hour?: number } } }} */ (ctx);
    const hour = Number(c?.data?.bestHour?.hour ?? -1);
    const label = hour >= 0 ? `${String(hour).padStart(2, '0')}:00` : '—';
    return `
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; background: color-mix(in srgb, var(--widget-accent, #8b5cf6) 15%, transparent); color: var(--widget-accent, #8b5cf6);">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </div>
        <span class="stat-label">${esc(t('analytics.bestHour'))}</span>
      </div>
      <div style="margin-top: auto;">
        <span class="stat-value" style="font-size: 1.4rem; font-weight: 800; color: var(--widget-accent, #8b5cf6);">${esc(label)}</span>
        <p style="font-size: 0.65rem; color: var(--color-text-secondary); font-weight: 600; text-transform: uppercase; margin-top: 2px;">Peak Performance</p>
      </div>
    `;
  },
  afterRender: (_el, _ctx) => {},
  destroy: (_el) => {},
};
