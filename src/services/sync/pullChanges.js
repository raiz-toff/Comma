/**
 * Pull half of sync (interop plan Workstream 3). Ports mobile's
 * `commaApp/src/services/sync/pullChanges.ts`.
 *
 * Lists all sync files in Drive's appDataFolder, filters to those NOT already in this device's
 * applied-set AND NOT authored by this device, downloads + decrypts each into a ChangeLog, and
 * returns them oldest → newest for the caller to apply.
 *
 * Deliberately stops at "fetched + decoded". The real Last-Write-Wins MERGE — and the per-log
 * "record in applied-set after its transaction commits" step — live in `applyChangeLog.js` /
 * `syncNow.js`. This module only does the network + crypto + discovery (the applied-set cursor
 * read).
 */

import { getDeviceId, getAppliedLogs, getQuarantinedLogs } from './syncState.js';
import { listAppDataFiles, downloadFile } from '../../modules/backup/drive-api.js';
import { decodeChangeLog, parseSyncFilename } from './changeLog.js';

/**
 * @typedef {Object} PulledLog
 * @property {string} fileId Drive file id (for downloads / future deletion during compaction)
 * @property {string} filename
 * @property {import('./changeLog.js').ChangeLog} log
 */

/** List every sync file (delta `.cmlog` AND snapshot `.cmsnap`) in the appDataFolder. */
async function listChangeLogFiles() {
  const files = await listAppDataFiles();
  // Keep only well-formed sync names — ignores `.comdb` backups, junk, etc.
  return files.filter((f) => parseSyncFilename(f.name) != null);
}

/**
 * Fetch + decode all change-logs this device hasn't applied and didn't author. Returns them
 * sorted oldest → newest (by filename timestamp) so the caller applies them in order. Requires
 * the backup passphrase to decrypt.
 * @param {string} passphrase
 * @returns {Promise<PulledLog[]>}
 */
export async function pullChanges(passphrase) {
  if (!passphrase) throw new Error('Enter the backup password to sync.');

  const deviceId = getDeviceId();
  const applied = getAppliedLogs();
  const quarantined = getQuarantinedLogs();
  const files = await listChangeLogFiles();

  // Filter: not already applied AND not authored by me AND not quarantined (a log whose apply
  // failed repeatedly — see syncState.js — must not wedge every newer log behind it). Pairing
  // with the applied-set means my own just-pushed logs — already in the set — are skipped too.
  const toFetch = files.filter((f) => {
    if (applied.has(f.name) || quarantined.has(f.name)) return false;
    const parsed = parseSyncFilename(f.name);
    return parsed != null && parsed.deviceId !== deviceId;
  });

  // Sort oldest → newest by timestamp embedded in the filename. (Merge is order-independent —
  // LWW is commutative — but a stable order keeps applies deterministic.)
  toFetch.sort((a, b) => {
    const ta = parseSyncFilename(a.name)?.createdAt ?? 0;
    const tb = parseSyncFilename(b.name)?.createdAt ?? 0;
    return ta - tb;
  });

  const pulled = [];
  for (const f of toFetch) {
    const blob = await downloadFile(f.id);
    const envelope = await blob.text();
    const log = await decodeChangeLog(envelope, passphrase);
    pulled.push({ fileId: f.id, filename: f.name, log });
  }

  return pulled;
}
