import {
  NOTIFICATION_IDS,
  createNotification,
} from '../../modules/notifications/notification-internal.js';
import { db } from '../../core/db.js';

export default {
  id: NOTIFICATION_IDS.mileageLogReminder,
  type: 'toast',
  cooldown: '30d',
  message: () => '',
  priority: 22,
  userToggleable: true,
  condition: async () => false,
  /** @param {{ user: Record<string, unknown>; now: Date }} ctx */
  evaluate: async (ctx) => {
    const user = ctx.user;
    const country = String(user?.locale?.country || user?.countryId || '').toUpperCase();
    if (country !== 'CA') return;

    const tomorrow = new Date(ctx.now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isLastDay = tomorrow.getMonth() !== ctx.now.getMonth();

    let targetMonthStr = '';
    const targetYear = ctx.now.getFullYear();
    const targetMonth = ctx.now.getMonth(); // 0-indexed

    if (isLastDay) {
      targetMonthStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;
    } else if (ctx.now.getDate() <= 3) {
      // Within the first 3 days of the next month, remind for the previous month
      const prevMonthDate = new Date(ctx.now.getFullYear(), ctx.now.getMonth() - 1, 1);
      targetMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
    }

    if (targetMonthStr) {
      const key = `notif:${NOTIFICATION_IDS.mileageLogReminder}:month:${targetMonthStr}`;
      const existing = await db.notifications.get(key);
      if (!existing) {
        await createNotification(
          NOTIFICATION_IDS.mileageLogReminder,
          'Verify mileage log',
          `Please verify that your mileage log is complete for ${targetMonthStr}. CRA requires contemporaneous records.`,
          { scope: 'month', tone: 'info', dedupeKey: key }
        );
      }
    }
  },
};
