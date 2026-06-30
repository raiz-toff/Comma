/**
 * Sync write/read helpers (cloud-sync P1 — see app/docs/sync-design.md §2).
 *
 * Every SYNCED record table carries two columns (schema.ts `syncColumns`):
 *   - syncUpdatedAt: epoch ms of the last LOCAL mutation — the Last-Write-Wins clock.
 *   - syncDeletedAt: epoch ms when soft-deleted, else null — a tombstone so deletions
 *     propagate to other devices instead of silently reappearing on the next pull.
 *
 * These primitives centralize the sync semantics so the ~58 call sites stay consistent.
 * They are deliberately small and composable rather than a single wrapper: each query
 * function keeps its own `if (isWeb) { localStorage } else { db }` branch (the existing
 * project style), and just threads the right primitive through both branches.
 *
 * Rules these enforce:
 *   - Inserts/updates stamp syncUpdatedAt = now.
 *   - A user-initiated delete becomes a soft-delete (set the tombstone), NOT a hard DELETE,
 *     so the deletion can sync. (Hard delete is still correct for local-only scratch like
 *     tempNativePoints and for delete-then-reinsert "replace" operations — those bypass
 *     these helpers on purpose.)
 *   - Reads hide tombstoned rows.
 */

import { isNull, type SQL } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";

/** Current wall-clock in epoch ms. Single source so it's easy to find/replace if we
 *  ever need a monotonic or server-corrected clock (see §5 clock-skew note). */
export function syncNow(): number {
  return Date.now();
}

/** Shape of the two sync columns, as plain values (works for both the localStorage
 *  web branch and Drizzle's `.values()` / `.set()`). */
export interface SyncStamp {
  syncUpdatedAt: number;
  syncDeletedAt?: number | null;
}

/**
 * Stamp a payload for INSERT: set syncUpdatedAt = now. A fresh row is never born
 * tombstoned, so syncDeletedAt is left as the column default (null) unless the caller
 * explicitly passed one.
 */
export function stampInsert<T extends Record<string, unknown>>(payload: T): T & { syncUpdatedAt: number } {
  return { ...payload, syncUpdatedAt: syncNow() };
}

/**
 * Stamp a partial payload for UPDATE: set syncUpdatedAt = now. Any caller-supplied
 * sync fields are preserved (the spread puts our stamp last only for syncUpdatedAt).
 */
export function stampUpdate<T extends Record<string, unknown>>(patch: T): T & { syncUpdatedAt: number } {
  return { ...patch, syncUpdatedAt: syncNow() };
}

/**
 * The patch to apply (via `.set(...)` on native, or object-merge on web) to perform a
 * SOFT delete: mark the tombstone and bump the LWW clock so the deletion wins on merge.
 * Use this in place of `db.delete(...)` for user-initiated deletes of synced records.
 */
export function softDeletePatch(): SyncStamp {
  const now = syncNow();
  return { syncDeletedAt: now, syncUpdatedAt: now };
}

/**
 * Drizzle WHERE fragment that excludes tombstoned rows. Pass the table's syncDeletedAt
 * column: `where(notDeleted(shifts.syncDeletedAt))`, or compose with `and(...)`.
 */
export function notDeleted(syncDeletedAtColumn: SQLiteColumn): SQL {
  return isNull(syncDeletedAtColumn);
}

/**
 * Web/localStorage predicate equivalent of `notDeleted`: true if the row is not
 * tombstoned. Use to `.filter(isNotDeleted)` after JSON.parse on the web branch.
 */
export function isNotDeleted(row: { syncDeletedAt?: number | null }): boolean {
  return row.syncDeletedAt == null;
}
