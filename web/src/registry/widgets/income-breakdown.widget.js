import { t }                      from '../../utils/strings.js';
import { esc }                    from './esc.js';
import { renderIncomeSourceChart } from '../../modules/analytics/analytics-charts.js';

const _IC_PIE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>`;

export default {
  id: 'incomeBreakdown',
  label: 'Income Breakdown',
  defaultSize: '1x1',
  defaultVisible: false,
  category: 'analytics',

  render: async (ctx) => {
    const c        = /** @type {any} */ (ctx);
    const gross    = Number(c?.data?.financial?.gross) || 0;
    const tips     = Number(c?.data?.financial?.tips)  || 0;
    const bonus    = Number(c?.data?.financial?.bonus) || 0;
    const base     = Math.max(0, gross - tips - bonus);
    const tipsPct  = gross > 0 ? Math.round((tips / gross)  * 100) : 0;
    const bonusPct = gross > 0 ? Math.round((bonus / gross) * 100) : 0;

    return `
      <div class="wr">
        <div class="wh">
          <div class="wi">${_IC_PIE}</div>
          <span class="wl">${esc(t('analytics.incomeBreakdown'))}</span>
          ${tipsPct > 0 ? `<span class="wb pos">${tipsPct}% tips</span>` : ''}
        </div>
        <div class="wch" style="height:110px">
          <canvas data-widget-chart="incomeBreakdown"></canvas>
        </div>
        <div class="wss">
          <div class="wsc">
            <span class="wscl">Base</span>
            <span class="wscv">${Math.round((base/Math.max(gross,1))*100)}%</span>
          </div>
          <div class="wsc">
            <span class="wscl">Tips</span>
            <span class="wscv pos">${tipsPct}%</span>
          </div>
          ${bonusPct > 0 ? `<div class="wsc"><span class="wscl">Bonus</span><span class="wscv acc">${bonusPct}%</span></div>` : ''}
        </div>
      </div>`;
  },

  afterRender: (el, ctx) => {
    const c      = /** @type {any} */ (ctx);
    const canvas = el.querySelector('canvas[data-widget-chart="incomeBreakdown"]');
    if (canvas instanceof HTMLCanvasElement && c?.data?.financial) {
      const { gross, tips, bonus } = c.data.financial;
      const base = Math.max(0, gross - tips - bonus);
      renderIncomeSourceChart(canvas, { base, tips, bonus });
    }
  },
  destroy: (_el) => {},
};
