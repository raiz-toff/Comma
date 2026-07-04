import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { db } from "../database/client";
import {
  vehicles,
  maintenanceLogs,
  shifts,
  expenses,
  goals,
  settings,
  taxHistory,
  platforms,
  shiftPlatforms,
  merchants,
  vehicleTaxProfiles,
} from "../database/schema";
import { encryptBackup, decryptBackup } from "./cryptoHelper";
import { GOOGLE_WEB_CLIENT_ID } from "../config/google";

let GoogleSignin: any = null;
try {
  GoogleSignin = require("@react-native-google-signin/google-signin").GoogleSignin;
} catch (e) {
  // Silent fallback
}

const isWeb = Platform.OS === "web";
const ENCRYPTION_KEY_STORE_KEY = "COMMA_BACKUP_ENCRYPTION_KEY";

/**
 * fetch() with a hard timeout. A dropped connection mid-request otherwise hangs the promise
 * forever (e.g. the "Backing up…" overlay never resolves). Aborts after `timeoutMs` and maps
 * the abort to a clear, user-facing message.
 */
export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = 60000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error("The network request timed out. Check your connection and try again.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// ─── OAuth / Access Token Management ─────────────────────────────────────────

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiryTime: number; // timestamp ms
}

export async function saveTokens(tokens: GoogleTokens) {
  if (isWeb) {
    localStorage.setItem("comma_gdrive_tokens", JSON.stringify(tokens));
    return;
  }
  await SecureStore.setItemAsync("comma_gdrive_tokens", JSON.stringify(tokens));
}

export async function getTokens(): Promise<GoogleTokens | null> {
  try {
    const raw = isWeb
      ? localStorage.getItem("comma_gdrive_tokens")
      : await SecureStore.getItemAsync("comma_gdrive_tokens");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

let refreshInFlight: Promise<string> | null = null;

export async function refreshGoogleToken(refreshToken: string): Promise<string> {
  // Single-flight: two Drive operations refreshing near expiry would otherwise each POST to the
  // token endpoint and race on saveTokens (last write wins, one response wasted/invalidated).
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const response = await fetchWithTimeout("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `client_id=${GOOGLE_WEB_CLIENT_ID}&refresh_token=${refreshToken}&grant_type=refresh_token`,
    });

    if (!response.ok) {
      throw new Error("Failed to refresh Google OAuth token.");
    }

    const data = await response.json();
    const tokens = await getTokens();
    if (tokens) {
      await saveTokens({
        ...tokens,
        accessToken: data.access_token,
        expiryTime: Date.now() + data.expires_in * 1000,
      });
    }
    return data.access_token;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export async function getValidAccessToken(): Promise<string> {
  const tokens = await getTokens();
  if (!tokens) throw new Error("Google Drive is not authenticated.");

  // Native: GoogleSignin owns the token lifecycle and refreshes silently.
  if (!isWeb && GoogleSignin) {
    try {
      const nativeTokens = await GoogleSignin.getTokens();
      return nativeTokens.accessToken;
    } catch (e) {
      console.warn("Failed to get native Google tokens:", e);
      // Do NOT silently fall through to the cached accessToken — on native it was stored as a
      // 1-hour estimate with no refresh token, so it's almost certainly stale and would 401.
      if (tokens.refreshToken) {
        return await refreshGoogleToken(tokens.refreshToken);
      }
      throw new Error("Your Google Drive session expired. Please reconnect Google Drive in Settings.");
    }
  }

  // Web / implicit flow: refresh if near expiry, else surface a clear re-auth error rather
  // than handing back an expired token that fails every subsequent Drive call.
  const isExpiring = tokens.expiryTime - Date.now() < 5 * 60 * 1000;
  if (isExpiring) {
    if (tokens.refreshToken) {
      return await refreshGoogleToken(tokens.refreshToken);
    }
    throw new Error("Your Google Drive session expired. Please reconnect Google Drive in Settings.");
  }
  return tokens.accessToken;
}

// ─── Backup payload tables ───────────────────────────────────────────────────

/**
 * Tables included in a backup, ordered parents → children so that inserts on
 * restore satisfy foreign-key references. Restore deletes in reverse order.
 *
 * Intentionally excluded: `locationPoints` and `tempNativePoints` — raw GPS
 * breadcrumbs that are bulky and reconstructable. Each shift already stores its
 * aggregated mileage plus an encoded `routePath`, so the meaningful route data
 * survives a restore without bloating every backup with thousands of points.
 */
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

/**
 * Drizzle `{ mode: 'timestamp' }` columns surface as `Date`, which JSON serializes
 * to an ISO string. On restore those strings must be turned back into `Date` before
 * insert, or Drizzle's timestamp mapper throws. Keep this in sync with the schema.
 */
const TIMESTAMP_FIELDS: Record<string, readonly string[]> = {
  vehicles: ["createdAt"],
  goals: ["createdAt"],
  taxHistory: ["changedAt"],
  shifts: ["startTime", "endTime"],
  maintenanceLogs: ["date"],
  expenses: ["date"],
};

/** Minimum backup password length. The password is the ONLY thing protecting the
 *  backup (the key derives from it alone), so reject trivially short ones. */
export const MIN_PASSPHRASE_LENGTH = 6;

/** Bumped from the original v1 (5 tables, device-bound key) to v2 (all user-data
 *  tables, password-only key that restores on any device). */
export const BACKUP_SCHEMA_VERSION = 2;

export interface BackupPayload {
  version: number;
  app: "comma";
  createdAt: string;
  tables: Record<string, Record<string, unknown>[]>;
}

function reviveTimestamps(
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

// ─── Backup Flow ─────────────────────────────────────────────────────────────

/**
 * Snapshot every BACKUP_TABLE into a portable payload. Shared by the (dormant) Drive backup
 * and the local backup-file export (`src/services/backupFile.ts`).
 */
export async function buildBackupPayload(): Promise<BackupPayload> {
  const tables: Record<string, Record<string, unknown>[]> = {};
  if (isWeb) {
    for (const { name } of BACKUP_TABLES) {
      const raw = localStorage.getItem(`comma_${name}`);
      tables[name] = raw ? JSON.parse(raw) : [];
    }
  } else {
    for (const { name, table } of BACKUP_TABLES) {
      tables[name] = await db.select().from(table);
    }
  }
  return {
    version: BACKUP_SCHEMA_VERSION,
    app: "comma",
    createdAt: new Date().toISOString(),
    tables,
  };
}

export async function backupToDrive(passphrase: string): Promise<void> {
  if (!passphrase || passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(`Backup password must be at least ${MIN_PASSPHRASE_LENGTH} characters.`);
  }

  const payload = await buildBackupPayload();
  const envelope = await encryptBackup(JSON.stringify(payload), passphrase);

  // Upload to the Drive appDataFolder via a multipart/related request. We build the
  // body as a plain string rather than FormData + Blob: React Native's FormData does
  // not reliably serialize Blob parts, whereas a manual multipart body always works,
  // and both of our parts (metadata + encrypted envelope) are text anyway.
  const accessToken = await getValidAccessToken();
  const metadata = {
    // Full timestamp (": " and "." are not filename-safe) so multiple backups in one
    // day don't collide.
    name: `comma-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.comdb`,
    parents: ["appDataFolder"],
  };

  const boundary = "comma_backup_boundary";
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/octet-stream\r\n\r\n` +
    `${envelope}\r\n` +
    `--${boundary}--`;

  const response = await fetchWithTimeout(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Google Drive upload failed (${response.status}). ${detail}`.trim());
  }

  // Update last backup timestamp
  const nowStr = new Date().toISOString();
  if (isWeb) {
    localStorage.setItem("comma_last_backup_at", nowStr);
  } else {
    await db
      .insert(settings)
      .values({ key: "last_backup_at", value: nowStr })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: nowStr },
      });
  }
}

