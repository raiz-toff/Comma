/**
 * Analytics metric registry (Category B).
 * @see docs/feature_modularity.md
 */

import monthGross from './month_gross.metric.js';
import monthHourly from './month_hourly.metric.js';
import monthOrders from './month_orders.metric.js';
import monthZeroDays from './month_zero_days.metric.js';
import placeholder from './placeholder.metric.js';
import shiftDuration from './shift_duration.metric.js';
import shiftGross from './shift_gross.metric.js';
import shiftHourly from './shift_hourly.metric.js';
import deadMilesRatio from './dead_miles_ratio.metric.js';

/** @typedef {typeof placeholder} MetricDefinition */

const FORMATS = new Set([
  'currency',
  'currency_per_hour',
  'currency_per_km',
  'percent',
  'number',
  'duration',
  'distance',
  'text',
]);

/** @type {MetricDefinition[]} */
const METRICS = [
  shiftGross,
  shiftHourly,
  shiftDuration,
  deadMilesRatio,
  monthGross,
  monthHourly,
  monthOrders,
  monthZeroDays,
  placeholder,
];

/** @type {Map<string, MetricDefinition>} */
const byId = new Map(METRICS.map((m) => [String(m.id).toLowerCase(), m]));

/**
 * @param {MetricDefinition} def
 * @returns {boolean}
 */
function validateMetricDefinition(def) {
  const required = ['id', 'label', 'shortLabel', 'format'];
  const missing = required.filter((k) => def[k] == null);
  if (missing.length) throw new Error(`Metric definition missing: ${missing.join(', ')}`);
  if (!FORMATS.has(def.format)) throw new Error(`Metric ${def.id} has invalid format`);
  const hasPerShift = typeof def.calcPerShift === 'function';
  const hasFromCtx = typeof def.calcFromCtx === 'function';
  if (!hasPerShift && !hasFromCtx) throw new Error(`Metric ${def.id} needs calcPerShift and/or calcFromCtx`);
  return true;
}

/**
 * @param {string | null | undefined} id
 * @param {{
 *   shift?: unknown;
 *   vehicle?: unknown;
 *   summary?: Record<string, unknown>;
 *   zeroDaysLength?: number;
 * }} [ctx]
 * @returns {unknown}
 */
export function getMetricValue(id, ctx = {}) {
  const def = MetricRegistry.getById(id);
  if (!def || def.id === 'placeholder') return null;
  if (ctx.shift != null && typeof def.calcPerShift === 'function') {
    const v = def.calcPerShift(ctx.shift, ctx.vehicle ?? null);
    if (v != null) return v;
  }
  if (typeof def.calcFromCtx === 'function') return def.calcFromCtx(ctx);
  return null;
}

export const MetricRegistry = {
  /** @returns {readonly MetricDefinition[]} */
  getAll: () => METRICS,

  /**
   * @param {string | null | undefined} id
   * @returns {MetricDefinition | undefined}
   */
  getById: (id) => {
    const key = String(id || '').toLowerCase();
    return byId.get(key);
  },

  /** @param {MetricDefinition} def */
  validate: (def) => validateMetricDefinition(def),
};

export function assertMetricRegistryValid() {
  for (const m of METRICS) validateMetricDefinition(m);
}
