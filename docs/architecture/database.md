# Database

The phone app stores all data in a local SQLite database, defined with Drizzle ORM and reached only through query helpers.

**Schema:** [`src/database/schema.ts`](../../src/database/schema.ts) (the source of truth)
**Queries:** [`src/database/queries/`](../../src/database/queries/)
**Client and migrations:** [`src/database/client.ts`](../../src/database/client.ts)

Every column below is taken from the schema. Eleven tables carry the two sync columns and participate in cloud sync; four (`settings`, `locationPoints`, `tempNativePoints`, `syncOverwriteLog`) are deliberately device-local.

<Chips accent="teal" items={["shifts", "shiftPlatforms", "expenses", "merchants", "vehicles", "maintenanceLogs", "vehicleTaxProfiles", "goals", "platforms", "taxHistory", "profile"]} caption="The eleven synced tables. Each row carries syncUpdatedAt (the last-write-wins clock) and syncDeletedAt (the tombstone) — every read filters the tombstones out." />

---

## `shifts`

One row per shift.

| Column | Type | Notes |
|---|---|---|
| `id` | text (PK) | |
| `vehicleId` | text (FK → vehicles) | Nullable |
| `platform` | text | Primary platform id (comma-joined for multi-platform shifts) |
| `startTime` | timestamp | |
| `endTime` | timestamp | |
| `grossRevenue` | real | Base pay, default 0 |
| `tipsRevenue` | real | Tips, default 0 |
| `bonusAmount` | real | Bonuses and promotions, default 0 |
| `trackedMileage` | real | Deprecated — superseded by `activeMileage`, kept for backward compatibility |
| `deadMileage` | real | GPS distance while not on a delivery, default 0 |
| `activeMileage` | real | GPS delivery distance, default 0 |
| `durationSeconds` | integer | Total elapsed shift time, default 0 |
| `pausedSeconds` | integer | Paused time; net active time = `durationSeconds` − `pausedSeconds` |
| `notes` | text | Nullable |
| `routePath` | text | Encoded route (JSON array of simplified lat/lng/timestamp points) |
| `reconciliationStatus` | text | `tracking` \| `pending_reconciliation` \| `reconciled` (default `reconciled`) |
| `startOdometer` | integer | Optional manual odometer reading |
| `endOdometer` | integer | Optional manual odometer reading |
| `distanceSource` | text | `gps_only` (default) \| `odometer` \| `manual` |
| `syncUpdatedAt` | integer | Sync clock |
| `syncDeletedAt` | integer | Tombstone |

---

## `shiftPlatforms`

Per-platform sub-record for a shift run across more than one platform. Cascades on shift delete.

| Column | Type | Notes |
|---|---|---|
| `id` | text (PK) | |
| `shiftId` | text (FK → shifts, cascade) | |
| `platform` | text | Platform id |
| `platformOnlineSeconds` | integer | Online time on this platform, default 0 |
| `platformActiveSeconds` | integer | On-delivery time on this platform, default 0 |
| `grossRevenue` | real | Earnings from this platform, default 0 |
| `tipsRevenue` | real | Tips from this platform, default 0 |
| `tripsCount` | integer | Deliveries, default 0 |
| `syncUpdatedAt` | integer | |
| `syncDeletedAt` | integer | |

---

## `expenses`

| Column | Type | Notes |
|---|---|---|
| `id` | text (PK) | |
| `shiftId` | text (FK → shifts) | Optional link to a shift |
| `category` | text | Expense category key |
| `amount` | real | Total cost |
| `date` | timestamp | |
| `isDeductible` | boolean | Default true |
| `deductiblePct` | real | 0–100; deductible amount = `amount` × `deductiblePct` / 100 (default 100) |
| `vehicleId` | text (FK → vehicles) | Optional |
| `notes` | text | Nullable |
| `receiptUri` | text | Local file URI for a receipt photo |
| `isRecurring` | boolean | Default false |
| `recurringInterval` | text | `weekly` \| `monthly` \| `yearly` |
| `merchant` | text | Display name, default empty |
| `merchantNormalized` | text | Normalized for grouping, default empty |
| `syncUpdatedAt` | integer | |
| `syncDeletedAt` | integer | |

