# Database

Comma stores all data in a local SQLite database, accessed through Drizzle ORM.

**Database file:** `comma.db` in the app sandbox.  
**Schema location:** [`src/database/schema.ts`](../../src/database/schema.ts)  
**Queries:** [`src/database/queries/`](../../src/database/queries/)  
**Client init:** [`src/database/client.ts`](../../src/database/client.ts)

---

## Schema

### `vehicles`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (PK) | UUID |
| `name` | TEXT | Display name |
| `type` | TEXT | `car` \| `bike` \| `scooter` \| `van` \| `other` |
| `isActive` | BOOLEAN | Soft-delete for UI |
| `createdAt` | TIMESTAMP | |
| `make` | TEXT | Optional |
| `model` | TEXT | Optional |
| `year` | INTEGER | Optional |
| `fuelType` | TEXT | `gas` \| `electric` \| `hybrid` \| `other` |
| `licensePlate` | TEXT | Optional |
| `currentOdometer` | INTEGER | Running total, in miles/km |
| `syncUpdatedAt` | INTEGER | epoch ms — LWW sync clock |
| `syncDeletedAt` | INTEGER | epoch ms — soft-delete tombstone |

---

### `shifts`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (PK) | UUID |
| `vehicleId` | TEXT (FK → vehicles) | |
| `platform` | TEXT | Primary platform ID |
| `startTime` | TIMESTAMP | |
| `endTime` | TIMESTAMP | |
| `grossRevenue` | REAL | Base pay (not including tips) |
| `tipsRevenue` | REAL | Tips |
| `activeMileage` | REAL | GPS-tracked delivery miles |
| `deadMileage` | REAL | GPS-tracked commute/wait miles |
| `trackedMileage` | REAL | Deprecated — kept for backward compat |
| `durationSeconds` | INTEGER | Total elapsed seconds |
| `pausedSeconds` | INTEGER | Paused seconds (net = duration - paused) |
| `notes` | TEXT | Optional |
| `routePath` | TEXT | Encoded polyline (GPS route) |
| `reconciliationStatus` | TEXT | `tracking` \| `pending_reconciliation` \| `reconciled` |
| `startOdometer` | INTEGER | Optional manual odometer |
| `endOdometer` | INTEGER | Optional manual odometer |
| `distanceSource` | TEXT | `gps_only` \| `odometer` \| `manual` |
| `syncUpdatedAt` | INTEGER | |
| `syncDeletedAt` | INTEGER | |

---

### `shiftPlatforms`

Per-platform sub-record for multi-platform shifts.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (PK) | |
| `shiftId` | TEXT (FK → shifts, CASCADE) | |
| `platform` | TEXT | Platform ID |
| `platformOnlineSeconds` | INTEGER | Online time for this platform |
| `grossRevenue` | REAL | Earnings from this platform |
| `tipsRevenue` | REAL | Tips from this platform |
| `tripsCount` | INTEGER | Number of deliveries |
| `syncUpdatedAt` | INTEGER | |
| `syncDeletedAt` | INTEGER | |

---

### `expenses`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (PK) | |
| `shiftId` | TEXT (FK → shifts) | Optional — link to a specific shift |
| `vehicleId` | TEXT (FK → vehicles) | Optional |
| `category` | TEXT | Expense category key |
| `amount` | REAL | Total cost |
| `date` | TIMESTAMP | |
| `isDeductible` | BOOLEAN | Whether any portion is deductible |
| `deductiblePct` | REAL | 0–100; actual deduction = amount × pct/100 |
| `notes` | TEXT | |
| `receiptUri` | TEXT | Local file URI for receipt photo |
| `isRecurring` | BOOLEAN | |
| `recurringInterval` | TEXT | `weekly` \| `monthly` \| `yearly` |
| `merchant` | TEXT | Display name |
| `merchantNormalized` | TEXT | Normalized for grouping |
| `syncUpdatedAt` | INTEGER | |
| `syncDeletedAt` | INTEGER | |

---

### `vehicles`

*(See above.)*

---

### `maintenanceLogs`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (PK) | |
| `vehicleId` | TEXT (FK → vehicles) | |
| `type` | TEXT | `oil_change` \| `tire` \| `brake` \| `fuel` \| `wash` \| `other` |
| `cost` | REAL | |
| `odometer` | REAL | Optional reading at time of service |
| `date` | TIMESTAMP | |
| `notes` | TEXT | |
| `syncUpdatedAt` | INTEGER | |
| `syncDeletedAt` | INTEGER | |

---

### `goals`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (PK) | |
| `label` | TEXT | |
| `targetValue` | REAL | |
| `unit` | TEXT | `currency` \| `hours` \| `shifts` \| `mileage` |
| `period` | TEXT | `daily` \| `weekly` \| `monthly` \| `yearly` |
| `isActive` | BOOLEAN | |
| `createdAt` | TIMESTAMP | |
| `syncUpdatedAt` | INTEGER | |
| `syncDeletedAt` | INTEGER | |

---

### `platforms`