// ─── Restore Flow ────────────────────────────────────────────────────────────

export interface DriveBackupFile {
  id: string;
  name: string;
  createdTime: string;
}

export async function listBackups(): Promise<DriveBackupFile[]> {
  const accessToken = await getValidAccessToken();
  const response = await fetchWithTimeout(
    "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,createdTime)&orderBy=createdTime%20desc",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch backups list from Google Drive.");
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * Delete a file from Drive by id. Used by sync compaction (P5) to remove change-logs
 * once their data is captured in a snapshot. Returns true on success; a 404 (already
 * gone) counts as success — the goal state is "file absent".
 */
export async function deleteDriveFile(fileId: string): Promise<boolean> {
  const accessToken = await getValidAccessToken();
  const response = await fetchWithTimeout(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return response.ok || response.status === 404;
}

export async function restoreFromDrive(fileId: string, passphrase: string): Promise<void> {
  if (!passphrase) throw new Error("Enter the backup password to restore.");

  const accessToken = await getValidAccessToken();
  const response = await fetchWithTimeout(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to download backup file.");
  }

  const envelope = await response.text();
  const decryptedText = await decryptBackup(envelope, passphrase);

  let payload: BackupPayload;
  try {
    payload = JSON.parse(decryptedText) as BackupPayload;
  } catch {
    throw new Error("Backup contents are corrupted.");
  }
  await applyBackupPayload(payload);
}

/**
 * Transactionally replace local data with a backup payload's contents. Shared by the
 * (dormant) Drive restore and the local backup-file restore (`src/services/backupFile.ts`).
 * Only tables PRESENT in the payload are wiped, so a partial backup never destroys data it
 * doesn't contain; timestamp columns are revived before insert.
 */
export async function applyBackupPayload(payload: BackupPayload): Promise<void> {
  if (!payload || !payload.tables || typeof payload.tables !== "object") {
    throw new Error("Invalid backup file structure.");
  }

  if (isWeb) {
    // localStorage has no transaction, so snapshot the current values and roll back on any
    // failure — otherwise a mid-restore error (e.g. quota exceeded) leaves a half-overwritten
    // dataset with some tables new and some old.
    const snapshot: Record<string, string | null> = {};
    try {
      for (const { name } of BACKUP_TABLES) {
        snapshot[name] = localStorage.getItem(`comma_${name}`);
        if (payload.tables[name]) {
          localStorage.setItem(`comma_${name}`, JSON.stringify(payload.tables[name]));
        }
      }
    } catch (e) {
      for (const { name } of BACKUP_TABLES) {
        const prev = snapshot[name];
        if (prev === undefined) continue; // never reached this table
        if (prev === null) localStorage.removeItem(`comma_${name}`);
        else localStorage.setItem(`comma_${name}`, prev);
      }
      throw new Error("Restore failed and was rolled back — your existing data is unchanged.");
    }
    return;
  }

  // Native: restore inside a single transaction so a failure can't leave a
  // half-wiped database.
  await db.transaction(async (tx: any) => {
    // Delete children → parents, but only for tables actually present in this
    // backup — so an older/partial backup never wipes data it doesn't contain.
    for (let i = BACKUP_TABLES.length - 1; i >= 0; i--) {
      const { name, table } = BACKUP_TABLES[i];
      if (payload.tables[name]) await tx.delete(table);
    }
    // Insert parents → children.
    for (const { name, table } of BACKUP_TABLES) {
      const rows = payload.tables[name];
      if (!rows || !rows.length) continue;
      for (const row of rows) {
        await tx.insert(table).values(reviveTimestamps(name, row));
      }
    }
  });
}
