import { db, getAppState, setAppState } from '../../core/db.js';
import { store } from '../../core/store.js';
import { bus, PLATFORM_CHANGED, VEHICLE_FILTER_CHANGED, NAVIGATION } from '../../core/events.js';
import { formatCurrency } from '../../utils/formatters.js';
import { t } from '../../utils/strings.js';
import { showModal } from '../../ui/components.js';
import { getIcon } from '../../ui/icons.js';

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

function shiftStartDateTime(shift) {
  if (typeof shift.startTime === 'number' && Number.isFinite(shift.startTime)) return new Date(shift.startTime);
  const date = typeof shift.date === 'string' ? shift.date : null;
  const start = typeof shift.startTime === 'string' ? shift.startTime : '00:00';
  if (!date) return null;
  const dt = new Date(`${date}T${start}:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function shiftEndDateTime(shift) {
  if (typeof shift.endTime === 'number' && Number.isFinite(shift.endTime)) return new Date(shift.endTime);
  const date = typeof shift.date === 'string' ? shift.date : null;
  if (!date) return null;
  const start = typeof shift.startTime === 'string' ? shift.startTime : '00:00';
  const end = typeof shift.endTime === 'string' ? shift.endTime : null;
  const minutes = minutesFromShift(shift);
  if (end) {
    const dt = new Date(`${date}T${end}:00`);
    if (!Number.isNaN(dt.getTime())) return dt;
  }
  const s = new Date(`${date}T${start}:00`);
  if (Number.isNaN(s.getTime())) return null;
  s.setMinutes(s.getMinutes() + Math.max(0, minutes));
  return s;
}

function isNightShift(shift) {
  if (typeof shift.startTime === 'number' && typeof shift.endTime === 'number') {
    const startHour = new Date(shift.startTime).getHours();
    const endHour = new Date(shift.endTime).getHours();
    if (startHour >= 22) return true;
    if (endHour <= 5) return true;
    return false;
  }
  const start = typeof shift.startTime === 'string' ? shift.startTime : '';
  const end = typeof shift.endTime === 'string' ? shift.endTime : '';
  const startHour = Number(start.slice(0, 2));
  const endHour = Number(end.slice(0, 2));
  if (Number.isFinite(startHour) && startHour >= 22) return true;
  if (Number.isFinite(endHour) && endHour <= 5) return true;
  if (start && end) {
    const date = typeof shift.date === 'string' ? shift.date : '';
    const s = new Date(`${date}T${start}:00`);
    const e = new Date(`${date}T${end}:00`);
    if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && e.getTime() < s.getTime()) return true;
  }
  return false;
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

async function loadScheduleModel(referenceDate = new Date()) {
  const user = store.get('user');
  const weekStartDay = num(user?.locale?.weekStartDay, 0);
  const currency = user?.locale?.currency || 'USD';
  const localeCountry = user?.locale?.country || 'US';
  const weekStartDate = weekStart(referenceDate, weekStartDay);
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 6);
  const monthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const monthEnd = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
  const activePlatformId = String(store.get('activePlatformId') || 'all');
  const activeVehicleId = String(store.get('activeVehicleId') || 'all');
  const [weekRowsRaw, monthRowsRaw, allRowsRaw, state] = await Promise.all([
    db.shifts.where('date').between(ymd(weekStartDate), ymd(weekEndDate), true, true).filter((s) => s.deletedAt == null).toArray(),
    listShiftsForMonth(referenceDate.getFullYear(), referenceDate.getMonth()),
    db.shifts.filter((s) => s.deletedAt == null).toArray(),
    getScheduleState(),
  ]);

  const filterFn = (s) =>
    (activePlatformId === 'all' || String(s.platformId) === activePlatformId) &&
    (activeVehicleId === 'all' || String(s.vehicleId) === activeVehicleId);
  const weekRows = weekRowsRaw.filter(filterFn);
  const monthRows = monthRowsRaw.filter(filterFn);
  const allRows = allRowsRaw.filter(filterFn);
  const planning = state.planning.filter(filterFn);

  const weekTotals = new Map();
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(weekStartDate);
    d.setDate(d.getDate() + i);
    weekTotals.set(ymd(d), { date: ymd(d), gross: 0, minutes: 0, shifts: [], plan: [] });
  }
  for (const shift of weekRows) {
    const key = String(shift.date || '');
    if (!weekTotals.has(key)) continue;
    const cell = weekTotals.get(key);
    cell.gross += grossFromShift(shift);
    cell.minutes += minutesFromShift(shift);
    cell.shifts.push(shift);
  }
  for (const plan of planning) {
    if (!weekTotals.has(plan.date)) continue;
    weekTotals.get(plan.date).plan.push(plan);
  }

  const monthByDate = new Map();
  for (const shift of monthRows) {
    const key = String(shift.date || '');
    if (!monthByDate.has(key)) monthByDate.set(key, { gross: 0, platforms: new Set() });
    const slot = monthByDate.get(key);
    slot.gross += grossFromShift(shift);
    slot.platforms.add(String(shift.platformId || 'other'));
  }

  const weekMinutes = [...weekTotals.values()].reduce((sum, day) => sum + day.minutes, 0);
  const weekHours = weekMinutes / 60;
  const weekGross = [...weekTotals.values()].reduce((sum, day) => sum + day.gross, 0);
  const weekGoal = num(store.get('currentWeekGoal'));
  const avgHourly = weekMinutes > 0 ? weekGross / (weekMinutes / 60) : 0;
  const optimalHours = weekGoal > 0 && avgHourly > 0 ? weekGoal / avgHourly : 0;
  const remainingHours = Math.max(0, optimalHours - weekHours);

  const scatter = monthRows
    .map((shift) => {
      const hours = minutesFromShift(shift) / 60;
      const gross = grossFromShift(shift);
      return { hours, gross, rate: hours > 0 ? gross / hours : 0, date: shift.date };
    })
    .filter((row) => row.hours > 0 && row.gross >= 0);

  const hourlyBuckets = new Array(24).fill(0);
  for (const shift of allRows) {
    // Fix 1 (interop plan) — allRows are real db.shifts rows; startTime is epoch ms now.
    if (typeof shift.startTime !== 'number' || !Number.isFinite(shift.startTime)) continue;
    const start = new Date(shift.startTime).getHours();
    hourlyBuckets[start] += grossFromShift(shift);
  }
  const peakThreshold = [...hourlyBuckets].sort((a, b) => b - a)[Math.max(0, Math.floor(hourlyBuckets.length * 0.2) - 1)] || 0;

  const sortedByStart = [...allRows]
    .map((shift) => ({ shift, start: shiftStartDateTime(shift), end: shiftEndDateTime(shift) }))
    .filter((row) => row.start && row.end)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const restGaps = [];
  for (let i = 1; i < sortedByStart.length; i += 1) {
    const prev = sortedByStart[i - 1];
    const curr = sortedByStart[i];
    const gap = curr.start.getTime() - prev.end.getTime();
    if (gap >= 0) {
      restGaps.push({
        before: ymd(prev.start),
        after: ymd(curr.start),
        hours: gap / 3600000,
      });
    }
  }
  const shortRests = restGaps.filter((g) => g.hours < 8);
  const minRest = restGaps.length ? Math.min(...restGaps.map((g) => g.hours)) : 0;

  return {
    now: referenceDate,
    user,
    currency,
    localeCountry,
    weekStartDay,
    weekStartDate,
    monthStart,
    monthEnd,
    weekTotals,
    monthByDate,
    offDays: state.offDays,
    planning,
    weekHours,
    weekGross,
    weekGoal,
    optimalHours,
    remainingHours,
    scatter,
    hourlyBuckets,
    peakThreshold,
    restGaps,
    shortRests,
    minRest,
  };
}

function renderWeekGrid(model) {
  const days = [];
  for (let i = 0; i < 7; i += 1) {
    const day = new Date(model.weekStartDate);
    day.setDate(day.getDate() + i);
    const key = ymd(day);
    const bucket = model.weekTotals.get(key) || { gross: 0, minutes: 0, shifts: [], plan: [] };
    const hours = bucket.minutes / 60;
    const hasData = bucket.shifts.length > 0 || bucket.plan.length > 0;
    
    const isToday = key === ymd(model.now);
    const hoursLeft = Math.max(0, 24 - model.now.getHours() - (model.now.getMinutes() / 60));
    const hoursDisplay = isToday ? `${hoursLeft.toFixed(1)}h left` : `${hours.toFixed(1)}h`;

    days.push(`
      <article class="schedule-week-cell ${isToday ? 'is-today' : ''} ${model.offDays.has(key) ? 'is-off-day' : ''} ${hasData ? 'is-clickable' : ''}" data-date="${esc(key)}">
        <header>
          <strong>${esc(dayName(day.getDay()))}</strong>
          <span>${esc(day.getDate())}</span>
        </header>
        <div class="schedule-shift-blocks">
          ${bucket.shifts
            .map((shift) => {
              const st = fmtHm(shift.startTime);
              const et = fmtHm(shift.endTime);
              const night = isNightShift(shift);
              return `<span class="schedule-shift-chip ${night ? 'is-night' : ''}" title="${esc(`${st}-${et}`)}">${esc(st)}-${esc(et)}${night ? ' 🌙' : ''}</span>`;
            })
            .join('')}
          ${bucket.plan
            .map(
              (shift) =>
                `<span class="schedule-shift-chip is-plan" title="Planned">${esc(shift.startTime || '--:--')}-${esc(shift.endTime || '--:--')} · plan</span>`,
            )
            .join('')}
        </div>
        <footer>
          <span>${esc(formatCurrency(bucket.gross, model.localeCountry, { currency: model.currency }))}</span>
          <span>${esc(hoursDisplay)}</span>
        </footer>
      </article>
    `);
  }
  return days.join('');
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
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
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
  const peakHours = model.hourlyBuckets
    .map((value, hour) => ({ value, hour }))
    .filter((row) => row.value >= model.peakThreshold && row.value > 0)
    .map((row) => `${String(row.hour).padStart(2, '0')}:00`)
    .slice(0, 6);
  const bestRate = model.scatter.length ? Math.max(...model.scatter.map((p) => p.rate)) : 0;
  const worstRate = model.scatter.length ? Math.min(...model.scatter.map((p) => p.rate)) : 0;
  return `
    <section class="schedule-metrics card">
      <div class="card-header" style="padding:0; margin-bottom: var(--space-4);">
        <h2 style="font-size: var(--text-lg); font-weight: 800; display: flex; align-items: center; gap: var(--space-2);">
          ${getIcon('rollingTrend', 20)} Hours Tracker
        </h2>
      </div>
      <div class="schedule-hours-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${esc(weekPct.toFixed(0))}">
        <span style="width:${esc(weekPct.toFixed(2))}%"></span>
      </div>
      <div style="display: grid; gap: var(--space-2); margin-top: var(--space-2);">
        <p>${esc(model.weekHours.toFixed(1))}h logged this week${model.optimalHours > 0 ? ` · target pace ${esc(model.optimalHours.toFixed(1))}h` : ''}</p>
        <p>${model.remainingHours > 0 ? `${esc(model.remainingHours.toFixed(1))}h remaining to hit weekly goal pace` : 'Goal pace reached for this week'}</p>
        <p>Efficiency spread: best ${esc(formatCurrency(bestRate, model.localeCountry, { currency: model.currency }))}/h · lowest ${esc(formatCurrency(worstRate, model.localeCountry, { currency: model.currency }))}/h</p>
        <p>Peak earning hours: ${peakHours.length ? esc(peakHours.join(', ')) : 'Not enough history yet'}</p>
        <p>Rest tracker: minimum gap ${esc(model.minRest.toFixed(1))}h · short gaps (&lt;8h): ${esc(model.shortRests.length)}</p>
      </div>
    </section>
  `;
}

function renderScatter(model) {
  if (model.scatter.length === 0) {
    return '<p class="schedule-empty">No shifts in this month yet.</p>';
  }

  const maxHours = Math.max(...model.scatter.map((p) => p.hours), 1);
  const maxGross = Math.max(...model.scatter.map((p) => p.gross), 1);

  // Linear regression for trend line
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  const n = model.scatter.length;
  model.scatter.forEach(p => {
    sumX += p.hours;
    sumY += p.gross;
    sumXY += p.hours * p.gross;
    sumXX += p.hours * p.hours;
  });
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
  const intercept = (sumY - slope * sumX) / n;

  const trendX1 = 0;
  const trendY1 = 100 - ((intercept / maxGross) * 100);
  const trendX2 = 100;
  const trendY2 = 100 - (((slope * maxHours + intercept) / maxGross) * 100);

  return `
    <div class="schedule-scatter-container">
      <div class="schedule-scatter-axis-y">
        <span>${esc(formatCurrency(maxGross, model.localeCountry, { currency: model.currency }))}</span>
        <span>${esc(formatCurrency(maxGross / 2, model.localeCountry, { currency: model.currency }))}</span>
        <span>0</span>
      </div>
      
      <div class="schedule-scatter-wrapper">
        <div class="schedule-scatter">
          <svg class="schedule-scatter-trend" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1="${trendX1}" y1="${trendY1}" x2="${trendX2}" y2="${trendY2}" stroke="var(--color-brand)" stroke-width="0.5" stroke-dasharray="2,2" opacity="0.5" />
          </svg>
          ${model.scatter
            .map((point) => {
              const x = (point.hours / maxHours) * 100;
              const y = 100 - (point.gross / maxGross) * 100;
              return `<span class="schedule-point" style="left:${esc(x.toFixed(2))}%;top:${esc(y.toFixed(2))}%;" 
                        data-date="${esc(point.date)}" 
                        data-hours="${point.hours}" 
                        data-gross="${point.gross}" 
                        data-rate="${point.rate}"></span>`;
            })
            .join('')}
        </div>
        <div class="schedule-scatter-axis-x">
          <span>0h</span>
          <span>${esc((maxHours / 2).toFixed(1))}h</span>
          <span>${esc(maxHours.toFixed(1))}h</span>
        </div>
      </div>
    </div>
  `;
}

function render24hTimeline(dayShifts, dayPlans) {
  const renderRow = (rowStart, rowEnd, label) => {
    const hours = Array.from({ length: 12 }, (_, i) => rowStart + i);
    // Fix 1 (interop plan) — real shift rows' startTime/endTime are epoch-ms timestamps now;
    // planning rows (dayPlans) are still HH:mm-of-day strings (a separate, unsynced concept —
    // see the module-level note above `minutesFromShift`). Handle both shapes.
    const getH = (t) => {
      if (typeof t === 'number' && Number.isFinite(t)) {
        const d = new Date(t);
        return d.getHours() + d.getMinutes() / 60;
      }
      if (!t || typeof t !== 'string' || !t.includes(':')) return null;
      const [h, m] = t.split(':').map(Number);
      return Number.isFinite(h) ? h + (Number.isFinite(m) ? m / 60 : 0) : null;
    };

    const shiftsInRow = dayShifts.map(s => {
      const sH = getH(s.startTime);
      const eH = getH(s.endTime);
      if (sH === null || eH === null) return '';
      if (eH <= rowStart || sH >= rowEnd) return '';
      const bStart = Math.max(rowStart, sH);
      const bEnd = Math.min(rowEnd, eH);
      const left = ((bStart - rowStart) / 12) * 100;
      const width = ((bEnd - bStart) / 12) * 100;
      return `<div class="day-timeline-block is-shift is-clickable" data-shift-id="${esc(s.id)}" style="left:${left}%; width:${Math.max(1, width)}%;" title="${esc(`${s.platformId}: ${fmtHm(s.startTime)}-${fmtHm(s.endTime)}`)}"></div>`;
    }).join('');

    const plansInRow = dayPlans.map(p => {
      const sH = getH(p.startTime);
      const eH = getH(p.endTime);
      if (sH === null || eH === null) return '';
      if (eH <= rowStart || sH >= rowEnd) return '';
      const bStart = Math.max(rowStart, sH);
      const bEnd = Math.min(rowEnd, eH);
      const left = ((bStart - rowStart) / 12) * 100;
      const width = ((bEnd - bStart) / 12) * 100;
      return `<div class="day-timeline-block is-plan" style="left:${left}%; width:${Math.max(1, width)}%;" title="Planned: ${p.startTime}-${p.endTime}"></div>`;
    }).join('');

    return `
      <div class="day-timeline-row">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
           <span style="font-size: 10px; font-weight: 800; color: var(--color-text-muted);">${label}</span>
        </div>
        <div class="day-timeline-ruler">
          ${hours.map(h => `<span>${String(h).padStart(2, '0')}</span>`).join('')}
        </div>
        <div class="day-timeline-track">
          ${shiftsInRow}
          ${plansInRow}
        </div>
      </div>
    `;
  };

  return `
    <div class="day-timeline-container">
      ${renderRow(0, 12, 'AM (00-12)')}
      ${renderRow(12, 24, 'PM (12-00)')}
    </div>
  `;
}

async function showDayDetailModal(dateStr, model, root) {
  const date = parseYmd(dateStr);
  if (!date) return;
  
  const activePlatformId = String(store.get('activePlatformId') || 'all');
  const activeVehicleId = String(store.get('activeVehicleId') || 'all');
  const dayShifts = (await db.shifts.where('date').equals(dateStr).toArray())
    .filter(s => s.deletedAt == null)
    .filter(s => activePlatformId === 'all' || String(s.platformId) === activePlatformId)
    .filter(s => activeVehicleId === 'all' || String(s.vehicleId) === activeVehicleId);
  const dayPlans = (model.planning || []).filter(p => p.date === dateStr);
  const totalGross = dayShifts.reduce((sum, s) => sum + grossFromShift(s), 0);
  
  const content = document.createElement('div');
  content.className = 'day-detail-modal';
  content.innerHTML = `
    <div class="day-detail-summary">
      <div class="metric-card">
        <strong>${esc(formatCurrency(totalGross, model.localeCountry, { currency: model.currency }))}</strong>
        <span>Gross Earnings</span>
      </div>
      <div class="metric-card">
        <strong>${esc(dayShifts.length)}</strong>
        <span>Shifts Logged</span>
      </div>
    </div>
    
    <h3 class="day-detail-title">24-Hour Timeline</h3>
    ${render24hTimeline(dayShifts, dayPlans)}
    
    <h3 class="day-detail-title">Shift Details</h3>
    <div class="day-detail-list">
      ${dayShifts.length === 0 && dayPlans.length === 0 ? '<p class="schedule-empty">No activity scheduled for this day.</p>' : ''}
      ${dayShifts.map(s => {
        const durationHrs = (s.activeMinutes || s.onlineMinutes || minutesFromShift(s)) / 60;
        const hourlyRate = durationHrs > 0 ? grossFromShift(s) / durationHrs : 0;
        const fmtRate = formatCurrency(hourlyRate, model.localeCountry, { currency: model.currency });
        const basePay = num(s.grossRevenue) - num(s.tipsRevenue) - (Number(s.bonusAmount) || 0);
        
        return `
          <div class="day-detail-row is-clickable" data-shift-id="${esc(s.id)}">
            <span class="badge" data-platform-id="${esc(s.platformId)}">${esc(s.platformId)}</span>
            <span class="time">${esc(fmtHm(s.startTime))} - ${esc(fmtHm(s.endTime))}</span>
            <span class="earn">${esc(formatCurrency(grossFromShift(s), model.localeCountry, { currency: model.currency }))}</span>
          </div>
          <div class="day-shift-overview" id="overview-${esc(s.id)}">
            <div class="sch-overview-grid">
              <div class="sch-overview-cell">
                <span class="sch-overview-lbl">Hourly Rate</span>
                <span class="sch-overview-val" style="color: var(--color-brand); font-weight:800;">${esc(fmtRate)}/h</span>
              </div>
              <div class="sch-overview-cell">
                <span class="sch-overview-lbl">Base Pay</span>
                <span class="sch-overview-val">${esc(formatCurrency(basePay, model.localeCountry, { currency: model.currency }))}</span>
              </div>
              <div class="sch-overview-cell">
                <span class="sch-overview-lbl">Tips</span>
                <span class="sch-overview-val" style="color: var(--color-success);">${esc(formatCurrency(num(s.tipsRevenue), model.localeCountry, { currency: model.currency }))}</span>
              </div>
              <div class="sch-overview-cell">
                <span class="sch-overview-lbl">Bonus</span>
                <span class="sch-overview-val">${esc(formatCurrency(Number(s.bonusAmount) || 0, model.localeCountry, { currency: model.currency }))}</span>
              </div>
              <div class="sch-overview-cell">
                <span class="sch-overview-lbl">Deliveries</span>
                <span class="sch-overview-val">${esc(s.deliveryCount || 0)}</span>
              </div>
              <div class="sch-overview-cell">
                <span class="sch-overview-lbl">Distance</span>
                <span class="sch-overview-val">${esc(s.activeMileage || 0)} km</span>
              </div>
            </div>
            ${s.notes ? `<div class="sch-overview-notes"><strong>Notes:</strong> ${esc(s.notes)}</div>` : ''}
          </div>
        `;
      }).join('')}
      ${dayPlans.map(p => `
        <div class="day-detail-row is-plan">
          <span class="badge">PLAN</span>
          <span class="time">${esc(p.startTime)} - ${esc(p.endTime)}</span>
          <span class="earn">--</span>
        </div>
      `).join('')}
    </div>
  `;

  // Attach interactive toggle logic for shift rows and timeline blocks
  const toggleOverview = (shiftId) => {
    if (!shiftId) return;
    const row = content.querySelector(`.day-detail-row[data-shift-id="${shiftId}"]`);
    const overview = content.querySelector(`#overview-${shiftId}`);
    if (!row || !overview) return;
    
    const isExpanded = overview.classList.contains('is-expanded');
    
    // Collapse all other overviews
    content.querySelectorAll('.day-shift-overview').forEach(el => {
      el.classList.remove('is-expanded');
      el.style.maxHeight = '0';
      el.style.padding = '0';
      el.style.opacity = '0';
      el.style.borderTop = 'none';
      el.style.borderBottom = 'none';
      el.style.marginTop = '0';
    });
    content.querySelectorAll('.day-detail-row').forEach(el => {
      el.classList.remove('is-active');
    });

    if (!isExpanded) {
      overview.classList.add('is-expanded');
      row.classList.add('is-active');
      overview.style.maxHeight = '280px';
      overview.style.padding = 'var(--space-3) var(--space-4)';
      overview.style.opacity = '1';
      overview.style.borderTop = '1px solid var(--color-border)';
      overview.style.borderBottom = '1px solid var(--color-border)';
      overview.style.marginTop = '4px';
    }
  };

  content.addEventListener('click', (e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    const row = target.closest('.day-detail-row[data-shift-id]');
    if (row) {
      toggleOverview(row.getAttribute('data-shift-id'));
      return;
    }

    const block = target.closest('.day-timeline-block[data-shift-id]');
    if (block) {
      toggleOverview(block.getAttribute('data-shift-id'));
      return;
    }
  });

  showModal({
    title: `${dayName(date.getDay())}, ${date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`,
    content,
    size: 'lg',
    actions: [{ label: t('common.close'), class: 'btn btn-ghost' }]
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
  const model = await loadScheduleModel(new Date());
  root.innerHTML = `
    <section class="schedule-view">
      <header class="card card-raised schedule-header">
        <div class="schedule-header-text">
          <h1>${esc(t('schedule.title'))}</h1>
          <p>${esc(t('schedule.subtitle'))}</p>
        </div>
      </header>

      <section class="schedule-section">
        <h2 class="schedule-section-title">${esc(t('schedule.weekView'))}</h2>
        <div class="schedule-week-grid">${renderWeekGrid(model)}</div>
      </section>

      <div class="schedule-main-layout">
        <section class="schedule-main-content">
          <article class="card">
            <div class="card-header" style="padding:0; margin-bottom: var(--space-4);">
              <h2 style="font-size: var(--text-lg); font-weight: 800;">${esc(t('schedule.monthView'))}</h2>
            </div>
            <div class="schedule-month-grid">${renderMonthGrid(model)}</div>
          </article>
        </section>

        <aside class="schedule-side-content">
          <article class="card">
            <div class="card-header" style="padding:0; margin-bottom: var(--space-4);">
              <h2 style="font-size: var(--text-lg); font-weight: 800; display: flex; align-items: center; gap: var(--space-2);">
                ${getIcon('plus', 20)} ${esc(t('schedule.planningMode'))}
              </h2>
            </div>
            <p style="color: var(--color-text-secondary); font-size: var(--text-sm); margin-bottom: var(--space-4);">
              Mark days off or plan upcoming shifts.
            </p>
            <div class="schedule-actions">
              <ion-button size="small" fill="outline" data-action="add-plan">
                <span slot="start" class="schedule-action-icon" aria-hidden="true">${getIcon('plus', 16)}</span>
                Add plan
              </ion-button>
              <ion-button size="small" fill="clear" data-action="mark-off-day">
                <span slot="start" class="schedule-action-icon" aria-hidden="true">${getIcon('calendar', 16)}</span>
                Toggle off-day
              </ion-button>
            </div>
          </article>

          ${renderStats(model)}
        </aside>
      </div>

      <section class="card schedule-efficiency-section">
        <div class="card-header" style="padding:0; margin-bottom: var(--space-4);">
          <h2 style="font-size: var(--text-lg); font-weight: 800; display: flex; align-items: center; gap: var(--space-2);">
            ${getIcon('scatter', 20)} Time vs earnings efficiency
          </h2>
        </div>
        ${renderScatter(model)}
        
        <div class="sch-efficiency-guide">
          <header class="sch-guide-header">
            <h3>How to Read This Chart</h3>
          </header>
          <div class="sch-guide-grid">
            <div class="sch-guide-item">
              <div>
                <h4>Shift Efficiency (Dots)</h4>
                <p>Each green dot represents a single shift. Its position shows the relation between <strong>duration (X-axis)</strong> and <strong>earnings (Y-axis)</strong>. Hover over any dot to see exact details.</p>
              </div>
            </div>
            <div class="sch-guide-item">
              <div>
                <h4>Trend Line</h4>
                <p>The dashed line represents your baseline earning trajectory. Shifts <strong>above the line</strong> are high-value, highly-efficient shifts. Shifts <strong>below the line</strong> had lower hourly returns.</p>
              </div>
            </div>
            <div class="sch-guide-item">
              <div>
                <h4>Actionable Strategy</h4>
                <p>Identify the shifts furthest above the trendline, note their starting times and platforms, and plan future shifts to match their patterns to optimize your earnings.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </section>
  `;

  // Set up Schedule Scatter Interactive Hover States
  const scatterPoints = root.querySelectorAll('.schedule-point');
  const scatterWrap = root.querySelector('.schedule-scatter');
  if (scatterWrap && scatterPoints.length > 0) {
    // Create tooltip element dynamically if not present
    let tooltip = scatterWrap.querySelector('.sch-scatter-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.className = 'sch-scatter-tooltip';
      scatterWrap.appendChild(tooltip);
    }

    // Create horizontal and vertical laser guides dynamically if not present
    let guideX = scatterWrap.querySelector('.sch-scatter-guide-x');
    if (!guideX) {
      guideX = document.createElement('div');
      guideX.className = 'sch-scatter-guide-x';
      scatterWrap.appendChild(guideX);
    }
    let guideY = scatterWrap.querySelector('.sch-scatter-guide-y');
    if (!guideY) {
      guideY = document.createElement('div');
      guideY.className = 'sch-scatter-guide-y';
      scatterWrap.appendChild(guideY);
    }

    const showPointDetails = (target) => {
      const date = target.getAttribute('data-date') || '';
      const hours = parseFloat(target.getAttribute('data-hours') || '0');
      const gross = parseFloat(target.getAttribute('data-gross') || '0');
      const rate = parseFloat(target.getAttribute('data-rate') || '0');

      // Formatted strings
      const fmtEarn = formatCurrency(gross, model.localeCountry, { currency: model.currency });
      const fmtHrs = `${hours.toFixed(1)}h`;
      const fmtRate = formatCurrency(rate, model.localeCountry, { currency: model.currency });

      let dateHtml = '';
      if (date) {
        const dObj = new Date(`${date}T00:00:00`);
        if (!Number.isNaN(dObj.getTime())) {
          dateHtml = dObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' });
        }
      }

      // Build HTML
      tooltip.innerHTML = `
        ${dateHtml ? `<div class="sch-tooltip-header">${dateHtml}</div>` : ''}
        <div class="sch-tooltip-row">
          <span class="sch-tooltip-lbl">Earnings</span>
          <span class="sch-tooltip-val" style="color: var(--color-success, #10b981);">${fmtEarn}</span>
        </div>
        <div class="sch-tooltip-row">
          <span class="sch-tooltip-lbl">Hours</span>
          <span class="sch-tooltip-val">${fmtHrs}</span>
        </div>
        <div class="sch-tooltip-hr"></div>
        <div class="sch-tooltip-row">
          <span class="sch-tooltip-lbl">Rate</span>
          <span class="sch-tooltip-val" style="color: var(--color-brand, #3b82f6); font-weight:800;">${fmtRate}/h</span>
        </div>
      `;

      // Tooltip positioning
      const pctLeft = parseFloat(target.style.left);
      const pctTop = parseFloat(target.style.top);

      // Convert percentage coordinates to pixels based on scatter wrap size
      const wrapW = scatterWrap.clientWidth;
      const wrapH = scatterWrap.clientHeight;
      const posX = (pctLeft / 100) * wrapW;
      const posY = (pctTop / 100) * wrapH;

      // Position tooltip and clamp bounds
      const tooltipWidth = 155;
      const padding = 10;
      
      let relX = posX;
      let relY = posY;

      if (relY < 65) {
        tooltip.style.transform = 'translate(-50%, 15px)';
      } else {
        tooltip.style.transform = 'translate(-50%, -115%)';
      }

      if (relX < (tooltipWidth / 2) + padding) {
        relX = (tooltipWidth / 2) + padding;
      } else if (relX > wrapW - (tooltipWidth / 2) - padding) {
        relX = wrapW - (tooltipWidth / 2) - padding;
      }

      tooltip.style.left = `${relX}px`;
      tooltip.style.top = `${relY}px`;
      tooltip.style.opacity = '1';

      // Laser guides snap
      guideX.style.top = `${posY}px`;
      guideX.style.width = `${posX}px`;
      guideX.style.opacity = '0.35';

      guideY.style.left = `${posX}px`;
      guideY.style.top = `${posY}px`;
      guideY.style.height = `${wrapH - posY}px`;
      guideY.style.opacity = '0.35';

      // Dim other points
      scatterPoints.forEach(p => { if (p !== target) p.style.opacity = '0.15'; else p.style.opacity = '1'; });
    };

    const hidePointDetails = () => {
      tooltip.style.opacity = '0';
      guideX.style.opacity = '0';
      guideY.style.opacity = '0';
      scatterPoints.forEach(p => { p.style.opacity = '1'; });
    };

    scatterPoints.forEach(point => {
      // Hover behaviors for desktop mouse
      point.addEventListener('mouseenter', (e) => {
        showPointDetails(/** @type {HTMLElement} */ (e.target));
      });
      point.addEventListener('mouseleave', () => {
        hidePointDetails();
      });

      // Click/Tap behavior for touch screens and hybrid devices
      point.addEventListener('click', (e) => {
        e.stopPropagation();
        showPointDetails(/** @type {HTMLElement} */ (e.target));
      });
    });

    // Dismiss tooltip on tapping anywhere else on the document
    const onDocClick = (e) => {
      if (e.target && !/** @type {HTMLElement} */ (e.target).closest('.schedule-point') && !/** @type {HTMLElement} */ (e.target).closest('.sch-scatter-tooltip')) {
        hidePointDetails();
      }
    };
    document.addEventListener('click', onDocClick);

    // Keep track of document click listener for proper cleanup
    root._scheduleDocClick = onDocClick;
  }

  const onClick = (e) => {
    const target = e.target;
    if (!target) return;
    
    const actionEl = target.closest('[data-action]');
    if (actionEl) {
      const action = actionEl.getAttribute('data-action');
      if (action === 'add-plan') handleAddPlan(root, model);
      if (action === 'mark-off-day') handleMarkOffDay(root);
      return;
    }

    const cell = target.closest('.schedule-week-cell.is-clickable, .schedule-month-cell.is-clickable');
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
    if (root._scheduleDocClick) {
      document.removeEventListener('click', root._scheduleDocClick);
      root._scheduleDocClick = null;
    }
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
