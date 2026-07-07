import { formatCurrency, formatLargeNumber } from '../../utils/formatters.js';
import { esc } from './esc.js';

const _IC_TRUCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`;

export default {
  id: 'orderEconomics',
  label: 'Order Economics',
  defaultSize: '1x1',
  defaultVisible: false,
  category: 'financial',

  // Merges deliveries + perDelivery + tipsTotal — three numbers about the
  // same delivery count — into one row instead of three full-width cards.
  render: async (ctx) => {
    const c = /** @type {any} */ (ctx);
    const orders = Math.round(Number(c?.data?.financial?.orders) || 0);
    const perDelivery = Number(c?.data?.financial?.perDelivery) || 0;
    const tips = Number(c?.data?.financial?.tips) || 0;
    const country = String(c?.data?.localeCountry || 'US');
    const currency = String(c?.data?.currency || 'USD');

    const items = [
      { label: 'Deliveries', value: formatLargeNumber(orders) },
      { label: 'Per Delivery', value: formatCurrency(perDelivery, country, { currency }) },
      { label: 'Tips', value: formatCurrency(tips, country, { currency }) },
    ];

    return `
      <div class="wr">
        <div class="wh">
          <div class="wi">${_IC_TRUCK}</div>
          <span class="wl">Order Economics</span>
        </div>
        <div class="wrow3">
          ${items.map((i) => `
            <div class="wrow3-cell">
              <span class="wrow3-l">${esc(i.label)}</span>
              <span class="wrow3-v">${esc(i.value)}</span>
            </div>
          `).join('')}
        </div>
      </div>`;
  },
  afterRender: (_el, _ctx) => {},
  destroy: (_el) => {},
};
