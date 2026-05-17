import {
  NOTIFICATION_IDS,
  createNotification,
  num,
} from '../../modules/notifications/notification-internal.js';

export default {
  id: NOTIFICATION_IDS.longShiftAlert,
  type: 'toast',
  cooldown: '1d',
  message: () => '',
  priority: 34,
  userToggleable: true,
  condition: async () => false,
  /** @param {{ user: Record<string, unknown>; todayShifts: Array<Record<string, unknown>> }} ctx */
  evaluate: async (ctx) => {
    const user = ctx.user;
    const thresholdHours = num(user?.settings?.longShiftHoursThreshold ?? user?.longShiftHoursThreshold ?? 10, 10);
    const thresholdMinutes = thresholdHours * 60;

    const longShift = ctx.todayShifts.find((s) => {
      if (s.deletedAt != null) return false;
      const duration = num(s.durationMinutes || s.activeMinutes || s.onlineMinutes);
      return duration > thresholdMinutes;
    });

    if (longShift) {
      const actualDuration = num(longShift.durationMinutes || longShift.activeMinutes || longShift.onlineMinutes);
      const hoursStr = (actualDuration / 60).toFixed(1);
      await createNotification(
        NOTIFICATION_IDS.longShiftAlert,
        'Long shift detected',
        `You logged a long shift of ${hoursStr} hours. Remember to take regular breaks, stay hydrated, and get plenty of rest!`,
        { scope: 'day', tone: 'info' }
      );
    }
  },
};
