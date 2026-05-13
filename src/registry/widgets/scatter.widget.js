import { renderEarningsVsHoursChart } from '../../modules/analytics/analytics-charts.js';
import { t } from '../../utils/strings.js';
import { esc } from './esc.js';

export default {
  id: 'scatter',
  label: 'Earnings vs Hours',
  defaultSize: '2x2',
  defaultVisible: false,
  category: 'analytics',

  /** @param {unknown} ctx */
  render: async (ctx) => {
    const label = t('analytics.scatter') || 'Earnings vs Hours';
    return `
      <div class="wr">
        <div class="wh">
          <div class="wi">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M3 20h18M3 20V4"></path>
            </svg>
          </div>
          <span class="stat-label">${esc(label)}</span>
        </div>
        <div class="wch" style="height: 120px; margin-top: 10px;">
          <canvas id="chart-scatter"></canvas>
        </div>
      </div>
    `;
  },

  /** @param {HTMLElement} el @param {any} ctx */
  afterRender: (el, ctx) => {
    const canvas = el.querySelector('#chart-scatter');
    const data = ctx?.data?.scatter;
    if (canvas instanceof HTMLCanvasElement && data) {
      renderEarningsVsHoursChart(canvas, data);
    }
  },
  destroy: (_el) => {},
};