User's platform configuration (active/inactive, rates, display order).

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (PK) | Platform key (e.g. `doordash`) |
| `label` | TEXT | Display name |
| `color` | TEXT | Hex color |
| `textColor` | TEXT | Text color on badge |
| `country` | TEXT | `CA` \| `US` \| `UK` \| `NP` |
| `isActive` | BOOLEAN | User has activated this platform |
| `hourlyRate` | TEXT | Target hourly rate |
| `mileageRate` | TEXT | Per-mile/km rate |
| `sortPriority` | INTEGER | Order in pickers |
| `logoEmoji` | TEXT | Optional emoji logo |
| `syncUpdatedAt` | INTEGER | |
| `syncDeletedAt` | INTEGER | |

---

### `merchants`

Normalized merchant names for expense grouping.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (PK) | |
| `name` | TEXT (UNIQUE) | Display name |
| `normalizedName` | TEXT | Lowercased, stripped for matching |
| `syncUpdatedAt` | INTEGER | |
| `syncDeletedAt` | INTEGER | |

---

### `taxHistory`

Append-only log of tax region/rate changes.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (PK) | |
| `oldRegion` | TEXT | Previous province/state |
| `oldRate` | REAL | Previous rate |
| `newRegion` | TEXT | New province/state |
| `newRate` | REAL | New rate |
| `changedAt` | TIMESTAMP | |
| `syncUpdatedAt` | INTEGER | |
| `syncDeletedAt` | INTEGER | |

---

### `vehicleTaxProfiles`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (PK) | |
| `vehicleId` | TEXT (FK → vehicles, CASCADE) | |
| `taxYear` | INTEGER | e.g. 2025 |
| `country` | TEXT | `US` \| `CA` \| `UK` \| `NP` |
| `deductionMethod` | TEXT | `standard_mileage` \| `actual_expenses` |
| `standardRatePrimary` | REAL | IRS/CRA/HMRC rate (first tier) |
| `standardRateSecondary` | REAL | Second-tier rate (UK: after 10k miles) |
| `rateThreshold` | REAL | Miles at which rate steps down |
| `beginningYearOdometer` | INTEGER | Odometer Jan 1 |
| `endingYearOdometer` | INTEGER | Odometer Dec 31 |
| `syncUpdatedAt` | INTEGER | |
| `syncDeletedAt` | INTEGER | |

---

### `settings`

Key-value store for app configuration.

| Column | Type | Notes |
|---|---|---|
| `key` | TEXT (PK) | Settings key |
| `value` | TEXT | JSON-serialized value |

Key examples: `profile`, `active_shift_state`, `sync_device_id`, `sync_applied_logs`, `sync_last_pushed_at`, `sync_enabled`

---

### `locationPoints`

GPS points recorded during GPS-tracked shifts.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (PK) | |
| `sessionId` | TEXT | Shift session identifier |
| `shiftId` | TEXT (FK → shifts) | |
| `latitude` | REAL | |
| `longitude` | REAL | |
| `altitude` | REAL | |
| `accuracy` | REAL | GPS horizontal accuracy (meters) |
| `speed` | REAL | m/s at time of point |
| `timestamp` | TIMESTAMP | |
| `source` | TEXT | `gps` (default) |
| `isFiltered` | BOOLEAN | true = discarded by jitter filter |

Not synced to cloud. Device-local ephemeral data.

---

### `tempNativePoints`

Staging table for the native GPS module. The native Kotlin/Swift code writes raw GPS points here; JS polls and processes them into `locationPoints`.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER (PK, autoincrement) | |
| `lat` | REAL | |
| `lon` | REAL | |
| `timestamp` | INTEGER | epoch ms |

Not synced.

---

### `syncOverwriteLog`

Local audit trail for cloud sync merge conflicts on financial data. Device-local — not synced.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (PK) | |
| `tableName` | TEXT | Which table had the conflict |
| `rowId` | TEXT | The row's primary key |
| `supersededRow` | TEXT | JSON of the local row that lost |
| `winnerRow` | TEXT | JSON of the incoming row that won |
| `mergedAt` | INTEGER | epoch ms |

---

## Sync columns

Every synced table has two additional columns:

```ts
syncUpdatedAt: integer  // epoch ms of last local mutation — the LWW clock
syncDeletedAt: integer  // epoch ms of soft-delete, null if alive
```

Every read query filters `WHERE syncDeletedAt IS NULL`. Every write touches `syncUpdatedAt`.

See [Cloud Sync](../backup-and-sync/cloud-sync.md) for design details.

---

## Migrations

Migrations are defined in `src/database/client.ts` using Drizzle's migration system. When the app launches, it runs any pending migrations before the first query.

To add a migration: add a new entry to the migrations array in `client.ts` with the SQL to run and an incremented version number. Migrations are idempotent — they check whether the change already exists before applying it.

---

## Query conventions

- All queries live in `src/database/queries/` — one file per domain (analytics, shifts, expenses, etc.).
- No raw SQL strings in screen components. All SQL is in query files.
- No JavaScript-level filtering of data that should be filtered in SQL (e.g. no `.filter()` on a result set that could use `WHERE`).
- Mutations use `syncedInsert` / `syncedUpdate` / `syncedDelete` from `src/database/syncedWrites.ts` to automatically stamp sync columns.
