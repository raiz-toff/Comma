import type { SqlJsStatic, Database } from "sql.js";
import { drizzle } from "drizzle-orm/sql-js";
import * as schema from "./schema";
import { loadDbFromIDB, saveDbToIDB } from "./persist";

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

let _SQL: SqlJsStatic | null = null;
let _sqlDb: Database | null = null;
let _db: DrizzleDb | null = null;
let _saveTimer: ReturnType<typeof setTimeout> | null = null;

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL,
  make TEXT, model TEXT, year INTEGER, fuel_type TEXT, license_plate TEXT,
  current_odometer INTEGER NOT NULL DEFAULT 0,
  sync_updated_at INTEGER NOT NULL DEFAULT 0, sync_deleted_at INTEGER
);
CREATE TABLE IF NOT EXISTS platforms (
  id TEXT PRIMARY KEY, label TEXT NOT NULL, color TEXT NOT NULL,
  text_color TEXT NOT NULL, country TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  hourly_rate TEXT NOT NULL DEFAULT '20', mileage_rate TEXT NOT NULL DEFAULT '0.62',
  sort_priority INTEGER NOT NULL DEFAULT 1, logo_emoji TEXT,
  sync_updated_at INTEGER NOT NULL DEFAULT 0, sync_deleted_at INTEGER
);
CREATE TABLE IF NOT EXISTS merchants (
  id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, normalized_name TEXT NOT NULL,
  sync_updated_at INTEGER NOT NULL DEFAULT 0, sync_deleted_at INTEGER
);
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY, label TEXT NOT NULL, target_value REAL NOT NULL,
  unit TEXT NOT NULL, period TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL,
  sync_updated_at INTEGER NOT NULL DEFAULT 0, sync_deleted_at INTEGER
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY, value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tax_history (
  id TEXT PRIMARY KEY, old_region TEXT, old_rate REAL,
  new_region TEXT NOT NULL, new_rate REAL NOT NULL, changed_at INTEGER NOT NULL,
  sync_updated_at INTEGER NOT NULL DEFAULT 0, sync_deleted_at INTEGER
);
CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY, vehicle_id TEXT REFERENCES vehicles(id),
  platform TEXT NOT NULL, start_time INTEGER NOT NULL, end_time INTEGER NOT NULL,
  gross_revenue REAL NOT NULL DEFAULT 0, tips_revenue REAL NOT NULL DEFAULT 0,
  tracked_mileage REAL NOT NULL DEFAULT 0, dead_mileage REAL NOT NULL DEFAULT 0,
  active_mileage REAL NOT NULL DEFAULT 0, duration_seconds INTEGER NOT NULL DEFAULT 0,
  paused_seconds INTEGER NOT NULL DEFAULT 0, notes TEXT, route_path TEXT,
  reconciliation_status TEXT NOT NULL DEFAULT 'reconciled',
  start_odometer INTEGER, end_odometer INTEGER,
  distance_source TEXT NOT NULL DEFAULT 'gps_only',
  sync_updated_at INTEGER NOT NULL DEFAULT 0, sync_deleted_at INTEGER
);
CREATE TABLE IF NOT EXISTS maintenance_logs (
  id TEXT PRIMARY KEY, vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
  type TEXT NOT NULL, cost REAL NOT NULL, odometer REAL,
  date INTEGER NOT NULL, notes TEXT,
  sync_updated_at INTEGER NOT NULL DEFAULT 0, sync_deleted_at INTEGER
);
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY, shift_id TEXT REFERENCES shifts(id),
  category TEXT NOT NULL, amount REAL NOT NULL, date INTEGER NOT NULL,
  is_deductible INTEGER NOT NULL DEFAULT 1, deductible_pct REAL NOT NULL DEFAULT 100,
  vehicle_id TEXT REFERENCES vehicles(id), notes TEXT, receipt_uri TEXT,
  is_recurring INTEGER NOT NULL DEFAULT 0, recurring_interval TEXT,
  merchant TEXT NOT NULL DEFAULT '', merchant_normalized TEXT NOT NULL DEFAULT '',
  sync_updated_at INTEGER NOT NULL DEFAULT 0, sync_deleted_at INTEGER
);
CREATE TABLE IF NOT EXISTS shift_platforms (
  id TEXT PRIMARY KEY, shift_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, platform_online_seconds INTEGER NOT NULL DEFAULT 0,
  gross_revenue REAL NOT NULL DEFAULT 0, tips_revenue REAL NOT NULL DEFAULT 0,
  trips_count INTEGER NOT NULL DEFAULT 0,
  sync_updated_at INTEGER NOT NULL DEFAULT 0, sync_deleted_at INTEGER
);
CREATE TABLE IF NOT EXISTS vehicle_tax_profiles (
  id TEXT PRIMARY KEY, vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  tax_year INTEGER NOT NULL, country TEXT NOT NULL, deduction_method TEXT NOT NULL,
  standard_rate_primary REAL, standard_rate_secondary REAL, rate_threshold REAL,
  beginning_year_odometer INTEGER, ending_year_odometer INTEGER,
  sync_updated_at INTEGER NOT NULL DEFAULT 0, sync_deleted_at INTEGER
);
`;

export function scheduleDbSave() {
  if (!_sqlDb) return;
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(async () => {
    if (_sqlDb) {
      const data = _sqlDb.export();
      await saveDbToIDB(data);
    }
  }, 500);
}

export async function getDb(): Promise<DrizzleDb> {
  if (_db) return _db;

  if (!_SQL) {
    const initSqlJs = (await import("sql.js")).default;
    _SQL = await initSqlJs({ locateFile: () => "/sql-wasm.wasm" });
  }

  const saved = await loadDbFromIDB();
  _sqlDb = saved ? new _SQL.Database(saved) : new _SQL.Database();

  if (!saved) {
    _sqlDb.run(CREATE_TABLES_SQL);
    await saveDbToIDB(_sqlDb.export());
  }

  _db = drizzle(_sqlDb, { schema });
  return _db;
}

export function getSqlDb(): Database | null {
  return _sqlDb;
}

export function resetDbInstance() {
  _sqlDb?.close();
  _sqlDb = null;
  _db = null;
}
