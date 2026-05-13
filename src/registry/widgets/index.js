/**
 * Dashboard widget registry (Category B).
 * Engines consume this; definitions stay in `*.widget.js` files.
 * @see docs/feature_modularity.md
 */

import earnings from './earnings.widget.js';
import expenses from './expenses.widget.js';
import hourlyRate from './hourly-rate.widget.js';
import orders from './orders.widget.js';
import placeholder from './placeholder.widget.js';
import recentShifts from './recent-shifts.widget.js';
import schedule from './schedule.widget.js';
import streak from './streak.widget.js';
import taxJar from './tax-jar.widget.js';
import weekCompare from './week-compare.widget.js';
import weeklyGoal from './weekly-goal.widget.js';
import incomeBreakdown from './income-breakdown.widget.js';
import weeklyProjection from './weekly-projection.widget.js';
import avgRate from './avg-rate.widget.js';
import bestDay from './best-day.widget.js';
import bestHour from './best-hour.widget.js';
import deadMiles from './dead-miles.widget.js';
import deliveries from './deliveries.widget.js';
import effectiveRate from './effective-rate.widget.js';
import monthGross from './month-gross.widget.js';
import monthHourly from './month-hourly.widget.js';
import monthOrders from './month-orders.widget.js';
import netIncome from './net-income.widget.js';
import outOfPocket from './out-of-pocket.widget.js';
import perDelivery from './per-delivery.widget.js';
import platformActivity from './platform-activity.widget.js';
import rollingTrend from './rolling-trend.widget.js';
import scatter from './scatter.widget.js';
import stabilityScore from './stability-score.widget.js';
import tipsTotal from './tips-total.widget.js';
import totalExpenses from './total-expenses.widget.js';
import totalHours from './total-hours.widget.js';
import zeroDays from './zero-days.widget.js';

/** First bento stat strip — matches legacy `views/dashboard.js` layout. */
export const DASHBOARD_STAT_STRIP_IDS = ['earnings', 'weeklyGoal', 'orders', 'weekCompare'];

/** Preferred ids for the top stat strip when user `dashboardWidgets` is set. */
export const DASHBOARD_STRIP_SLOT_ID_SET = new Set(DASHBOARD_STAT_STRIP_IDS);

/** Default order when `user.dashboardWidgets` is unset (aligned with settings `WIDGET_CHOICES`). */
export const DEFAULT_DASHBOARD_WIDGET_ORDER = [
  'earnings',
  'weeklyGoal',
  'streak',
  'hourlyRate',
  'taxJar',
  'expenses',
  'schedule',
  'recentShifts',
];

/** @typedef {{ user?: unknown; store?: unknown; data?: Record<string, unknown> }} WidgetContext */

/** @typedef {typeof placeholder} WidgetDefinition */

/** @type {WidgetDefinition[]} */
const WIDGETS = [
  earnings,
  weeklyGoal,
  orders,
  weekCompare,
  streak,
  hourlyRate,
  taxJar,
  expenses,
  schedule,
  recentShifts,
  placeholder,
  incomeBreakdown,
  weeklyProjection,
  avgRate,
  bestDay,
  bestHour,
  deadMiles,
  deliveries,
  effectiveRate,
  monthGross,
  monthHourly,
  monthOrders,
  netIncome,
  outOfPocket,
  perDelivery,
  platformActivity,
  rollingTrend,
  scatter,
  stabilityScore,
  tipsTotal,
  totalExpenses,
  totalHours,
  zeroDays,
];

/** @type {Map<string, WidgetDefinition>} */
const byId = new Map(WIDGETS.map((w) => [String(w.id).toLowerCase(), w]));

/**
 * @param {WidgetDefinition} def
 * @returns {boolean}
 */
function validateWidgetDefinition(def) {
  const required = ['id', 'label', 'defaultSize', 'defaultVisible', 'render', 'afterRender', 'destroy'];
  const missing = required.filter((k) => def[k] == null);
  if (missing.length) throw new Error(`Widget definition missing: ${missing.join(', ')}`);
  if (typeof def.render !== 'function' || typeof def.afterRender !== 'function' || typeof def.destroy !== 'function') {
    throw new Error(`Widget ${def.id} missing render/afterRender/destroy`);
  }
  if (def.shouldShow != null && typeof def.shouldShow !== 'function') {
    throw new Error(`Widget ${def.id} shouldShow must be a function`);
  }
  return true;
}

/**
 * @param {unknown} user
 * @param {unknown} [ctx] Optional widget context for `shouldShow`.
 * @returns {string[]} Canonical widget ids (registry order, de-duplicated).
 */
export function getOrderedDashboardWidgetIds(user, ctx) {
  const u = /** @type {{ dashboardWidgets?: unknown }} */ (user);
  const raw =
    Array.isArray(u?.dashboardWidgets) && u.dashboardWidgets.length
      ? u.dashboardWidgets.map((x) => String(x))
      : [...DEFAULT_DASHBOARD_WIDGET_ORDER];
  const out = [];
  const seen = new Set();
  for (const id of raw) {
    const w = WidgetRegistry.getById(id);
    if (!w || w.id === 'placeholder' || seen.has(w.id)) continue;
    if (typeof w.shouldShow === 'function' && ctx != null && !w.shouldShow(ctx)) continue;
    seen.add(w.id);
    out.push(w.id);
  }
  return out;
}

/**
 * @param {string[]} ids
 * @param {unknown} ctx
 * @returns {Promise<{ id: string; html: string }[]>}
 */
export async function renderWidgetCellsInnerHtml(ids, ctx) {
  const out = [];
  for (const rawId of ids) {
    const w = WidgetRegistry.getById(rawId);
    if (!w) continue;
    out.push({ id: w.id, html: await w.render(ctx) });
  }
  return out;
}

export const WidgetRegistry = {
  /** @returns {readonly WidgetDefinition[]} */
  getAll: () => WIDGETS,

  /**
   * @param {string | null | undefined} id
   * @returns {WidgetDefinition | undefined}
   */
  getById: (id) => {
    const key = String(id || '').toLowerCase();
    return byId.get(key);
  },

  /** @param {WidgetDefinition} def */
  validate: (def) => validateWidgetDefinition(def),
};

export function assertWidgetRegistryValid() {
  for (const w of WIDGETS) validateWidgetDefinition(w);
}

/**
 * @param {string} [category] If omitted, returns all non-placeholder widgets.
 * @returns {WidgetDefinition[]}
 */
export function getWidgetsByCategory(category) {
  return WIDGETS.filter((w) => {
    if (w.id === 'placeholder') return false;
    if (category && w.category !== category) return false;
    return true;
  });
}

/** All widget IDs excluding placeholder — used by settings widget manager */
export function getAllSelectableWidgetIds() {
  return WIDGETS.filter((w) => w.id !== 'placeholder').map((w) => w.id);
}
