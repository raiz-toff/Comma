import { t }   from '../../utils/strings.js';
import { esc } from './esc.js';

const _IC_MAP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;

export default {
  id: 'deadMiles',
  label: 'Dead Miles',
  defaultSize: '1x1',
  defaultVisible: false,
  category: 'analytics',

  render: async (ctx) => {
    const c      = /** @type {any} */ (ctx);
    const ratio  = Number(c?.data?.deadMiles?.ratio)  || 0;
    const deadKm = Number(c?.data?.deadMiles?.deadKm) || 0;
    const pct    = (ratio * 100).toFixed(1);
    const badge  = ratio > 0.25 ? 'neg' : ratio > 0.15 ? 'warn' : 'pos';
    const label  = ratio > 0.25 ? 'High' : ratio > 0.15 ? 'Moderate' : 'Low';

    return `
      <div class="wr">
        <div class="wh">
          <div class="wi">${_IC_MAP}</div>
          <span class="wl">${esc(t('analytics.deadMilesSummary'))}</span>
          <span class="wb ${badge}">${esc(label)}</span>
        </div>
        <div class="wv">${esc(pct)}<span class="unit">%</span></div>
        <div class="wdm">
          <div class="wdm-dead" style="width:${Math.min(100, ratio*100).toFixed(1)}%"></div>
        </div>
        <div class="wf">
          <span class="ws">${esc(deadKm.toFixed(1))} km unpaid</span>
          <span class="ws">${esc((100 - ratio*100).toFixed(1))}% earning</span>
        </div>
      </div>`;
  },
  afterRender: (_el, _ctx) => {},
  destroy:     (_el)       => {},
};
