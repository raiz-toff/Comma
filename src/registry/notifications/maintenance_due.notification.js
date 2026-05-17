import {
  NOTIFICATION_IDS,
  createNotification,
  daysBetween,
  nowIso,
} from '../../modules/notifications/notification-internal.js';
import { db } from '../../core/db.js';

export default {
  id: NOTIFICATION_IDS.maintenanceDue,
  type: 'toast',
  cooldown: '7d',
  message: () => '',
  priority: 25,
  userToggleable: true,
  condition: async () => false,
  /** @param {{ now: Date }} ctx */
  evaluate: async (ctx) => {
    const expenses = await db.expenses.filter((e) => e.deletedAt == null).toArray();
    const now = ctx?.now || new Date();
    const maintenanceRows = expenses.filter((e) => String(e.category || '') === 'maintenance');
    if (maintenanceRows.length === 0) return;
    const last = maintenanceRows
      .map((e) => new Date(String(e.date || e.createdAt || nowIso())))
      .filter((d) => !Number.isNaN(d.getTime()))
      .sort((a, b) => b.getTime() - a.getTime())[0];
    if (last && daysBetween(last, now) >= 90) {
      await createNotification(
        NOTIFICATION_IDS.maintenanceDue,
        'Maintenance check due',
        'No maintenance expense has been logged in about 90 days. Consider a quick vehicle check.',
        { scope: 'week', tone: 'warning' },
      );
    }
  },
};