---

## `merchants`

Normalized merchant names for expense grouping.

| Column | Type | Notes |
|---|---|---|
| `id` | text (PK) | |
| `name` | text (unique) | Display name |
| `normalizedName` | text | Lowercased, stripped for matching |
| `syncUpdatedAt` | integer | |
| `syncDeletedAt` | integer | |

---

## `vehicles`

| Column | Type | Notes |
|---|---|---|
| `id` | text (PK) | |
| `name` | text | Display name |
| `type` | text | Vehicle type key, e.g. `car`, `scooter`, `ebike` |
| `isActive` | boolean | Default true |
| `createdAt` | timestamp | |
| `make` | text | Optional |
| `model` | text | Optional |
| `year` | integer | Optional |
| `fuelType` | text | `gas` \| `electric` \| `hybrid` \| `other` |
| `licensePlate` | text | Optional |
| `currentOdometer` | integer | Running total, default 0 |
| `syncUpdatedAt` | integer | |
| `syncDeletedAt` | integer | |

---

## `maintenanceLogs`

| Column | Type | Notes |
|---|---|---|
| `id` | text (PK) | |
| `vehicleId` | text (FK → vehicles) | |
| `type` | text | `oil_change` \| `tire` \| `brake` \| `fuel` \| `wash` \| `other` |
| `cost` | real | |
| `odometer` | real | Optional reading at time of service |
| `date` | timestamp | |
| `notes` | text | |
| `syncUpdatedAt` | integer | |
| `syncDeletedAt` | integer | |

---

## `vehicleTaxProfiles`

Per-vehicle, per-year tax method. Cascades on vehicle delete.

| Column | Type | Notes |
|---|---|---|
| `id` | text (PK) | |
| `vehicleId` | text (FK → vehicles, cascade) | |
| `taxYear` | integer | e.g. 2026 |
| `country` | text | Country id |
| `deductionMethod` | text | `standard_mileage` \| `actual_expenses` |
| `standardRatePrimary` | real | First-tier per-distance rate |
| `standardRateSecondary` | real | Second-tier rate (e.g. Canada above the km threshold) |
| `rateThreshold` | real | Distance at which the rate steps down |
| `beginningYearOdometer` | integer | Reading at the start of the year |
| `endingYearOdometer` | integer | Reading at the end of the year |
| `syncUpdatedAt` | integer | |
| `syncDeletedAt` | integer | |

---

## `goals`

| Column | Type | Notes |
|---|---|---|
| `id` | text (PK) | |
| `label` | text | |
| `targetValue` | real | |
| `unit` | text | `currency` \| `hours` \| `shifts` \| `mileage` |
| `period` | text | `daily` \| `weekly` \| `monthly` \| `yearly` |
| `isActive` | boolean | Default true |
| `createdAt` | timestamp | |
| `syncUpdatedAt` | integer | |
| `syncDeletedAt` | integer | |

---

## `platforms`

The user's platform configuration. Comma ships Canada only, so `country` holds `CA` in practice, though the column can carry other codes.

| Column | Type | Notes |
|---|---|---|
| `id` | text (PK) | Platform key, e.g. `doordash` |
| `label` | text | Display name |
| `color` | text | Hex color |
| `textColor` | text | Text color on a badge |
| `country` | text | Country id |
| `isActive` | boolean | User has activated it (default false) |
| `hourlyRate` | text | Target hourly rate (default `20`) |
| `mileageRate` | text | Per-distance rate (default `0.62`) |
| `sortPriority` | integer | Order in pickers (default 1) |
| `logoEmoji` | text | Optional |
| `syncUpdatedAt` | integer | |
| `syncDeletedAt` | integer | |

---

## `taxHistory`

Append-only log of tax region and rate changes.

| Column | Type | Notes |
|---|---|---|
| `id` | text (PK) | |
| `oldRegion` | text | Previous region |
| `oldRate` | real | Previous rate |
| `newRegion` | text | New region |
| `newRate` | real | New rate |
| `changedAt` | timestamp | |
| `syncUpdatedAt` | integer | |
| `syncDeletedAt` | integer | |

---

