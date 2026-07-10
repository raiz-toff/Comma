import { formatCurrency } from '../../utils/formatters.js';
import { t }              from '../../utils/strings.js';
import { esc }            from './esc.js';

const _IC_TARGET = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`;

export default {
  id: 'weeklyGoal',
  label: 'Weekly Goal',
  defaultSize: '1x1',
  defaultVisible: true,
  category: 'stats',

  render: async (ctx) => {
    const c        = /** @type {any} */ (ctx);
    const target   = Number(c?.data?.weeklyProjection) || 0;
    const actual   = Number(c?.data?.financial?.gross) || 0;
    const country  = String(c?.data?.localeCountry || 'US');
    const currency = String(c?.data?.currency      || 'USD');
    const pct      = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
    const badge    = pct >= 100 ? 'pos' : pct >= 75 ? 'warn' : 'neu';

    return `
      <div class="wr">
        <div class="wh">
          <div class="wi">${_IC_TARGET}</div>
          <span class="wl">${esc(t('analytics.projection'))}</span>
          ${target > 0 ? `<span class="wb ${badge}">${pct}%</span>` : ''}
        </div>
        <div class="wv">${esc(formatCurrency(target, country, { currency }))}</div>
        ${target > 0 ? `
        <div class="wpb">
          <div class="wpf" style="width:${pct}%"></div>
        </div>
        <div class="wf">
          <span class="ws">current: ${esc(formatCurrency(actual, country, { currency }))}</span>
          <span class="ws">${pct}% done</span>
        </div>` : '<div class="ws">weekly target</div>'}
      </div>`;
  },
  afterRender: (_el, _ctx) => {},
  destroy:     (_el)       => {},
};
