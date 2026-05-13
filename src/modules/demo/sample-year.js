/**
 * Demo sample data (`loadSampleData`) is generated for this calendar year only.
 * Real-time dashboards must align with it when `demoMode` is on, or metrics read empty years.
 */
export const DEMO_SAMPLE_DATA_YEAR = 2025;

/**
 * Fixed instant inside the sample year so week-scoped analytics (compare, projection) see shifts.
 * Mid-October 2025 falls on a weekday in the seeded range.
 */
export function getDemoAnalyticsAnchorDate() {
  return new Date(DEMO_SAMPLE_DATA_YEAR, 9, 15, 12, 0, 0, 0);
}
