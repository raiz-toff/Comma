export default {
  id: 'month_gross',
  label: 'Monthly earnings',
  shortLabel: 'Earn',
  format: 'currency',
  showInAnalytics: true,
  analyticsOrder: 1,
  messageKey: 'analytics.earnings',
  /** @param {unknown} _shift @param {unknown} [_vehicle] */
  calcPerShift: (_shift, _vehicle) => null,
  /** @param {{ summary?: { gross?: number } }} ctx */
  calcFromCtx: (ctx) => Number(ctx?.summary?.gross ?? 0) || 0,
};
