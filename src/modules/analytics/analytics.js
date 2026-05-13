import { db, getAppState } from '../../core/db.js';
import { MetricRegistry, getMetricValue } from '../../registry/metrics/index.js';
import { formatCurrency, formatLargeNumber } from '../../utils/formatters.js';
import {
  calcBonusDependencyRatio,
  calcEarningsPerKm,
  calcEarningsPerOrder,
  calcHourlyRate,
  calcLinearRegression,
  calcNetHourlyRate,
  calcPersonalRecords,
  calcTipRate,
  projectWeekEarnings,
} from '../../utils/calculations.js';
import { getOutOfPocketExpensesForPeriod, getTotalExpensesForPeriod } from '../expenses/expenses.js';
import { platformAnalyticsEnabled } from '../../registry/platforms/terminology.js';

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Shift gross stored as integer cents (plan v3). */
function grossCents(shift) {
  return num(shift.grossEarnings ?? shift.gross);
}

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfWeek(now = new Date(), weekStartDay = 0) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const delta = (d.getDay() - weekStartDay + 7) % 7;
  d.setDate(d.getDate() - delta);
  return d;
}

function endOfWeek(now = new Date(), weekStartDay = 0) {
  const s = startOfWeek(now, weekStartDay);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  return e;
}

function monthRange(month, year) {
  const s = new Date(year, month - 1, 1);
  const e = new Date(year, month, 0);
  return { start: ymd(s), end: ymd(e) };
}

