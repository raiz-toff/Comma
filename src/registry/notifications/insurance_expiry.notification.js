import {
  NOTIFICATION_IDS,
  createNotification,
  daysBetween,
  nowIso,
} from '../../modules/notifications/notification-internal.js';
import { db } from '../../core/db.js';

export default {
  id: NOTIFICATION_IDS.insuranceExpiry,
  type: 'toast',
  cooldown: '7d',
  message: () => '',
  priority: 26,
  userToggleable: true,
  condition: async () => false,
  /** @param {{ now: Date }} ctx */
  evaluate: async (ctx) => {
    const expenses = await db.expenses.filter((e) => e.deletedAt == null).toArray();
    const now = ctx?.now || new Date();
    const insuranceRows = expenses.filter((e) => String(e.category || '') === 'insurance');
    if (insuranceRows.length === 0) return;
    const lastInsurance = insuranceRows
      .map((e) => new Date(String(e.date || e.createdAt || nowIso())))
      .filter((d) => !Number.isNaN(d.getTime()))
      .sort((a, b) => b.getTime() - a.getTime())[0];
      
    if (!lastInsurance) return;

    const daysSinceLastPayment = daysBetween(lastInsurance, now);
    const daysUntilExpiry = 365 - daysSinceLastPayment;

    // Cascading warnings at 30 days, 7 days, and 3 days before expiry
    const thresholds = [30, 7, 3];
    for (const threshold of thresholds) {
      if (daysUntilExpiry <= threshold && daysUntilExpiry >= 0) {
        const expiryYear = lastInsurance.getFullYear() + 1;
        const expiryMonth = String(lastInsurance.getMonth() + 1).padStart(2, '0');
        const expiryDay = String(lastInsurance.getDate()).padStart(2, '0');
        const expiryDateStr = `${expiryYear}-${expiryMonth}-${expiryDay}`;

        const key = `notif:${NOTIFICATION_IDS.insuranceExpiry}:threshold-${threshold}:${expiryDateStr}`;
        const existing = await db.notifications.get(key);
        if (!existing) {
          await createNotification(
            NOTIFICATION_IDS.insuranceExpiry,
            'Insurance renewal reminder',
            `Your vehicle insurance is due for renewal in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}.`,
            {
              scope: 'week',
              tone: 'warning',
              dedupeKey: key,
            }
          );
          break; // Stop at the first threshold we hit and trigger
        }
      }
    }
  },
};
