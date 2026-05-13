import {
  getBestDayOfWeek,
  getBestTimeOfDay,
  getDeadMilesSummary,
  getEarningsVsHoursScatter,
  getMonthlySummary,
  getRegisteredMetricDisplay,
  getRolling30DayTrend,
  getZerodays,
  listAnalyticsDashboardMetricIds,
} from '../modules/analytics/analytics.js';
import {
  renderEarningsHeatmap,
  renderEarningsVsHoursChart,
  renderHourlyTrendChart,
} from '../modules/analytics/analytics-charts.js';
import { bus, NAVIGATION, PLATFORM_CHANGED, SHIFT_DELETED, SHIFT_SAVED } from '../core/events.js';
import { t } from '../utils/strings.js';
import { store } from '../core/store.js';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** @param {string} h */
function isAnalyticsRouteHash(h) {
  return h === '#/analytics' || h === '#/analytics/week' || h.startsWith('#/analytics/');
}

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** @type {WeakMap<HTMLElement, () => void>} */
const teardownByRoot = new WeakMap();

/**
 * @param {HTMLElement} root
 * @param {Record<string, unknown>} ctx
 */
async function paintAnalytics(root, ctx) {
  void ctx;
  const now = new Date();
  const user = store.get('user');
  const platformFilter = String(store.get('activePlatformId') ?? 'all');
  const localeCountry = user?.locale?.country || 'US';
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const [monthSummary, rolling, bestDay, bestHour, deadMiles, zeroDays, scatter] = await Promise.all([
    getMonthlySummary(m, y, platformFilter),
    getRolling30DayTrend(platformFilter),
    getBestDayOfWeek(platformFilter),
    getBestTimeOfDay(platformFilter),
    getDeadMilesSummary(platformFilter),
    getZerodays(m, y, platformFilter),
    getEarningsVsHoursScatter(`${y}-01-01`, `${y}-12-31`, platformFilter),
  ]);

  const metricCtx = { summary: monthSummary, zeroDaysLength: zeroDays.length };
  const currency = user?.locale?.currency || 'USD';
  const statCardsHtml = listAnalyticsDashboardMetricIds()
    .map((id) => {
      const row = getRegisteredMetricDisplay(id, metricCtx, localeCountry, currency);
      if (!row) return '';
      const title = row.messageKey ? t(row.messageKey) : row.label;
      return `<article class="card stat-card bento-cell-1x1">
          <span class="stat-label">${esc(title)}</span>
          <span class="stat-value">${esc(row.value)}</span>
        </article>`;
    })
    .join('');

  root.innerHTML = `
    <section class="analytics-view">
      <header class="card card-raised">
        <h1>${esc(t('analytics.title'))}</h1>
        <p>${esc(t('analytics.subtitle'))}</p>
      </header>
      <section class="bento-grid" style="margin-top: var(--space-4);">
        ${statCardsHtml}
      </section>
      <section class="bento-grid" style="margin-top: var(--space-4);">
        <article class="card bento-cell-2x1">
          <h2>${esc(t('analytics.trends'))}</h2>
          <div style="height:220px"><canvas data-chart="rolling-trend"></canvas></div>
        </article>
        <article class="card bento-cell-2x1">
          <h2>${esc(t('analytics.scatter'))}</h2>
          <div style="height:220px"><canvas data-chart="scatter"></canvas></div>
        </article>
        <article class="card bento-cell-2x1">
          <h2>${esc(t('analytics.heatmap'))}</h2>
          <div data-chart="heatmap"></div>
        </article>
        <article class="card bento-cell-1x1">
          <h2>${esc(t('analytics.bestWindow'))}</h2>
          <p>${esc(t('analytics.bestDay'))}: ${esc(DOW[bestDay.day] || 'Sun')}</p>
          <p>${esc(t('analytics.bestHour'))}: ${esc(String(bestHour.hour).padStart(2, '0'))}:00</p>
          <p>${esc(t('analytics.deadMilesSummary'))}: ${esc((deadMiles.ratio * 100).toFixed(1))}% ${esc(t('analytics.deadKmOfTotal'))} · ${esc(deadMiles.deadKm.toFixed(1))} ${esc(t('analytics.deadKmUnits'))}</p>
        </article>
      </section>
    </section>
  `;

  const trendCanvas = root.querySelector('canvas[data-chart="rolling-trend"]');
  if (trendCanvas instanceof HTMLCanvasElement) {
    renderHourlyTrendChart(
      trendCanvas,
      rolling.points.map((p) => String(p.x + 1)),
      rolling.points.map((p) => p.y),
    );
  }
  const scatterCanvas = root.querySelector('canvas[data-chart="scatter"]');
  if (scatterCanvas instanceof HTMLCanvasElement) {
    renderEarningsVsHoursChart(scatterCanvas, scatter);
  }
  const heatmapContainer = root.querySelector('[data-chart="heatmap"]');
  if (heatmapContainer instanceof HTMLElement) {
    renderEarningsHeatmap(
      heatmapContainer,
      rolling.points.map((point, idx) => {
        const d = new Date();
        d.setDate(d.getDate() - (rolling.points.length - idx - 1));
        return { date: d.toISOString().slice(0, 10), value: point.y };
      }),
    );
  }
}

/** @param {HTMLElement} root @param {Record<string, unknown>} ctx */
export async function render(root, ctx) {
  const prev = teardownByRoot.get(root);
  if (typeof prev === 'function') prev();

  let disposed = false;
  const rerender = () => {
    if (disposed) return;
    void paintAnalytics(root, ctx);
  };

  /** @type {(() => void)[]} */
  const unsubs = [];

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    while (unsubs.length) {
      const u = unsubs.pop();
      try {
        if (typeof u === 'function') u();
      } catch {
        /* ignore */
      }
    }
    teardownByRoot.delete(root);
  };

  unsubs.push(bus.on(PLATFORM_CHANGED, rerender));
  unsubs.push(bus.on(SHIFT_SAVED, rerender));
  unsubs.push(bus.on(SHIFT_DELETED, rerender));
  unsubs.push(
    bus.on(NAVIGATION, (payload) => {
      const h =
        payload && typeof payload === 'object' && payload && 'hash' in payload
          ? String(/** @type {{ hash?: string }} */ (payload).hash)
          : '';
      if (isAnalyticsRouteHash(h)) return;
      cleanup();
    }),
  );

  teardownByRoot.set(root, cleanup);

  await paintAnalytics(root, ctx);
}
