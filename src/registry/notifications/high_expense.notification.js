import {
  NOTIFICATION_IDS,
  createNotification,
  num,
  sumGross,
} from '../../modules/notifications/notification-internal.js';

export default {
  id: NOTIFICATION_IDS.highExpense,
  type: 'toast',
  cooldown: '7d',
  message: () => '',
  priority: 23,
  userToggleable: true,
  condition: async () => false,
  /**
   * @param {{
   *   weekShifts: Array<Record<string, unknown>>;
   *   weekExpenses: Array<Record<string, unknown>>;
   * }} ctx
   */
  evaluate: async (ctx) => {
    const weekGross = sumGross(ctx.weekShifts);
    const expenseTotal = ctx.weekExpenses.reduce(
      (sum, e) => sum + Math.max(0, num(e.amount)) * (Math.max(0, Math.min(100, num(e.deductiblePct, 100))) / 100),
      0,
    );
    if (weekGross > 0) {
      const ratio = (expenseTotal / weekGross) * 100;
      if (ratio >= 35) {
        await createNotification(
          NOTIFICATION_IDS.highExpense,
          'High expense ratio',
          `Expenses are ${ratio.toFixed(0)}% of weekly gross. Review categories for savings opportunities.`,
          { scope: 'week', tone: 'warning' },
        );
      }
    }
  },
};
