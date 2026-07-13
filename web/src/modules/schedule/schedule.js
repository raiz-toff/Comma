import { db, getAppState, setAppState } from '../../core/db.js';
import { store } from '../../core/store.js';
import { matchesFilter } from '../../utils/filters.js';
import { bus, PLATFORM_CHANGED, VEHICLE_FILTER_CHANGED, NAVIGATION } from '../../core/events.js';
import { formatCurrency } from '../../utils/formatters.js';
import { t } from '../../utils/strings.js';
import { showModal } from '../../ui/components.js';
import { getIcon } from '../../ui/icons.js';
import { getPlatformConfig } from '../../registry/platforms/terminology.js';

const APP_STATE_KEYS = {
  planning: 'schedule_planning_shifts',
  offDays: 'schedule_non_delivery_days',
};

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

function stripFabQueryFromHash() {
  try {
    const raw = window.location.hash || '';
    const qi = raw.indexOf('?');
    if (qi === -1) return;
    const base = raw.slice(0, qi);
    const params = new URLSearchParams(raw.slice(qi + 1));
    if (!params.has('fab')) return;
    params.delete('fab');
    const qs = params.toString();
    const next = qs ? `${base}?${qs}` : base;
    const path = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, '', `${path}${next}`);
  } catch {
    /* ignore */
  }
}

function parseYmd(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function weekStart(date, weekStartDay) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const shift = (d.getDay() - weekStartDay + 7) % 7;
  d.setDate(d.getDate() - shift);
  return d;
}

function dayName(idx) {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][idx] || 'Day';
}

// NOTE (Fix 1 — interop plan): this module reads TWO different shapes that both happen to be
// called "shift" here — real `db.shifts` rows, whose startTime/endTime are now epoch-ms
// timestamps, AND the separate `schedule_planning_shifts` appState array (future-planned shifts,
// not real shift rows — see getScheduleState below), which still stores startTime/endTime as
// HH:mm-of-day strings paired with `date` (a genuinely different, unsynced, web-only concept —
// left alone by this pass). Every helper below accepts either shape.

function minutesFromShift(shift) {
  const explicit = num(shift.activeMinutes || shift.onlineMinutes);
  if (explicit > 0) return explicit;
  if (typeof shift.startTime === 'number' && typeof shift.endTime === 'number') {
    const delta = shift.endTime - shift.startTime;
    return Number.isFinite(delta) && delta > 0 ? Math.round(delta / 60000) : 0;
  }
  const date = typeof shift.date === 'string' ? shift.date : null;
  const start = typeof shift.startTime === 'string' ? shift.startTime : null;
  const end = typeof shift.endTime === 'string' ? shift.endTime : null;
  if (!date || !start || !end) return 0;
  const s = new Date(`${date}T${start}:00`);
  const e = new Date(`${date}T${end}:00`);
  const delta = e.getTime() - s.getTime();
  if (!Number.isFinite(delta)) return 0;
  return Math.max(0, Math.round(delta / 60000));
}

function grossFromShift(shift) {
  // Shift gross revenue is stored as a real dollar value in the DB.
  return num(shift.grossRevenue);
}

