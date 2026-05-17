import {
  NOTIFICATION_IDS,
  createNotification,
  getCountryTaxProfile,
  getNextTaxDeadline,
} from '../../modules/notifications/notification-internal.js';

export default {
  id: NOTIFICATION_IDS.taxInstallment,
  type: 'toast',
  cooldown: '7d',
  message: () => '',
  priority: 22,
  userToggleable: true,
  condition: async () => false,
  /** @param {{ user: Record<string, unknown>; now: Date }} ctx */
  evaluate: async (ctx) => {
    const user = ctx.user;
    const country = String(user?.locale?.country || 'US').toUpperCase();
    const nextTax = getNextTaxDeadline(country, ctx.now);
    const taxProfile = getCountryTaxProfile(country);

    const reminderWindow =
      typeof taxProfile.taxInstallmentReminderDays === 'number' && Number.isFinite(taxProfile.taxInstallmentReminderDays)
        ? Math.max(0, Math.floor(taxProfile.taxInstallmentReminderDays))
        : 10;
    if (nextTax.daysUntil >= 0 && nextTax.daysUntil <= reminderWindow) {
      await createNotification(
        NOTIFICATION_IDS.taxInstallment,
        'Tax installment due soon',
        `${nextTax.label} is in ${nextTax.daysUntil} day${nextTax.daysUntil === 1 ? '' : 's'}.`,
        { scope: 'week', tone: 'warning' },
      );
    }
  },
};
