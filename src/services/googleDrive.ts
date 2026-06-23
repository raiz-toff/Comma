import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { db } from "../database/client";
import { vehicles, shifts, expenses, goals, settings } from "../database/schema";
import { getOrCreateEncryptionKey, encrypt, decrypt } from "./cryptoHelper";

const isWeb = Platform.OS === "web";
const ENCRYPTION_KEY_STORE_KEY = "COMMA_BACKUP_ENCRYPTION_KEY";

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

export async function refreshGoogleToken(refreshToken: string): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `client_id=YOUR_CLIENT_ID&refresh_token=${refreshToken}&grant_type=refresh_token`,
  });

  if (!response.ok) {
    throw new Error("Failed to refresh Google OAuth token.");
  }

  const data = await response.json();
  const tokens = await getTokens();
  if (tokens) {
    const updated = {
      ...tokens,
      accessToken: data.access_token,
      expiryTime: Date.now() + data.expires_in * 1000,
    };
    await saveTokens(updated);
  }
  return data.access_token;
}

export async function getValidAccessToken(): Promise<string> {
  const tokens = await getTokens();
  if (!tokens) throw new Error("Google Drive is not authenticated.");

  // If token expires in less than 5 minutes, refresh
  if (tokens.expiryTime - Date.now() < 5 * 60 * 1000 && tokens.refreshToken) {
    return await refreshGoogleToken(tokens.refreshToken);
  }
  return tokens.accessToken;
}

// ─── Backup Flow ─────────────────────────────────────────────────────────────

export async function backupToDrive(pin: string = "1234"): Promise<void> {
  let vehiclesList: any[] = [];
  let shiftsList: any[] = [];
  let expensesList: any[] = [];
  let goalsList: any[] = [];
  let settingsList: any[] = [];

  if (isWeb) {
    const v = localStorage.getItem("comma_vehicles");
    const s = localStorage.getItem("comma_shifts");
    const e = localStorage.getItem("comma_expenses");
    const g = localStorage.getItem("comma_goals");
    const st = localStorage.getItem("comma_settings");
    vehiclesList = v ? JSON.parse(v) : [];
    shiftsList = s ? JSON.parse(s) : [];
    expensesList = e ? JSON.parse(e) : [];
    goalsList = g ? JSON.parse(g) : [];
    settingsList = st ? JSON.parse(st) : [];
  } else {
    vehiclesList = await db.select().from(vehicles);
    shiftsList = await db.select().from(shifts);
    expensesList = await db.select().from(expenses);
    goalsList = await db.select().from(goals);
    settingsList = await db.select().from(settings);
  }

  const exportPayload = {
    version: 1,
    vehicles: vehiclesList,
    shifts: shiftsList,
    expenses: expensesList,
    goals: goalsList,
    settings: settingsList,
  };

  const serialized = JSON.stringify(exportPayload);
  const key = await getOrCreateEncryptionKey(pin);
  const encrypted = await encrypt(serialized, key);

  // Upload to GDrive appDataFolder
  const accessToken = await getValidAccessToken();
  const metadata = {
    name: `comma-backup-${new Date().toISOString().split("T")[0]}.comdb`,
    parents: ["appDataFolder"],
  };

  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  form.append(
    "file",
    new Blob([encrypted], { type: "application/octet-stream" })
  );

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    }
  );

  if (!response.ok) {
    throw new Error("Google Drive file upload failed.");
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
  const response = await fetch(
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

export async function restoreFromDrive(fileId: string, pin: string = "1234"): Promise<void> {
  const accessToken = await getValidAccessToken();
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to download backup file.");
  }

  const encryptedText = await response.text();
  const key = await getOrCreateEncryptionKey(pin);
  const decryptedText = await decrypt(encryptedText, key);
  const payload = JSON.parse(decryptedText);

  // Validate Schema
  if (!payload || payload.version !== 1 || !Array.isArray(payload.vehicles)) {
    throw new Error("Invalid backup file schema.");
  }

  if (isWeb) {
    localStorage.setItem("comma_vehicles", JSON.stringify(payload.vehicles));
    localStorage.setItem("comma_shifts", JSON.stringify(payload.shifts || []));
    localStorage.setItem("comma_expenses", JSON.stringify(payload.expenses || []));
    localStorage.setItem("comma_goals", JSON.stringify(payload.goals || []));
    localStorage.setItem("comma_settings", JSON.stringify(payload.settings || []));
  } else {
    // Perform SQLite restore inside transaction
    await db.transaction(async (tx: any) => {
      // Wipe Tables
      await tx.delete(vehicles);
      await tx.delete(shifts);
      await tx.delete(expenses);
      await tx.delete(goals);
      await tx.delete(settings);

      // Populate
      for (const row of payload.vehicles) await tx.insert(vehicles).values(row);
      for (const row of payload.shifts || []) await tx.insert(shifts).values(row);
      for (const row of payload.expenses || []) await tx.insert(expenses).values(row);
      for (const row of payload.goals || []) await tx.insert(goals).values(row);
      for (const row of payload.settings || []) await tx.insert(settings).values(row);
    });
  }
}