/** HH:mm (local time-of-day) from a real shift's epoch-ms startTime/endTime (Fix 1). */
function fmtHm(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '--:--';
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function bucketForHeat(v) {
  if (v <= 0) return 0;
  if (v < 40) return 1;
  if (v < 80) return 2;
  if (v < 140) return 3;
  return 4;
}

async function getScheduleState() {
  const [planningRaw, offRaw] = await Promise.all([
    getAppState(APP_STATE_KEYS.planning),
    getAppState(APP_STATE_KEYS.offDays),
  ]);
  const planning = Array.isArray(planningRaw)
    ? planningRaw
        .filter((row) => row && typeof row === 'object')
        .map((row) => ({
          date: typeof row.date === 'string' ? row.date : '',
          startTime: typeof row.startTime === 'string' ? row.startTime : '',
          endTime: typeof row.endTime === 'string' ? row.endTime : '',
          platformId: typeof row.platformId === 'string' ? row.platformId : 'other',
        }))
        .filter((row) => parseYmd(row.date))
    : [];
  const offDays = new Set(
    Array.isArray(offRaw) ? offRaw.filter((row) => typeof row === 'string' && parseYmd(row)) : [],
  );
  return { planning, offDays };
}

async function listShiftsForMonth(year, monthIndex) {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  return db.shifts
    .where('date')
    .between(ymd(start), ymd(end), true, true)
    .filter((row) => row.deletedAt == null)
    .toArray();
}

/**
 * @param {Date} [monthDate] Which month to load into the calendar grid. Defaults to the real
 * "now" — but "now" itself (used for the week's Hours Tracker and the today-highlight) always
 * stays the actual current moment, independent of which month is being browsed (see `now` vs
 * `monthDate` below): paging to a past/future month must not change what "this week" means.
 */
async function loadScheduleModel(monthDate = new Date()) {
  const now = new Date();
  const user = store.get('user');
  const weekStartDay = num(user?.locale?.weekStartDay, 0);
  const currency = user?.locale?.currency || 'USD';
  const localeCountry = user?.locale?.country || 'US';
  const weekStartDate = weekStart(now, weekStartDay);
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 6);
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const activePlatformId = String(store.get('activePlatformId') || 'all');
  const activeVehicleId = String(store.get('activeVehicleId') || 'all');
  const [weekRowsRaw, monthRowsRaw, state] = await Promise.all([
    db.shifts.where('date').between(ymd(weekStartDate), ymd(weekEndDate), true, true).filter((s) => s.deletedAt == null).toArray(),
    listShiftsForMonth(monthDate.getFullYear(), monthDate.getMonth()),
    getScheduleState(),
  ]);

  const filterFn = (s) =>
    matchesFilter(s.platformId, activePlatformId) && matchesFilter(s.vehicleId, activeVehicleId);
  const weekRows = weekRowsRaw.filter(filterFn);
  const monthRows = monthRowsRaw.filter(filterFn);
  const planning = state.planning.filter(filterFn);

  const monthByDate = new Map();
  for (const shift of monthRows) {
    const key = String(shift.date || '');
    if (!monthByDate.has(key)) monthByDate.set(key, { gross: 0, platforms: new Set() });
    const slot = monthByDate.get(key);
    slot.gross += grossFromShift(shift);
    slot.platforms.add(String(shift.platformId || 'other'));
  }

  const weekMinutes = weekRows.reduce((sum, s) => sum + minutesFromShift(s), 0);
  const weekHours = weekMinutes / 60;
  const weekGross = weekRows.reduce((sum, s) => sum + grossFromShift(s), 0);
  const weekGoal = num(store.get('currentWeekGoal'));
  const avgHourly = weekMinutes > 0 ? weekGross / (weekMinutes / 60) : 0;
  const optimalHours = weekGoal > 0 && avgHourly > 0 ? weekGoal / avgHourly : 0;
  const remainingHours = Math.max(0, optimalHours - weekHours);

  return {
    now,
    user,
    currency,
    localeCountry,
    weekStartDay,
    monthStart,
    monthEnd,
    monthByDate,
    offDays: state.offDays,
    planning,
    weekHours,
    weekGross,
    weekGoal,
    optimalHours,
    remainingHours,
  };
}

function renderMonthGrid(model) {
  const firstDay = new Date(model.monthStart);
  const start = weekStart(firstDay, model.weekStartDay);
  const cells = [];

  // Add day headers
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(`
      <div class="schedule-month-header-cell">
        ${esc(dayName(d.getDay()))}
      </div>
    `);
  }

  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = ymd(d);
    const inMonth = d.getMonth() === model.monthStart.getMonth();
    const entry = model.monthByDate.get(key) || { gross: 0, platforms: new Set() };
    const hasData = entry.platforms.size > 0;
    const bucket = bucketForHeat(entry.gross);
    const dots = [...entry.platforms].slice(0, 4);

    const isToday = key === ymd(model.now);
    let todayBadgeHtml = '';
    if (isToday) {
      const hoursLeft = Math.max(0, 24 - model.now.getHours() - (model.now.getMinutes() / 60));
      todayBadgeHtml = `<span class="sch-month-today-indicator">${hoursLeft.toFixed(1)}h left</span>`;
    }

    cells.push(`
      <div class="schedule-month-cell ${isToday ? 'is-today' : ''} ${inMonth ? '' : 'is-outside'} heat-${bucket} ${model.offDays.has(key) ? 'is-off-day' : ''} ${hasData ? 'is-clickable' : ''}" data-date="${esc(key)}">
        <div class="schedule-month-cell-top">
          <div class="schedule-month-day">${esc(d.getDate())}</div>
          ${todayBadgeHtml}
        </div>
        <div class="schedule-month-earn">${entry.gross > 0 ? esc(formatCurrency(entry.gross, model.localeCountry, { currency: model.currency })) : ''}</div>
        <div class="schedule-platform-dots">${dots.map((pid) => `<span class="dot dot-${esc(pid)}"></span>`).join('')}</div>
      </div>
    `);
  }
  return cells.join('');
}

