/**
 * Single source of truth for the SYNCED RECORD tables (interop plan Workstream 3).
 * Ports mobile's `commaApp/src/database/syncedTables.ts` — the record bucket ONLY: the 10
 * user-data tables that carry the sync columns (`syncUpdatedAt`/`syncDeletedAt`, see
 * `src/core/db.js` STORES_V5 doc). Both push and apply import this, so the synced set never
 * drifts.
 *
 * Deliberately EXCLUDES `locationPoints` (bulky, unsynced GPS scratch — mirrors mobile) and
 * every other web-only table (`users`, `appState`, `badges`, `notifications`, `challenges`,
 * `xpLog`, `backupLog`, `vehicleOdometerLog`, `fuelPrices`, `goalHistory`) — none of those are
 * in mobile's `SYNCED_TABLES` either.
 *
 * Unlike mobile's version, this file does NOT need a `reviveTimestamps` step: web stores plain
 * JS values in Dexie already (no ORM column-mode coercion to undo), so an incoming change-log
 * row's fields (including the epoch-ms `startTime`/`endTime` on shifts, per Fix 1) are already
 * in the right shape to write straight into Dexie.
 */

import { db } from '../../core/db.js';

export const SYNCED_TABLES = [
  // Synced user PROFILE (bucket b — per-key KV; the record engine gives per-key LWW free).
  { name: 'profile', table: db.profile },
  { name: 'vehicles', table: db.vehicles },
  { name: 'platforms', table: db.platforms },
  { name: 'merchants', table: db.merchants },
  { name: 'goals', table: db.goals },
  { name: 'taxHistory', table: db.taxHistory },
  { name: 'shifts', table: db.shifts },
  { name: 'maintenanceLogs', table: db.vehicleMaintenanceLogs },
  { name: 'expenses', table: db.expenses },
  { name: 'shiftPlatforms', table: db.shiftPlatforms },
  { name: 'vehicleTaxProfiles', table: db.vehicleTaxProfiles },
];

/** Fast name → Dexie table lookup for applying incoming change-log rows. */
export const SYNCED_TABLE_BY_NAME = Object.fromEntries(SYNCED_TABLES.map((t) => [t.name, t.table]));