## `profile`

A synced key-value table: one row per key, each carrying the sync columns, so the record-level engine gives per-key last-write-wins for free. This is the profile data that **travels with the user** — name, country, province, units, currency, goals, withholding rate, onboarding-complete — which is why signing a fresh device into sync brings it up already configured. Values are JSON-encoded. Both apps bridge their local profile storage into and out of this table around each sync.

| Column | Type | Notes |
|---|---|---|
| `key` | text (PK) | Profile key |
| `value` | text | JSON-encoded value |
| `syncUpdatedAt` | integer | |
| `syncDeletedAt` | integer | |

---

## `settings` (device-local)

A key-value store for configuration that stays on the device and does **not** sync: sync cursors, the demo flag, the active-shift snapshot, and scratch. No sync columns.

| Column | Type | Notes |
|---|---|---|
| `key` | text (PK) | |
| `value` | text | JSON-encoded value |

Example keys: `onboarding_completed`, `profile`, `app_config`, `demo_mode`, `active_platform_filter`, `preferred_vehicle_id`, `active_shift_state`, `shift_templates`.

---

## `locationPoints` (device-local)

Filtered GPS points from a tracked shift, for route replay and recalculation. Not synced.

| Column | Type | Notes |
|---|---|---|
| `id` | text (PK) | |
| `sessionId` | text | Shift session identifier |
| `shiftId` | text (FK → shifts) | |
| `latitude` | real | |
| `longitude` | real | |
| `altitude` | real | |
| `accuracy` | real | Horizontal accuracy (meters) |
| `speed` | real | m/s at the point |
| `timestamp` | timestamp | |
| `source` | text | `gps` (default) |
| `isFiltered` | boolean | True = discarded by the jitter filter |

---

## `tempNativePoints` (device-local)

Staging table the native Kotlin module writes raw GPS points into; `useActiveShift` reads it on shift end. Not synced.

| Column | Type | Notes |
|---|---|---|
| `id` | integer (PK, autoincrement) | |
| `lat` | real | |
| `lon` | real | |
| `timestamp` | integer | epoch ms |

---

## `syncOverwriteLog` (device-local)

Append-only recovery log for the sync merge engine. When a last-write-wins merge overwrites a financial row (`expenses`, `taxHistory`, `shifts`, `shiftPlatforms`) that had real local edits, the superseded version is recorded here first, so a number changed on another device is never lost silently. Deliberately has no sync columns and is not itself synced.

| Column | Type | Notes |
|---|---|---|
| `id` | text (PK) | |
| `tableName` | text | Table that had the conflict |
| `rowId` | text | The row's primary key |
| `supersededRow` | text | JSON of the local row that lost |
| `winnerRow` | text | JSON of the incoming row that won |
| `mergedAt` | integer | epoch ms of the merge |

---

## Sync columns

Every synced table carries two columns, spread from a shared definition:

```ts
syncUpdatedAt: integer  // epoch ms of the last local mutation — the last-write-wins clock (default 0)
syncDeletedAt: integer  // epoch ms of a soft delete, else null — the tombstone
```

A delete is a **soft delete**: the row is stamped with `syncDeletedAt` and kept, so the deletion can propagate to other devices instead of being resurrected by them. Every read filters `WHERE syncDeletedAt IS NULL`; every write touches `syncUpdatedAt`. The default of 0 means any pre-sync row is treated as oldest, so an incoming change wins until that row is next edited locally.

The eleven synced tables are: `shifts`, `shiftPlatforms`, `expenses`, `merchants`, `vehicles`, `maintenanceLogs`, `vehicleTaxProfiles`, `goals`, `platforms`, `taxHistory`, and `profile`.

See [Cloud Sync](../backup-and-sync/cloud-sync.md) for the merge design.

---

## Conventions

- All queries live in `src/database/queries/`, one file per domain. No raw SQL in screens or hooks.
- No JavaScript-level filtering of data that a `WHERE` clause could filter.
- Mutations go through `syncedInsert` / `syncedUpdate` / `syncedDelete` (`src/database/syncedWrites.ts`) so sync columns are stamped automatically. Direct writes are only acceptable on the tables that are not synced.
