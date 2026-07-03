import { buildWidgetDataContext } from '../modules/analytics/widget-data.js';
import { WidgetRegistry } from '../registry/widgets/index.js';
import { afterRenderWidgets } from '../registry/widgets/after-render.js';
import { bus } from '../core/events.js';
import { store } from '../core/store.js';
import { getIcon } from '../ui/icons.js';
import { t } from '../utils/strings.js';
import { ymd } from '../utils/date-range-presets.js';
import { renderSkeleton } from '../ui/components.js';


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

const ANALYTICS_TAB_KEY = 'comma-analytics-active-tab-v1';

const ANALYTICS_TAB_WIDGETS = {
  // Charts & trends over time
  perf: ['rollingTrend', 'scatter', 'weekCompare', 'hoursCompare', 'bestDay', 'bestHour', 'streak', 'deadMiles'],
  // Breakdowns & forward-looking insights
  insights: ['platformActivity', 'incomeBreakdown', 'stabilityScore', 'weeklyProjection', 'recentShifts', 'schedule', 'taxJar'],
  // Single-number stat cards (excludes what the dashboard KPI strip already shows)
  stats: ['effectiveRate', 'deliveries', 'perDelivery', 'tipsTotal', 'monthOrders', 'monthHourly', 'zeroDays', 'outOfPocket'],
};

function loadActiveTab() {
  const tab = sessionStorage.getItem(ANALYTICS_TAB_KEY);
  return tab && ANALYTICS_TAB_WIDGETS[tab] ? tab : 'perf';
}

function saveActiveTab(tab) {
  sessionStorage.setItem(ANALYTICS_TAB_KEY, tab);
}

/**
 * @param {HTMLElement} root
 * @param {Record<string, unknown>} _ctx
 */
async function paintAnalytics(root, _ctx) {
  const platformFilter = String(store.get('activePlatformId') ?? 'all');
  const now = new Date();
  const user = store.get('user');

  const weekStartDay = Number(user?.locale?.weekStartDay ?? 0);
  const range = {
    start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
    end: ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };

  root.innerHTML = `
    <header class="view-header">
      <div class="view-header-content">
        <h1>${esc(t('analytics.title'))}</h1>
        <p class="view-subtitle">${esc(t('analytics.subtitle'))}</p>
      </div>
    </header>
    <section class="view-body" style="padding-bottom: var(--space-20);">
      <div class="analytics-layout">
        <aside class="analytics-nav-column">
          <div class="analytics-tabs">
            <button type="button" class="analytics-tab-btn is-active"><span>Loading...</span></button>
          </div>
        </aside>
        <main class="analytics-panels">
          <div class="bento-grid" style="margin-top: var(--space-2);">
            ${renderSkeleton('card')}
            ${renderSkeleton('card')}
            ${renderSkeleton('card')}
            ${renderSkeleton('card')}
          </div>
        </main>
      </div>
    </section>
  `;

  const widgetCtx = await buildWidgetDataContext(range, platformFilter, weekStartDay);
  const activeTab = loadActiveTab();
  const categoryWidgetIds = ANALYTICS_TAB_WIDGETS[activeTab] || ANALYTICS_TAB_WIDGETS.perf;

  const cardsHtml = (await Promise.all(categoryWidgetIds.map(async (id) => {
    const w = WidgetRegistry.getById(id);
    if (!w) return '';
    return `
      <article class="card bento-cell-${w.defaultSize}" data-widget-id="${esc(id)}">
        <div class="analytics-card-content">
          ${await (async () => {
            try {
              return await w.render(widgetCtx);
            } catch (err) {
              console.error(`Widget ${id} failed to render:`, err);
              return `<div class="widget-error">${getIcon('warning', 24)}<p>Failed to load insight</p></div>`;
            }
          })()}
        </div>
      </article>
    `;
  }))).join('');

  root.innerHTML = `
    <header class="view-header">
      <div class="view-header-content">
        <h1>${esc(t('analytics.title'))}</h1>
        <p class="view-subtitle">${esc(t('analytics.subtitle'))}</p>
      </div>
    </header>

    <section class="view-body" style="padding-bottom: var(--space-20);">

      <div class="analytics-layout">
        <!-- Sidebar Navigation -->
        <aside class="analytics-nav-column">
          <div class="analytics-tabs">
            <button type="button" class="analytics-tab-btn${activeTab === 'perf' ? ' is-active' : ''}" data-analytics-tab="perf" aria-selected="${activeTab === 'perf'}">
              <span>${esc(t('analytics.performanceModules'))}</span>
            </button>
            <button type="button" class="analytics-tab-btn${activeTab === 'insights' ? ' is-active' : ''}" data-analytics-tab="insights" aria-selected="${activeTab === 'insights'}">
              <span>${esc(t('analytics.deepInsights'))}</span>
            </button>
            <button type="button" class="analytics-tab-btn${activeTab === 'stats' ? ' is-active' : ''}" data-analytics-tab="stats" aria-selected="${activeTab === 'stats'}">
              <span>${esc(t('analytics.statModules'))}</span>
            </button>
          </div>
        </aside>

        <!-- Main Content Area -->
        <main class="analytics-panels">
          <div class="analytics-tab-content">
            ${cardsHtml
              ? `<section class="bento-grid bento-layout-${user?.bentoLayout || 'balanced'}" style="margin-top: var(--space-2);">${cardsHtml}</section>`
              : `<div class="analytics-empty-tab">${getIcon('warning', 48)}<p>No insights available for this category yet.</p></div>`}
          </div>
        </main>
      </div>
    </section>
  `;

  // After-render for all widgets (charts, etc.)
  afterRenderWidgets(root, widgetCtx);
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

  const handleClick = (ev) => {
    const target = ev.target;
    if (!(target instanceof HTMLElement)) return;

    const tabBtn = target.closest('[data-analytics-tab]');
    if (tabBtn) {
      const tab = tabBtn.dataset.analyticsTab;
      if (tab) {
        saveActiveTab(tab);
        rerender();
      }
    }
  };

  root.addEventListener('click', handleClick);

  const unsubs = [
    bus.on('platform:changed', rerender),
    bus.on('shift:saved', rerender),
    bus.on('shift:deleted', rerender),
  ];

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    root.removeEventListener('click', handleClick);
    while (unsubs.length) {
      const u = unsubs.pop();
      if (typeof u === 'function') u();
    }
  };

  teardownByRoot.set(root, cleanup);
  void paintAnalytics(root, ctx);

  return cleanup;
}
