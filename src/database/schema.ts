import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

/**
 * Sync columns (cloud-sync P1 — see app/docs/sync-design.md).
 *
 * Spread into every SYNCED record table (the 11 in BACKUP_TABLES). Intentionally
 * NOT on settings (split into profile vs device-local later), locationPoints, or
 * tempNativePoints (local GPS scratch, never synced).
 *
 *  - syncUpdatedAt: epoch ms of the last LOCAL mutation. The Last-Write-Wins clock.
 *      Default 0 so pre-sync rows already in the DB are treated as "oldest" and any
 *      incoming change wins until the row is next touched locally.
 *  - syncDeletedAt: epoch ms when soft-deleted, else null. Tombstone so a deletion
 *      on one device propagates to the others. Reads must filter `IS NULL`.
 */
const syncColumns = {
  syncUpdatedAt: integer('sync_updated_at').default(0).notNull(),
  syncDeletedAt: integer('sync_deleted_at'),
};

export const vehicles = sqliteTable('vehicles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  make: text('make'),
  model: text('model'),
  year: integer('year'),
  fuelType: text('fuel_type'),   // 'gas' | 'electric' | 'hybrid' | 'other'
  licensePlate: text('license_plate'),
  currentOdometer: integer('current_odometer').default(0).notNull(),
  // Demo Mode row, seeded by loadSampleData() — lets clearSampleData() delete surgically
  // instead of wiping the whole table. Device-local in spirit (demo data never syncs), but
  // lives as a real column because SQLite has no schemaless escape hatch like Dexie's.
  isDemo: integer('is_demo', { mode: 'boolean' }).default(false).notNull(),
  ...syncColumns,
});

export const maintenanceLogs = sqliteTable('maintenance_logs', {
  id:         text('id').primaryKey(),
  vehicleId:  text('vehicle_id').notNull().references(() => vehicles.id),
  type:       text('type').notNull(), // 'oil_change'|'tire'|'brake'|'fuel'|'wash'|'other'
  cost:       real('cost').notNull(),
  odometer:   real('odometer'),       // reading at time of service
  date:       integer('date', { mode: 'timestamp' }).notNull(),
  notes:      text('notes'),
  ...syncColumns,
});

export const shifts = sqliteTable('shifts', {
  id: text('id').primaryKey(),
  vehicleId: text('vehicle_id').references(() => vehicles.id), 
  platform: text('platform').notNull(), 
  startTime: integer('start_time', { mode: 'timestamp' }).notNull(),
  endTime: integer('end_time', { mode: 'timestamp' }).notNull(),
  grossRevenue: real('gross_revenue').default(0).notNull(),
  tipsRevenue: real('tips_revenue').default(0).notNull(),
  bonusAmount: real('bonus_amount').default(0).notNull(),
  /** @deprecated Replaced by activeMileage going forward, kept for backward compatibility */
  trackedMileage: real('tracked_mileage').default(0).notNull(),
  deadMileage: real('dead_mileage').default(0).notNull(),
  // GPS-tracked commute/waiting miles (not on a delivery)
  activeMileage: real('active_mileage').default(0).notNull(),
  // GPS-tracked delivery miles — replaces trackedMileage going forward
  // Keep trackedMileage column for backward compat, add comment marking it deprecated
  durationSeconds: integer('duration_seconds').default(0).notNull(),
  // Total elapsed shift time in seconds
  pausedSeconds: integer('paused_seconds').default(0).notNull(),
  // Total paused time — net active time = durationSeconds - pausedSeconds
  notes: text('notes'),
  routePath: text('route_path'),
  reconciliationStatus: text('reconciliation_status').default('reconciled').notNull(), // 'tracking' | 'pending_reconciliation' | 'reconciled'
  startOdometer: integer('start_odometer'),
  endOdometer: integer('end_odometer'),
  distanceSource: text('distance_source').default('gps_only').notNull(),
  isDemo: integer('is_demo', { mode: 'boolean' }).default(false).notNull(),
  ...syncColumns,
});

export const locationPoints = sqliteTable('location_points', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  shiftId: text('shift_id').references(() => shifts.id),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  altitude: real('altitude'),
  accuracy: real('accuracy'),
  speed: real('speed'),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
  source: text('source').default('gps').notNull(),
  isFiltered: integer('is_filtered', { mode: 'boolean' }).default(false).notNull(),
});

export const expenses = sqliteTable('expenses', {
  id: text('id').primaryKey(),
  shiftId: text('shift_id').references(() => shifts.id), 
  category: text('category').notNull(), 
  amount: real('amount').notNull(),
  date: integer('date', { mode: 'timestamp' }).notNull(),
  isDeductible: integer('is_deductible', { mode: 'boolean' }).default(true).notNull(),
  deductiblePct: real('deductible_pct').default(100).notNull(), // 0–100; actual deductible amount = amount * deductiblePct / 100
  vehicleId:   text('vehicle_id').references(() => vehicles.id), // optional
  notes:       text('notes'),
  receiptUri:  text('receipt_uri'),  // local file URI for photo receipts
  isRecurring: integer('is_recurring', { mode: 'boolean' }).default(false).notNull(),
  recurringInterval: text('recurring_interval'), // 'weekly'|'monthly'|'yearly'
  recurringNextDate: text('recurring_next_date'), // ISO date string; next occurrence due
  recurringSnoozeUntil: text('recurring_snooze_until'), // ISO date string; suppress due-check until this date
  merchant: text('merchant').default("").notNull(),
  merchantNormalized: text('merchant_normalized').default("").notNull(),
  isDemo: integer('is_demo', { mode: 'boolean' }).default(false).notNull(),
  ...syncColumns,
});

