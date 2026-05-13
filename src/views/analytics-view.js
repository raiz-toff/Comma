import { buildWidgetDataContext } from '../modules/analytics/widget-data.js';
import { WidgetRegistry } from '../registry/widgets/index.js';
import { afterRenderWidgets } from '../registry/widgets/after-render.js';
import { bus } from '../core/events.js';
import { store } from '../core/store.js';
import { saveUser } from '../core/db.js';
import { getIcon } from '../ui/icons.js';
import { t } from '../utils/strings.js';
import { ymd } from '../utils/date-range-presets.js';


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


  const widgetCtx = await buildWidgetDataContext(range, platformFilter, weekStartDay);
  const currentWidgets = Array.isArray(user?.dashboardWidgets) ? user.dashboardWidgets : [];

  // Helper: Render "Add to Dashboard" 1-Click Tiles
  const renderWidgetControls = (id, current) => {
    const entry = current.find(w => (typeof w === 'string' ? w : w.id) === id);
    const exists = !!entry;
    
    if (exists) {
      return `
        <div class="widget-config-row">
          <span class="badge badge-xs badge-success">${getIcon('check', 12)} Added</span>
        </div>
      `;
    }

    return `
      <div class="widget-action-wrapper" data-config-id="${esc(id)}">
        <button type="button" class="btn btn-xs btn-primary toggle-widget-menu">
          ${getIcon('plus', 12)} Add
        </button>
        <div class="widget-command-stack">
          <div class="stack-label">Choose Layout Size</div>
          <div class="primary-tiles">
            <button class="action-tile add-to-dash-btn" data-add-id="${esc(id)}" data-add-size="1x1">
              <span class="tile-shape shape-1x1"></span>
              <span class="tile-label">1×1</span>
            </button>
            <button class="action-tile add-to-dash-btn" data-add-id="${esc(id)}" data-add-size="2x1">
              <span class="tile-shape shape-2x1"></span>
              <span class="tile-label">2×1</span>
            </button>
            <button class="action-tile add-to-dash-btn" data-add-id="${esc(id)}" data-add-size="2x2">
              <span class="tile-shape shape-2x2"></span>
              <span class="tile-label">2×2</span>
            </button>
            <button class="action-tile add-to-dash-btn" data-add-id="${esc(id)}" data-add-size="1x2">
              <span class="tile-shape shape-1x2"></span>
              <span class="tile-label">1×2</span>
            </button>
            <button class="action-tile add-to-dash-btn" data-add-id="${esc(id)}" data-add-size="4x1">
              <span class="tile-shape shape-4x1"></span>
              <span class="tile-label">4×1</span>
            </button>
            <button class="action-tile add-to-dash-btn" data-add-id="${esc(id)}" data-add-size="4x2">
              <span class="tile-shape shape-4x2"></span>
              <span class="tile-label">4×2</span>
            </button>
          </div>
        </div>
      </div>
    `;
  };

  root.innerHTML = `
    <header class="view-header">
      <div class="view-header-content">
        <h1>${esc(t('analytics.title'))}</h1>
        <p class="view-subtitle">${esc(t('analytics.subtitle'))}</p>
      </div>
    </header>

    <section class="view-body" style="padding-bottom: var(--space-20);">
      
      <!-- 1. ACTIVE ON DASHBOARD -->
      ${currentWidgets.length > 0 ? `
        <div class="analytics-section-title">
          <h3>${esc(t('analytics.onDashboard'))}</h3>
          <span class="section-divider"></span>
        </div>
        <div class="active-widgets-ribbon">
          ${currentWidgets.map(wObj => {
            const id = typeof wObj === 'string' ? wObj : wObj?.id;
            const size = typeof wObj === 'string' ? '1x1' : wObj?.size || '1x1';
            const def = WidgetRegistry.getById(id);
            if (!def) return '';
            
            // Map profile to color variable (Financial, Growth, etc)
            const profile = def.profile || 'activity';
            const colorVar = `--wp-${profile}-a`;
            
            return `
              <div class="active-chip">
                <span class="chip-dot" style="background: var(${colorVar})"></span>
                <span class="chip-label">${esc(def.label)}</span>
                <span class="chip-size">${esc(size)}</span>
              </div>
            `;
          }).join('')}
        </div>
        <div class="analytics-manage-link" style="margin-top: var(--space-4); margin-bottom: var(--space-8);">
          <a href="#/settings?tab=appearance" class="btn btn-ghost btn-xs">
            ${getIcon('settings', 14)} Manage active widgets in Settings
          </a>
        </div>
      ` : ''}

      <!-- PRO TIP BANNER -->
      <div class="analytics-pro-tip card card-raised">
        <div class="pro-tip-icon">${getIcon('streak', 20)}</div>
        <div class="pro-tip-content">
          <strong>PRO TIP:</strong> Hover over any insight below to instantly add it to your dashboard in any size (1x1, 2x1, or 2x2)!
        </div>
      </div>

      <!-- 2. AVAILABLE PERFORMANCE MODULES -->
      ${await (async () => {
        const perfIds = ['rollingTrend', 'scatter', 'bestDay', 'bestHour', 'deadMiles'];
        const available = perfIds.filter(id => !currentWidgets.find(w => (typeof w === 'string' ? w : w.id) === id));
        if (available.length === 0) return '';
        return `
          <div class="analytics-section-title">
            <h3>${esc(t('analytics.performanceModules'))}</h3>
            <span class="section-divider"></span>
          </div>
          <section class="bento-grid" style="margin-top: var(--space-2); margin-bottom: var(--space-8);">
            ${(await Promise.all(available.map(async (id) => {
              const w = WidgetRegistry.getById(id);
              if (!w) return '';
              return `
                <article class="card bento-cell-${w.defaultSize}" data-widget-id="${esc(id)}">
                  <div class="analytics-card-header">
                    ${renderWidgetControls(id, currentWidgets)}
                  </div>
                  <div class="analytics-card-content">
                    ${await w.render(widgetCtx)}
                  </div>
                </article>
              `;
            }))).join('')}
          </section>
        `;
      })()}

      <!-- 3. AVAILABLE DEEP INSIGHTS -->
      ${await (async () => {
        const deepIds = ['platformActivity', 'incomeBreakdown', 'weeklyProjection', 'stabilityScore'];
        const available = deepIds.filter(id => !currentWidgets.find(w => (typeof w === 'string' ? w : w.id) === id));
        if (available.length === 0) return '';
        return `
          <div class="analytics-section-title">
            <h3>${esc(t('analytics.deepInsights'))}</h3>
            <span class="section-divider"></span>
          </div>
          <section class="bento-grid" style="margin-top: var(--space-2); margin-bottom: var(--space-8);">
            ${(await Promise.all(available.map(async (id) => {
              const w = WidgetRegistry.getById(id);
              if (!w) return '';
              return `
                <article class="card bento-cell-${w.defaultSize}" data-widget-id="${esc(id)}">
                  <div class="analytics-card-header">
                    ${renderWidgetControls(id, currentWidgets)}
                  </div>
                  <div class="analytics-card-content">
                    ${await w.render(widgetCtx)}
                  </div>
                </article>
              `;
            }))).join('')}
          </section>
        `;
      })()}

      <!-- 4. AVAILABLE SUMMARY STATS -->
      ${await (async () => {
        const statIds = ['earnings', 'weeklyGoal', 'hourlyRate', 'netIncome', 'totalHours', 'deliveries', 'tipsTotal', 'totalExpenses', 'avgRate', 'effectiveRate', 'zeroDays'];
        const available = statIds.filter(id => !currentWidgets.find(w => (typeof w === 'string' ? w : w.id) === id));
        if (available.length === 0) return '';
        return `
          <div class="analytics-section-title">
            <h3>${esc(t('analytics.statModules'))}</h3>
            <span class="section-divider"></span>
          </div>
          <section class="bento-grid" style="margin-top: var(--space-2);">
            ${(await Promise.all(available.map(async (id) => {
              const w = WidgetRegistry.getById(id);
              if (!w) return '';
              return `
                <article class="card bento-cell-${w.defaultSize}" data-widget-id="${esc(id)}">
                  <div class="analytics-card-header">
                    ${renderWidgetControls(id, currentWidgets)}
                  </div>
                  <div class="analytics-card-content">
                    ${await w.render(widgetCtx)}
                  </div>
                </article>
              `;
            }))).join('')}
          </section>
        `;
      })()}
    </section>

  `;

  // After-render for all widgets
  afterRenderWidgets(root, widgetCtx);
}

