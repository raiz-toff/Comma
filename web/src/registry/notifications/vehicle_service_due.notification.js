import {
  NOTIFICATION_IDS,
  createNotification,
} from '../../modules/notifications/notification-internal.js';
import { db } from '../../core/db.js';

export default {
  id: NOTIFICATION_IDS.vehicleServiceDue,
  type: 'toast',
  cooldown: '30d',
  message: () => '',
  priority: 32,
  userToggleable: true,
  condition: async () => false,
  /** @param {{ user: Record<string, unknown> }} ctx */
  evaluate: async (ctx) => {
    // Sum cumulative activeMileage across all non-deleted shifts
    const shifts = await db.shifts.filter((s) => s.deletedAt == null).toArray();
    const totalKm = shifts.reduce((sum, s) => sum + (Number(s.activeMileage) || 0), 0);

    const milestoneInterval = 5000;
    const currentMilestone = Math.floor(totalKm / milestoneInterval) * milestoneInterval;

    if (currentMilestone >= 5000) {
      const key = `notif:${NOTIFICATION_IDS.vehicleServiceDue}:km:${currentMilestone}`;
      const existing = await db.notifications.get(key);
      if (!existing) {
        await createNotification(
          NOTIFICATION_IDS.vehicleServiceDue,
          'Vehicle service reminder',
          `Your cumulative tracked distance has reached ${currentMilestone.toLocaleString()} km. It might be time for a routine oil change, tire rotation, or vehicle inspection.`,
          { scope: 'ever', tone: 'info', dedupeKey: key }
        );
      }
    }
  },
};
