import { formatCurrency } from '../../utils/formatters.js';
import { t }              from '../../utils/strings.js';
import { esc }            from './esc.js';

const _IC_TREND_UP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`;
const _IC_TREND_DN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>`;

export default {
  id: 'weekCompare',
  label: 'Week over Week',
  defaultSize: '1x1',
  defaultVisible: true,
  category: 'stats',

  render: async (ctx) => {
    const c        = /** @type {any} */ (ctx);
    const delta    = Number(c?.data?.weekCompare?.delta) || 0;
    const country  = String(c?.data?.localeCountry || 'US');
    const currency = String(c?.data?.currency      || 'USD');
    const isUp     = delta >= 0;
    const color    = delta === 0 ? 'var(--color-text-muted)' : isUp ? '#10b981' : '#f43f5e';
    const icon     = delta === 0 ? '' : isUp ? _IC_TREND_UP : _IC_TREND_DN;
    const sign     = delta > 0 ? '+' : '';
    const badge    = isUp ? 'pos' : delta < 0 ? 'neg' : 'neu';
    const text     = isUp ? 'vs last week' : 'vs last week';

    return `
      <div class="wr">
        <div class="wh">
          <div class="wi" style="color:${color}">${icon || _IC_TREND_UP}</div>
          <span class="wl">${esc(t('analytics.compare'))}</span>
          <span class="wb ${badge}">${isUp ? '▲' : delta < 0 ? '▼' : '—'} WoW</span>
        </div>
        <div class="wv" style="color:${color}">
          ${sign}${esc(formatCurrency(delta, country, { currency }))}
        </div>
        <div class="ws">${esc(text)}</div>
      </div>`;
  },
  afterRender: (_el, _ctx) => {},
  destroy:     (_el)       => {},
};
