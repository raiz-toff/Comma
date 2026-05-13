import { formatCurrency } from '../../utils/formatters.js';
import { t } from '../../utils/strings.js';
import { esc } from './esc.js';

export default {
  id: 'tipsTotal',
  label: 'Tips Total',
  defaultSize: '1x1',
  defaultVisible: false,
  category: 'financial',

  /** @param {unknown} ctx */
  render: async (ctx) => {
    const c = /** @type {any} */ (ctx);
    const val = Number(c?.data?.financial?.tips) || 0;
    const country = String(c?.data?.localeCountry || 'US');
    const currency = String(c?.data?.currency || 'USD');
    return `
      <span class="stat-label">${esc(t('views.dashboard.financial.tipsTotal'))}</span>
      <span class="stat-value" style="color: var(--color-success, #10b981);">${esc(formatCurrency(val, country, { currency }))}</span>
    `;
  },
  afterRender: (_el, _ctx) => {},
  destroy: (_el) => {},
};
