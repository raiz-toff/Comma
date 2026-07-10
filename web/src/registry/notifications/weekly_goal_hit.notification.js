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
  id: NOTIFICATION_IDS.weeklyGoalHit,
  type: 'celebration',
  cooldown: '7d',
  message: () => '',
  priority: 15,
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
    if (progress >= 1) {
      await createNotification(
        NOTIFICATION_IDS.weeklyGoalHit,
        'Weekly goal complete',
        `Great work - you have reached your weekly goal (${gross.toFixed(0)} / ${goal.toFixed(0)}).`,
        { scope: 'week', tone: 'celebration' },
      );
    }
  },
};
