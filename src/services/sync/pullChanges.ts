/**
 * Pull half of sync (cloud-sync P2 — see sync-design.md §4 "PULL").
 *
 * Lists all `.cmlog` files in Drive's appDataFolder, filters to those NOT already in
 * this device's applied-set AND NOT authored by this device, downloads + decrypts each
 * into a ChangeLog, and returns them oldest → newest for the caller to apply.
 *
 * P2 deliberately stops at "fetched + decoded". The real Last-Write-Wins MERGE — and
 * the per-log "record in applied-set after its transaction commits" step — is P3. This
 * module only does the network + crypto + discovery (the applied-set cursor read).
 */

import {
  getDeviceId,
  getAppliedLogs,
} from "../../database/syncState";
import { getValidAccessToken, fetchWithTimeout } from "../googleDrive";
import { listAppDataFiles, type DriveFileRef } from "./driveIO";
import {
  type ChangeLog,
  decodeChangeLog,
  parseSyncFilename,
} from "./changeLog";

export interface PulledLog {
  /** Drive file id (for downloads / future deletion during compaction). */
  fileId: string;
  filename: string;
  log: ChangeLog;
}

/** List every sync file (delta `.cmlog` AND snapshot `.cmsnap`) in the appDataFolder. */
async function listChangeLogFiles(): Promise<DriveFileRef[]> {
  const files = await listAppDataFiles();
  // Keep only well-formed sync names — ignores `.comdb` backups, manifests, etc.
  return files.filter((f) => parseSyncFilename(f.name) != null);
}

/** Download a single Drive file's raw text body (the encrypted envelope). */
async function downloadFile(fileId: string): Promise<string> {
  const accessToken = await getValidAccessToken();
  const response = await fetchWithTimeout(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) {
    throw new Error("Failed to download a change-log file.");
  }
  return response.text();
}

/**
 * Fetch + decode all change-logs this device hasn't applied and didn't author.
 * Returns them sorted oldest → newest (by filename timestamp) so the caller applies
 * them in order. Requires the backup passphrase to decrypt.
 */
export async function pullChanges(passphrase: string): Promise<PulledLog[]> {
  if (!passphrase) throw new Error("Enter the backup password to sync.");

  const [deviceId, applied] = await Promise.all([getDeviceId(), getAppliedLogs()]);
  const files = await listChangeLogFiles();

  // Filter: not already applied AND not authored by me. (Pairing with the applied-set
  // means my own just-pushed logs — already in the set — are skipped here too.)
  const toFetch = files.filter((f) => {
    if (applied.has(f.name)) return false;
    const parsed = parseSyncFilename(f.name);
    return parsed != null && parsed.deviceId !== deviceId;
  });

  // Sort oldest → newest by timestamp embedded in the filename. (Merge is order-independent
  // — LWW is commutative — but a stable order keeps applies deterministic. A snapshot and a
  // delta with the same data resolve to the same result whichever lands first.)
  toFetch.sort((a, b) => {
    const ta = parseSyncFilename(a.name)?.createdAt ?? 0;
    const tb = parseSyncFilename(b.name)?.createdAt ?? 0;
    return ta - tb;
  });

  const pulled: PulledLog[] = [];
  for (const f of toFetch) {
    const envelope = await downloadFile(f.id);
    const log = await decodeChangeLog(envelope, passphrase);
    pulled.push({ fileId: f.id, filename: f.name, log });
  }

  return pulled;
}
