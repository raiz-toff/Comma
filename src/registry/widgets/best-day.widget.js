import { t } from '../../utils/strings.js';
import { esc } from './esc.js';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default {
  id: 'bestDay',
  label: 'Best Day',
  defaultSize: '1x1',
  defaultVisible: false,
  category: 'analytics',
  /** @param {unknown} ctx */
  render: async (ctx) => {
    const c = /** @type {{ data?: { bestDay?: { day?: number } } }} */ (ctx);
    const day = Number(c?.data?.bestDay?.day ?? -1);
    const label = day >= 0 && day <= 6 ? DOW[day] : '—';
    return `
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; background: color-mix(in srgb, var(--widget-accent, #8b5cf6) 15%, transparent); color: var(--widget-accent, #8b5cf6);">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
        </div>
        <span class="stat-label">${esc(t('analytics.bestDay'))}</span>
      </div>
      <div style="margin-top: auto;">
        <span class="stat-value" style="font-size: 1.4rem; font-weight: 800; color: var(--widget-accent, #8b5cf6);">${esc(label)}</span>
        <p style="font-size: 0.65rem; color: var(--color-text-secondary); font-weight: 600; text-transform: uppercase; margin-top: 2px;">Highest Earning Day</p>
      </div>
    `;
  },
  afterRender: (_el, _ctx) => {},
  destroy: (_el) => {},
};
