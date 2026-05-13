import { formatCurrency } from '../../utils/formatters.js';
import { t } from '../../utils/strings.js';
import { esc } from './esc.js';

export default {
  id: 'earnings',
  label: 'Earnings',
  defaultSize: '1x1',
  defaultVisible: true,
  category: 'stats',
  /** @param {unknown} ctx */
  render: async (ctx) => {
    const c = /** @type {{ data?: { annual?: { gross?: number }; localeCountry?: string; currency?: string } } }} */ (ctx);
    const gross = Number(c?.data?.annual?.gross) || 0;
    const country = String(c?.data?.localeCountry || 'US');
    const currency = String(c?.data?.currency || 'USD');
    return `<span class="stat-label">${esc(t('analytics.earnings'))} YTD</span><span class="stat-value">${esc(formatCurrency(gross, country, { currency }))}</span>`;
  },
  /** @param {HTMLElement} _el @param {unknown} _ctx */
  afterRender: (_el, _ctx) => {},
  /** @param {HTMLElement} _el */
  destroy: (_el) => {},
};
