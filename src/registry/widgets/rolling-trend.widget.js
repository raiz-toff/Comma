import { renderHourlyTrendChart } from '../../modules/analytics/analytics-charts.js';
import { t } from '../../utils/strings.js';
import { esc } from './esc.js';

export default {
  id: 'rollingTrend',
  label: 'Earnings Trend',
  defaultSize: '2x2',
  defaultVisible: false,
  category: 'analytics',

  /** @param {unknown} ctx */
  render: async (ctx) => {
    const label = t('analytics.trends') || 'Earnings Trend';
    return `
      <div class="wr">
        <div class="wh">
          <div class="wi">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
          </div>
          <span class="stat-label">${esc(label)}</span>
        </div>
        <div class="wch" style="height: 120px; margin-top: 10px;">
          <canvas id="chart-rolling-trend"></canvas>
        </div>
      </div>
    `;
  },

  /** @param {HTMLElement} el @param {any} ctx */
  afterRender: (el, ctx) => {
    const canvas = el.querySelector('#chart-rolling-trend');
    const data = ctx?.data?.rollingTrend;
    if (canvas instanceof HTMLCanvasElement && data?.points) {
      renderHourlyTrendChart(
        canvas,
        data.points.map((p) => String(p.x + 1)),
        data.points.map((p) => p.y)
      );
    }
  },
  destroy: (_el) => {},
};
