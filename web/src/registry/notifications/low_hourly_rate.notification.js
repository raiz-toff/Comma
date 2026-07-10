import {
  NOTIFICATION_IDS,
  createNotification,
  sumActiveMinutes,
  sumGross,
} from '../../modules/notifications/notification-internal.js';

export default {
  id: NOTIFICATION_IDS.lowHourlyRate,
  type: 'toast',
  cooldown: '7d',
  message: () => '',
  priority: 24,
  userToggleable: true,
  condition: async () => false,
  /** @param {{ weekShifts: Array<Record<string, unknown>> }} ctx */
  evaluate: async (ctx) => {
    const weekGross = sumGross(ctx.weekShifts);
    const weekMinutes = sumActiveMinutes(ctx.weekShifts);
    if (weekGross > 0 && weekMinutes > 0) {
      const hourly = (weekGross / weekMinutes) * 60;
      if (hourly < 15) {
        await createNotification(
          NOTIFICATION_IDS.lowHourlyRate,
          'Low hourly rate warning',
          `This week is averaging ${hourly.toFixed(2)} per hour. Consider adjusting zone, timing, or platform mix.`,
          { scope: 'week', tone: 'warning' },
        );
      }
    }
  },
};
