import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const vehicles = sqliteTable('vehicles', {
  id: text('id').primaryKey(), 
  name: text('name').notNull(), 
  type: text('type').notNull(), 
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
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
});

export const expenses = sqliteTable('expenses', {
  id: text('id').primaryKey(),
  shiftId: text('shift_id').references(() => shifts.id), 
  category: text('category').notNull(), 
  amount: real('amount').notNull(),
  date: integer('date', { mode: 'timestamp' }).notNull(),
  isDeductible: integer('is_deductible', { mode: 'boolean' }).default(true).notNull(),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

