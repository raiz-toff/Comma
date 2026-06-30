/**
 * Single source of truth for the SYNCED RECORD tables (cloud-sync — see
 * app/docs/sync-design.md §1a, §2). Both the change-log push/pull engine and any
 * future merge logic import this, so the synced set never drifts.
 *
 * This is the record bucket ONLY: the 10 user-data tables that carry the sync
 * columns (syncUpdatedAt / syncDeletedAt). It deliberately EXCLUDES:
 *   - `settings`            → profile / device-local KV, synced separately (§1a)
 *   - `locationPoints`,
 *     `tempNativePoints`    → bulky GPS scratch, never synced
 *
 * Ordering is parents → children so inserts satisfy FK references; deletes/wipes
 * walk it in reverse.
 */

import {
  vehicles,
  platforms,
  merchants,
  goals,
  taxHistory,
  shifts,
  maintenanceLogs,
  expenses,
  shiftPlatforms,
  vehicleTaxProfiles,
} from "./schema";

export const SYNCED_TABLES = [
  { name: "vehicles", table: vehicles },
  { name: "platforms", table: platforms },
  { name: "merchants", table: merchants },
  { name: "goals", table: goals },
  { name: "taxHistory", table: taxHistory },
  { name: "shifts", table: shifts },
  { name: "maintenanceLogs", table: maintenanceLogs },
  { name: "expenses", table: expenses },
  { name: "shiftPlatforms", table: shiftPlatforms },
  { name: "vehicleTaxProfiles", table: vehicleTaxProfiles },
] as const;

export type SyncedTableName = (typeof SYNCED_TABLES)[number]["name"];

/** Fast name → table lookup for applying incoming change-log rows. */
export const SYNCED_TABLE_BY_NAME: Record<string, (typeof SYNCED_TABLES)[number]["table"]> =
  Object.fromEntries(SYNCED_TABLES.map((t) => [t.name, t.table]));

/**
 * Drizzle `{ mode: 'timestamp' }` columns surface as `Date`, which JSON-serializes to an
 * ISO string. Incoming change-log rows must turn those strings back into `Date` before
 * insert, or Drizzle's timestamp mapper throws. Keep in sync with schema.ts.
 *
 * NOTE: the sync columns themselves (syncUpdatedAt / syncDeletedAt) are plain epoch-ms
 * `integer`s — NOT timestamp-mode — so they are intentionally absent here.
 */
export const TIMESTAMP_FIELDS: Record<string, readonly string[]> = {
  vehicles: ["createdAt"],
  goals: ["createdAt"],
  taxHistory: ["changedAt"],
  shifts: ["startTime", "endTime"],
  maintenanceLogs: ["date"],
  expenses: ["date"],
};

/** Revive ISO/epoch timestamp fields on an incoming row back into `Date` objects. */
export function reviveTimestamps(
  tableName: string,
  row: Record<string, unknown>
): Record<string, unknown> {
  const fields = TIMESTAMP_FIELDS[tableName];
  if (!fields) return row;
  const out: Record<string, unknown> = { ...row };
  for (const f of fields) {
    if (out[f] != null) out[f] = new Date(out[f] as string | number);
  }
  return out;
}
