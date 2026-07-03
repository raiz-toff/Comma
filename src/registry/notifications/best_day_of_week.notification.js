import {
  NOTIFICATION_IDS,
  createNotification,
  subtractDays,
} from '../../modules/notifications/notification-internal.js';

export default {
  id: NOTIFICATION_IDS.bestDayOfWeek,
  type: 'toast',
  cooldown: '30d',
  message: () => '',
  priority: 50,
  userToggleable: true,
  condition: async () => false,
  /** @param {{ today: string; recentShifts: Array<Record<string, unknown>> }} ctx */
  evaluate: async (ctx) => {
    const startOfPeriod = subtractDays(ctx.today, 56); // 8 weeks
    const last8WeeksShifts = ctx.recentShifts.filter((s) => {
      return s.deletedAt == null && s.date && s.date >= startOfPeriod;
    });

    if (last8WeeksShifts.length < 5) return; // ignore if very few shifts logged

    const weekdayGross = {};

    for (const s of last8WeeksShifts) {
      const d = new Date(s.date + 'T12:00:00');
      if (Number.isNaN(d.getTime())) continue;
      const day = d.getDay(); // 0 = Sunday, 1 = Monday, etc.

      const dollars = Math.max(0, Number(s.grossRevenue) || 0);

      weekdayGross[day] = (weekdayGross[day] || 0) + dollars;
    }

    let bestDay = -1;
    let maxGross = 0;

    for (let day = 0; day < 7; day++) {
      const gross = weekdayGross[day] || 0;
      if (gross > maxGross) {
        maxGross = gross;
        bestDay = day;
      }
    }

    if (bestDay >= 0 && maxGross > 0) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const bestDayName = dayNames[bestDay];

      await createNotification(
        NOTIFICATION_IDS.bestDayOfWeek,
        'Best earning day insight',
        `Your best earning day over the last 8 weeks has been ${bestDayName}. Consider scheduling more shifts then to maximize your revenue.`,
        { scope: 'month', tone: 'info' }
      );
    }
  },
};
