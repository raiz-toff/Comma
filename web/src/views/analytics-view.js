import { buildWidgetDataContext } from '../modules/analytics/widget-data.js';
import { WidgetRegistry } from '../registry/widgets/index.js';
import { afterRenderWidgets } from '../registry/widgets/after-render.js';
import { bus } from '../core/events.js';
import { store } from '../core/store.js';
import { getIcon } from '../ui/icons.js';
import { ymd } from '../utils/date-range-presets.js';
import { formatCurrency } from '../utils/formatters.js';
import { calcTaxSetAside } from '../utils/calculations.js';


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
const ANALYTICS_PERIOD_TYPE_KEY = 'comma-analytics-period-type-v1';

// Period offset (0 = current, -1 = previous, …). Kept in module scope because
// the store only persists pre-declared keys; resets to 0 on full reload.
let periodOffset = 0;

// Monotonic render token. Each paintAnalytics() call claims the next value; after
// every await it checks it is still the newest call before touching the DOM. This
// prevents a slow in-flight repaint (e.g. a previous arrow click) from resolving
// late and clobbering a newer render with stale HTML — the "clicks but doesn't
// refresh / stuck skeleton" race.
let paintToken = 0;

// Consolidated from 21 single-purpose widgets down to 6 grouped cards (see
// docs/analytics-consolidation.md-equivalent proposal): each of these merges
// several former standalone widgets behind a segmented control or compact
// grid, grouped by the question they answer rather than by data source.
// effectiveRate, monthHourly, outOfPocket and taxJar no longer appear here —
// they're expandable detail on the hero stat cards below (see statCardHtml).
const ANALYTICS_TAB_WIDGETS = {
  perf: ['trends', 'workRhythm'],
  insights: ['incomeSources', 'outlook', 'efficiencyStability'],
  stats: ['orderEconomics'],
};

// Matches the Android bottom tab bar (Performance / Insights / Stat Cards).
const CATEGORY_CONFIG = [
  { key: 'perf', icon: 'chart-bar', label: 'Performance' },
  { key: 'insights', icon: 'star', label: 'Insights' },
  { key: 'stats', icon: 'layout-grid', label: 'Stat Cards' },
];

const PERIOD_TYPES = ['week', 'month', 'year'];

function loadActiveTab() {
  const tab = sessionStorage.getItem(ANALYTICS_TAB_KEY);
  return tab && ANALYTICS_TAB_WIDGETS[tab] ? tab : 'perf';
}

function saveActiveTab(tab) {
  sessionStorage.setItem(ANALYTICS_TAB_KEY, tab);
}

function loadPeriodType() {
  const p = sessionStorage.getItem(ANALYTICS_PERIOD_TYPE_KEY);
  return p && PERIOD_TYPES.includes(p) ? p : 'month';
}

function savePeriodType(p) {
  sessionStorage.setItem(ANALYTICS_PERIOD_TYPE_KEY, p);
}

// ── Period math (mirrors the Android getPeriodDates helper) ────────────────
/**
 * @param {'week'|'month'|'year'} type
 * @param {number} offset  0 = current, -1 = previous, etc.
 * @param {number} weekStartDay
 * @returns {{ start: Date, end: Date }}
 */
function getPeriodDates(type, offset, weekStartDay = 0) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  if (type === 'week') {
    const day = start.getDay();
    const diff = start.getDate() - day + (day < weekStartDay ? -7 : 0) + weekStartDay;
    start.setDate(diff + offset * 7);
    end.setTime(start.getTime() + 6 * 24 * 60 * 60 * 1000);
    end.setHours(23, 59, 59, 999);
  } else if (type === 'month') {
    start.setFullYear(start.getFullYear(), start.getMonth() + offset, 1);
    end.setFullYear(start.getFullYear(), start.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
  } else if (type === 'year') {
    start.setFullYear(start.getFullYear() + offset, 0, 1);
    end.setFullYear(start.getFullYear() + offset, 11, 31);
    end.setHours(23, 59, 59, 999);
  }

  return { start, end };
}

