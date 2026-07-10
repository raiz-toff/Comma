import { formatCurrency } from '../../utils/formatters.js';
import { t }              from '../../utils/strings.js';
import { esc }            from './esc.js';

const _IC_ZAP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;

export default {
  id: 'effectiveRate',
  label: 'Effective $/hr',
  defaultSize: '1x1',
  defaultVisible: false,
  category: 'financial',

  render: async (ctx) => {
    const c        = /** @type {any} */ (ctx);
    const val      = Number(c?.data?.financial?.effectivePerHr) || 0;
    const avg      = Number(c?.data?.financial?.avgRateHr)      || 0;
    const country  = String(c?.data?.localeCountry || 'US');
    const currency = String(c?.data?.currency      || 'USD');

    // Compare effective vs gross rate
    const delta  = avg > 0 ? val - avg : null;
    const subText = delta !== null
      ? `${delta >= 0 ? '+' : ''}${formatCurrency(delta, country, { currency })} vs gross rate`
      : 'after expenses';

    return `
      <div class="wr">
        <div class="wh">
          <div class="wi">${_IC_ZAP}</div>
          <span class="wl">${esc(t('views.dashboard.financial.effectivePerHr'))}</span>
          <span class="wb ${delta !== null && delta >= 0 ? 'pos' : 'neg'}">after costs</span>
        </div>
        <div class="wv" style="color:var(--wa)">${esc(formatCurrency(val, country, { currency }))}</div>
        <div class="ws">${esc(subText)}</div>
      </div>`;
  },
  afterRender: (_el, _ctx) => {},
  destroy:     (_el)       => {},
};
