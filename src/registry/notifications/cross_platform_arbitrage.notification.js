import {
  NOTIFICATION_IDS,
  createNotification,
  num,
} from '../../modules/notifications/notification-internal.js';
import { db } from '../../core/db.js';

export default {
  id: NOTIFICATION_IDS.crossPlatformArbitrage,
  type: 'toast',
  cooldown: '7d',
  message: () => '',
  priority: 19,
  userToggleable: true,
  condition: async () => false,
  /** @param {{ weekShifts: Array<Record<string, unknown>> }} ctx */
  evaluate: async (ctx) => {
    const activePlatforms = await db.platforms.filter((p) => p.active === true).toArray();
    if (activePlatforms.length < 2) return;
    const map = new Map();
    for (const s of ctx.weekShifts) {
      const pid = String(s.platformId || '');
      if (!pid) continue;
      const gross = Math.max(0, num(s.grossRevenue));
      const minutes = Math.max(0, num(s.activeMinutes) || num(s.onlineMinutes));
      if (minutes <= 0 || gross <= 0) continue;
      const rec = map.get(pid) || { gross: 0, minutes: 0 };
      rec.gross += gross;
      rec.minutes += minutes;
      map.set(pid, rec);
    }
    const rates = [...map.entries()]
      .map(([pid, rec]) => ({ pid, hourly: (rec.gross / rec.minutes) * 60 }))
      .sort((a, b) => b.hourly - a.hourly);
    if (rates.length < 2) return;
    const top = rates[0];
    const runnerUp = rates[1];
    if (top.hourly > 0 && (top.hourly - runnerUp.hourly) / top.hourly >= 0.25) {
      const label = activePlatforms.find((p) => String(p.id) === top.pid)?.name || top.pid;
      await createNotification(
        NOTIFICATION_IDS.crossPlatformArbitrage,
        'Cross-platform opportunity',
        `${label} is outperforming your next platform this week. Consider prioritizing its peak windows.`,
        { scope: 'week', tone: 'info' },
      );
    }
  },
};