function yearRange(year) {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

async function listShiftsBetween(startDate, endDate) {
  return db.shifts
    .where('date')
    .between(startDate, endDate, true, true)
    .filter((row) => row.deletedAt == null)
    .toArray();
}

/**
 * Same rule as shifts list / header switcher: `'all'` keeps every shift; otherwise `platformId` must match.
 * @template T
 * @param {T[]} shifts
 * @param {string} [activePlatformId='all']
 * @returns {T[]}
 */
function filterShiftsByActivePlatform(shifts, activePlatformId = 'all') {
  const pid = String(activePlatformId ?? 'all');
  if (pid === 'all') return shifts;
  return shifts.filter((s) => String(/** @type {{ platformId?: unknown }} */ (s).platformId ?? '') === pid);
}

/**
 * Streak for dashboard: app-wide when filter is `all`; otherwise consecutive calendar days
 * with at least one shift on that platform (most recent work day backward until a gap).
 * @param {string} [activePlatformId='all']
 * @returns {Promise<number>}
 */
export async function getStreakCountForActiveFilter(activePlatformId = 'all') {
  const pid = String(activePlatformId ?? 'all');
  if (pid === 'all') {
    const raw = await getAppState('streak_count');
    return Number(raw) || 0;
  }
  const rows = filterShiftsByActivePlatform(
    await db.shifts.filter((s) => s.deletedAt == null).toArray(),
    pid,
  );
  const dates = [...new Set(rows.map((s) => String(s.date || '')).filter(Boolean))].sort((a, b) =>
    b.localeCompare(a),
  );
  if (dates.length === 0) return 0;
  let streak = 1;
  for (let i = 1; i < dates.length; i += 1) {
    const newer = dates[i - 1];
    const older = dates[i];
    const dNew = new Date(`${newer}T12:00:00`);
    const dOld = new Date(`${older}T12:00:00`);
    const diff = Math.round((dNew.getTime() - dOld.getTime()) / 86400000);
    if (diff === 1) streak += 1;
    else break;
  }
  return streak;
}

function getDurationMinutes(shift) {
  return num(shift.durationMinutes || shift.activeMinutes || shift.onlineMinutes);
}

function parseDate(dateStr) {
  const d = new Date(`${String(dateStr || '')}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthKeyFromDateStr(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function median(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function quarterBuckets(values) {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return { q1: 0, q2: 0, q3: 0 };
  const at = (p) => {
    const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p)));
    return sorted[idx];
  };
  return { q1: at(0.25), q2: at(0.5), q3: at(0.75) };
}

function shiftStartHour(shift) {
  const startTime = String(shift.startTime || '');
  const hour = Number(startTime.slice(0, 2));
  if (Number.isFinite(hour) && hour >= 0 && hour <= 23) return hour;
  return null;
}

function dayPartForHour(hour) {
  if (!Number.isFinite(hour)) return null;
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 16) return 'midday';
  if (hour >= 16 && hour < 21) return 'evening';
  return 'night';
}

function mean(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const nums = values.filter((v) => Number.isFinite(v));
  if (nums.length === 0) return 0;
  const total = nums.reduce((sum, v) => sum + v, 0);
  return total / nums.length;
}

function stdDev(values, avg = mean(values)) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const nums = values.filter((v) => Number.isFinite(v));
  if (nums.length < 2) return 0;
  const variance = nums.reduce((sum, v) => sum + (v - avg) ** 2, 0) / nums.length;
  return Math.sqrt(variance);
}

async function hydrateDerived(shifts) {
  if (!Array.isArray(shifts) || shifts.length === 0) return [];
  return Promise.all(
    shifts.map(async (shift) => {
      const gc = grossCents(shift);
      const gross = gc / 100;
      const durationMinutes = getDurationMinutes(shift);
      const tips = num(shift.tips) / 100;
      const bonus = num(shift.bonusEarnings ?? shift.bonus) / 100;
      const orders = num(shift.deliveryCount ?? shift.orders);
      const distanceKm = num(shift.distanceKm);
      const expenseCents = await getTotalExpensesForPeriod(shift.date, shift.date, shift.platformId || undefined);
      const expense = expenseCents / 100;
      return {
        ...shift,
        gross,
        durationMinutes,
        tips,
        bonus,
        orders,
        distanceKm,
        hourlyRate: calcHourlyRate(gross, durationMinutes),
        netHourlyRate: calcNetHourlyRate(gross, expense, durationMinutes),
        earningsPerOrder: calcEarningsPerOrder(gross, orders),
        tipRate: calcTipRate(tips, gross),
        bonusDependencyRatio: calcBonusDependencyRatio(bonus, gross),
      };
    }),
  );
}

function aggregateSummary(rows) {
  let gross = 0;
  let tips = 0;
  let bonus = 0;
  let orders = 0;
  let minutes = 0;
  let distanceKm = 0;
  for (const row of rows) {
    gross += num(row.gross);
    tips += num(row.tips);
    bonus += num(row.bonus);
    orders += num(row.orders);
    minutes += num(row.durationMinutes);
    distanceKm += num(row.distanceKm);
  }
  const hourlyRate = calcHourlyRate(gross, minutes);
  const tipRate = calcTipRate(tips, gross);
  const bonusRatio = calcBonusDependencyRatio(bonus, gross);
  return {
    count: rows.length,
    gross,
    tips,
    bonus,
    orders,
    minutes,
    distanceKm,
    hourlyRate,
    tipRate,
    bonusRatio,
    earningsPerKm: calcEarningsPerKm(gross, distanceKm),
  };
}

/**
 * Fast totals from raw shifts (no per-shift expense DB lookups).
 * @param {Record<string, unknown>[]} shifts
 */
function aggregateShiftsLight(shifts) {
  let gross = 0;
  let tips = 0;
  let bonus = 0;
  let orders = 0;
  let minutes = 0;
  for (const s of shifts) {
    gross += grossCents(s) / 100;
    tips += num(s.tips) / 100;
    bonus += num(s.bonusEarnings ?? s.bonus) / 100;
    orders += num(s.deliveryCount ?? s.orders);
    minutes += getDurationMinutes(s);
  }
  const hourlyRate = calcHourlyRate(gross, minutes);
  return {
    count: shifts.length,
    gross,
    tips,
    bonus,
    orders,
    minutes,
    hourlyRate,
  };
}

/** @param {string} dateStr @param {number} deltaDays @returns {string} */
function addDaysToYmd(dateStr, deltaDays) {
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + deltaDays);
  return ymd(d);
}

/** @param {string} dateStr @param {number} weekStartDay 0=Sun … 6=Sat @returns {string} */
function startOfWeekForYmd(dateStr, weekStartDay) {
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  const delta = (d.getDay() - weekStartDay + 7) % 7;
  d.setDate(d.getDate() - delta);
  return ymd(d);
}

/** @param {string} a @param {string} b */
function ymdMax(a, b) {
  return String(a) >= String(b) ? String(a) : String(b);
}

/** @param {string} a @param {string} b */
function ymdMin(a, b) {
  return String(a) <= String(b) ? String(a) : String(b);
}

/**
 * Financial KPIs for a date range, scoped by platform switcher (`activePlatformId`).
 * @param {string} startDate YYYY-MM-DD
 * @param {string} endDate YYYY-MM-DD
 * @param {string} [activePlatformId='all']
 * @param {number} [weekStartDay=0] matches `user.locale.weekStartDay`
 */
export async function getFinancialOverviewForRange(startDate, endDate, activePlatformId = 'all', weekStartDay = 0) {
  const empty = {
    count: 0,
    gross: 0,
    tips: 0,
    bonus: 0,
    orders: 0,
    minutes: 0,
    hourlyRate: 0,
    expense: 0,
    outOfPocket: 0,
    netIncome: 0,
    hours: 0,
    avgRateHr: 0,
    effectivePerHr: 0,
    perDelivery: 0,
    bestWeek: /** @type {{ index: number; net: number; start: string; end: string } | null} */ (null),
    worstWeek: /** @type {{ index: number; net: number; start: string; end: string } | null} */ (null),
  };
  if (!startDate || !endDate || String(startDate) > String(endDate)) return empty;

  const shifts = filterShiftsByActivePlatform(await listShiftsBetween(startDate, endDate), activePlatformId);
  const s = aggregateShiftsLight(shifts);
  const pid = String(activePlatformId ?? 'all') === 'all' ? undefined : String(activePlatformId);
  const [expenseCents, oopCents] = await Promise.all([
    getTotalExpensesForPeriod(startDate, endDate, pid),
    getOutOfPocketExpensesForPeriod(startDate, endDate, pid),
  ]);
  const expense = expenseCents / 100;
  const outOfPocket = oopCents / 100;
  const netIncome = s.gross - expense;
  const hours = s.minutes / 60;
  const avgRateHr = s.hourlyRate;
  const effectivePerHr = hours > 0 ? netIncome / hours : 0;
  const perDelivery = calcEarningsPerOrder(s.gross, s.orders);

  let segmentStart = startDate;
  /** @type {{ index: number; net: number; start: string; end: string; gross: number }[]} */
  const weekNets = [];
  let weekIdx = 0;
  let guard = 0;
  while (segmentStart <= endDate && guard < 520) {
    guard += 1;
    const weekAnchor = startOfWeekForYmd(segmentStart, weekStartDay);
    const weekEndFromAnchor = addDaysToYmd(weekAnchor, 6);
    const effStart = ymdMax(segmentStart, weekAnchor);
    const effEnd = ymdMin(endDate, weekEndFromAnchor);
    const segShifts = filterShiftsByActivePlatform(await listShiftsBetween(effStart, effEnd), activePlatformId);
    const seg = aggregateShiftsLight(segShifts);
    const expC = await getTotalExpensesForPeriod(effStart, effEnd, pid);
    const net = seg.gross - expC / 100;
    weekIdx += 1;
    weekNets.push({ index: weekIdx, net, start: effStart, end: effEnd, gross: seg.gross });
    segmentStart = addDaysToYmd(effEnd, 1);
  }

  let best = /** @type {typeof weekNets[0] | null} */ (null);
  let worst = /** @type {typeof weekNets[0] | null} */ (null);
  for (const w of weekNets) {
    if (best == null || w.net > best.net) best = w;
    if (worst == null || w.net < worst.net) worst = w;
  }

  return {
    ...s,
    expense,
    outOfPocket,
    netIncome,
    hours,
    avgRateHr,
    effectivePerHr,
    perDelivery,
    bestWeek: best,
    worstWeek: worst,
  };
}

export async function getDailySummary(date) {
  const shifts = await listShiftsBetween(date, date);
  const rows = await hydrateDerived(shifts);
  return aggregateSummary(rows);
}

export async function getWeeklySummary(startDate) {
  const s = new Date(`${startDate}T00:00:00`);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  const shifts = await listShiftsBetween(startDate, ymd(e));
  const rows = await hydrateDerived(shifts);
  return aggregateSummary(rows);
}

/**
 * @param {number} month
 * @param {number} year
 * @param {string} [activePlatformId='all']
 */
export async function getMonthlySummary(month, year, activePlatformId = 'all') {
  const { start, end } = monthRange(month, year);
  const shifts = filterShiftsByActivePlatform(await listShiftsBetween(start, end), activePlatformId);
  const rows = await hydrateDerived(shifts);
  return aggregateSummary(rows);
}

/**
 * @param {number} year
 * @param {string} [activePlatformId='all'] from `store.get('activePlatformId')` — limits metrics to one platform
 */
export async function getAnnualSummary(year, activePlatformId = 'all') {
  const { start, end } = yearRange(year);
  const shifts = filterShiftsByActivePlatform(await listShiftsBetween(start, end), activePlatformId);
  const rows = await hydrateDerived(shifts);
  return aggregateSummary(rows);
}

/**
 * @param {string} [activePlatformId='all']
 */
export async function getRolling30DayTrend(activePlatformId = 'all') {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 29);
  const shifts = filterShiftsByActivePlatform(
    await listShiftsBetween(ymd(start), ymd(today)),
    activePlatformId,
  );
  const byDay = new Map();
  for (const s of shifts) {
    byDay.set(s.date, (byDay.get(s.date) || 0) + grossCents(s));
  }
  const points = [];
  for (let i = 0; i < 30; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const date = ymd(d);
    points.push({ x: i, y: num(byDay.get(date)) / 100 });
  }
  return { points, regression: calcLinearRegression(points) };
}

/**
 * @param {string} [activePlatformId='all']
 */
export async function getBestDayOfWeek(activePlatformId = 'all') {
  const shifts = filterShiftsByActivePlatform(
    await db.shifts.filter((s) => s.deletedAt == null).toArray(),
    activePlatformId,
  );
  const buckets = new Map();
  for (const s of shifts) {
    const d = new Date(`${s.date}T00:00:00`);
    const day = Number.isNaN(d.getTime()) ? 0 : d.getDay();
    const key = String(day);
    buckets.set(key, (buckets.get(key) || 0) + grossCents(s));
  }
  let best = { day: 0, gross: 0 };
  for (const [key, gross] of buckets.entries()) {
    if (gross > best.gross) best = { day: Number(key), gross };
  }
  return best;
}

/**
 * @param {string} [activePlatformId='all']
 */
export async function getBestTimeOfDay(activePlatformId = 'all') {
  const shifts = filterShiftsByActivePlatform(
    await db.shifts.filter((s) => s.deletedAt == null).toArray(),
    activePlatformId,
  );
  const buckets = new Map();
  for (const s of shifts) {
    const startTime = String(s.startTime || '');
    const hour = Number(startTime.slice(0, 2));
    if (!Number.isFinite(hour)) continue;
    buckets.set(hour, (buckets.get(hour) || 0) + grossCents(s));
  }
  let best = { hour: 0, gross: 0 };
  for (const [hour, gross] of buckets.entries()) {
    if (gross > best.gross) best = { hour, gross };
  }
  return best;
}

/**
 * @param {string} [activePlatformId='all']
 */
export async function getDeadMilesSummary(activePlatformId = 'all') {
  const shifts = filterShiftsByActivePlatform(
    await db.shifts.filter((s) => s.deletedAt == null).toArray(),
    activePlatformId,
  );
  let deadKm = 0;
  let businessKm = 0;
  for (const s of shifts) {
    deadKm += num(s.deadMilesKm);
    businessKm += num(s.distanceKm);
  }
  const total = deadKm + businessKm;
  const ratio = total > 0 ? deadKm / total : 0;
  return { deadKm, businessKm, ratio };
}

export async function getPlatformComparison() {
  const shifts = await db.shifts.filter((s) => s.deletedAt == null).toArray();
  const grouped = new Map();
  for (const s of shifts) {
    const id = String(s.platformId || 'other');
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id).push(s);
  }
  const out = [];
  for (const [platformId, rows] of grouped.entries()) {
    const derived = await hydrateDerived(rows);
    const sum = aggregateSummary(derived);
    out.push({
      platformId,
      ...sum,
      analyticsModules: {
        bonusTracking: platformAnalyticsEnabled(platformId, 'bonusTracking'),
        surgeAnalysis: platformAnalyticsEnabled(platformId, 'surgeAnalysis'),
        blockEarnings: platformAnalyticsEnabled(platformId, 'blockEarnings'),
        batchTracking: platformAnalyticsEnabled(platformId, 'batchTracking'),
        orderTypeTracking: platformAnalyticsEnabled(platformId, 'orderTypeTracking'),
        questTracking: platformAnalyticsEnabled(platformId, 'questTracking'),
        promotionsTracking: platformAnalyticsEnabled(platformId, 'promotionsTracking'),
      },
    });
  }
  out.sort((a, b) => b.gross - a.gross);
  return out;
}

/**
 * @param {string} [activePlatformId='all']
 */
export async function getIncomeSourceBreakdown(activePlatformId = 'all') {
  const shifts = filterShiftsByActivePlatform(
    await db.shifts.filter((s) => s.deletedAt == null).toArray(),
    activePlatformId,
  );
  let baseCents = 0;
  let tipsCents = 0;
  let bonusCents = 0;
  for (const s of shifts) {
    const g = grossCents(s);
    const t = num(s.tips);
    const b = num(s.bonusEarnings ?? s.bonus);
    tipsCents += t;
    bonusCents += b;
    baseCents += Math.max(0, g - t - b);
  }
  return { base: baseCents / 100, tips: tipsCents / 100, bonus: bonusCents / 100 };
}

export async function getPersonalRecords() {
  const shifts = await db.shifts.filter((s) => s.deletedAt == null).toArray();
  const normalized = shifts.map((s) => ({
    gross: grossCents(s) / 100,
    durationMinutes: getDurationMinutes(s),
    orders: num(s.deliveryCount ?? s.orders),
  }));
  return calcPersonalRecords(normalized);
}

/**
 * @param {number} month
 * @param {number} year
 * @param {string} [activePlatformId='all']
 */
export async function getZerodays(month, year, activePlatformId = 'all') {
  const { start, end } = monthRange(month, year);
  const shifts = filterShiftsByActivePlatform(await listShiftsBetween(start, end), activePlatformId);
  const worked = new Set(shifts.map((s) => s.date));
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  const zeroDays = [];
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const key = ymd(d);
    if (!worked.has(key)) zeroDays.push(key);
  }
  return zeroDays;
}

export async function getEarningsPerKm(startDate, endDate) {
  const shifts = await listShiftsBetween(startDate, endDate);
  const gross = shifts.reduce((sum, s) => sum + grossCents(s), 0);
  const distance = shifts.reduce((sum, s) => sum + num(s.distanceKm), 0);
  return calcEarningsPerKm(gross / 100, distance);
}

/**
 * @param {string} [activePlatformId='all']
 * @param {{ anchorDate?: Date }} [options] Use `anchorDate` instead of today for week boundaries (demo sample year).
 */
export async function getWeeklyProjection(activePlatformId = 'all', options = {}) {
  const raw = /** @type {{ anchorDate?: unknown }} */ (options).anchorDate;
  const today =
    raw instanceof Date && !Number.isNaN(/** @type {Date} */ (raw).getTime())
      ? new Date(/** @type {Date} */ (raw).getTime())
      : new Date();
  const start = startOfWeek(today, 1);
  const end = endOfWeek(today, 1);
  const shifts = filterShiftsByActivePlatform(await listShiftsBetween(ymd(start), ymd(end)), activePlatformId);
  const points = shifts.map((s) => ({
    startAt: `${s.date}T${String(s.startTime || '00:00')}:00`,
    gross: grossCents(s) / 100,
  }));
  return projectWeekEarnings(points, today);
}

/**
 * @param {number} [limit=10]
 * @param {string} [activePlatformId='all']
 */
export async function getTopEarningShifts(limit = 10, activePlatformId = 'all') {
  const rows = filterShiftsByActivePlatform(
    await db.shifts.filter((s) => s.deletedAt == null).toArray(),
    activePlatformId,
  );
  return rows
    .map((s) => ({
      id: s.id,
      date: s.date,
      platformId: s.platformId,
      gross: grossCents(s) / 100,
      durationMinutes: getDurationMinutes(s),
    }))
    .sort((a, b) => b.gross - a.gross)
    .slice(0, Math.max(1, limit));
}

/**
 * @param {number} [year]
 * @param {string} [activePlatformId='all']
 */
export async function getCumulativeYtdSeries(year = new Date().getFullYear(), activePlatformId = 'all') {
  const { start, end } = yearRange(year);
  const shifts = filterShiftsByActivePlatform(await listShiftsBetween(start, end), activePlatformId);
  const byDay = new Map();
  for (const s of shifts) {
    byDay.set(s.date, (byDay.get(s.date) || 0) + grossCents(s));
  }
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  let running = 0;
  const labels = [];
  const values = [];
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const key = ymd(d);
    running += num(byDay.get(key));
    labels.push(key);
    values.push(running / 100);
  }
  return { labels, values };
}

/**
 * @param {string} startDate
 * @param {string} endDate
 * @param {string} [activePlatformId='all']
 */
export async function getEarningsVsHoursScatter(startDate, endDate, activePlatformId = 'all') {
  const shifts = filterShiftsByActivePlatform(await listShiftsBetween(startDate, endDate), activePlatformId);
  return shifts.map((s) => ({
    x: getDurationMinutes(s) / 60,
    y: grossCents(s) / 100,
  }));
}

/**
 * @param {string} [activePlatformId='all']
 * @param {{ anchorDate?: Date }} [options] Use `anchorDate` instead of today for week boundaries (demo sample year).
 */
export async function getWeekOverWeek(activePlatformId = 'all', options = {}) {
  const raw = /** @type {{ anchorDate?: unknown }} */ (options).anchorDate;
  const now =
    raw instanceof Date && !Number.isNaN(/** @type {Date} */ (raw).getTime())
      ? new Date(/** @type {Date} */ (raw).getTime())
      : new Date();
  const thisWeekStart = startOfWeek(now, 1);
  const thisWeekEnd = endOfWeek(now, 1);
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(thisWeekEnd);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);
  const [thisWeek, lastWeek] = await Promise.all([
    listShiftsBetween(ymd(thisWeekStart), ymd(thisWeekEnd)),
    listShiftsBetween(ymd(lastWeekStart), ymd(lastWeekEnd)),
  ]);
  const tw = filterShiftsByActivePlatform(thisWeek, activePlatformId);
  const lw = filterShiftsByActivePlatform(lastWeek, activePlatformId);
  const thisGross = tw.reduce((sum, s) => sum + grossCents(s), 0);
  const lastGross = lw.reduce((sum, s) => sum + grossCents(s), 0);
  return { thisGross: thisGross / 100, lastGross: lastGross / 100, delta: (thisGross - lastGross) / 100 };
}

/**
 * @param {number} [limit=8]
 * @param {string} [activePlatformId='all']
 */
export async function getRecentActivity(limit = 8, activePlatformId = 'all') {
  const rows = filterShiftsByActivePlatform(
    await db.shifts.filter((s) => s.deletedAt == null).toArray(),
    activePlatformId,
  );
  return rows
    .sort((a, b) => String(b.updatedAt || b.date).localeCompare(String(a.updatedAt || a.date)))
    .slice(0, Math.max(1, limit))
    .map((s) => ({
      id: s.id,
      date: s.date,
      platformId: s.platformId,
      gross: grossCents(s) / 100,
      orders: num(s.deliveryCount ?? s.orders),
    }));
}

export async function getCohortFirstVsCurrentMonth() {
  const shifts = await db.shifts.filter((s) => s.deletedAt == null).toArray();
  if (shifts.length === 0) {
    return {
      firstMonth: null,
      currentMonth: null,
      firstGross: 0,
      currentGross: 0,
      change: 0,
      changePct: 0,
    };
  }
  const keys = shifts
    .map((s) => monthKeyFromDateStr(s.date))
    .filter(Boolean)
    .sort();
  if (keys.length === 0) {
    return {
      firstMonth: null,
      currentMonth: null,
      firstGross: 0,
      currentGross: 0,
      change: 0,
      changePct: 0,
    };
  }
  const firstMonth = keys[0];
  const currentMonth = keys[keys.length - 1];
  let firstGross = 0;
  let currentGross = 0;
  for (const s of shifts) {
    const k = monthKeyFromDateStr(s.date);
    const gross = grossCents(s);
    if (k === firstMonth) firstGross += gross;
    if (k === currentMonth) currentGross += gross;
  }
  const change = currentGross - firstGross;
  const changePct = firstGross > 0 ? (change / firstGross) * 100 : 0;
  return { firstMonth, currentMonth, firstGross, currentGross, change, changePct };
}

export async function getDiminishingReturnsByShiftPosition() {
  const shifts = await db.shifts.filter((s) => s.deletedAt == null).toArray();
  const byDate = new Map();
  for (const s of shifts) {
    const key = String(s.date || '');
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(s);
  }
  const buckets = new Map();
  for (const rows of byDate.values()) {
    rows.sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')));
    rows.forEach((s, idx) => {
      const position = idx + 1;
      const hourly = getDurationMinutes(s) > 0 ? calcHourlyRate(grossCents(s) / 100, getDurationMinutes(s)) : 0;
      if (!buckets.has(position)) buckets.set(position, []);
      buckets.get(position).push(hourly);
    });
  }
  const positions = [...buckets.entries()]
    .map(([position, values]) => ({ position, hourlyRate: mean(values), sampleSize: values.length }))
    .sort((a, b) => a.position - b.position);
  let diminishingAtPosition = null;
  for (let i = 1; i < positions.length; i += 1) {
    if (positions[i].hourlyRate < positions[i - 1].hourlyRate) {
      diminishingAtPosition = positions[i].position;
      break;
    }
  }
  return { positions, diminishingAtPosition };
}

export async function getDayPartAnalysisMatrix() {
  const shifts = await db.shifts.filter((s) => s.deletedAt == null).toArray();
  const dayParts = ['morning', 'midday', 'evening', 'night'];
  const dayKeys = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const matrix = {};
  for (const part of dayParts) {
    matrix[part] = Object.fromEntries(dayKeys.map((d) => [d, { gross: 0, minutes: 0, count: 0, hourlyRate: 0 }]));
  }
  for (const s of shifts) {
    const hour = shiftStartHour(s);
    const part = dayPartForHour(hour);
    if (!part) continue;
    const d = parseDate(s.date);
    if (!d) continue;
    const day = dayKeys[d.getDay()];
    const slot = matrix[part][day];
    slot.gross += grossCents(s) / 100;
    slot.minutes += getDurationMinutes(s);
    slot.count += 1;
  }
  for (const part of dayParts) {
    for (const day of dayKeys) {
      const slot = matrix[part][day];
      slot.hourlyRate = slot.minutes > 0 ? calcHourlyRate(slot.gross, slot.minutes) : 0;
    }
  }
  return { dayParts, days: dayKeys, matrix };
}

export async function getHolidayVsRegularComparison(holidays = []) {
  const holidaySet = new Set((holidays || []).map((h) => String(h)));
  const shifts = await db.shifts.filter((s) => s.deletedAt == null).toArray();
  let holidayGross = 0;
  let regularGross = 0;
  let holidayMinutes = 0;
  let regularMinutes = 0;
  let holidayCount = 0;
  let regularCount = 0;
  for (const s of shifts) {
    const gross = grossCents(s);
    const mins = getDurationMinutes(s);
    if (holidaySet.has(String(s.date))) {
      holidayGross += gross;
      holidayMinutes += mins;
      holidayCount += 1;
    } else {
      regularGross += gross;
      regularMinutes += mins;
      regularCount += 1;
    }
  }
  const holidayHourly = calcHourlyRate(holidayGross / 100, holidayMinutes);
  const regularHourly = calcHourlyRate(regularGross / 100, regularMinutes);
  return {
    holiday: { gross: holidayGross / 100, count: holidayCount, hourlyRate: holidayHourly },
    regular: { gross: regularGross / 100, count: regularCount, hourlyRate: regularHourly },
    upliftPct: regularHourly > 0 ? ((holidayHourly - regularHourly) / regularHourly) * 100 : 0,
  };
}

export async function getWeatherCorrelation() {
  const shifts = await db.shifts.filter((s) => s.deletedAt == null).toArray();
  const grouped = new Map();
  for (const s of shifts) {
    const weather = String(s.weather || 'Unknown');
    if (!grouped.has(weather)) grouped.set(weather, []);
    grouped.get(weather).push(s);
  }
  const rows = [];
  for (const [weather, items] of grouped.entries()) {
    const gross = items.reduce((sum, s) => sum + grossCents(s), 0);
    const minutes = items.reduce((sum, s) => sum + getDurationMinutes(s), 0);
    rows.push({
      weather,
      count: items.length,
      gross: gross / 100,
      hourlyRate: calcHourlyRate(gross / 100, minutes),
    });
  }
  rows.sort((a, b) => b.hourlyRate - a.hourlyRate);
  return rows;
}

export async function getOrdersPerHour(startDate, endDate) {
  const shifts = startDate && endDate
    ? await listShiftsBetween(startDate, endDate)
    : await db.shifts.filter((s) => s.deletedAt == null).toArray();
  let orders = 0;
  let minutes = 0;
  for (const s of shifts) {
    orders += num(s.deliveryCount ?? s.orders);
    minutes += getDurationMinutes(s);
  }
  const hours = minutes / 60;
  return {
    orders,
    hours,
    ordersPerHour: hours > 0 ? orders / hours : 0,
  };
}

export async function getSeasonalityHeatmap() {
  const shifts = await db.shifts.filter((s) => s.deletedAt == null).toArray();
  const now = new Date();
  const months = [];
  const monthTotals = new Map();
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push(key);
    monthTotals.set(key, 0);
  }
  for (const s of shifts) {
    const key = monthKeyFromDateStr(s.date);
    if (!monthTotals.has(key)) continue;
    monthTotals.set(key, monthTotals.get(key) + grossCents(s));
  }
  return months.map((month) => ({ month, gross: (monthTotals.get(month) || 0) / 100 }));
}

export async function getCompoundGrowthRate() {
  const cohort = await getCohortFirstVsCurrentMonth();
  if (!cohort.firstMonth || !cohort.currentMonth) return { cagrPct: 0, periods: 0 };
  const [startYear, startMonth] = cohort.firstMonth.split('-').map((v) => Number(v));
  const [endYear, endMonth] = cohort.currentMonth.split('-').map((v) => Number(v));
  const periods = Math.max(0, (endYear - startYear) * 12 + (endMonth - startMonth));
  if (periods <= 0 || cohort.firstGross <= 0 || cohort.currentGross <= 0) return { cagrPct: 0, periods };
  const cagr = (cohort.currentGross / cohort.firstGross) ** (1 / periods) - 1;
  return { cagrPct: cagr * 100, periods };
}

export async function getBreakEvenAnalysis({ fixedCosts = 0, variableCostPct = 0 } = {}) {
  const shifts = await db.shifts.filter((s) => s.deletedAt == null).toArray();
  const gross = shifts.reduce((sum, s) => sum + grossCents(s), 0);
  const inferredVariable = Math.max(0, num(variableCostPct)) / 100;
  const contributionMargin = 1 - inferredVariable;
  const breakEvenRevenue = contributionMargin > 0 ? num(fixedCosts) / contributionMargin : 0;
  return {
    fixedCosts: num(fixedCosts),
    variableCostPct: inferredVariable * 100,
    contributionMarginPct: contributionMargin * 100,
    breakEvenRevenue,
    currentRevenue: gross / 100,
    marginToBreakEven: gross / 100 - breakEvenRevenue,
  };
}

export async function getNetWorthContribution(startDate, endDate) {
  const shifts = startDate && endDate
    ? await listShiftsBetween(startDate, endDate)
    : await db.shifts.filter((s) => s.deletedAt == null).toArray();
  if (shifts.length === 0) return { gross: 0, expenses: 0, net: 0, savingsRatePct: 0 };
  const dates = shifts.map((s) => String(s.date)).sort();
  const rangeStart = startDate || dates[0];
  const rangeEnd = endDate || dates[dates.length - 1];
  const gross = shifts.reduce((sum, s) => sum + grossCents(s), 0);
  const expenses = await getTotalExpensesForPeriod(rangeStart, rangeEnd);
  const net = gross - expenses;
  return {
    gross,
    expenses,
    net,
    savingsRatePct: gross > 0 ? (net / gross) * 100 : 0,
  };
}

export async function getShiftEfficiencyQuartiles() {
  const shifts = await db.shifts.filter((s) => s.deletedAt == null).toArray();
  const scored = shifts
    .map((s) => ({
      id: s.id,
      date: s.date,
      platformId: s.platformId,
      efficiency: calcHourlyRate(grossCents(s) / 100, getDurationMinutes(s)),
    }))
    .filter((row) => Number.isFinite(row.efficiency));
  const thresholds = quarterBuckets(scored.map((r) => r.efficiency));
  const buckets = { q1: [], q2: [], q3: [], q4: [] };
  for (const row of scored) {
    if (row.efficiency <= thresholds.q1) buckets.q1.push(row);
    else if (row.efficiency <= thresholds.q2) buckets.q2.push(row);
    else if (row.efficiency <= thresholds.q3) buckets.q3.push(row);
    else buckets.q4.push(row);
  }
  return { thresholds, buckets };
}

export async function getPredictiveWeeklyEarnings() {
  const projection = await getWeeklyProjection();
  const shifts = await db.shifts.filter((s) => s.deletedAt == null).toArray();
  const daily = new Map();
  for (const s of shifts) {
    daily.set(s.date, (daily.get(s.date) || 0) + grossCents(s));
  }
  const series = [...daily.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map((entry, idx) => ({ x: idx, y: num(entry[1]) }));
  const regression = calcLinearRegression(series);
  return {
    projectedWeekGross: projection,
    trendSlope: regression.slope,
    trend: regression.trend,
  };
}

export async function getPlatformShiftOfActivity() {
  const shifts = await db.shifts.filter((s) => s.deletedAt == null).toArray();
  const monthSet = new Set(shifts.map((s) => monthKeyFromDateStr(s.date)).filter(Boolean));
  const months = [...monthSet].sort();
  const map = new Map();
  for (const s of shifts) {
    const m = monthKeyFromDateStr(s.date);
    if (!m) continue;
    const platformId = String(s.platformId || 'other');
    const key = `${m}::${platformId}`;
    map.set(key, (map.get(key) || 0) + grossCents(s));
  }
  const byMonth = [];
  for (const month of months) {
    const platforms = [];
    for (const [key, gross] of map.entries()) {
      if (!key.startsWith(`${month}::`)) continue;
      platforms.push({ platformId: key.split('::')[1], gross });
    }
    platforms.sort((a, b) => b.gross - a.gross);
    byMonth.push({
      month,
      dominantPlatform: platforms[0]?.platformId || null,
      platforms,
    });
  }
  return byMonth;
}

export async function getFatigueAlert() {
  const shifts = await db.shifts.filter((s) => s.deletedAt == null).toArray();
  const flagged = shifts
    .map((s) => ({
      id: s.id,
      date: s.date,
      durationMinutes: getDurationMinutes(s),
      hourlyRate: calcHourlyRate(grossCents(s) / 100, getDurationMinutes(s)),
    }))
    .filter((s) => s.durationMinutes >= 600 && s.hourlyRate < 15);
  return {
    threshold: { minMinutes: 600, lowHourlyRate: 15 },
    flagged,
    riskLevel: flagged.length >= 3 ? 'high' : flagged.length > 0 ? 'moderate' : 'low',
  };
}

export async function getEarningsAnxietyPattern() {
  const shifts = await db.shifts.filter((s) => s.deletedAt == null).toArray();
  const moodRows = shifts.filter((s) => s.mood);
  const out = {};
  for (const s of moodRows) {
    const mood = String(s.mood);
    if (!out[mood]) out[mood] = { count: 0, gross: 0, hourlyRates: [] };
    out[mood].count += 1;
    const gross = grossCents(s);
    const hourly = calcHourlyRate(gross, getDurationMinutes(s));
    out[mood].gross += gross;
    out[mood].hourlyRates.push(hourly);
  }
  const patterns = Object.entries(out).map(([mood, value]) => ({
    mood,
    count: value.count,
    avgGross: value.count > 0 ? value.gross / value.count : 0,
    avgHourlyRate: mean(value.hourlyRates),
    medianHourlyRate: median(value.hourlyRates),
  }));
  patterns.sort((a, b) => a.avgHourlyRate - b.avgHourlyRate);
  return patterns;
}

export async function getIncomeStabilityScore() {
  const shifts = await db.shifts.filter((s) => s.deletedAt == null).toArray();
  const byWeek = new Map();
  for (const s of shifts) {
    const d = parseDate(s.date);
    if (!d) continue;
    const weekStart = startOfWeek(d, 1);
    const key = ymd(weekStart);
    byWeek.set(key, (byWeek.get(key) || 0) + grossCents(s));
  }
  const weeklyGross = [...byWeek.values()];
  const avg = mean(weeklyGross);
  const sd = stdDev(weeklyGross, avg);
  const cv = avg > 0 ? sd / avg : 1;
  const stabilityScore = Math.max(0, Math.min(100, (1 - cv) * 100));
  return {
    weeklyGross,
    averageWeeklyGross: avg,
    stdDevWeeklyGross: sd,
    coefficientOfVariation: cv,
    stabilityScore,
  };
}

export async function getMoodTrend() {
  const shifts = await db.shifts.filter((s) => s.deletedAt == null && s.mood).toArray();
  const byDay = new Map();
  for (const s of shifts) {
    if (!byDay.has(s.date)) byDay.set(s.date, {});
    const day = byDay.get(s.date);
    const mood = String(s.mood);
    day[mood] = (day[mood] || 0) + 1;
  }
  const points = [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, counts]) => ({
      date,
      counts,
      dominantMood: Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    }));
  return points;
}

export { getMetricValue } from '../../registry/metrics/index.js';

function formatDurationMinutes(mins) {
  const m = Math.max(0, Math.floor(Number(mins) || 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!m) return '—';
  return h > 0 ? `${h}h ${r}m` : `${r}m`;
}

/**
 * @param {unknown} def
 * @param {unknown} raw
 * @param {string} localeCountry
 * @param {string} currency
 */
export function formatRegisteredMetricValue(def, raw, localeCountry, currency) {
  const d = /** @type {{ format?: string }} */ (def);
  const f = d.format;
  if (f === 'text') return raw == null || raw === '' ? '—' : String(raw);
  if (raw == null) return '—';
  if (f === 'currency' || f === 'currency_per_hour') {
    return formatCurrency(Number(raw) || 0, localeCountry, { currency });
  }
  if (f === 'number') return formatLargeNumber(Number(raw) || 0);
  if (f === 'percent') return `${(Number(raw) || 0).toFixed(1)}%`;
  if (f === 'duration') return formatDurationMinutes(raw);
  return String(raw ?? '—');
}

/**
 * @returns {string[]}
 */
export function listAnalyticsDashboardMetricIds() {
  return MetricRegistry.getAll()
    .filter((m) => m.showInAnalytics && m.id !== 'placeholder')
    .sort(
      (a, b) =>
        num(/** @type {{ analyticsOrder?: number }} */ (a).analyticsOrder, 99) -
        num(/** @type {{ analyticsOrder?: number }} */ (b).analyticsOrder, 99),
    )
    .map((m) => m.id);
}

/**
 * @param {string} id
 * @param {{ summary?: Record<string, unknown>; zeroDaysLength?: number }} ctx
 * @param {string} localeCountry
 * @param {string} currency
 */
export function getRegisteredMetricDisplay(id, ctx, localeCountry, currency) {
  const def = MetricRegistry.getById(id);
  if (!def) return null;
  const raw = getMetricValue(id, ctx);
  const messageKey = def.messageKey ? String(def.messageKey) : null;
  return {
    messageKey,
    label: def.label,
    value: formatRegisteredMetricValue(def, raw, localeCountry, currency),
  };
}
