import { getValidAccessToken } from "./auth";
import { decryptBackup, encryptBackup } from "./crypto";
import { getDb, getSqlDb, scheduleDbSave, resetDbInstance } from "./db/index";
import { saveDbToIDB } from "./db/persist";
import {
  vehicles, platforms, merchants, goals, settings,
  taxHistory, shifts, maintenanceLogs, expenses,
  shiftPlatforms, vehicleTaxProfiles,
} from "./db/schema";

export interface DriveBackupFile {
  id: string;
  name: string;
  createdTime: string;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 60000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("Request timed out. Check your connection and try again.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function listBackups(): Promise<DriveBackupFile[]> {
  const accessToken = await getValidAccessToken();
  const res = await fetchWithTimeout(
    "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,createdTime)&orderBy=createdTime%20desc",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error("Failed to fetch backups from Google Drive.");
  const data = await res.json();
  return ((data.files || []) as DriveBackupFile[]).filter((f) => f.name.endsWith(".comdb"));
}

const BACKUP_TABLES = [
  { name: "vehicles", table: vehicles },
  { name: "platforms", table: platforms },
  { name: "merchants", table: merchants },
  { name: "goals", table: goals },
  { name: "settings", table: settings },
  { name: "taxHistory", table: taxHistory },
  { name: "shifts", table: shifts },
  { name: "maintenanceLogs", table: maintenanceLogs },
  { name: "expenses", table: expenses },
  { name: "shiftPlatforms", table: shiftPlatforms },
  { name: "vehicleTaxProfiles", table: vehicleTaxProfiles },
] as const;

const TIMESTAMP_FIELDS: Record<string, readonly string[]> = {
  vehicles: ["createdAt"],
  goals: ["createdAt"],
  taxHistory: ["changedAt"],
  shifts: ["startTime", "endTime"],
  maintenanceLogs: ["date"],
  expenses: ["date"],
};

function reviveTimestamps(tableName: string, row: Record<string, unknown>): Record<string, unknown> {
  const fields = TIMESTAMP_FIELDS[tableName];
  if (!fields) return row;
  const out = { ...row };
  for (const f of fields) {
    if (out[f] != null) out[f] = new Date(out[f] as string | number);
  }
  return out;
}

export async function backupToDrive(passphrase: string): Promise<void> {
  if (!passphrase || passphrase.length < 6) throw new Error("Backup password must be at least 6 characters.");

  const db = await getDb();
  const tables: Record<string, unknown[]> = {};
  for (const { name, table } of BACKUP_TABLES) {
    tables[name] = await db.select().from(table as any);
  }

  const payload = { version: 2, app: "comma", createdAt: new Date().toISOString(), tables };
  const envelope = await encryptBackup(JSON.stringify(payload), passphrase);

  const accessToken = await getValidAccessToken();
  const metadata = {
    name: `comma-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.comdb`,
    parents: ["appDataFolder"],
  };

  const boundary = "comma_backup_boundary";
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n${envelope}\r\n` +
    `--${boundary}--`;

  const res = await fetchWithTimeout(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Drive upload failed (${res.status}). ${detail}`.trim());
  }
}

export async function restoreFromDrive(fileId: string, passphrase: string): Promise<void> {
  if (!passphrase) throw new Error("Enter the backup password to restore.");

  const accessToken = await getValidAccessToken();
  const res = await fetchWithTimeout(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error("Failed to download backup file.");

  const envelope = await res.text();
  const decrypted = await decryptBackup(envelope, passphrase);

  let payload: any;
  try {
    payload = JSON.parse(decrypted);
  } catch {
    throw new Error("Backup contents are corrupted.");
  }
  if (!payload?.tables || typeof payload.tables !== "object") {
    throw new Error("Invalid backup file structure.");
  }

  // Restore into sql.js DB via Drizzle
  const db = await getDb();
  const sqlDb = getSqlDb();
  if (!sqlDb) throw new Error("Database not initialized.");

  sqlDb.run("BEGIN");
  try {
    // Delete children → parents
    for (let i = BACKUP_TABLES.length - 1; i >= 0; i--) {
      const { name, table } = BACKUP_TABLES[i];
      if (payload.tables[name]) await db.delete(table as any);
    }
    // Insert parents → children
    for (const { name, table } of BACKUP_TABLES) {
      const rows: unknown[] = payload.tables[name];
      if (!rows?.length) continue;
      for (const row of rows) {
        await db.insert(table as any).values(reviveTimestamps(name, row as any) as any);
      }
    }
    sqlDb.run("COMMIT");
  } catch (e) {
    sqlDb.run("ROLLBACK");
    throw e;
  }

  // Persist the restored DB to IndexedDB
  await saveDbToIDB(sqlDb.export());
}
