import {
  bus,
  DATA_IMPORTED,
  EXPENSE_SAVED,
  NAVIGATION,
  PLATFORM_CHANGED,
  SHIFT_DELETED,
  SHIFT_SAVED,
  VEHICLE_FILTER_CHANGED,
} from '../core/events.js';
import { store } from '../core/store.js';
import { db } from '../core/db.js';
import { getFinancialOverviewForRange } from '../modules/analytics/analytics.js';
import { getIcon } from '../ui/icons.js';
import { renderSkeleton, resolvePlatformLogoHtml } from '../ui/components.js';
import { formatCurrency, formatDuration } from '../utils/formatters.js';
import { defaultRangeForPreset, enumerateWeekDates, ymd } from '../utils/date-range-presets.js';
import { matchesFilter } from '../utils/filters.js';
import { t } from '../utils/strings.js';
import { getDemoAnalyticsAnchorDate } from '../modules/demo/sample-year.js';
import { buildWidgetDataContext } from '../modules/analytics/widget-data.js';
import { getPlatformConfig } from '../registry/platforms/terminology.js';
import { canonicalCategoryId } from '../registry/expense-categories/index.js';
import { renderActivationPanel } from '../modules/onboarding/activation.js';

const DASHBOARD_RANGE_KEY = 'comma-dashboard-range-v1';
const RECENT_SHIFTS_LIMIT = 5;
// Presets kept identical to the pre-redesign dashboard so saved ranges keep resolving the same way.
const PRESETS = ['day', 'week', 'month', 'q1', 'q2', 'q3', 'q4', 'year', 'ytd'];

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clampPct(n) {
  return Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));
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

// Whether the custom start/end date row is open. Module-level (not per-root) — matches the
// old file's behaviour, where this was a single shared UI flag, not per-instance state.
let _dashCustomExpanded = false;

/** Net $ earned on a shift = gross + tips + bonus. Mirrors shifts-view.js's shiftNetEarnings. */
function shiftEarnings(s) {
  return Number(s?.grossRevenue ?? 0) + Number(s?.tipsRevenue ?? 0) + (Number(s?.bonusAmount) || 0);
}

/** Minutes worked on a shift. Mirrors shifts-view.js's shiftMinutes. */
function shiftMinutesWorked(s) {
  return Math.round(Number(s?.durationSeconds) / 60) || Number(s?.onlineMinutes) || 0;
}

/**
 * Mon–Sun (or the user's week start) totals for the calendar week containing `todayYmd`.
 * @param {string} todayYmd @param {number} weekStartDay @param {string} platformFilter @param {string} vehicleFilter
 */
async function loadWeekRows(todayYmd, weekStartDay, platformFilter, vehicleFilter) {
  const dates = enumerateWeekDates(todayYmd, weekStartDay);
  if (!dates.length) return [];
  const rows = await db.shifts.where('date').between(dates[0], dates[dates.length - 1], true, true).toArray();
  const inScope = rows.filter(
    (s) => s.deletedAt == null && matchesFilter(s.platformId, platformFilter) && matchesFilter(s.vehicleId, vehicleFilter),
  );
  return dates.map((date) => {
    const dayShifts = inScope.filter((s) => s.date === date);
    return {
      date,
      earnings: dayShifts.reduce((sum, s) => sum + shiftEarnings(s), 0),
      minutes: dayShifts.reduce((sum, s) => sum + shiftMinutesWorked(s), 0),
    };
  });
}

/** Most-recent shifts (any range), scoped by the active platform/vehicle filters. */
async function loadRecentShifts(platformFilter, vehicleFilter, limit = RECENT_SHIFTS_LIMIT) {
  return db.shifts
    .orderBy('date')
    .reverse()
    .filter(
      (s) => s.deletedAt == null && matchesFilter(s.platformId, platformFilter) && matchesFilter(s.vehicleId, vehicleFilter),
    )
    .limit(limit)
    .toArray();
}

/** Fuel-category expense $ for the range, weighted by deductible % — same weighting fin.expense uses. */
async function loadFuelTotal(startDate, endDate, platformFilter) {
  const rows = await db.expenses
    .filter(
      (e) =>
        e.deletedAt == null &&
        String(e.date || '') >= startDate &&
        String(e.date || '') <= endDate &&
        canonicalCategoryId(e.category) === 'fuel' &&
        matchesFilter(e.platformId, platformFilter),
    )
    .toArray();
  return rows.reduce((sum, row) => sum + num(row.amount) * (num(row.deductiblePct, 100) / 100), 0);
}

