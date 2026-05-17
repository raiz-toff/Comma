import {
  NOTIFICATION_IDS,
  createNotification,
  num,
  sumGross,
  weekBounds,
  ymd,
  getWeeklyGoal,
  daysBetween,
} from '../../modules/notifications/notification-internal.js';
import { db } from '../../core/db.js';

export default {
  id: NOTIFICATION_IDS.weeklyGoalMiss,
  type: 'toast',
  cooldown: '7d',
  message: () => '',
  priority: 18,
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

    // Fire within a grace window of 1 to 3 days after week start instead of on a single exact day
    const daysSinceWeekStart = daysBetween(week.start, now);
    if (daysSinceWeekStart < 1 || daysSinceWeekStart > 3) return;

    const prevStart = new Date(week.start);
    prevStart.setDate(prevStart.getDate() - 7);
    const prevStartStr = ymd(prevStart);

    // Pre-emptively check if we already fired for this previous week's scope
    const key = `notif:${NOTIFICATION_IDS.weeklyGoalMiss}:week:${prevStartStr}`;
    const existing = await db.notifications.get(key);
    if (existing) return;

    const prevEnd = new Date(week.start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevRows = await db.shifts
      .where('date').between(prevStartStr, ymd(prevEnd), true, true)
      .filter((s) => s.deletedAt == null)
      .toArray();
    const prevGross = sumGross(prevRows);
    if (prevRows.length > 0 && prevGross < goal) {
      await createNotification(
        NOTIFICATION_IDS.weeklyGoalMiss,
        'Last week reflection',
        `Last week finished at ${((prevGross / goal) * 100).toFixed(0)}% of goal. You can reset and build this week.`,
        {
          scope: 'week',
          tone: 'info',
          dedupeKey: key,
        },
      );
    }
  },
};
