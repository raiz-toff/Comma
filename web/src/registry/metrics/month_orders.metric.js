export default {
  id: 'month_orders',
  label: 'Orders',
  shortLabel: 'Ord',
  format: 'number',
  showInAnalytics: true,
  analyticsOrder: 3,
  messageKey: 'analytics.orders',
  calcPerShift: () => null,
  /** @param {{ summary?: { orders?: number } }} ctx */
  calcFromCtx: (ctx) => Number(ctx?.summary?.orders ?? 0) || 0,
};
