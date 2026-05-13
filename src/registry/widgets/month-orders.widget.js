import { formatLargeNumber } from '../../utils/formatters.js';
import { t } from '../../utils/strings.js';
import { esc } from './esc.js';

export default {
  id: 'monthOrders',
  label: 'Monthly Orders',
  defaultSize: '1x1',
  defaultVisible: false,
  category: 'analytics',

  /** @param {unknown} ctx */
  render: async (ctx) => {
    const c = /** @type {any} */ (ctx);
    const n = Math.round(Number(c?.data?.monthSummary?.orders) || 0);
    const month = new Date().toLocaleString('default', { month: 'short' });
    return `
      <span class="stat-label">${esc(t('analytics.orders'))} (${esc(month)})</span>
      <span class="stat-value">${esc(formatLargeNumber(n))}</span>
    `;
  },
  afterRender: (_el, _ctx) => {},
  destroy: (_el) => {},
};
