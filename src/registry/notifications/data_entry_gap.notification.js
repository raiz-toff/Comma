import {
  NOTIFICATION_IDS,
  createNotification,
} from '../../modules/notifications/notification-internal.js';

export default {
  id: NOTIFICATION_IDS.dataEntryGap,
  type: 'toast',
  cooldown: '7d',
  message: () => '',
  priority: 36,
  userToggleable: true,
  condition: async () => false,
  /** @param {{ user: Record<string, unknown>; today: string; recentShifts: Array<Record<string, unknown>> }} ctx */
  evaluate: async (ctx) => {
    const activeShifts = ctx.recentShifts.filter((s) => s.deletedAt == null && s.date);
    if (activeShifts.length < 5) return; // need enough history to construct a pattern

    // Sort ascending
    const sorted = [...activeShifts].sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const firstDate = new Date(sorted[0].date + 'T12:00:00');
    const lastDate = new Date(sorted[sorted.length - 1].date + 'T12:00:00');

    const timespanDays = Math.round((lastDate.getTime() - firstDate.getTime()) / 86400000);
    if (timespanDays < 14) return; // need at least 2 weeks of history span

    // Calculate typical average worked day gap
    const avgDaysBetween = timespanDays / sorted.length;

    // Current gap since last shift
    const dToday = new Date(ctx.today + 'T12:00:00');
    const daysSinceLastShift = Math.round((dToday.getTime() - lastDate.getTime()) / 86400000);

    // If current gap is 10+ days and is at least 2.5x their normal average working gap
    if (daysSinceLastShift >= 10 && daysSinceLastShift >= avgDaysBetween * 2.5) {
      await createNotification(
        NOTIFICATION_IDS.dataEntryGap,
        'Unusual gap in shifts',
        `We noticed an unusual ${daysSinceLastShift}-day gap since your last shift compared to your usual schedule. Did you miss logging some entries?`,
        { scope: 'week', tone: 'info' }
      );
    }
  },
};
