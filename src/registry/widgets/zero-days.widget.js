import { t } from '../../utils/strings.js';
import { esc } from './esc.js';

export default {
  id: 'zeroDays',
  label: 'Zero Days',
  defaultSize: '1x1',
  defaultVisible: false,
  category: 'analytics',

  /** @param {unknown} ctx */
  render: async (ctx) => {
    const c = /** @type {any} */ (ctx);
    const n = Number(c?.data?.zeroDaysCount) || 0;
    return `
      <span class="stat-label">${esc(t('analytics.zeroDays'))}</span>
      <span class="stat-value">${esc(n)}</span>
      <p style="font-size: 0.65rem; color: var(--color-text-secondary); font-weight: 600; text-transform: uppercase; margin-top: 4px;">Days without earnings</p>
    `;
  },
  afterRender: (_el, _ctx) => {},
  destroy: (_el) => {},
};