function renderStats(model) {
  const weekPct = model.optimalHours > 0 ? Math.min(100, (model.weekHours / model.optimalHours) * 100) : 0;
  let goalLine = '';
  if (model.optimalHours > 0) {
    goalLine =
      model.remainingHours > 0
        ? `<p class="schedule-metrics-line"><span class="num">${esc(model.remainingHours.toFixed(1))}h</span> left to hit your goal pace.</p>`
        : `<p class="schedule-metrics-line">Goal pace reached for this week.</p>`;
  }
  return `
    <section class="schedule-metrics card">
      <div class="schedule-card-header">
        <h2 class="schedule-card-title">${getIcon('clock', 20)} Hours Tracker</h2>
      </div>
      <div class="schedule-hours-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${esc(weekPct.toFixed(0))}">
        <span style="width:${esc(weekPct.toFixed(2))}%"></span>
      </div>
      <p class="schedule-metrics-line">You've worked <span class="num">${esc(model.weekHours.toFixed(1))}h</span> this week.</p>
      ${goalLine}
    </section>
  `;
}

async function showDayDetailModal(dateStr, model, root) {
  const date = parseYmd(dateStr);
  if (!date) return;

  const activePlatformId = String(store.get('activePlatformId') || 'all');
  const activeVehicleId = String(store.get('activeVehicleId') || 'all');
  const dayShifts = (await db.shifts.where('date').equals(dateStr).toArray())
    .filter((s) => s.deletedAt == null)
    .filter((s) => matchesFilter(s.platformId, activePlatformId))
    .filter((s) => matchesFilter(s.vehicleId, activeVehicleId));
  const dayPlans = (model.planning || []).filter((p) => p.date === dateStr);
  const totalGross = dayShifts.reduce((sum, s) => sum + grossFromShift(s), 0);

  const content = document.createElement('div');
  content.className = 'day-detail-modal';
  content.innerHTML = `
    <p class="day-detail-summary-line">
      <span class="num">${esc(formatCurrency(totalGross, model.localeCountry, { currency: model.currency }))}</span>
      across ${esc(dayShifts.length)} ${dayShifts.length === 1 ? 'shift' : 'shifts'}
    </p>
    <div class="day-detail-list">
      ${dayShifts.length === 0 && dayPlans.length === 0 ? '<p class="schedule-empty">No activity scheduled for this day.</p>' : ''}
      ${dayShifts
        .map((s) => {
          const platform = getPlatformConfig(s.platformId);
          const initial = (String(platform?.name || s.platformId || '?').trim()[0] || '?').toUpperCase();
          return `
            <div class="day-detail-row is-clickable" data-shift-id="${esc(s.id)}">
              <span class="day-detail-chip" style="--chip-color: var(--color-${esc(s.platformId || 'other')}, var(--color-other))">${esc(initial)}</span>
              <span class="time">${esc(fmtHm(s.startTime))} - ${esc(fmtHm(s.endTime))}</span>
              <span class="earn">${esc(formatCurrency(grossFromShift(s), model.localeCountry, { currency: model.currency }))}</span>
            </div>
          `;
        })
        .join('')}
      ${dayPlans
        .map(
          (p) => `
            <div class="day-detail-row is-plan">
              <span class="badge">Plan</span>
              <span class="time">${esc(p.startTime)} - ${esc(p.endTime)}</span>
              <span class="earn">--</span>
            </div>
          `,
        )
        .join('')}
    </div>
  `;

  let modalHandle = null;
  content.addEventListener('click', (e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    const row = target.closest('.day-detail-row[data-shift-id]');
    if (!row) return;
    const shiftId = row.getAttribute('data-shift-id');
    if (!shiftId) return;
    // Reuse the Dashboard's deep-link mechanism instead of rebuilding shift details here —
    // the Shifts page's own edit modal is the one source of truth for a shift's fields.
    modalHandle?.close();
    window.location.hash = `#/shifts?open=${encodeURIComponent(shiftId)}`;
  });

  modalHandle = showModal({
    title: `${dayName(date.getDay())}, ${date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`,
    content,
    actions: [{ label: t('common.close'), class: 'btn btn-ghost' }],
  });
}

