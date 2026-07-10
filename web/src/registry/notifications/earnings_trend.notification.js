import {
  NOTIFICATION_IDS,
  createNotification,
  subtractDays,
  sumGross,
} from '../../modules/notifications/notification-internal.js';

export default {
  id: NOTIFICATION_IDS.earningsTrend,
  type: 'toast',
  cooldown: '7d',
  message: () => '',
  priority: 43,
  userToggleable: true,
  condition: async () => false,
  /** @param {{ weekStart: string; weekShifts: Array<Record<string, unknown>>; recentShifts: Array<Record<string, unknown>> }} ctx */
  evaluate: async (ctx) => {
    const thisWeekGross = sumGross(ctx.weekShifts);

    const startOfPrevPeriod = subtractDays(ctx.weekStart, 28);
    const endOfPrevPeriod = subtractDays(ctx.weekStart, 1);

    const prevPeriodShifts = ctx.recentShifts.filter((s) => {
      return s.deletedAt == null && s.date && s.date >= startOfPrevPeriod && s.date <= endOfPrevPeriod;
    });

    const totalPrevGross = sumGross(prevPeriodShifts);
    const averageWeeklyGross = totalPrevGross / 4;

    // Only compare if the user has a baseline history established
    if (averageWeeklyGross <= 20) return;

    const pctDiff = (thisWeekGross - averageWeeklyGross) / averageWeeklyGross;

    if (pctDiff <= -0.20) {
      await createNotification(
        NOTIFICATION_IDS.earningsTrend,
        'Earnings are down this week',
        `Your gross earnings this week are down ${(Math.abs(pctDiff) * 100).toFixed(0)}% compared to your 4-week rolling average.`,
        { scope: 'week', tone: 'warning' }
      );
    } else if (pctDiff >= 0.20) {
      await createNotification(
        NOTIFICATION_IDS.earningsTrend,
        'Great week! Earnings are up',
        `Congratulations! Your gross earnings this week are up ${(pctDiff * 100).toFixed(0)}% compared to your 4-week rolling average. Keep up the amazing work!`,
        { scope: 'week', tone: 'celebration' }
      );
    }
  },
};
