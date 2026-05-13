import { formatLargeNumber } from '../../utils/formatters.js';
import { t } from '../../utils/strings.js';
import { esc } from './esc.js';

export default {
  id: 'deliveries',
  label: 'Deliveries',
  defaultSize: '1x1',
  defaultVisible: false,
  category: 'financial',

  /** @param {unknown} ctx */
  render: async (ctx) => {
    const c = /** @type {any} */ (ctx);
    const n = Math.round(Number(c?.data?.financial?.orders) || 0);
    return `
      <span class="stat-label">${esc(t('views.dashboard.financial.deliveries'))}</span>
      <span class="stat-value">${esc(formatLargeNumber(n))}</span>
    `;
  },
  afterRender: (_el, _ctx) => {},
  destroy: (_el) => {},
};
