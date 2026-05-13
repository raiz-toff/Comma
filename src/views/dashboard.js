import {
  bus,
  DATA_IMPORTED,
  EXPENSE_SAVED,
  NAVIGATION,
  PLATFORM_CHANGED,
  SHIFT_DELETED,
  SHIFT_SAVED,
} from '../core/events.js';
import { store } from '../core/store.js';
import { getFinancialOverviewForRange } from '../modules/analytics/analytics.js';
import { getIcon } from '../ui/icons.js';
import { formatCurrency } from '../utils/formatters.js';
import { t } from '../utils/strings.js';

const DASHBOARD_RANGE_KEY = 'macadam-dashboard-range-v1';

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** @param {Date} d @param {number} weekStartDay */
function startOfWeekDate(d, weekStartDay) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const delta = (x.getDay() - weekStartDay + 7) % 7;
  x.setDate(x.getDate() - delta);
  return x;
}

/**
 * @param {'week'|'month'|'ytd'|'all'} preset
 * @param {Date} now
 * @param {number} weekStartDay
 */
function defaultRangeForPreset(preset, now, weekStartDay) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = ymd(now);
  if (preset === 'week') {
    return { start: ymd(startOfWeekDate(now, weekStartDay)), end: today, preset: 'week' };
  }
  if (preset === 'month') {
    const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const end = ymd(new Date(y, m + 1, 0));
    return { start, end, preset: 'month' };
  }
  if (preset === 'ytd') {
    return { start: `${y}-01-01`, end: today, preset: 'ytd' };
  }
  return { start: `${y - 5}-01-01`, end: today, preset: 'all' };
}

