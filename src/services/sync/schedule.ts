/**
 * Auto-push schedule rules (cloud-sync P4 — see sync-design.md §4).
 *
 * Pure + testable (no I/O). The user picks an auto-push cadence (WhatsApp-style "how
 * often to back up"); this decides whether a push is due at a session boundary. PULL
 * always happens on foreground regardless — only PUSH is throttled by the schedule.
 */

export type SyncSchedule = "manual" | "daily" | "weekly";

export const DEFAULT_SCHEDULE: SyncSchedule = "daily";

/** Minimum gap between automatic pushes, per schedule. `manual` never auto-pushes. */
export const SCHEDULE_INTERVAL_MS: Record<SyncSchedule, number> = {
  manual: Infinity,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

/** User-facing labels for the schedule picker. */
export const SCHEDULE_LABELS: Record<SyncSchedule, string> = {
  manual: "Manual",
  daily: "Daily",
  weekly: "Weekly",
};

export const SYNC_SCHEDULES: readonly SyncSchedule[] = ["manual", "daily", "weekly"];

/** Narrow an arbitrary stored string back to a valid SyncSchedule (default on garbage). */
export function coerceSchedule(value: string | null | undefined): SyncSchedule {
  return value === "manual" || value === "daily" || value === "weekly" ? value : DEFAULT_SCHEDULE;
}

/**
 * Is an automatic push due now? True when the schedule is not `manual` AND at least the
 * schedule interval has elapsed since the last push run. `lastPushRunAt = 0` (never
 * pushed) makes any non-manual schedule due immediately.
 */
export function isSyncDue(schedule: SyncSchedule, lastPushRunAt: number, now: number): boolean {
  if (schedule === "manual") return false;
  return now - lastPushRunAt >= SCHEDULE_INTERVAL_MS[schedule];
}