/** @param {Record<string, unknown> | null} timer */
function elapsedMsForTimer(timer) {
  if (!timer) return 0;
  let elapsed = Number(timer.elapsedMs) || 0;
  if (!timer.pausedAt && timer.startTime) {
    elapsed += Date.now() - new Date(String(timer.startTime)).getTime();
  }
  return Math.max(0, elapsed);
}

function renderShiftButton(activeTimer) {
  if (activeTimer) {
    return `
      <button type="button" id="dash-active-timer-btn" class="btn dash-shift-btn dash-shift-btn--live">
        <span class="dash-shift-btn-dot" aria-hidden="true"></span>
        <span>${esc(t('views.dashboard.financial.shiftLive'))}</span>
      </button>`;
  }
  return `
    <button type="button" id="dash-start-shift-btn" class="btn btn-primary dash-shift-btn">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" width="14" height="14"><path d="M21.4086 9.35258C23.5305 10.5065 23.5305 13.4935 21.4086 14.6474L8.59662 21.6145C6.53435 22.736 4 21.2763 4 18.9671L4 5.0329C4 2.72368 6.53435 1.26402 8.59661 2.38548L21.4086 9.35258Z" fill="currentColor"></path></svg>
      <span>${esc(t('views.dashboard.financial.startShift'))}</span>
    </button>`;
}

function renderPeriodPicker(range) {
  const presetsHtml = PRESETS.map((p) => {
    const label = t(`views.dashboard.financial.preset${p.charAt(0).toUpperCase()}${p.slice(1)}`);
    return `<button type="button" class="dash-preset${range.preset === p ? ' is-active' : ''}" data-dashboard-preset="${p}">${esc(label)}</button>`;
  }).join('');

  const customRowHtml = _dashCustomExpanded
    ? `
      <div class="dash-period-custom">
        <input type="text" class="input dash-date-field" id="dashboard-filter-start" placeholder="${esc(t('views.dashboard.financial.startDate'))}" readonly value="${esc(range.start)}" />
        <span class="dash-period-custom-sep" aria-hidden="true">&ndash;</span>
        <input type="text" class="input dash-date-field" id="dashboard-filter-end" placeholder="${esc(t('views.dashboard.financial.endDate'))}" readonly value="${esc(range.end)}" />
        <button type="button" class="btn btn-secondary btn-sm" data-dashboard-apply>${esc(t('views.dashboard.financial.apply'))}</button>
      </div>`
    : '';

  return `
    <div class="dash-period">
      <div class="dash-period-presets" role="group" aria-label="${esc(t('views.dashboard.financial.presetsAria'))}">${presetsHtml}</div>
      <button type="button" class="dash-period-toggle" data-dashboard-toggle-filter aria-expanded="${_dashCustomExpanded}">
        ${esc(t('views.dashboard.financial.presetCustom'))}${getIcon(_dashCustomExpanded ? 'chevron-up' : 'chevron-down', 14)}
      </button>
      ${customRowHtml}
    </div>`;
}

function renderHero(fin, fmt) {
  const hasShifts = num(fin.gross) > 0 || num(fin.hours) > 0;
  const rateLine = hasShifts
    ? `<p class="dash-hero-rate">${esc(t('views.dashboard.financial.heroRateLine').replace('{rate}', fmt(fin.effectivePerHr)))}</p>`
    : `<p class="dash-hero-rate dash-hero-rate--muted">${esc(t('views.dashboard.financial.heroNoShifts'))}</p>`;
  return `
    <section class="dash-hero">
      <p class="dash-hero-lede">${esc(t('views.dashboard.financial.heroKept'))}</p>
      <p class="dash-hero-amount">${fmt(fin.netIncome)}</p>
      ${rateLine}
    </section>`;
}

function renderSplit(kept, gas, carOther, fmt) {
  const denom = Math.max(1, kept + gas + carOther);
  const keptPct = clampPct((kept / denom) * 100);
  const gasPct = clampPct((gas / denom) * 100);
  const carOtherPct = clampPct((carOther / denom) * 100);
  return `
    <section class="dash-split">
      <h2 class="dash-section-title">${esc(t('views.dashboard.financial.whereWentTitle'))}</h2>
      <div class="dash-split-bar">
        <span class="dash-split-seg dash-split-seg--kept" style="--w: ${keptPct.toFixed(2)}%"></span>
        <span class="dash-split-seg dash-split-seg--gas" style="--w: ${gasPct.toFixed(2)}%"></span>
        <span class="dash-split-seg dash-split-seg--car" style="--w: ${carOtherPct.toFixed(2)}%"></span>
      </div>
      <ul class="dash-split-legend">
        <li><span class="dash-legend-dot dash-legend-dot--kept"></span>${esc(t('views.dashboard.financial.keptLabel'))} <span class="dash-legend-amount">${fmt(kept)}</span></li>
        <li><span class="dash-legend-dot dash-legend-dot--gas"></span>${esc(t('views.dashboard.financial.gasLabel'))} <span class="dash-legend-amount">${fmt(gas)}</span></li>
        <li><span class="dash-legend-dot dash-legend-dot--car"></span>${esc(t('views.dashboard.financial.carOtherLabel'))} <span class="dash-legend-amount">${fmt(carOther)}</span></li>
      </ul>
    </section>`;
}

