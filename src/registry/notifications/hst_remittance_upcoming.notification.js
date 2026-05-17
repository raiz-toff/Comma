import {
  NOTIFICATION_IDS,
  createNotification,
  daysBetween,
} from '../../modules/notifications/notification-internal.js';
import { db } from '../../core/db.js';

export default {
  id: NOTIFICATION_IDS.hstRemittanceUpcoming,
  type: 'toast',
  cooldown: '90d',
  message: () => '',
  priority: 14,
  userToggleable: true,
  condition: async () => false,
  /** @param {{ user: Record<string, unknown>; now: Date }} ctx */
  evaluate: async (ctx) => {
    const user = ctx.user;
    const country = String(user?.locale?.country || user?.countryId || '').toUpperCase();
    if (country !== 'CA') return;

    const y = ctx.now.getFullYear();
    const targets = [
      { date: new Date(y, 3, 30, 12, 0, 0), q: 'Q1', label: 'April 30', yr: y },
      { date: new Date(y, 6, 31, 12, 0, 0), q: 'Q2', label: 'July 31', yr: y },
      { date: new Date(y, 9, 31, 12, 0, 0), q: 'Q3', label: 'October 31', yr: y },
      { date: new Date(y, 0, 31, 12, 0, 0), q: 'Q4', label: 'January 31', yr: y },
      { date: new Date(y + 1, 0, 31, 12, 0, 0), q: 'Q4', label: 'January 31', yr: y + 1 },
    ];

    for (const target of targets) {
      const days = daysBetween(ctx.now, target.date);
      if (days >= 0 && days <= 14) {
        const key = `notif:${NOTIFICATION_IDS.hstRemittanceUpcoming}:quarter:${target.yr}-${target.q}`;
        const existing = await db.notifications.get(key);
        if (!existing) {
          await createNotification(
            NOTIFICATION_IDS.hstRemittanceUpcoming,
            'HST remittance upcoming',
            `Your quarterly HST remittance deadline (${target.label}) is in ${days} day${days === 1 ? '' : 's'}.`,
            { scope: 'quarter', tone: 'warning', dedupeKey: key }
          );
          break;
        }
      }
    }
  },
};