/** @param {'week'|'month'|'year'} type @param {Date} start @param {Date} end */
function getPeriodLabel(type, start, end) {
  if (type === 'week') {
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }
  if (type === 'month') {
    return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  return String(start.getFullYear());
}

/** Split a currency string into its leading symbol and the numeric remainder. */
function currencyParts(amount, localeCountry, currency) {
  const full = formatCurrency(Number(amount) || 0, localeCountry, { currency });
  const m = full.match(/^([^\d\-]+)?(.*)$/);
  return { symbol: (m && m[1]) ? m[1].trim() : '', value: (m && m[2]) ? m[2].trim() : full };
}

// ── Stat card hero block (mirrors Android renderStatCards) ─────────────────
/**
 * @param {{ label: string, value: string, subtitle: string, color: string, icon: string, span?: string, detail?: { label: string, value: string, tone?: string }[] }} opts
 */
function statCardHtml({ label, value, subtitle, color, icon, span, detail }) {
  const expandable = Array.isArray(detail) && detail.length > 0;
  return `
    <article class="astat-card${span ? ` ${span}` : ''}${expandable ? ' is-expandable' : ''}" style="--astat-accent: ${color};"${expandable ? ' data-stat-toggle' : ''}>
      <div class="astat-card-head">
        <span class="astat-card-icon">${getIcon(icon, 14)}</span>
        <span class="astat-card-label">${esc(label)}</span>
        ${expandable ? `<span class="astat-card-chevron">${getIcon('chevron-down', 12)}</span>` : ''}
      </div>
      <div class="astat-card-value">${esc(value)}</div>
      ${subtitle ? `<div class="astat-card-sub">${esc(subtitle)}</div>` : ''}
      ${expandable ? `
        <div class="astat-detail" hidden>
          ${detail.map((d) => `
            <div class="astat-detail-row">
              <span class="astat-detail-l">${esc(d.label)}</span>
              <span class="astat-detail-v${d.tone ? ` ${d.tone}` : ''}">${esc(d.value)}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </article>
  `;
}

/**
 * Renders the hero stat strip. Avg Rate / Expenses / Tax Set-Aside are
 * expandable — they absorb what used to be the standalone effectiveRate,
 * monthHourly, outOfPocket and taxJar widgets as a tap-to-reveal detail
 * instead of 4 extra cards.
 * @param {any} widgetCtx
 * @param {number} taxRatePct
 * @param {string} localeCountry
 * @param {string} currency
 */
function renderStatCards(widgetCtx, taxRatePct, localeCountry, currency) {
  const financial = widgetCtx?.data?.financial;
  const monthSummary = widgetCtx?.data?.monthSummary;

  // On web `financial.gross` already includes tips + bonus (see grossCents in
  // analytics.js), so it IS the total revenue — do not add tips/bonus again.
  const totalRevenue = Number(financial?.gross) || 0;
  const netIncome = Number(financial?.netIncome) || 0;
  const expenses = Math.max(0, totalRevenue - netIncome);
  const taxRate = taxRatePct || 15;
  const taxSetAside = totalRevenue > 0 ? totalRevenue * 0.3 * (taxRate / 100) : 0;

  const activeHrs = Number(financial?.activeHours) || Number(financial?.hours) || 0;
  const onlineHrs = Number(financial?.onlineHours) || Number(financial?.hours) || 0;
  const onlineRate = onlineHrs > 0 ? totalRevenue / onlineHrs : 0;
  const activeRate = activeHrs > 0 ? totalRevenue / activeHrs : 0;
  const count = Number(financial?.count) || 0;

  const fmt = (v) => formatCurrency(Number(v) || 0, localeCountry, { currency });
  const burn = totalRevenue > 0 ? ((expenses / totalRevenue) * 100).toFixed(1) : '0';

  const effectivePerHr = Number(financial?.effectivePerHr) || 0;
  const monthlyHourly = Number(monthSummary?.hourlyRate) || 0;
  const outOfPocket = Number(financial?.outOfPocket) || 0;
  const estimatedTax = calcTaxSetAside(totalRevenue, taxRate);
  const netAfterTax = Math.max(0, netIncome - estimatedTax);

  return `
    <div class="astat-grid">
      ${statCardHtml({ label: 'Gross Earnings', value: fmt(totalRevenue), subtitle: 'Total Revenue', color: 'var(--clr-teal)', icon: 'gross', span: 'astat-span-full' })}
      ${statCardHtml({ label: 'Net Take-Home', value: fmt(netIncome), subtitle: 'After Expenses', color: 'var(--color-info)', icon: 'net' })}
      ${statCardHtml({
        label: 'Expenses', value: fmt(expenses), subtitle: `${burn}% Burn Ratio`, color: '#FF5247', icon: 'expenses-solid',
        detail: [
          { label: 'Burn Ratio', value: `${burn}% of gross` },
          { label: 'Out of Pocket', value: fmt(outOfPocket) },
        ],
      })}
      ${statCardHtml({
        label: 'Avg Rate', value: `${fmt(activeRate)}/hr`, subtitle: 'Active Rate', color: 'var(--color-warning)', icon: 'rate-solid',
        detail: [
          { label: 'Active Rate', value: `${fmt(activeRate)}/hr` },
          { label: 'Online Rate', value: `${fmt(onlineRate)}/hr` },
          { label: 'Effective (after costs)', value: `${fmt(effectivePerHr)}/hr` },
          { label: 'Monthly Avg', value: `${fmt(monthlyHourly)}/hr` },
        ],
      })}
      ${statCardHtml({
        label: 'Tax Set-Aside', value: fmt(taxSetAside), subtitle: `${taxRate}% Tax Rate`, color: 'var(--clr-sky)', icon: 'tax-solid',
        detail: [
          { label: 'Estimated Set-Aside', value: fmt(estimatedTax) },
          { label: 'Net After Tax', value: fmt(netAfterTax), tone: 'pos' },
        ],
      })}
      ${statCardHtml({ label: 'Total Time', value: `${activeHrs.toFixed(1)} hrs`, subtitle: `${count} Shifts Logged (Active)`, color: '#8b5cf6', icon: 'time-solid', span: 'astat-span-full' })}
    </div>
  `;
}

// ── Period-type picker (ion-modal bottom sheet) ────────────────────────────
/**
 * Week/month/year grouping picker as an ion-modal bottom sheet (drag handle,
 * breakpoints). Escape / backdrop tap / swipe-down are ion-modal's own
 * dismissal paths — the old fixed-overlay markup and manual backdrop-click
 * handling are gone. Picking a type calls `onPick(type)` and closes.
 * @param {{ periodType: string, onPick: (type: string) => void }} opts
 */
async function openPeriodTypeSheet({ periodType, onPick }) {
  // Remove any prior instance first so rapid re-opens can't stack.
  document.querySelectorAll('.analytics-period-modal').forEach((n) => n.remove());
  const modal = /** @type {HTMLElement & { present: () => Promise<void>; dismiss: () => Promise<boolean> }} */ (
    document.createElement('ion-modal')
  );
  modal.classList.add('analytics-period-modal');
  /** @type {any} */ (modal).breakpoints = [0, 0.65, 0.92];
  /** @type {any} */ (modal).initialBreakpoint = 0.65;
  /** @type {any} */ (modal).handle = true;

  const host = document.createElement('div');
  host.className = 'analytics-period-sheet-panel';
  host.innerHTML = `
    <div class="analytics-period-sheet-title">Select grouping</div>
    <ion-segment class="analytics-period-seg" value="${esc(periodType)}" data-period-type-segment>
      ${PERIOD_TYPES.map((type) => `
        <ion-segment-button value="${esc(type)}">${esc(type.charAt(0).toUpperCase() + type.slice(1))}</ion-segment-button>
      `).join('')}
    </ion-segment>
  `;
  modal.appendChild(host);

  host.addEventListener('ionChange', (ev) => {
    const target = ev.target instanceof HTMLElement ? ev.target : null;
    if (!target || !target.matches('[data-period-type-segment]')) return;
    const type = String(/** @type {CustomEvent<{ value?: unknown }>} */ (ev).detail?.value ?? '');
    if (PERIOD_TYPES.includes(type)) {
      onPick(type);
      void modal.dismiss();
    }
  });

  modal.addEventListener('ionModalDidDismiss', () => modal.remove());
  document.body.appendChild(modal);
  await modal.present();
}

/**
 * @param {HTMLElement} root
 * @param {Record<string, unknown>} _ctx
 */
async function paintAnalytics(root, _ctx) {
  const myToken = ++paintToken;
  const platformFilter = String(store.get('activePlatformId') ?? 'all');
  const user = store.get('user');

  const weekStartDay = Number(user?.locale?.weekStartDay ?? 0);
  const localeCountry = user?.locale?.country || user?.country || 'US';
  const currency = user?.locale?.currency || user?.currency || 'USD';

  const periodType = loadPeriodType();
  const { start, end } = getPeriodDates(periodType, periodOffset, weekStartDay);
  const range = { start: ymd(start), end: ymd(end) };
  const periodLabel = getPeriodLabel(periodType, start, end);
  const activeTab = loadActiveTab();

  const navHtml = (netValue) => {
    const { symbol, value } = currencyParts(netValue, localeCountry, currency);
    return `
      <div class="analytics-period-nav">
        <button type="button" class="analytics-period-pill" data-period-open>
          <span>${esc(periodLabel)}</span>
          ${getIcon('chevron-down', 12)}
        </button>
        <div class="analytics-period-row">
          <button type="button" class="analytics-period-arrow" data-period-step="-1" aria-label="Previous period">
            ${getIcon('chevron-left', 20)}
          </button>
          <div class="analytics-period-net">
            <span class="analytics-period-net-symbol">${esc(symbol)}</span>
            <span class="analytics-period-net-value">${esc(value)}</span>
          </div>
          <button type="button" class="analytics-period-arrow${periodOffset >= 0 ? ' is-disabled' : ''}" data-period-step="1" aria-label="Next period"${periodOffset >= 0 ? ' disabled' : ''}>
            ${getIcon('chevron-right', 20)}
          </button>
        </div>
      </div>
    `;
  };

  const tabsHtml = `
    <ion-segment class="analytics-segbar" value="${esc(activeTab)}" data-analytics-tab-segment>
      ${CATEGORY_CONFIG.map(({ key, icon, label }) => `
        <ion-segment-button value="${esc(key)}">
          <span class="analytics-seg-inner">${getIcon(icon, 14)}<span>${esc(label)}</span></span>
        </ion-segment-button>
      `).join('')}
    </ion-segment>
  `;

  root.innerHTML = `
    <section class="view-body analytics-android" style="padding-bottom: var(--space-20);">
      ${navHtml(0)}
      ${tabsHtml}
      <div class="analytics-panels">
        <div class="analytics-cards analytics-cards--loading">
          ${Array.from({ length: 4 }, () => `
            <div class="analytics-skel">
              <ion-skeleton-text animated style="width: 38%; height: 14px;"></ion-skeleton-text>
              <ion-skeleton-text animated style="width: 72%; height: 22px;"></ion-skeleton-text>
              <ion-skeleton-text animated style="width: 55%; height: 14px;"></ion-skeleton-text>
            </div>`).join('')}
        </div>
      </div>
    </section>
  `;

  let widgetCtx;
  try {
    widgetCtx = await buildWidgetDataContext(range, platformFilter, weekStartDay);
  } catch (err) {
    if (myToken !== paintToken) return; // superseded by a newer repaint
    console.error('[comma analytics] failed to build widget data', err);
    root.innerHTML = `
      <section class="view-body analytics-android" style="padding-bottom: var(--space-20);">
        ${navHtml(0)}
        ${tabsHtml}
        <div class="analytics-panels">
          <div class="analytics-empty-tab">${getIcon('warning', 48)}<p>Couldn't load analytics for this period.</p></div>
        </div>
      </section>
    `;
    return;
  }
  if (myToken !== paintToken) return; // a newer arrow click already started; drop this stale render

  const financial = widgetCtx.data.financial;
  const taxRatePct = Number(widgetCtx.taxRatePct) || 0;
  const netIncome = Number(financial?.netIncome) || 0;

  const categoryWidgetIds = ANALYTICS_TAB_WIDGETS[activeTab] || ANALYTICS_TAB_WIDGETS.perf;

  const cardsHtml = (await Promise.all(categoryWidgetIds.map(async (id) => {
    const w = WidgetRegistry.getById(id);
    if (!w) return '';
    return `
      <article class="card analytics-widget-card" data-widget-id="${esc(id)}">
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

  if (myToken !== paintToken) return; // widgets finished after a newer repaint started

  const statHeroHtml = activeTab === 'stats'
    ? renderStatCards(widgetCtx, taxRatePct, localeCountry, currency)
    : '';

  const bodyHtml = cardsHtml || statHeroHtml
    ? `${statHeroHtml}<div class="analytics-cards">${cardsHtml}</div>`
    : `<div class="analytics-empty-tab">${getIcon('warning', 48)}<p>No insights available for this category yet.</p></div>`;

  root.innerHTML = `
    <section class="view-body analytics-android" style="padding-bottom: var(--space-20);">
      ${navHtml(netIncome)}
      ${tabsHtml}
      <div class="analytics-panels">
        ${bodyHtml}
      </div>
    </section>
  `;

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

    // Hero stat card tap-to-expand (Avg Rate / Expenses / Tax Set-Aside detail)
    const statToggle = target.closest('[data-stat-toggle]');
    if (statToggle) {
      const panel = statToggle.querySelector('.astat-detail');
      if (panel) {
        const willOpen = panel.hasAttribute('hidden');
        panel.hidden = !willOpen;
        statToggle.classList.toggle('is-open', willOpen);
      }
      return;
    }

    // Prev/next period arrows
    const stepBtn = target.closest('[data-period-step]');
    if (stepBtn && !stepBtn.hasAttribute('disabled')) {
      const step = Number(stepBtn.dataset.periodStep) || 0;
      periodOffset = Math.min(0, periodOffset + step);
      rerender();
      return;
    }

    // Open the period-type picker (ion-modal bottom sheet)
    if (target.closest('[data-period-open]')) {
      void openPeriodTypeSheet({
        periodType: loadPeriodType(),
        onPick: (type) => {
          savePeriodType(type);
          periodOffset = 0;
          rerender();
        },
      });
    }
  };

  // The category tab bar is an ion-segment: it fires ionChange (not a plain click).
  // Delegated on root so it survives every innerHTML repaint.
  const handleIonChange = (ev) => {
    const target = ev.target instanceof HTMLElement ? ev.target : null;
    if (!target || !target.matches('[data-analytics-tab-segment]')) return;
    const tab = String(/** @type {CustomEvent<{ value?: unknown }>} */ (ev).detail?.value ?? '');
    if (ANALYTICS_TAB_WIDGETS[tab] && tab !== loadActiveTab()) {
      saveActiveTab(tab);
      rerender();
    }
  };

  root.addEventListener('click', handleClick);
  root.addEventListener('ionChange', handleIonChange);

  const unsubs = [
    bus.on('platform:changed', rerender),
    bus.on('shift:saved', rerender),
    bus.on('shift:deleted', rerender),
  ];

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    root.removeEventListener('click', handleClick);
    root.removeEventListener('ionChange', handleIonChange);
    while (unsubs.length) {
      const u = unsubs.pop();
      if (typeof u === 'function') u();
    }
  };

  teardownByRoot.set(root, cleanup);
  void paintAnalytics(root, ctx);

  return cleanup;
}
