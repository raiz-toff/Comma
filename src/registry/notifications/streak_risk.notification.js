import {
  NOTIFICATION_IDS,
  createNotification,
  num,
} from '../../modules/notifications/notification-internal.js';
import { db } from '../../core/db.js';

async function computeStreakFromDB(todayStr, db) {
  const rows = await db.shifts.filter((s) => s.deletedAt == null).toArray();
  const dates = [...new Set(rows.map((s) => String(s.date || '')))]
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a));
  
  if (dates.length === 0) return 0;
  
  let startIndex = -1;
  if (dates[0] === todayStr) {
    startIndex = 0;
  } else {
    const dToday = new Date(`${todayStr}T12:00:00`);
    const dLast = new Date(`${dates[0]}T12:00:00`);
    const diff = Math.round((dToday.getTime() - dLast.getTime()) / 86400000);
    if (diff === 1) {
      startIndex = 0;
    } else {
      return 0;
    }
  }

  let streak = 1;
  for (let i = startIndex + 1; i < dates.length; i++) {
    const newer = dates[i - 1];
    const older = dates[i];
    const dNew = new Date(`${newer}T12:00:00`);
    const dOld = new Date(`${older}T12:00:00`);
    const diff = Math.round((dNew.getTime() - dOld.getTime()) / 86400000);
    if (diff === 1) {
      streak += 1;
    } else if (diff === 0) {
      continue;
    } else {
      break;
    }
  }
  return streak;
}

export default {
  id: NOTIFICATION_IDS.streakRisk,
  type: 'toast',
  cooldown: '1d',
  message: () => '',
  priority: 30,
  userToggleable: true,
  condition: async () => false,
  /** @param {{ today: string; todayShifts: Array<Record<string, unknown>> }} ctx */
  evaluate: async (ctx) => {
    const streakCount = await computeStreakFromDB(ctx.today, db);
    if (streakCount > 0 && ctx.todayShifts.length === 0) {
      await createNotification(
        NOTIFICATION_IDS.streakRisk,
        'Streak at risk',
        `You are on a ${streakCount}-day streak. Logging even one short shift today keeps it alive.`,
        { scope: 'day', tone: 'warning' },
      );
    }
  },
};
