/**
 * P8 — Notifications System.
 * On app-open checks with persistence in `notifications` table.
 * Per-type checks iterate NotificationRegistry.
 */

import { db, getUser } from '../../core/db.js';
import { isUserVaultActive } from '../../core/vault-gate.js';
import { store } from '../../core/store.js';
import { bus } from '../../core/events.js';
import { getDemoAnalyticsAnchorDate } from '../demo/sample-year.js';
import { NotificationRegistry } from '../../registry/notifications/index.js';
import {
  NOTIFICATION_IDS,
  num,
  nowIso,
  weekBounds,
  ymd,
  subtractDays,
  getPrefForType,
} from './notification-internal.js';

export { NOTIFICATION_IDS as NOTIFICATION_TYPES } from './notification-internal.js';
export { createNotification, getPrefForType, normalizeTypePref } from './notification-internal.js';

/**
 * Full P8 notification sweep, intended for app-open.
 * @returns {Promise<void>}
 */
export async function checkAllNotifications() {
  const user = await getUser();
  if (!user || !isUserVaultActive(user)) return;
  const now = store.get('demoMode') ? getDemoAnalyticsAnchorDate() : new Date();
  const today = ymd(now);

  // Non-blocking purge of dismissed notifications older than 90 days (Bug K)
  (async () => {
    try {
      const NOTIF_TTL_DAYS = 90;
      const cutoff = subtractDays(today, NOTIF_TTL_DAYS);
      await db.notifications
        .where('createdAt').below(cutoff + 'T00:00:00')
        .filter((n) => n.dismissed === true)
        .delete();
    } catch (e) {
      console.warn('[notifications] failed to purge old dismissed notifications', e);
    }
  })();

  const weekStartDay = Math.max(0, Math.min(6, num(user?.locale?.weekStartDay, 0)));
  const week = weekBounds(now, weekStartDay);
  const weekStart = ymd(week.start);
  const weekEnd = ymd(week.end);

  const ANALYSIS_WINDOW_DAYS = 90;
  const windowStart = subtractDays(today, ANALYSIS_WINDOW_DAYS);

  const [recentShifts, todayShifts, weekShifts, weekExpenses] = await Promise.all([
    db.shifts.where('date').aboveOrEqual(windowStart)
             .filter((s) => s.deletedAt == null).toArray(),
    db.shifts.where('date').equals(today)
             .filter((s) => s.deletedAt == null).toArray(),
    db.shifts.where('date').between(weekStart, weekEnd, true, true)
             .filter((s) => s.deletedAt == null).toArray(),
    db.expenses.where('date').between(weekStart, weekEnd, true, true)
               .filter((e) => e.deletedAt == null).toArray(),
  ]);

  const ctx = {
    user,
    now,
    today,
    weekStartDay,
    week,
    weekStart,
    weekEnd,
    recentShifts,
    todayShifts,
    weekShifts,
    weekExpenses,
  };

  const defs = [...NotificationRegistry.getAll()].sort((a, b) => num(a.priority, 99) - num(b.priority, 99));

  // Run all evaluations concurrently, checking throttles and executing
  const results = await Promise.allSettled(
    defs.map(async (def) => {
      if (def.id === 'placeholder' || typeof def.evaluate !== 'function') return;

      // Throttle checks according to the configured frequency preference
      const pref = getPrefForType(user.notificationPrefs, def.id);
      if (pref.frequency === 'daily') {
        const throttleKey = `notif:throttle:${def.id}:day:${ctx.today}`;
        const already = await db.notifications.get(throttleKey);
        if (already) return;
      }
      if (pref.frequency === 'weekly') {
        const throttleKey = `notif:throttle:${def.id}:week:${ctx.weekStart}`;
        const already = await db.notifications.get(throttleKey);
        if (already) return;
      }

      await def.evaluate(ctx);
    })
  );

  // Log any rejections for diagnostics:
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.warn(`Rule ${defs[i].id} threw:`, r.reason);
    }
  });
}

/** @returns {Promise<void>} */
export async function runOnOpenNotificationCheck() {
  await checkAllNotifications();
}

/**
 * Mark a notification as read (Feature: read tracking).
 * @param {string} id
 */
export async function markNotificationRead(id) {
  if (!id) return;
  const count = await db.notifications.update(id, { read: true, readAt: nowIso() });
  if (count > 0) {
    bus.emit('notification:unread-change');
  }
}

/**
 * Mark a notification as dismissed (Feature: dismiss tracking).
 * @param {string} id
 */
export async function dismissNotification(id) {
  if (!id) return;
  const count = await db.notifications.update(id, { dismissed: true, dismissedAt: nowIso(), read: true });
  if (count > 0) {
    bus.emit('notification:unread-change');
  }
}