/** @returns {{ start: string; end: string; preset: string } | null} */
function loadDashboardRange() {
  try {
    const raw = sessionStorage.getItem(DASHBOARD_RANGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p.start === 'string' && typeof p.end === 'string' && typeof p.preset === 'string') {
        return p;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** @param {{ start: string; end: string; preset: string }} s */
function saveDashboardRange(s) {
  try {
    sessionStorage.setItem(DASHBOARD_RANGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** @type {WeakMap<HTMLElement, () => void>} */
const teardownByRoot = new WeakMap();

/**
 * @param {HTMLElement} root
 * @param {Record<string, unknown>} ctx
 */
async function paintDashboard(root, ctx) {
  void ctx;

  const now = new Date();
  const user = store.get('user');
  const weekStartDay = Number(user?.locale?.weekStartDay ?? 0);
  const platformFilter = String(store.get('activePlatformId') ?? 'all');
  let range = loadDashboardRange();
  if (!range) range = defaultRangeForPreset('month', now, weekStartDay);
  if (String(range.start) > String(range.end)) {
    const t0 = range.start;
    range = { ...range, start: range.end, end: t0 };
  }

  const fin = await getFinancialOverviewForRange(range.start, range.end, platformFilter, weekStartDay);
  const localeCountry = user?.locale?.country || 'US';
  const currency = user?.locale?.currency || 'USD';

  const fmt = (v) => esc(formatCurrency(Number(v) || 0, localeCountry, { currency }));
  const fmtNum = (v, frac = 2) => esc(Number(v || 0).toFixed(frac));
  const hoursStr = `${fmtNum(fin.hours, 2)} ${esc(t('views.dashboard.financial.hoursSuffix'))}`;

  const presetActive = (p) => (range.preset === p ? ' is-active' : '');

  const best = fin.bestWeek;
  const worst = fin.worstWeek;
  const bestLine = best
    ? `${esc(t('views.dashboard.financial.weekN').replace('{n}', String(best.index)))} (${fmt(best.net)}) ${esc(t('views.dashboard.financial.netProfit'))}`
    : esc(t('views.dashboard.financial.noWeekData'));
  const worstLine = worst
    ? `${esc(t('views.dashboard.financial.weekN').replace('{n}', String(worst.index)))} (${fmt(worst.net)}) ${esc(t('views.dashboard.financial.netProfit'))}`
    : esc(t('views.dashboard.financial.noWeekData'));

  root.innerHTML = `
    <section class="dashboard-view dashboard-view--financial">
      <header class="financial-dash-header">
        <div class="financial-dash-header-text">
          <h1 class="financial-dash-title">${esc(t('views.dashboard.financial.title'))}</h1>
          <p class="financial-dash-subtitle">${esc(t('views.dashboard.financial.subtitle'))}</p>
        </div>
        <div class="financial-dash-actions">
          <a class="btn btn-secondary" href="#/analytics/week">${esc(t('views.dashboard.financial.weeklyLog'))}</a>
          <a class="btn btn-secondary" href="#/expenses">${esc(t('views.dashboard.financial.expensesNav'))}</a>
          <a class="btn btn-primary financial-dash-export" href="#/reports">${getIcon('export', 18, 'financial-dash-export-icon')}${esc(
            t('views.dashboard.financial.export'),
          )}</a>
        </div>
      </header>

      <div class="financial-dash-filter card" data-dashboard-filter>
        <div class="financial-dash-filter-bar">
          <div class="financial-dash-filter-left">
            <span class="financial-dash-filter-label">${esc(t('views.dashboard.financial.dateRange'))}</span>
            <div class="financial-dash-dates">
              <input type="date" class="input financial-dash-date" id="dashboard-filter-start" value="${esc(range.start)}" aria-label="${esc(t('views.dashboard.financial.startDate'))}" />
              <input type="date" class="input financial-dash-date" id="dashboard-filter-end" value="${esc(range.end)}" aria-label="${esc(t('views.dashboard.financial.endDate'))}" />
            </div>
          </div>
          <div class="financial-dash-filter-right">
            <div class="financial-dash-presets" role="group" aria-label="${esc(t('views.dashboard.financial.presetsAria'))}">
              <button type="button" class="btn btn-ghost financial-dash-preset${presetActive('week')}" data-dashboard-preset="week">${esc(t('views.dashboard.financial.presetWeek'))}</button>
              <button type="button" class="btn btn-ghost financial-dash-preset${presetActive('month')}" data-dashboard-preset="month">${esc(t('views.dashboard.financial.presetMonth'))}</button>
              <button type="button" class="btn btn-ghost financial-dash-preset${presetActive('ytd')}" data-dashboard-preset="ytd">${esc(t('views.dashboard.financial.presetYtd'))}</button>
              <button type="button" class="btn btn-ghost financial-dash-preset${presetActive('all')}" data-dashboard-preset="all">${esc(t('views.dashboard.financial.presetAll'))}</button>
            </div>
            <button type="button" class="btn btn-primary financial-dash-apply" data-dashboard-apply>
              ${getIcon('filter', 18, 'financial-dash-apply-icon')}${esc(t('views.dashboard.financial.apply'))}
            </button>
          </div>
        </div>
      </div>

      <div class="financial-dash-primary">
        <article class="card financial-kpi financial-kpi--large">
          <div class="financial-kpi-icon" aria-hidden="true">${getIcon('dollar', 24)}</div>
          <div class="financial-kpi-body">
            <span class="financial-kpi-label">${esc(t('views.dashboard.financial.totalEarnings'))}</span>
            <span class="financial-kpi-value">${fmt(fin.gross)}</span>
            <span class="financial-kpi-trend" aria-hidden="true">—</span>
          </div>
        </article>
        <article class="card financial-kpi financial-kpi--large">
          <div class="financial-kpi-icon" aria-hidden="true">${getIcon('chart-line', 24)}</div>
          <div class="financial-kpi-body">
            <span class="financial-kpi-label">${esc(t('views.dashboard.financial.netIncome'))}</span>
            <span class="financial-kpi-value">${fmt(fin.netIncome)}</span>
            <span class="financial-kpi-trend" aria-hidden="true">—</span>
          </div>
        </article>
        <article class="card financial-kpi financial-kpi--large">
          <div class="financial-kpi-icon" aria-hidden="true">${getIcon('bolt', 24)}</div>
          <div class="financial-kpi-body">
            <span class="financial-kpi-label">${esc(t('views.dashboard.financial.avgRateHr'))}</span>
            <span class="financial-kpi-value">${fmt(fin.avgRateHr)}</span>
            <span class="financial-kpi-trend" aria-hidden="true">—</span>
          </div>
        </article>
        <article class="card financial-kpi financial-kpi--large">
          <div class="financial-kpi-icon" aria-hidden="true">${getIcon('clock', 24)}</div>
          <div class="financial-kpi-body">
            <span class="financial-kpi-label">${esc(t('views.dashboard.financial.totalHours'))}</span>
            <span class="financial-kpi-value">${hoursStr}</span>
            <span class="financial-kpi-trend" aria-hidden="true">—</span>
          </div>
        </article>
      </div>

      <div class="financial-dash-secondary">
        <article class="card financial-metric">
          <span class="financial-metric-label">${esc(t('views.dashboard.financial.deliveries'))}</span>
          <span class="financial-metric-value">${esc(String(Math.round(fin.orders || 0)))}</span>
        </article>
        <article class="card financial-metric">
          <span class="financial-metric-label">${esc(t('views.dashboard.financial.perDelivery'))}</span>
          <span class="financial-metric-value financial-metric-value--accent">${fmt(fin.perDelivery)}</span>
        </article>
        <article class="card financial-metric">
          <span class="financial-metric-label">${esc(t('views.dashboard.financial.tipsTotal'))}</span>
          <span class="financial-metric-value financial-metric-value--positive">${fmt(fin.tips)}</span>
        </article>
        <article class="card financial-metric">
          <span class="financial-metric-label">${esc(t('views.dashboard.financial.expensesMetric'))}</span>
          <span class="financial-metric-value financial-metric-value--negative">${fmt(fin.expense)}</span>
        </article>
        <article class="card financial-metric">
          <span class="financial-metric-label">${esc(t('views.dashboard.financial.outOfPocket'))}</span>
          <span class="financial-metric-value financial-metric-value--negative">${fmt(fin.outOfPocket)}</span>
        </article>
        <article class="card financial-metric">
          <span class="financial-metric-label">${esc(t('views.dashboard.financial.effectivePerHr'))}</span>
          <span class="financial-metric-value financial-metric-value--accent">${fmt(fin.effectivePerHr)}</span>
        </article>
      </div>

      <div class="financial-dash-highlights">
        <article class="financial-highlight financial-highlight--best">
          <div class="financial-highlight-icon" aria-hidden="true">${getIcon('trophy', 22)}</div>
          <div class="financial-highlight-body">
            <h2 class="financial-highlight-title">${esc(t('views.dashboard.financial.bestPerformance'))}</h2>
            <p class="financial-highlight-metric">${bestLine}</p>
            <p class="financial-highlight-hint">${esc(t('views.dashboard.financial.bestHint'))}</p>
          </div>
        </article>
        <article class="financial-highlight financial-highlight--worst">
          <div class="financial-highlight-icon" aria-hidden="true">${getIcon('warning', 22)}</div>
          <div class="financial-highlight-body">
            <h2 class="financial-highlight-title">${esc(t('views.dashboard.financial.needsImprovement'))}</h2>
            <p class="financial-highlight-metric">${worstLine}</p>
            <p class="financial-highlight-hint">${esc(t('views.dashboard.financial.worstHint'))}</p>
          </div>
        </article>
      </div>
    </section>
  `;

  /** @param {'week'|'month'|'ytd'|'all'} preset */
  const applyPreset = (preset) => {
    const r = defaultRangeForPreset(preset, new Date(), weekStartDay);
    saveDashboardRange(r);
    const sEl = /** @type {HTMLInputElement | null} */ (root.querySelector('#dashboard-filter-start'));
    const eEl = /** @type {HTMLInputElement | null} */ (root.querySelector('#dashboard-filter-end'));
    if (sEl) sEl.value = r.start;
    if (eEl) eEl.value = r.end;
    void paintDashboard(root, ctx);
  };

  root.onclick = (ev) => {
    const el = /** @type {HTMLElement | null} */ (ev.target && /** @type {HTMLElement} */ (ev.target).closest('[data-dashboard-preset],[data-dashboard-apply]'));
    if (!el || !root.contains(el)) return;
    if (el.hasAttribute('data-dashboard-apply')) {
      const sEl = /** @type {HTMLInputElement | null} */ (root.querySelector('#dashboard-filter-start'));
      const eEl = /** @type {HTMLInputElement | null} */ (root.querySelector('#dashboard-filter-end'));
      let s = String(sEl?.value || '').trim();
      let e = String(eEl?.value || '').trim();
      if (!s || !e) return;
      if (s > e) {
        const t1 = s;
        s = e;
        e = t1;
        if (sEl) sEl.value = s;
        if (eEl) eEl.value = e;
      }
      saveDashboardRange({ start: s, end: e, preset: 'custom' });
      void paintDashboard(root, ctx);
      return;
    }
    const preset = el.getAttribute('data-dashboard-preset');
    if (preset === 'week' || preset === 'month' || preset === 'ytd' || preset === 'all') {
      applyPreset(preset);
    }
  };
}

/** @param {HTMLElement} root @param {Record<string, unknown>} ctx */
export async function render(root, ctx) {
  const prev = teardownByRoot.get(root);
  if (typeof prev === 'function') prev();

  let disposed = false;
  const rerender = () => {
    if (disposed) return;
    void paintDashboard(root, ctx);
  };

  /** @type {(() => void)[]} */
  const unsubs = [];

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    root.onclick = null;
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
  unsubs.push(bus.on(EXPENSE_SAVED, rerender));
  unsubs.push(bus.on(DATA_IMPORTED, rerender));
  unsubs.push(
    bus.on(NAVIGATION, (payload) => {
      const h =
        payload && typeof payload === 'object' && payload && 'hash' in payload
          ? String(/** @type {{ hash?: string }} */ (payload).hash)
          : '';
      if (h === '#/dashboard') return;
      cleanup();
    }),
  );

  teardownByRoot.set(root, cleanup);

  await paintDashboard(root, ctx);
}
