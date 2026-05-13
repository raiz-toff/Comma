/**
 * Shared widget data context builder.
 * Assembles all analytics data that any widget might need in one parallel fetch.
 * Called by the dashboard view before rendering widgets.
 */

import { store } from '../../core/store.js';
import {
  getFinancialOverviewForRange,
  getMonthlySummary,
  getBestDayOfWeek,
  getBestTimeOfDay,
  getDeadMilesSummary,
  getZerodays,
  getWeekOverWeek,
  getAnnualSummary,
  getStreakCountForActiveFilter,
  getWeeklyProjection,
  getRolling30DayTrend,
  getPlatformShiftOfActivity,
  getIncomeStabilityScore,
  getEarningsVsHoursScatter,
} from './analytics.js';

/**
 * Builds the full data context object for widget rendering.
 * Widgets read from `ctx.data.*` to display their values.
 *
 * @param {{ start: string; end: string }} range
 * @param {string} platformFilter
 * @param {number} weekStartDay
 * @returns {Promise<{ user: unknown; data: Record<string, unknown> }>}
 */
export async function buildWidgetDataContext(range, platformFilter, weekStartDay) {
  const user = store.get('user');
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;

  // Parallel fetch of all required data points
  const [
    financial,
    monthSummary,
    bestDay,
    bestHour,
    deadMiles,
    zeroDaysCount,
    weekCompare,
    annual,
    streakCount,
    projection,
    rollingTrend,
    platformActivity,
    stabilityScore,
    scatter,
  ] = await Promise.all([
    getFinancialOverviewForRange(range.start, range.end, platformFilter),
    getMonthlySummary(y, m, platformFilter),
    getBestDayOfWeek(range.start, range.end, platformFilter),
    getBestTimeOfDay(range.start, range.end, platformFilter),
    getDeadMilesSummary(range.start, range.end, platformFilter),
    getZerodays(range.start, range.end, platformFilter),
    getWeekOverWeek(platformFilter),
    getAnnualSummary(y, platformFilter),
    getStreakCountForActiveFilter(platformFilter),
    getWeeklyProjection(platformFilter),
    getRolling30DayTrend(platformFilter),
    getPlatformShiftOfActivity(platformFilter),
    getIncomeStabilityScore(platformFilter),
    getEarningsVsHoursScatter(range.start, range.end, platformFilter),
  ]);


  return {
    user,
    localeCountry: user?.country || 'US',
    currency: user?.currency || 'USD',
    data: {
      financial,
      monthSummary,
      bestDay,
      bestHour,
      deadMiles,
      zeroDaysCount,
      weekCompare,
      annual,
      streakCount,
      projection,
      rollingTrend,
      platformActivity,
      stabilityScore,
      scatter,
    },
  };
}