export const goals = sqliteTable('goals', {
  id:          text('id').primaryKey(),
  label:       text('label').notNull(),
  targetValue: real('target_value').notNull(),
  unit:        text('unit').notNull(),    // 'currency'|'hours'|'shifts'|'mileage'
  period:      text('period').notNull(),  // 'daily'|'weekly'|'monthly'|'yearly'
  isActive:    integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  createdAt:   integer('created_at', { mode: 'timestamp' }).notNull(),
  isDemo:      integer('is_demo', { mode: 'boolean' }).default(false).notNull(),
  ...syncColumns,
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

/**
 * SYNCED user profile — per-key KV with the standard sync columns, so the existing
 * record-level engine gives per-key Last-Write-Wins for free (each key = one row).
 * This is the design doc's "bucket b": preferences that travel WITH THE USER
 * (name, country, units, goals, theme, onboarding-complete…), unlike `settings`,
 * which stays device-local (sync cursors, demo flag, scratch). Values are JSON-encoded.
 * Both apps bridge their local profile storage ↔ this table around each sync
 * (see src/services/sync/profileBridge.ts).
 */
export const profile = sqliteTable('profile', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  ...syncColumns,
});

export const taxHistory = sqliteTable('tax_history', {
  id: text('id').primaryKey(),
  oldRegion: text('old_region'),
  oldRate: real('old_rate'),
  newRegion: text('new_region').notNull(),
  newRate: real('new_rate').notNull(),
  changedAt: integer('changed_at', { mode: 'timestamp' }).notNull(),
  ...syncColumns,
});

export const platforms = sqliteTable('platforms', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  color: text('color').notNull(),
  textColor: text('text_color').notNull(),
  country: text('country').notNull(), // 'CA' | 'US' | 'UK' | 'NP'
  isActive: integer('is_active', { mode: 'boolean' }).default(false).notNull(),
  hourlyRate: text('hourly_rate').default('20').notNull(),
  mileageRate: text('mileage_rate').default('0.62').notNull(),
  sortPriority: integer('sort_priority').default(1).notNull(),
  logoEmoji: text('logo_emoji'),
  ...syncColumns,
});

export const tempNativePoints = sqliteTable('temp_native_points', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  lat: real('lat').notNull(),
  lon: real('lon').notNull(),
  timestamp: integer('timestamp').notNull(),
});

export const shiftPlatforms = sqliteTable('shift_platforms', {
  id: text('id').primaryKey(),
  shiftId: text('shift_id').notNull().references(() => shifts.id, { onDelete: 'cascade' }),
  platform: text('platform').notNull(),
  platformOnlineSeconds: integer('platform_online_seconds').default(0).notNull(),
  platformActiveSeconds: integer('platform_active_seconds').default(0).notNull(),
  grossRevenue: real('gross_revenue').default(0).notNull(),
  tipsRevenue: real('tips_revenue').default(0).notNull(),
  tripsCount: integer('trips_count').default(0).notNull(),
  ...syncColumns,
});

export const merchants = sqliteTable('merchants', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  normalizedName: text('normalized_name').notNull(),
  ...syncColumns,
});

export const vehicleTaxProfiles = sqliteTable('vehicle_tax_profiles', {
  id: text('id').primaryKey(),
  vehicleId: text('vehicle_id').notNull().references(() => vehicles.id, { onDelete: 'cascade' }),
  taxYear: integer('tax_year').notNull(),
  country: text('country').notNull(), // 'US' | 'CA' | 'UK' | 'NP'
  deductionMethod: text('deduction_method').notNull(), // 'standard_mileage' | 'actual_expenses'
  standardRatePrimary: real('standard_rate_primary'),
  standardRateSecondary: real('standard_rate_secondary'),
  rateThreshold: real('rate_threshold'),
  beginningYearOdometer: integer('beginning_year_odometer'),
  endingYearOdometer: integer('ending_year_odometer'),
  ...syncColumns,
});

/**
 * Append-only audit trail for the cloud-sync merge engine (sync-design.md §5).
 *
 * When a Last-Write-Wins merge OVERWRITES a financial row (expenses / taxHistory /
 * shifts / shiftPlatforms) that had real local edits, the superseded version is recorded
 * here BEFORE the overwrite — so a number changed on another device is never silently
 * lost and stays recoverable. DEVICE-LOCAL: deliberately has NO sync columns and is NOT
 * in SYNCED_TABLES / BACKUP_TABLES — it's a per-device recovery log, not synced data.
 */
export const syncOverwriteLog = sqliteTable('sync_overwrite_log', {
  id:            text('id').primaryKey(),
  tableName:     text('table_name').notNull(),
  rowId:         text('row_id').notNull(),
  supersededRow: text('superseded_row').notNull(), // JSON of the local row that lost
  winnerRow:     text('winner_row').notNull(),      // JSON of the incoming row that won
  mergedAt:      integer('merged_at').notNull(),     // epoch ms of the merge
});


