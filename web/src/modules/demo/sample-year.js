/**
 * Demo sample data (`loadSampleData`) is generated as the RECENT window ending today — the last
 * ~2 months — so the web demo matches the Android app, which seeds current data (not a fixed
 * calendar year). Because the data is anchored to "now", real-time dashboards use the real clock
 * in demo mode; there is no year-shift.
 *
 * (Historically this seeded the fixed 2025 calendar year and shifted the whole app's clock to
 * mid-October 2025. That drifted stale over time — by mid-2026 the demo showed "Dec 2025" data —
 * and never matched mobile, so it was replaced with this rolling recent window.)
 */

/** How many days back from today the demo seeds shifts/expenses (~2 months). */
export const DEMO_WINDOW_DAYS = 62;

/**
 * Analytics anchor for demo mode. The seeded data now ends today, so week/month-scoped analytics
 * should look at the real "now" — same as non-demo mode. Kept as a function (rather than removing
 * the call sites) so every consumer stays on the `demoMode ? anchor : new Date()` pattern.
 */
export function getDemoAnalyticsAnchorDate() {
  return new Date();
}

/**
 * True when [start, end] overlaps the seeded recent demo window ([today − DEMO_WINDOW_DAYS, today],
 * inclusive on YYYY-MM-DD strings). Used to decide whether a saved shifts-list range still lands on
 * demo data.
 * @param {string} start
 * @param {string} end
 */
export function demoSampleRangeOverlaps(start, end) {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - DEMO_WINDOW_DAYS);
  const ymd = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const ws = ymd(from);
  const we = ymd(now);
  return !(String(end) < ws || String(start) > we);
}
