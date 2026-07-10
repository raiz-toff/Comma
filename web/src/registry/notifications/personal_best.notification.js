import {
  NOTIFICATION_IDS,
  createNotification,
  num,
} from '../../modules/notifications/notification-internal.js';
import { db } from '../../core/db.js';

export default {
  id: NOTIFICATION_IDS.personalBest,
  type: 'celebration',
  cooldown: '7d',
  message: () => '',
  priority: 12,
  userToggleable: true,
  condition: async () => false,
  /**
   * @param {{
   *   weekShifts: Array<Record<string, unknown>>;
   * }} ctx
   */
  evaluate: async (ctx) => {
    const { weekShifts } = ctx;
    if (weekShifts.length === 0) return;

    // Lazily load full shift history when needed
    const allActive = await db.shifts.filter((s) => s.deletedAt == null).toArray();
    if (allActive.length < 2) return;

    // Sort ascending by date/time to find the latest shift and previous best
    const sortedAsc = [...allActive]
      .sort(
        (a, b) =>
          new Date(String(a.date || a.createdAt || '')).getTime() -
          new Date(String(b.date || b.createdAt || '')).getTime(),
      );

    const latest = sortedAsc[sortedAsc.length - 1];
    if (!latest) return;
    const latestGross = num(latest.grossRevenue);

    // Compute previous best of all shifts except the latest
    const prevBest = sortedAsc.slice(0, -1).reduce((max, s) => Math.max(max, num(s.grossRevenue)), 0);

    if (latestGross > 0 && latestGross > prevBest) {
      await createNotification(
        NOTIFICATION_IDS.personalBest,
        'New personal best',
        `New single-shift high: ${latestGross.toFixed(2)}. Keep this playbook for future sessions.`,
        { scope: 'week', tone: 'celebration' },
      );
    }
  },
};

