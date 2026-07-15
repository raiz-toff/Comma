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
  getQuarantinedLogs,
  getForgottenLogs,
} from "../../database/syncState";
import { getValidAccessToken, fetchWithTimeout } from "../googleDrive";
import { isPassphraseError } from "../cryptoEnvelope";
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

export interface PullResult {
  /** Successfully downloaded + decoded logs, oldest → newest. */
  logs: PulledLog[];
  /**
   * True when at least one file is ENCRYPTED and we couldn't open it (no password on this
   * device, or the wrong one). The caller should prompt for the password — these files are
   * deliberately NOT counted as failures, because quarantining them would make a perfectly
   * good backup permanently invisible after 3 syncs.
   */
  needsPassphrase: boolean;
  /** Filenames currently locked behind a password this device doesn't have. The "Forgot
   *  password?" flow needs the exact names to abandon (see syncState's forgotten-logs). */
  passphraseLockedFiles: string[];
  /** Filenames that failed to download/decode for any OTHER reason (corrupt, truncated…).
   *  These DO go through the quarantine counter. */
  failed: string[];
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
export async function pullChanges(passphrase: string): Promise<PullResult> {
  // An EMPTY passphrase is legal — it's the default one-tap mode. Plain envelopes decode
  // with no key; genuinely encrypted files surface as `needsPassphrase` below.
  const [deviceId, applied, quarantined, forgotten] = await Promise.all([
    getDeviceId(),
    getAppliedLogs(),
    getQuarantinedLogs(),
    getForgottenLogs(),
  ]);
  const files = await listChangeLogFiles();

  // Filter: not already applied AND not authored by me AND not quarantined (a log whose
  // apply failed repeatedly — see syncState — must not wedge every newer log behind it)
  // AND not explicitly forgotten (the user said they no longer have the password and chose
  // to abandon it — see syncState's forgotten-logs). Pairing with the applied-set means my
  // own just-pushed logs are skipped here too.
  const toFetch = files.filter((f) => {
    if (applied.has(f.name) || quarantined.has(f.name) || forgotten.has(f.name)) return false;
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

  // Decode per-file, not all-or-nothing: one unreadable file must not abort the whole pull
  // (that would let a single bad/encrypted file block every other device's data forever).
  const logs: PulledLog[] = [];
  const failed: string[] = [];
  const passphraseLockedFiles: string[] = [];
  let needsPassphrase = false;

  for (const f of toFetch) {
    try {
      const envelope = await downloadFile(f.id);
      const log = await decodeChangeLog(envelope, passphrase);
      logs.push({ fileId: f.id, filename: f.name, log });
    } catch (e) {
      if (isPassphraseError(e)) {
        // Encrypted and we lack the key — recoverable, so DON'T quarantine. Ask the user.
        needsPassphrase = true;
        passphraseLockedFiles.push(f.name);
        continue;
      }
      failed.push(f.name);
      console.warn(`[sync] could not read ${f.name}:`, e);
    }
  }

  return { logs, needsPassphrase, passphraseLockedFiles, failed };
}
