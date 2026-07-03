/**
 * Change-log file format + (de)serialization (interop plan Workstream 3).
 * Ports mobile's `commaApp/src/services/sync/changeLog.ts` verbatim.
 *
 * One file per push, stored in Drive's `appDataFolder`:
 *   filename:  comma-cl-{deviceId}-{epochMs}.cmlog
 *   content:   encryptBackup(JSON.stringify(ChangeLog), passphrase)
 *
 * The encryption reuses the same password-derived `encryptBackup`/`decryptBackup` the whole-vault
 * `.comdb` backup uses (Workstream 2 — already cross-device-compatible with mobile), so a log
 * written by web decrypts on mobile with the same backup password — no device key involved.
 */

import { encryptBackup, decryptBackup } from '../../modules/backup/encryption.js';

/** Schema version of the change-log envelope. Bump on any breaking shape change. */
export const CHANGELOG_VERSION = 1;

/**
 * @typedef {Object} ChangeLog
 * @property {1} v
 * @property {string} deviceId
 * @property {number} createdAt epoch ms
 * @property {number} sinceCursor the lastPushedAt cursor this delta covers (rows with syncUpdatedAt > sinceCursor)
 * @property {Record<string, Record<string, unknown>[]>} rows tableName -> changed rows (INCLUDING soft-deleted tombstones)
 */

// Two kinds of sync file live in the appDataFolder:
//   - DELTA change-logs:  comma-cl-{deviceId}-{epochMs}.cmlog   (one push's changes)
//   - SNAPSHOT:           comma-snap-{deviceId}-{epochMs}.cmsnap (full state, for compaction)
// Both encode a ChangeLog payload (a snapshot is just a ChangeLog containing ALL rows), so
// pull/merge treat them identically; only compaction distinguishes them by extension.
const LOG_PREFIX = 'comma-cl-';
const LOG_SUFFIX = '.cmlog';
const SNAP_PREFIX = 'comma-snap-';
const SNAP_SUFFIX = '.cmsnap';

/** @typedef {'log'|'snapshot'} SyncFileKind */

/** Build a delta change-log filename: `comma-cl-{deviceId}-{epochMs}.cmlog`. */
export function buildChangeLogFilename(deviceId, createdAt) {
  return `${LOG_PREFIX}${deviceId}-${createdAt}${LOG_SUFFIX}`;
}

/** Build a snapshot filename: `comma-snap-{deviceId}-{epochMs}.cmsnap` (compaction). */
export function buildSnapshotFilename(deviceId, createdAt) {
  return `${SNAP_PREFIX}${deviceId}-${createdAt}${SNAP_SUFFIX}`;
}

/**
 * @typedef {Object} ParsedSyncName
 * @property {SyncFileKind} kind
 * @property {string} deviceId
 * @property {number} createdAt
 */

// deviceId is dash-free by construction (syncState newDeviceId) and createdAt is numeric, so the
// single dash between them is the only dash in the core — split on the LAST dash.
function parseCore(core) {
  const lastDash = core.lastIndexOf('-');
  if (lastDash <= 0) return null;
  const deviceId = core.slice(0, lastDash);
  const ts = Number(core.slice(lastDash + 1));
  if (!Number.isFinite(ts)) return null;
  return { deviceId, createdAt: ts };
}

/**
 * Parse any sync filename (delta log OR snapshot) into its kind + deviceId + timestamp. Returns
 * null for anything else (`.comdb` backups, junk) so a mixed appDataFolder listing can be
 * filtered by name alone.
 * @param {string} filename
 * @returns {ParsedSyncName | null}
 */
export function parseSyncFilename(filename) {
  if (filename.startsWith(LOG_PREFIX) && filename.endsWith(LOG_SUFFIX)) {
    const c = parseCore(filename.slice(LOG_PREFIX.length, -LOG_SUFFIX.length));
    return c ? { kind: 'log', ...c } : null;
  }
  if (filename.startsWith(SNAP_PREFIX) && filename.endsWith(SNAP_SUFFIX)) {
    const c = parseCore(filename.slice(SNAP_PREFIX.length, -SNAP_SUFFIX.length));
    return c ? { kind: 'snapshot', ...c } : null;
  }
  return null;
}

/** Serialize + encrypt a ChangeLog into the `.cmlog`/`.cmsnap` file body.
 * @param {ChangeLog} log @param {string} passphrase @returns {Promise<string>} */
export async function encodeChangeLog(log, passphrase) {
  return encryptBackup(JSON.stringify(log), passphrase);
}

/** Decrypt + parse a sync file body back into a ChangeLog. Throws on wrong password (via
 * decryptBackup) or malformed/incompatible content.
 * @param {string} envelope @param {string} passphrase @returns {Promise<ChangeLog>} */
export async function decodeChangeLog(envelope, passphrase) {
  const json = await decryptBackup(envelope, passphrase);
  let log;
  try {
    log = JSON.parse(json);
  } catch {
    throw new Error('Change-log contents are corrupted.');
  }
  if (!log || typeof log !== 'object' || !log.rows || typeof log.rows !== 'object') {
    throw new Error('Invalid change-log structure.');
  }
  // Forward-compat guard: refuse to apply a log from a newer schema than we understand, rather
  // than silently mis-merging it.
  if (log.v > CHANGELOG_VERSION) {
    throw new Error(`This change-log was written by a newer app version (v${log.v}). Please update.`);
  }
  return log;
}