function renderWeek(weekRows, todayYmd, activeTimer, fmt) {
  const cells = weekRows
    .map((d) => {
      const isToday = d.date === todayYmd;
      const isLive = isToday && Boolean(activeTimer);
      const hasShift = d.minutes > 0 || d.earnings > 0;
      const dayName = new Date(`${d.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
      const cls = isLive ? ' is-live' : isToday ? ' is-today' : '';
      const body = hasShift
        ? `<span class="dash-day-amount">${fmt(d.earnings)}</span><span class="dash-day-hours">${esc(formatDuration(d.minutes, 'compact'))}</span>`
        : `<span class="dash-day-off">${esc(t('views.dashboard.financial.dayOff'))}</span>`;
      return `<div class="dash-day${cls}"><span class="dash-day-name">${esc(dayName)}</span>${body}</div>`;
    })
    .join('');
  return `
    <section class="dash-week">
      <h2 class="dash-section-title">${esc(t('views.dashboard.financial.thisWeekTitle'))}</h2>
      <div class="dash-week-grid">${cells}</div>
    </section>`;
}

function renderLiveCard(activeTimer, fin, widgetCtx, fmt) {
  if (!activeTimer) return '';
  const platform = getPlatformConfig(activeTimer.platformId);
  const elapsedMin = elapsedMsForTimer(activeTimer) / 60000;
  const rate = num(fin.activeAvgRateHr ?? fin.avgRateHr);
  const estEarnings = (elapsedMin / 60) * rate;

  const rollingPts = (widgetCtx.data.rollingTrend?.activeRatePoints || [])
    .map((p) => Number(p.y) || 0)
    .filter((v) => v > 0);
  const usualRate = rollingPts.length ? rollingPts.reduce((a, b) => a + b, 0) / rollingPts.length : rate;
  const delta = rate - usualRate;

  let compareLine;
  if (usualRate <= 0 || Math.abs(delta) < 1) {
    compareLine = t('views.dashboard.financial.liveAboutUsual');
  } else if (delta > 0) {
    compareLine = t('views.dashboard.financial.liveAboveUsual').replace('{amount}', fmt(delta));
  } else {
    compareLine = t('views.dashboard.financial.liveBelowUsual').replace('{amount}', fmt(Math.abs(delta)));
  }

  const isPaused = Boolean(activeTimer.pausedAt);
  return `
    <article class="card dash-live-card${isPaused ? ' is-paused' : ''}">
      <div class="dash-live-head">
        <span class="dash-live-dot" aria-hidden="true"></span>
        <span class="dash-live-platform">${esc(platform?.name || activeTimer.platformId || '')}</span>
        ${isPaused ? `<span class="dash-live-paused-pill">${esc(t('views.dashboard.financial.livePaused'))}</span>` : ''}
      </div>
      <p class="dash-live-earnings">${esc(t('views.dashboard.financial.liveSoFar').replace('{amount}', fmt(estEarnings)))}</p>
      <p class="dash-live-elapsed">${esc(formatDuration(Math.round(elapsedMin), 'compact'))}</p>
      <div class="dash-live-rate">
        <span class="dash-live-rate-label">${esc(t('views.dashboard.financial.liveRateLabel'))}</span>
        <span class="dash-live-rate-value">${fmt(rate)}/hr</span>
      </div>
      <p class="dash-live-compare">${esc(compareLine)}</p>
      <button type="button" id="dash-end-shift-btn" class="btn btn-secondary dash-live-end-btn">${esc(t('ui.fab.endShift'))}</button>
    </article>`;
}

function renderRecentList(recentShifts, fmt) {
  if (!recentShifts.length) {
    return `<p class="dash-recent-empty">${esc(t('views.dashboard.financial.recentShiftsEmpty'))}</p>`;
  }
  const rows = recentShifts
    .map((s) => {
      const platform = getPlatformConfig(s.platformId);
      // Prefer the platform's brand logo (inline SVG, currentColor → renders white on the coloured
      // chip like the icons in the filter switcher); fall back to the name's initial if a platform
      // ever ships without a logo.
      const logo = resolvePlatformLogoHtml(s.platformId);
      const initial = (String(platform?.name || s.platformId || '?').trim()[0] || '?').toUpperCase();
      const chipInner = logo || esc(initial);
      const dayName = new Date(`${s.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
      return `
        <li>
          <button type="button" class="dash-recent-row" data-dashboard-open-shift="${esc(String(s.id))}">
            <span class="dash-recent-chip${logo ? ' dash-recent-chip--logo' : ''}" style="--chip-color: var(--color-${esc(s.platformId || 'other')}, var(--color-other))">${chipInner}</span>
            <span class="dash-recent-meta">
              <span class="dash-recent-day">${esc(dayName)}</span>
              <span class="dash-recent-hours">${esc(formatDuration(shiftMinutesWorked(s), 'compact'))}</span>
            </span>
            <span class="dash-recent-amount">${fmt(shiftEarnings(s))}</span>
          </button>
        </li>`;
    })
    .join('');
  return `<ul class="dash-recent-list">${rows}</ul>`;
}

function renderAside(activeTimer, fin, widgetCtx, recentShifts, fmt) {
  return `
    <aside class="dash-aside">
      ${renderLiveCard(activeTimer, fin, widgetCtx, fmt)}
      <article class="card dash-recent-card">
        <h2 class="dash-section-title">${esc(t('views.dashboard.financial.recentShiftsTitle'))}</h2>
        ${renderRecentList(recentShifts, fmt)}
      </article>
    </aside>`;
}

/** @type {WeakMap<HTMLElement, () => void>} */
const teardownByRoot = new WeakMap();

/**
 * @param {HTMLElement} root
 * @param {Record<string, unknown>} ctx
 */
async function paintDashboard(root, ctx) {
  void ctx;

  const now = store.get('demoMode') ? getDemoAnalyticsAnchorDate() : new Date();
  const todayYmd = ymd(now);
  const user = store.get('user');
  const weekStartDay = Number(user?.locale?.weekStartDay ?? 0);
  const platformFilter = String(store.get('activePlatformId') ?? 'all');
  const vehicleFilter = String(store.get('activeVehicleId') ?? 'all');
  let range = loadDashboardRange();
  if (!range) range = defaultRangeForPreset('month', now, weekStartDay);
  if (String(range.start) > String(range.end)) {
    const t0 = range.start;
    range = { ...range, start: range.end, end: t0 };
  }

  const activeTimer = /** @type {Record<string, unknown> | null} */ (store.get('activeShiftTimer'));

  root.innerHTML = `
    <section class="dashboard-view dash">
      <header class="dash-header">
        <h1 class="dash-title">${esc(t('views.dashboard.financial.title'))}</h1>
        ${renderShiftButton(activeTimer)}
      </header>
      <div class="dash-skel-stack">
        ${renderSkeleton('stat')}
        ${renderSkeleton('chart')}
        ${renderSkeleton('card')}
      </div>
    </section>
  `;

  const [fin, weekRows, recentShifts] = await Promise.all([
    getFinancialOverviewForRange(range.start, range.end, platformFilter, weekStartDay, vehicleFilter),
    loadWeekRows(todayYmd, weekStartDay, platformFilter, vehicleFilter),
    loadRecentShifts(platformFilter, vehicleFilter),
  ]);

  // Rolling-trend data (used for the live-shift card's "vs. usual" comparison) — the same
  // context the old bento sparklines read from.
  const widgetCtx = await buildWidgetDataContext({ start: range.start, end: range.end }, platformFilter, weekStartDay, vehicleFilter);
  widgetCtx.data.financial = fin;

  const localeCountry = user?.locale?.country || 'US';
  const currency = user?.locale?.currency || 'USD';
  const fmt = (v) => esc(formatCurrency(Number(v) || 0, localeCountry, { currency }));

  const gasTotal = await loadFuelTotal(range.start, range.end, platformFilter);
  const carOtherTotal = Math.max(0, num(fin.expense) - gasTotal);
  const kept = Math.max(0, num(fin.netIncome));

  const activationHtml = await renderActivationPanel();

  root.innerHTML = `
    <section class="dashboard-view dash">
      <header class="dash-header">
        <h1 class="dash-title">${esc(t('views.dashboard.financial.title'))}</h1>
        ${renderShiftButton(activeTimer)}
      </header>

      ${activationHtml}

      ${renderPeriodPicker(range)}

      <div class="dash-grid">
        <div class="dash-main">
          ${renderHero(fin, fmt)}
          ${renderSplit(kept, gasTotal, carOtherTotal, fmt)}
          ${renderWeek(weekRows, todayYmd, activeTimer, fmt)}
        </div>
        ${renderAside(activeTimer, fin, widgetCtx, recentShifts, fmt)}
      </div>
    </section>
  `;

  const startInput = /** @type {HTMLInputElement | null} */ (root.querySelector('#dashboard-filter-start'));
  const endInput = /** @type {HTMLInputElement | null} */ (root.querySelector('#dashboard-filter-end'));
  if (startInput && window.flatpickr) {
    startInput._fp = window.flatpickr(startInput, {
      dateFormat: 'Y-m-d',
      defaultDate: range.start,
      locale: { firstDayOfWeek: weekStartDay },
      onChange: function (selectedDates) {
        if (selectedDates.length === 1) {
          const s = window.flatpickr.formatDate(selectedDates[0], 'Y-m-d');
          const currentEnd = endInput ? endInput.value : range.end;
          saveDashboardRange({ start: s, end: currentEnd, preset: 'custom' });
          void paintDashboard(root, ctx);
        }
      },
    });
  }
  if (endInput && window.flatpickr) {
    endInput._fp = window.flatpickr(endInput, {
      dateFormat: 'Y-m-d',
      defaultDate: range.end,
      locale: { firstDayOfWeek: weekStartDay },
      onChange: function (selectedDates) {
        if (selectedDates.length === 1) {
          const e = window.flatpickr.formatDate(selectedDates[0], 'Y-m-d');
          const currentStart = startInput ? startInput.value : range.start;
          saveDashboardRange({ start: currentStart, end: e, preset: 'custom' });
          void paintDashboard(root, ctx);
        }
      },
    });
  }

  root.onclick = async (ev) => {
    const el = /** @type {HTMLElement | null} */ (
      ev.target &&
      /** @type {HTMLElement} */ (ev.target).closest(
        '[data-dashboard-preset],[data-dashboard-apply],[data-dashboard-toggle-filter],[data-dashboard-open-shift]',
      )
    );
    if (!el || !root.contains(el)) return;

    const shiftId = el.getAttribute('data-dashboard-open-shift');
    if (shiftId) {
      window.location.hash = `#/shifts?open=${encodeURIComponent(shiftId)}`;
      return;
    }

    if (el.hasAttribute('data-dashboard-toggle-filter')) {
      _dashCustomExpanded = !_dashCustomExpanded;
      void paintDashboard(root, ctx);
      return;
    }

    if (el.hasAttribute('data-dashboard-apply')) {
      _dashCustomExpanded = false;
      void paintDashboard(root, ctx);
      return;
    }

    const preset = el.getAttribute('data-dashboard-preset');
    if (preset) {
      const anchorDate = store.get('demoMode') ? getDemoAnalyticsAnchorDate() : new Date();
      // @ts-ignore — preset is one of PRESETS, all valid inputs to defaultRangeForPreset
      const r = defaultRangeForPreset(preset, anchorDate, weekStartDay);
      saveDashboardRange(r);
      _dashCustomExpanded = false;
      void paintDashboard(root, ctx);
    }
  };

  const startBtn = root.querySelector('#dash-start-shift-btn');
  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      const { openStartShiftWizard } = await import('../modules/shifts/big-clock.js');
      openStartShiftWizard();
    });
  }

  // Both the header pill and the aside's "End shift" button open the same overlay — it owns
  // pause/resume and the End-shift flow (odometer/mileage prompt, then saveShift()). Calling
  // stopShiftTimer() directly here would skip that persistence step.
  root.querySelectorAll('#dash-active-timer-btn, #dash-end-shift-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { openBigClockOverlay } = await import('../modules/shifts/big-clock.js');
      openBigClockOverlay();
    });
  });
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
  unsubs.push(bus.on(VEHICLE_FILTER_CHANGED, rerender));
  unsubs.push(bus.on(SHIFT_SAVED, rerender));
  unsubs.push(bus.on(SHIFT_DELETED, rerender));
  unsubs.push(bus.on(EXPENSE_SAVED, rerender));
  unsubs.push(bus.on(DATA_IMPORTED, rerender));
  unsubs.push(bus.on('dashboard:updated', rerender));
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

  return cleanup;
}
