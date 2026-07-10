import {
  NOTIFICATION_IDS,
  createNotification,
  subtractDays,
  sumGross,
} from '../../modules/notifications/notification-internal.js';
import { db } from '../../core/db.js';

export default {
  id: NOTIFICATION_IDS.hstThreshold,
  type: 'toast',
  cooldown: '30d',
  message: () => '',
  priority: 15,
  userToggleable: true,
  condition: async () => false,
  /** @param {{ user: Record<string, unknown>; today: string }} ctx */
  evaluate: async (ctx) => {
    const user = ctx.user;
    const country = String(user?.locale?.country || user?.countryId || '').toUpperCase();
    if (country !== 'CA') return;

    // Canadian voluntary GST/HST registration threshold is $30,000 CAD
    const THRESHOLD = 30000;
    const WARNING_LIMIT = THRESHOLD * 0.8; // $24,000

    // Fetch shifts for the rolling 12-month (365 days) period
    const startOfPeriod = subtractDays(ctx.today, 365);
    const rollingShifts = await db.shifts
      .where('date')
      .aboveOrEqual(startOfPeriod)
      .filter((s) => s.deletedAt == null)
      .toArray();

    const rollingGross = sumGross(rollingShifts);

    if (rollingGross >= WARNING_LIMIT) {
      const grossFormatted = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(rollingGross);
      await createNotification(
        NOTIFICATION_IDS.hstThreshold,
        'HST/GST Threshold Approaching',
        `Your rolling 12-month gross earnings have reached ${grossFormatted}, crossing 80% of the $30,000 CAD HST/GST registration threshold. You may need to register for a GST/HST account soon.`,
        { scope: 'month', tone: 'warning' },
      );
    }
  },
};
