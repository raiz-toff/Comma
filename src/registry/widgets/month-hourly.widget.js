import { formatCurrency } from '../../utils/formatters.js';
import { t } from '../../utils/strings.js';
import { esc } from './esc.js';

export default {
  id: 'monthHourly',
  label: 'Monthly $/hr',
  defaultSize: '1x1',
  defaultVisible: false,
  category: 'analytics',

  /** @param {unknown} ctx */
  render: async (ctx) => {
    const c = /** @type {any} */ (ctx);
    const val = Number(c?.data?.monthSummary?.hourlyRate) || 0;
    const country = String(c?.data?.localeCountry || 'US');
    const currency = String(c?.data?.currency || 'USD');
    const month = new Date().toLocaleString('default', { month: 'short' });
    return `
      <span class="stat-label">${esc(t('analytics.hourlyRate'))} (${esc(month)})</span>
      <span class="stat-value">${esc(formatCurrency(val, country, { currency }))}</span>
    `;
  },
  afterRender: (_el, _ctx) => {},
  destroy: (_el) => {},
};
