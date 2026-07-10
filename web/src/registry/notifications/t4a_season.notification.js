import {
  NOTIFICATION_IDS,
  createNotification,
} from '../../modules/notifications/notification-internal.js';
import { db } from '../../core/db.js';

export default {
  id: NOTIFICATION_IDS.t4aSeason,
  type: 'toast',
  cooldown: '30d',
  message: () => '',
  priority: 12,
  userToggleable: true,
  condition: async () => false,
  /** @param {{ user: Record<string, unknown>; now: Date }} ctx */
  evaluate: async (ctx) => {
    const user = ctx.user;
    const country = String(user?.locale?.country || user?.countryId || '').toUpperCase();
    if (country !== 'CA') return;

    // First week of February (Month is 0-indexed, so 1 = February)
    const isFebruaryFirstWeek = ctx.now.getMonth() === 1 && ctx.now.getDate() <= 7;

    if (isFebruaryFirstWeek) {
      const year = ctx.now.getFullYear();
      const key = `notif:${NOTIFICATION_IDS.t4aSeason}:year:${year}`;
      const existing = await db.notifications.get(key);
      if (!existing) {
        await createNotification(
          NOTIFICATION_IDS.t4aSeason,
          'Collect T4A slips',
          'T4A tax slip season is here. Please collect your T4A tax slips from platforms like Uber and DoorDash before filing.',
          { scope: 'ever', tone: 'info', dedupeKey: key }
        );
      }
    }
  },
};