async function handleAddPlan(root, model) {
  const activePlats = await db.platforms.filter((p) => p.active === true).toArray();
  activePlats.sort((a, b) => (Number(a.priority) || 0) - (Number(b.priority) || 0));

  let platformOpts = '';
  if (activePlats.length > 0) {
    platformOpts = activePlats.map(p => `<option value="${esc(String(p.id))}">${esc(String(p.name || p.id))}</option>`).join('');
  } else {
    platformOpts = `<option value="other">other</option>`;
  }

  const wrap = document.createElement('div');
  wrap.className = 'form-grid';
  wrap.style.display = 'grid';
  wrap.style.gap = 'var(--space-4)';
  wrap.innerHTML = `
    <div class="field">
      <label class="label">${t('common.date')}</label>
      <input type="date" class="input" name="date" value="${ymd(new Date())}" />
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
      <div class="field">
        <label class="label">Start Time</label>
        <input type="text" class="input" name="startTime" data-clocklet="format: HH:mm" value="11:00" readonly style="cursor:pointer;" />
      </div>
      <div class="field">
        <label class="label">End Time</label>
        <input type="text" class="input" name="endTime" data-clocklet="format: HH:mm" value="14:00" readonly style="cursor:pointer;" />
      </div>
    </div>
    <div class="field">
      <label class="label">Platform ID</label>
      <select class="input" name="platformId">
        ${platformOpts}
      </select>
    </div>
  `;

  showModal({
    title: 'Plan a Future Shift',
    content: wrap,
    size: 'sm',
    actions: [
      { label: t('common.cancel'), class: 'btn btn-ghost' },
      {
        label: t('common.save'),
        class: 'btn btn-primary',
        onClick: async () => {
          const date = wrap.querySelector('[name="date"]')?.value;
          const startTime = wrap.querySelector('[name="startTime"]')?.value;
          const endTime = wrap.querySelector('[name="endTime"]')?.value;
          const platformId = wrap.querySelector('[name="platformId"]')?.value || 'other';

          if (!date || !parseYmd(date)) return;
          const raw = (await getAppState(APP_STATE_KEYS.planning)) || [];
          const next = Array.isArray(raw) ? [...raw] : [];
          next.push({ date, startTime, endTime, platformId });
          await setAppState(APP_STATE_KEYS.planning, next.slice(-60));
          await renderScheduleModule(root, {});
        }
      }
    ]
  });
}

async function handleMarkOffDay(root) {
  const wrap = document.createElement('div');
  wrap.className = 'form-grid';
  wrap.innerHTML = `
    <div class="field">
      <label class="label">Toggle Non-Delivery Day</label>
      <input type="date" class="input" name="date" value="${ymd(new Date())}" />
      <p style="font-size: var(--text-xs); color: var(--color-text-secondary); margin-top: var(--space-2);">
        Days marked as "off" will be highlighted in red on the grids.
      </p>
    </div>
  `;

  showModal({
    title: 'Schedule Management',
    content: wrap,
    size: 'sm',
    actions: [
      { label: t('common.cancel'), class: 'btn btn-ghost' },
      {
        label: 'Toggle State',
        class: 'btn btn-primary',
        onClick: async () => {
          const date = wrap.querySelector('[name="date"]')?.value;
          if (!date || !parseYmd(date)) return;
          const raw = (await getAppState(APP_STATE_KEYS.offDays)) || [];
          const set = new Set(Array.isArray(raw) ? raw.filter((d) => typeof d === 'string') : []);
          if (set.has(date)) set.delete(date);
          else set.add(date);
          await setAppState(APP_STATE_KEYS.offDays, [...set].sort());
          await renderScheduleModule(root, {});
        }
      }
    ]
  });
}

/**
 * @param {HTMLElement} root
 * @param {Record<string, unknown>} [ctx]
 */
