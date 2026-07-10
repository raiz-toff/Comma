import {
  NOTIFICATION_IDS,
  createNotification,
  num,
} from '../../modules/notifications/notification-internal.js';
import { db } from '../../core/db.js';

export default {
  id: NOTIFICATION_IDS.idleDayAlert,
  type: 'toast',
  cooldown: '1d',
  message: () => '',
  priority: 35,
  userToggleable: true,
  condition: async () => false,
  /** @param {{ user: Record<string, unknown>; today: string; recentShifts: Array<Record<string, unknown>> }} ctx */
  evaluate: async (ctx) => {
    const user = ctx.user;
    const threshold = num(user?.settings?.idleDaysThreshold ?? user?.idleDaysThreshold ?? 5, 5);

    let lastShift = ctx.recentShifts
      .filter((s) => s.deletedAt == null && s.date)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];

    if (!lastShift) {
      // Lazily fallback to seek full history for the absolute last shift if none preloaded in the 90-day window
      lastShift = await db.shifts
        .filter((s) => s.deletedAt == null && s.date)
        .reverse()
        .first();
    }

    if (!lastShift) return;

    const dLast = new Date(lastShift.date + 'T12:00:00');
    const dToday = new Date(ctx.today + 'T12:00:00');
    const daysSince = Math.round((dToday.getTime() - dLast.getTime()) / 86400000);

    if (daysSince >= threshold) {
      await createNotification(
        NOTIFICATION_IDS.idleDayAlert,
        'No recent shifts logged',
        `It has been ${daysSince} days since your last logged shift. Don't forget to log your work!`,
        { scope: 'day', tone: 'info' }
      );
    }
  },
};
