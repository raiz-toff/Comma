import { formatCurrency } from '../../utils/formatters.js';
import { t } from '../../utils/strings.js';
import { esc } from './esc.js';

export default {
  id: 'weekCompare',
  label: 'Week over week',
  defaultSize: '1x1',
  defaultVisible: true,
  category: 'stats',
  /** @param {unknown} ctx */
  render: async (ctx) => {
    const c = /** @type {{ data?: { weekCompare?: { delta?: number }; localeCountry?: string; currency?: string } } }} */ (ctx);
    const delta = Number(c?.data?.weekCompare?.delta) || 0;
    const country = String(c?.data?.localeCountry || 'US');
    const currency = String(c?.data?.currency || 'USD');
    const cls = delta >= 0 ? 'trend-up' : 'trend-down';
    return `<span class="stat-label">${esc(t('analytics.compare'))}</span><span class="stat-value ${cls}">${esc(formatCurrency(delta, country, { currency }))}</span>`;
  },
  afterRender: (_el, _ctx) => {},
  destroy: (_el) => {},
};
