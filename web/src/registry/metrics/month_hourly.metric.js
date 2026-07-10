export default {
  id: 'month_hourly',
  label: 'Monthly hourly',
  shortLabel: '/h',
  format: 'currency_per_hour',
  showInAnalytics: true,
  analyticsOrder: 2,
  messageKey: 'analytics.hourlyRate',
  calcPerShift: () => null,
  /** @param {{ summary?: { hourlyRate?: number } }} ctx */
  calcFromCtx: (ctx) => Number(ctx?.summary?.hourlyRate ?? 0) || 0,
};
