import {
  NOTIFICATION_IDS,
  createNotification,
  sumGross,
} from '../../modules/notifications/notification-internal.js';

export default {
  id: NOTIFICATION_IDS.dailySummary,
  type: 'toast',
  cooldown: '1d',
  message: () => '',
  priority: 10,
  userToggleable: true,
  condition: async () => false,
  /** @param {{ todayShifts: Array<Record<string, unknown>> }} ctx */
  evaluate: async (ctx) => {
    const gross = sumGross(ctx.todayShifts);
    await createNotification(
      NOTIFICATION_IDS.dailySummary,
      'Daily summary',
      `Today: ${ctx.todayShifts.length} shift${ctx.todayShifts.length === 1 ? '' : 's'}, gross ${gross.toFixed(2)}.`,
      { scope: 'day' },
    );
  },
};
