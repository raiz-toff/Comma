import { formatCurrency } from '../../utils/formatters.js';
import { t } from '../../utils/strings.js';
import { esc } from './esc.js';

export default {
  id: 'avgRate',
  label: 'Avg $/hr',
  defaultSize: '1x1',
  defaultVisible: true,
  category: 'financial',

  /** @param {unknown} ctx */
  render: async (ctx) => {
    const c = /** @type {any} */ (ctx);
    const val = Number(c?.data?.financial?.avgRateHr) || 0;
    const country = String(c?.data?.localeCountry || 'US');
    const currency = String(c?.data?.currency || 'USD');
    return `
      <span class="stat-label">${esc(t('views.dashboard.financial.avgRateHr'))}</span>
      <span class="stat-value">${esc(formatCurrency(val, country, { currency }))}</span>
    `;
  },
  afterRender: (_el, _ctx) => {},
  destroy: (_el) => {},
};
