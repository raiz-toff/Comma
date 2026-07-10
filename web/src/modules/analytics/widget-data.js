/**
 * Shared widget data context builder.
 * Assembles all analytics data that any widget might need in one parallel fetch.
 * Called by the dashboard view before rendering widgets.
 */

import { store } from '../../core/store.js';
import { getCountryTaxProfile } from '../../registry/countries/index.js';
import { calcTaxSetAside } from '../../utils/calculations.js';
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
    getMonthlySummary(m, y, platformFilter),
    getBestDayOfWeek(range.start, range.end, platformFilter),
    getBestTimeOfDay(range.start, range.end, platformFilter),
    getDeadMilesSummary(range.start, range.end, platformFilter),
    getZerodays(range.start, range.end, platformFilter),
    getWeekOverWeek(platformFilter, { anchorDate: range.end }),
    getAnnualSummary(y, platformFilter),
    getStreakCountForActiveFilter(platformFilter),
    getWeeklyProjection(platformFilter, { anchorDate: range.end }),
    getRolling30DayTrend(platformFilter, { anchorDate: range.end }),
    getPlatformShiftOfActivity(platformFilter),
    getIncomeStabilityScore(platformFilter),
    getEarningsVsHoursScatter(range.start, range.end, platformFilter),
  ]);


  // Real configured tax withholding rate (same source dashboard.js uses for its
  // Tax Set-Aside KPI card), exposed here so widgets (e.g. taxJar) can match it
  // instead of using a hardcoded guess.
  const localeCountryForTax = user?.locale?.country || user?.country || 'US';
  const taxProfile = getCountryTaxProfile(localeCountryForTax);
  const taxRatePct = Number.isFinite(Number(user?.taxWithholdingPct))
    ? Number(user.taxWithholdingPct)
    : Number(taxProfile?.defaultWithholdingPct) || 0;

  return {
    user,
    localeCountry: user?.country || 'US',
    currency: user?.currency || 'USD',
    taxRatePct,
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
