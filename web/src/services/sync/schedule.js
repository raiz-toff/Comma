/**
 * Auto-push schedule rules (interop plan Workstream 3).
 * Ports mobile's `commaApp/src/services/sync/schedule.ts` verbatim — pure + testable (no I/O).
 *
 * The user picks an auto-push cadence (WhatsApp-style "how often to back up"); this decides
 * whether a push is due at a session boundary. PULL always happens on foreground regardless —
 * only PUSH is throttled by the schedule.
 *
 * @typedef {'manual'|'daily'|'weekly'} SyncSchedule
 */

export const DEFAULT_SCHEDULE = 'daily';

/** Minimum gap between automatic pushes, per schedule. `manual` never auto-pushes. */
export const SCHEDULE_INTERVAL_MS = {
  manual: Infinity,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

/** User-facing labels for the schedule picker. */
export const SCHEDULE_LABELS = {
  manual: 'Manual',
  daily: 'Daily',
  weekly: 'Weekly',
};

export const SYNC_SCHEDULES = ['manual', 'daily', 'weekly'];

/**
 * Narrow an arbitrary stored string back to a valid SyncSchedule (default on garbage).
 * @param {string|null|undefined} value
 * @returns {SyncSchedule}
 */
export function coerceSchedule(value) {
  return value === 'manual' || value === 'daily' || value === 'weekly' ? value : DEFAULT_SCHEDULE;
}

/**
 * Is an automatic push due now? True when the schedule is not `manual` AND at least the
 * schedule interval has elapsed since the last push run. `lastPushRunAt = 0` (never pushed)
 * makes any non-manual schedule due immediately.
 * @param {SyncSchedule} schedule
 * @param {number} lastPushRunAt
 * @param {number} now
 * @returns {boolean}
 */
export function isSyncDue(schedule, lastPushRunAt, now) {
  if (schedule === 'manual') return false;
  return now - lastPushRunAt >= SCHEDULE_INTERVAL_MS[schedule];
}
