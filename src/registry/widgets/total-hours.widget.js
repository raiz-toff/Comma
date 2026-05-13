import { formatLargeNumber } from '../../utils/formatters.js';
import { t } from '../../utils/strings.js';
import { esc } from './esc.js';

export default {
  id: 'totalHours',
  label: 'Total Hours',
  defaultSize: '1x1',
  defaultVisible: true,
  category: 'financial',

  /** @param {unknown} ctx */
  render: async (ctx) => {
    const c = /** @type {any} */ (ctx);
    const n = Number(c?.data?.financial?.hours) || 0;
    return `
      <span class="stat-label">${esc(t('views.dashboard.financial.totalHours'))}</span>
      <span class="stat-value">${esc(formatLargeNumber(n, 1))}</span>
    `;
  },
  afterRender: (_el, _ctx) => {},
  destroy: (_el) => {},
};
