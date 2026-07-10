import {
  NOTIFICATION_IDS,
  createNotification,
  daysBetween,
} from '../../modules/notifications/notification-internal.js';
import { getUser } from '../../core/db.js';

export default {
  id: NOTIFICATION_IDS.backupOverdue,
  type: 'toast',
  cooldown: '7d',
  message: () => '',
  priority: 28,
  userToggleable: true,
  condition: async () => false,
  /** @param {{ now: Date }} ctx */
  evaluate: async (ctx) => {
    const user = await getUser();
    const lastBackup = user?.lastBackupAt;
    if (typeof lastBackup === 'string' && lastBackup) {
      const d = new Date(lastBackup);
      const now = ctx?.now || new Date();
      if (!Number.isNaN(d.getTime()) && daysBetween(d, now) >= 14) {
        await createNotification(
          NOTIFICATION_IDS.backupOverdue,
          'Backup recommended',
          'Your last backup is over 14 days old. A fresh export keeps your data safe.',
          { scope: 'week', tone: 'warning' },
        );
      }
    } else {
      // If never backed up, show recommendation
      await createNotification(
        NOTIFICATION_IDS.backupOverdue,
        'Backup recommended',
        'Your data is not backed up yet. A fresh export keeps your data safe.',
        { scope: 'week', tone: 'warning' },
      );
    }
  },
};
