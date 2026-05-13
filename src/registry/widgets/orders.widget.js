import { formatLargeNumber } from '../../utils/formatters.js';
import { t } from '../../utils/strings.js';
import { esc } from './esc.js';

export default {
  id: 'orders',
  label: 'Orders',
  defaultSize: '1x1',
  defaultVisible: true,
  category: 'stats',
  /** @param {unknown} ctx */
  render: async (ctx) => {
    const c = /** @type {{ data?: { annual?: { orders?: number } } }} */ (ctx);
    const n = Number(c?.data?.annual?.orders) || 0;
    return `<span class="stat-label">${esc(t('analytics.orders'))}</span><span class="stat-value">${esc(formatLargeNumber(n))}</span>`;
  },
  afterRender: (_el, _ctx) => {},
  destroy: (_el) => {},
};
