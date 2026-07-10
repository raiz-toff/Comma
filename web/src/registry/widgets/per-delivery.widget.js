import { formatCurrency } from '../../utils/formatters.js';
import { t }              from '../../utils/strings.js';
import { esc }            from './esc.js';

const _IC_TRUCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`;

export default {
  id: 'perDelivery',
  label: 'Per Delivery',
  defaultSize: '1x1',
  defaultVisible: false,
  category: 'financial',

  render: async (ctx) => {
    const c        = /** @type {any} */ (ctx);
    const val      = Number(c?.data?.financial?.perDelivery) || 0;
    const country  = String(c?.data?.localeCountry || 'US');
    const currency = String(c?.data?.currency      || 'USD');
    const orders   = Number(c?.data?.financial?.orders)  || 0;
    const sub      = orders > 0 ? `across ${orders} deliveries` : 'avg per delivery';

    return `
      <div class="wr">
        <div class="wh">
          <div class="wi">${_IC_TRUCK}</div>
          <span class="wl">${esc(t('views.dashboard.financial.perDelivery'))}</span>
          <span class="wb acc">avg</span>
        </div>
        <div class="wv" style="color:var(--wa)">${esc(formatCurrency(val, country, { currency }))}</div>
        <div class="ws">${esc(sub)}</div>
      </div>`;
  },
  afterRender: (_el, _ctx) => {},
  destroy:     (_el)       => {},
};
