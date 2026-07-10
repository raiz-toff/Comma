import { formatCurrency } from '../../utils/formatters.js';
import { t }              from '../../utils/strings.js';
import { esc }            from './esc.js';

const _IC_BARCHART = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="18" y="3" width="4" height="18" rx="1"/><rect x="10" y="8" width="4" height="13" rx="1"/><rect x="2" y="13" width="4" height="8" rx="1"/></svg>`;

export default {
  id: 'weeklyProjection',
  label: 'Weekly Projection',
  defaultSize: '1x1',
  defaultVisible: false,
  category: 'analytics',

  render: async (ctx) => {
    const c          = /** @type {any} */ (ctx);
    const projected  = Number(c?.data?.projection)        || 0;
    const actual     = Number(c?.data?.financial?.gross)  || 0;
    const country    = String(c?.data?.localeCountry || 'US');
    const currency   = String(c?.data?.currency      || 'USD');
    const pct        = projected > 0 ? Math.min(100, Math.round((actual / projected) * 100)) : 0;
    const remaining  = Math.max(0, projected - actual);
    const badge      = pct >= 100 ? 'pos' : pct >= 75 ? 'warn' : 'neu';

    // Days info
    const dayOfWeek  = new Date().getDay(); // 0=Sun
    const daysLeft   = 7 - dayOfWeek;

    return `
      <div class="wr">
        <div class="wh">
          <div class="wi">${_IC_BARCHART}</div>
          <span class="wl">${esc(t('analytics.weeklyProjection') || 'Weekly Projection')}</span>
          <span class="wb ${badge}">${pct}%</span>
        </div>
        <div class="wv">${esc(formatCurrency(projected, country, { currency }))}</div>
        <div class="wpb">
          <div class="wpf" style="width:${pct}%"></div>
        </div>
        <div class="wss">
          <div class="wsc">
            <span class="wscl">Earned</span>
            <span class="wscv">${esc(formatCurrency(actual, country, { currency }))}</span>
          </div>
          <div class="wsc">
            <span class="wscl">Remaining</span>
            <span class="wscv ${remaining > 0 ? 'neg' : 'pos'}">${esc(formatCurrency(remaining, country, { currency }))}</span>
          </div>
          <div class="wsc">
            <span class="wscl">Days left</span>
            <span class="wscv">${esc(String(daysLeft))}</span>
          </div>
        </div>
      </div>`;
  },
  afterRender: (_el, _ctx) => {},
  destroy:     (_el)       => {},
};
