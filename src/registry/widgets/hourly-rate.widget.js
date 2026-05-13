import { formatCurrency } from '../../utils/formatters.js';
import { t } from '../../utils/strings.js';
import { esc } from './esc.js';

export default {
  id: 'hourlyRate',
  label: 'Hourly rate',
  defaultSize: '1x1',
  defaultVisible: false,
  category: 'stats',
  /** @param {unknown} ctx */
  render: async (ctx) => {
    const c = /** @type {{ data?: { annual?: { hourlyRate?: number }; localeCountry?: string; currency?: string } } }} */ (ctx);
    const rate = Number(c?.data?.annual?.hourlyRate) || 0;
    const country = String(c?.data?.localeCountry || 'US');
    const currency = String(c?.data?.currency || 'USD');
    return `<span class="stat-label">${esc(t('analytics.hourlyRate'))}</span><span class="stat-value">${esc(formatCurrency(rate, country, { currency }))}</span>`;
  },
  afterRender: (_el, _ctx) => {},
  destroy: (_el) => {},
};
