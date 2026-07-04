/**
 * Local backup FILE export/restore — the second data-safety mechanism next to Cloud Sync
 * (2026-07-03). Plain unencrypted JSON the user holds themselves, mirroring the web app's
 * Settings → "Download backup file" / "Import backup file".
 *
 *  - `exportBackupFile()` — snapshot all BACKUP_TABLES (via `buildBackupPayload`) into
 *    `comma-backup-YYYYMMDD.json` and hand it to the OS share sheet (save to Files/Drive,
 *    send anywhere).
 *  - `restoreBackupFile()` — document picker → validate it's a MOBILE backup payload →
 *    the same transactional replace the Drive restore uses (`applyBackupPayload`: wipe only
 *    tables present, revive timestamps) → then RESET this install's sync identity: the
 *    restored `settings` rows carry the SOURCE device's `sync_device_id`/applied-set/cursor,
 *    and keeping them would make this device impersonate the source (skipped logs, filename
 *    collisions). Fresh id + cursors 0 + sync OFF — the user re-enables sync deliberately.
 *
 * NOTE: web-app backup files (`comma-vault-backup-*.json`, `{exportedAt, schemaVersion,
 * tables}`) are a different format — import those in the WEB app (Settings → Data), and the
 * data reaches this phone via Cloud Sync.
 */

import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { Platform } from "react-native";
import {
  buildBackupPayload,
  applyBackupPayload,
  type BackupPayload,
} from "./googleDrive";
import {
  resetSyncStateForReset,
  applyPostResetSyncStateNative,
  applyPostResetSyncStateWeb,
} from "../database/syncState";

const isWeb = Platform.OS === "web";

/** Build + share `comma-backup-YYYYMMDD.json`. Resolves once the share sheet is handed off. */
export async function exportBackupFile(): Promise<void> {
  const payload = await buildBackupPayload();
  const json = JSON.stringify(payload);
  const stamp = payload.createdAt.slice(0, 10).replace(/-/g, "");
  const filename = `comma-backup-${stamp}.json`;

  if (isWeb) {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const fileUri = FileSystem.cacheDirectory + filename;
  await FileSystem.writeAsStringAsync(fileUri, json, { encoding: FileSystem.EncodingType.UTF8 });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing isn't available on this device.");
  }
  await Sharing.shareAsync(fileUri, {
    mimeType: "application/json",
    dialogTitle: "Save Comma backup",
  });
}

export interface RestoreFileResult {
  /** false when the user cancelled the picker. */
  restored: boolean;
}

/**
 * Pick a `comma-backup-*.json` file and restore it. Throws with a user-readable message on
 * invalid files (including web-app vault backups, which must be imported on web instead).
 */
export async function restoreBackupFile(): Promise<RestoreFileResult> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "text/plain"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets || res.assets.length === 0) {
    return { restored: false };
  }

  const asset = res.assets[0];
  let text: string;
  if (isWeb && asset.file) {
    text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || "");
      reader.onerror = (err) => reject(err);
      reader.readAsText(asset.file!);
    });
  } else {
    text = await FileSystem.readAsStringAsync(asset.uri);
  }

  let payload: BackupPayload;
  try {
    payload = JSON.parse(text) as BackupPayload;
  } catch {
    throw new Error("That file isn't valid JSON.");
  }

  if ((payload as any)?.exportedAt && (payload as any)?.schemaVersion != null) {
    throw new Error(
      "This is a WEB app backup. Import it in the web app (Settings → Data → Import backup file) — it will reach this phone through Cloud Sync."
    );
  }
  if (!payload || payload.app !== "comma" || !payload.tables || typeof payload.tables !== "object") {
    throw new Error("This file isn't a Comma phone backup.");
  }

  await applyBackupPayload(payload);

  // The restored settings include the SOURCE device's sync identity — re-mint ours so this
  // install joins sync as itself. Sync is left OFF; the user re-enables it deliberately.
  const freshDeviceId = resetSyncStateForReset();
  if (isWeb) {
    applyPostResetSyncStateWeb(freshDeviceId);
  } else {
    await applyPostResetSyncStateNative(freshDeviceId);
  }

  return { restored: true };
}