export async function renderScheduleModule(root, ctx = {}) {
  // The browsed month is kept on `root` so prev/next navigation and re-renders triggered by
  // filter changes don't snap back to the current month (see loadScheduleModel's doc comment
  // for why "now" itself is never affected by this).
  const monthDate = root._scheduleMonth instanceof Date ? root._scheduleMonth : new Date();
  const model = await loadScheduleModel(monthDate);
  const monthLabel = model.monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  root.innerHTML = `
    <section class="schedule-view">
      <header class="card card-raised schedule-header">
        <div class="schedule-header-text">
          <h1>${esc(t('schedule.title'))}</h1>
          <p>${esc(t('schedule.subtitle'))}</p>
        </div>
      </header>

      <div class="schedule-main-layout">
        <section class="schedule-main-content">
          <article class="card">
            <div class="schedule-card-header">
              <h2 class="schedule-card-title">${esc(t('schedule.monthView'))}</h2>
              <div class="schedule-month-nav">
                <button type="button" class="btn btn-ghost btn-sm" data-action="prev-month" aria-label="Previous month">${getIcon('chevron-left', 16)}</button>
                <span class="schedule-month-label">${esc(monthLabel)}</span>
                <button type="button" class="btn btn-ghost btn-sm" data-action="next-month" aria-label="Next month">${getIcon('chevron-right', 16)}</button>
              </div>
            </div>
            <div class="schedule-month-grid">${renderMonthGrid(model)}</div>
          </article>
        </section>

        <aside class="schedule-side-content">
          <article class="card">
            <div class="schedule-card-header">
              <h2 class="schedule-card-title">${getIcon('plus', 20)} ${esc(t('schedule.planningMode'))}</h2>
            </div>
            <p class="schedule-planning-copy">Mark days off or plan upcoming shifts.</p>
            <div class="schedule-actions">
              <button type="button" class="btn btn-secondary btn-sm" data-action="add-plan">
                ${getIcon('plus', 16)} Add plan
              </button>
              <button type="button" class="btn btn-ghost btn-sm" data-action="mark-off-day">
                ${getIcon('calendar', 16)} Toggle off-day
              </button>
            </div>
          </article>

          ${renderStats(model)}
        </aside>
      </div>
    </section>
  `;

  const onClick = (e) => {
    const target = e.target;
    if (!target) return;

    const actionEl = target.closest('[data-action]');
    if (actionEl) {
      const action = actionEl.getAttribute('data-action');
      if (action === 'add-plan') handleAddPlan(root, model);
      if (action === 'mark-off-day') handleMarkOffDay(root);
      if (action === 'prev-month') {
        root._scheduleMonth = new Date(model.monthStart.getFullYear(), model.monthStart.getMonth() - 1, 1);
        renderScheduleModule(root, ctx);
      }
      if (action === 'next-month') {
        root._scheduleMonth = new Date(model.monthStart.getFullYear(), model.monthStart.getMonth() + 1, 1);
        renderScheduleModule(root, ctx);
      }
      return;
    }

    const cell = target.closest('.schedule-month-cell.is-clickable');
    if (cell && cell.dataset.date) {
      showDayDetailModal(cell.dataset.date, model, root);
    }
  };

  root.addEventListener('click', onClick);

  const onPlatform = () => renderScheduleModule(root, ctx);
  const offPlatform = bus.on(PLATFORM_CHANGED, onPlatform);
  const offVehicle = bus.on(VEHICLE_FILTER_CHANGED, onPlatform);

  // Teardown to avoid multiple listeners on re-render, AND to stop the PLATFORM_CHANGED
  // listener above from leaking after the user navigates away. Without the NAVIGATION
  // self-clean below, that leaked listener re-rendered the schedule into whatever view
  // shared this root — e.g. swiping the platform switcher on the Goals page redrew Schedule.
  let offNav = null;
  const prevTeardown = root._scheduleTeardown;
  if (typeof prevTeardown === 'function') prevTeardown();
  root._scheduleTeardown = () => {
    root.removeEventListener('click', onClick);
    offPlatform();
    offVehicle();
    if (offNav) {
      offNav();
      offNav = null;
    }
  };

  // Self-clean when navigating to a non-schedule route (mirrors expenses/notifications views).
  // Runs the CURRENT `_scheduleTeardown`, so it stays correct across self re-renders.
  offNav = bus.on(NAVIGATION, (payload) => {
    const h =
      payload && typeof payload === 'object' && payload && 'hash' in payload
        ? String(/** @type {{ hash?: string }} */ (payload).hash)
        : '';
    if (h === '#/schedule' || h.startsWith('#/schedule/')) return;
    const teardown = root._scheduleTeardown;
    if (typeof teardown === 'function') {
      root._scheduleTeardown = null;
      teardown();
    }
  });

  if (ctx && /** @type {{ fabQuickSchedule?: boolean }} */ (ctx).fabQuickSchedule) {
    queueMicrotask(() => {
      stripFabQueryFromHash();
      const btn = root.querySelector('[data-action="add-plan"]');
      btn?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      btn?.focus({ preventScroll: true });
    });
  }
}
