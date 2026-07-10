import {
  NOTIFICATION_IDS,
  createNotification,
  subtractDays,
  sumGross,
} from '../../modules/notifications/notification-internal.js';
import { db } from '../../core/db.js';

export default {
  id: NOTIFICATION_IDS.platformConcentration,
  type: 'toast',
  cooldown: '7d',
  message: () => '',
  priority: 44,
  userToggleable: true,
  condition: async () => false,
  /** @param {{ today: string; recentShifts: Array<Record<string, unknown>> }} ctx */
  evaluate: async (ctx) => {
    const startOfPeriod = subtractDays(ctx.today, 30);
    const last30DaysShifts = ctx.recentShifts.filter(
      (s) => s.deletedAt == null && s.date && s.date >= startOfPeriod
    );

    const totalGross = sumGross(last30DaysShifts);
    if (totalGross <= 50) return; // ignore concentration alerts for negligible income

    const byPlatform = {};
    for (const s of last30DaysShifts) {
      const pid = String(s.platformId || 'other');
      const dollars = Math.max(0, Number(s.grossRevenue) || 0);
      byPlatform[pid] = (byPlatform[pid] || 0) + dollars;
    }

    for (const [pid, platformGross] of Object.entries(byPlatform)) {
      const ratio = platformGross / totalGross;
      if (ratio > 0.9) {
        let platformName = pid;
        try {
          const platform = await db.platforms.get(pid);
          if (platform?.name) platformName = platform.name;
        } catch {
          // ignore
        }
        await createNotification(
          NOTIFICATION_IDS.platformConcentration,
          'Platform concentration high',
          `You earned ${(ratio * 100).toFixed(0)}% of your income on ${platformName} in the last 30 days. Consider diversifying to protect against sudden platform deactivations!`,
          { scope: 'week', tone: 'info' }
        );
        break;
      }
    }
  },
};