/** @param {HTMLElement} root @param {Record<string, unknown>} ctx */
export async function render(root, ctx) {
  const prev = teardownByRoot.get(root);
  if (typeof prev === 'function') prev();

  const user = store.get('user');
  let disposed = false;
  let syncTimeout = null;
  let localWidgets = Array.isArray(user?.dashboardWidgets) ? [...user.dashboardWidgets] : [];

  const rerender = () => {
    if (disposed) return;
    void paintAnalytics(root, ctx);
  };

  const flushSync = async () => {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = null;
    await saveUser({ dashboardWidgets: localWidgets });
    await store.refresh('user');
    bus.emit('dashboard:updated');
  };

  const debouncedSync = () => {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(flushSync, 400); // 400ms buffer for rapid fire
  };

  const handleAddClick = async (ev) => {
    const target = ev.target;
    if (!(target instanceof HTMLElement)) return;

    // 1. Toggle Main Widget Size Menu
    const toggleBtn = target.closest('.toggle-widget-menu');
    if (toggleBtn) {
      const menu = toggleBtn.nextElementSibling;
      const wasVisible = menu?.classList.contains('is-visible');
      
      // Close ALL open menus first
      root.querySelectorAll('.widget-command-stack.is-visible').forEach(m => m.classList.remove('is-visible'));
      
      // Open this one only if it was closed
      if (menu && !wasVisible) menu.classList.add('is-visible');
      return;
    }

    // Close menus on outside click
    if (!target.closest('.widget-command-stack')) {
      root.querySelectorAll('.widget-command-stack.is-visible').forEach(m => m.classList.remove('is-visible'));
    }

    // 3. ADD Logic (Optimistic & Debounced)
    const addBtn = target.closest('.add-to-dash-btn');
    if (addBtn) {
      const id = addBtn.dataset.addId;
      const size = addBtn.dataset.addSize || '1x1';
      if (!id) return;

      if (!localWidgets.find(w => (typeof w === 'string' ? w : w.id) === id)) {
        localWidgets.push({ id, size, visible: true });
        
        // Optimistic Hide: Hide the available card
        const card = addBtn.closest('.card');
        if (card) {
          card.style.opacity = '0';
          card.style.transform = 'scale(0.9)';
          setTimeout(() => { if (card) card.style.display = 'none'; }, 200);
        }

        // Auto-close menu
        root.querySelectorAll('.widget-command-stack.is-visible').forEach(m => m.classList.remove('is-visible'));
        
        debouncedSync();
        bus.emit('toast', { message: t('analytics.addedToDashboard'), type: 'success' });
      }
      return;
    }
  };

  root.addEventListener('click', handleAddClick);

  const unsubs = [
    bus.on('platform:changed', rerender),
    bus.on('shift:saved', rerender),
    bus.on('shift:deleted', rerender),
    bus.on('dashboard:updated', rerender),
  ];

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    root.removeEventListener('click', handleAddClick);
    while (unsubs.length) {
      const u = unsubs.pop();
      if (typeof u === 'function') u();
    }
  };

  teardownByRoot.set(root, cleanup);
  void paintAnalytics(root, ctx);
}
