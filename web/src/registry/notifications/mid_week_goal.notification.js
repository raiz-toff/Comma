import {
  NOTIFICATION_IDS,
  createNotification,
  num,
  sumGross,
  weekBounds,
  ymd,
  getWeeklyGoal,
} from '../../modules/notifications/notification-internal.js';

export default {
  id: NOTIFICATION_IDS.midWeekGoal,
  type: 'toast',
  cooldown: '7d',
  message: () => '',
  priority: 20,
  userToggleable: true,
  condition: async () => false,
  /** @param {{ user: Record<string, unknown>; now: Date; weekShifts: Array<Record<string, unknown>> }} ctx */
  evaluate: async (ctx) => {
    const user = ctx.user;
    const now = ctx.now;
    const weekStartDay = Math.max(0, Math.min(6, num(user?.locale?.weekStartDay, 0)));
    const week = weekBounds(now, weekStartDay);
    const goal = await getWeeklyGoal(user, ymd(week.start), ymd(week.end));
    if (goal <= 0) return;
    const gross = sumGross(ctx.weekShifts);
    const progress = gross / goal;
    if (now.getDay() === 3 && progress < 0.5) {
      await createNotification(
        NOTIFICATION_IDS.midWeekGoal,
        'Mid-week check-in',
        `You are at ${(progress * 100).toFixed(0)}% of your weekly goal. Small focused sessions can close the gap.`,
        { scope: 'week', tone: 'warning' },
      );
    }
  },
};
