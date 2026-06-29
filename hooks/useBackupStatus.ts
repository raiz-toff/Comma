import { Platform } from "react-native";
import { eq } from "drizzle-orm";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/src/database/client";
import { settings } from "@/src/database/schema";

const isWeb = Platform.OS === "web";

/** Consider a backup stale after this many days without one. */
export const BACKUP_STALE_DAYS = 7;

export interface BackupStatus {
  /** ISO timestamp of the last successful backup, or null if never. */
  lastBackupAt: string | null;
  /** Whole days since the last backup; null if never backed up. */
  daysSince: number | null;
  /** User has opted in to overdue reminders (Settings → Alerts). */
  reminderEnabled: boolean;
  /** True when the reminder is on AND it's been too long (or never). */
  isOverdue: boolean;
}

/** Read a settings KV value, honoring the web localStorage fallback. */
async function readRaw(key: string, webKey: string): Promise<string | null> {
  if (isWeb) return localStorage.getItem(webKey);
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

async function fetchBackupStatus(): Promise<BackupStatus> {
  // last_backup_at is written by googleDrive.ts: raw key on native, comma_last_backup_at on web.
  const lastBackupAt = await readRaw("last_backup_at", "comma_last_backup_at");

  // backupOverdue lives inside the notification_prefs JSON blob. Default ON for a
  // local-only app — only treat it as off when the user has explicitly disabled it.
  const prefsRaw = await readRaw("notification_prefs", "comma_setting_notification_prefs");
  let reminderEnabled = true;
  if (prefsRaw) {
    try {
      const parsed = JSON.parse(prefsRaw);
      // Respect an explicit false; missing key still defaults to enabled.
      reminderEnabled = parsed?.backupOverdue !== false;
    } catch {
      reminderEnabled = true;
    }
  }

  let daysSince: number | null = null;
  if (lastBackupAt) {
    const ms = Date.now() - new Date(lastBackupAt).getTime();
    daysSince = Math.floor(ms / 86_400_000);
  }

  // Overdue only matters when the user asked to be reminded.
  const tooLong = daysSince === null || daysSince >= BACKUP_STALE_DAYS;
  const isOverdue = reminderEnabled && tooLong;

  return { lastBackupAt, daysSince, reminderEnabled, isOverdue };
}

/**
 * Backup staleness for the Dashboard reminder banner. Honors the user's
 * "Backup overdue" alert toggle — returns isOverdue=false when it's off.
 */
export function useBackupStatus(enabled = true) {
  return useQuery({
    queryKey: ["backup", "status"],
    queryFn: fetchBackupStatus,
    enabled,
    staleTime: 60_000,
  });
}
