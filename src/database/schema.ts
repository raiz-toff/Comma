import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

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
});

export const maintenanceLogs = sqliteTable('maintenance_logs', {
  id:         text('id').primaryKey(),
  vehicleId:  text('vehicle_id').notNull().references(() => vehicles.id),
  type:       text('type').notNull(), // 'oil_change'|'tire'|'brake'|'fuel'|'wash'|'other'
  cost:       real('cost').notNull(),
  odometer:   real('odometer'),       // reading at time of service
  date:       integer('date', { mode: 'timestamp' }).notNull(),
  notes:      text('notes'),
});

export const shifts = sqliteTable('shifts', {
  id: text('id').primaryKey(),
  vehicleId: text('vehicle_id').references(() => vehicles.id), 
  platform: text('platform').notNull(), 
  startTime: integer('start_time', { mode: 'timestamp' }).notNull(),
  endTime: integer('end_time', { mode: 'timestamp' }).notNull(),
  grossRevenue: real('gross_revenue').default(0).notNull(),
  tipsRevenue: real('tips_revenue').default(0).notNull(),
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
  vehicleId:   text('vehicle_id').references(() => vehicles.id), // optional
  notes:       text('notes'),
  receiptUri:  text('receipt_uri'),  // local file URI for photo receipts
  isRecurring: integer('is_recurring', { mode: 'boolean' }).default(false).notNull(),
  recurringInterval: text('recurring_interval'), // 'weekly'|'monthly'|'yearly'
  merchant: text('merchant').default("").notNull(),
  merchantNormalized: text('merchant_normalized').default("").notNull(),
});

export const goals = sqliteTable('goals', {
  id:          text('id').primaryKey(),
  label:       text('label').notNull(),
  targetValue: real('target_value').notNull(),
  unit:        text('unit').notNull(),    // 'currency'|'hours'|'shifts'|'mileage'
  period:      text('period').notNull(),  // 'daily'|'weekly'|'monthly'|'yearly'
  isActive:    integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  createdAt:   integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const taxHistory = sqliteTable('tax_history', {
  id: text('id').primaryKey(),
  oldRegion: text('old_region'),
  oldRate: real('old_rate'),
  newRegion: text('new_region').notNull(),
  newRate: real('new_rate').notNull(),
  changedAt: integer('changed_at', { mode: 'timestamp' }).notNull(),
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
  grossRevenue: real('gross_revenue').default(0).notNull(),
  tipsRevenue: real('tips_revenue').default(0).notNull(),
  tripsCount: integer('trips_count').default(0).notNull(),
});

export const merchants = sqliteTable('merchants', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  normalizedName: text('normalized_name').notNull(),
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
});


