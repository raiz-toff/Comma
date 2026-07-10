export default {
  id: 'month_zero_days',
  label: 'Zero days',
  shortLabel: '0d',
  format: 'number',
  showInAnalytics: true,
  analyticsOrder: 4,
  messageKey: 'analytics.zeroDays',
  calcPerShift: () => null,
  /** @param {{ zeroDaysLength?: number }} ctx */
  calcFromCtx: (ctx) => Math.max(0, Number(ctx?.zeroDaysLength ?? 0) || 0),
};
