/**
 * Lazy compaction (interop plan Workstream 3). Ports mobile's
 * `commaApp/src/services/sync/compaction.ts` against Dexie queries.
 *
 * Change-logs accumulate forever otherwise. When enough delta `.cmlog` files pile up, this
 * collapses them into ONE snapshot (`.cmsnap`) of the device's full merged state and deletes the
 * deltas it has subsumed.
 *
 * THE SAFETY INVARIANT: never delete a log until its data is provably in a snapshot.
 *   - The snapshot is built from LOCAL state, which has already merged every log in this
 *     device's applied-set. So each such log's rows are present (at ≥ their version) in the
 *     snapshot — LWW guarantees a device that never saw the log gets ≥ its data from the
 *     snapshot instead.
 *   - We therefore delete ONLY delta logs whose filename is in our applied-set, and ONLY AFTER
 *     the snapshot upload succeeds. Logs we haven't applied (or that arrived during compaction)
 *     are left untouched ("tolerate leftovers").
 *
 * A snapshot is just a ChangeLog containing ALL rows, so pull/merge handle it with no special
 * case — only the `.cmsnap` extension distinguishes it (so it isn't deleted as a delta).
 * Filename-only discovery; no manifest.
 */

import { SYNCED_TABLES } from './syncedTables.js';
import { getDeviceId, getAppliedLogs, addAppliedLog } from './syncState.js';
import { listAppDataFiles, uploadSyncFile, deleteFile } from '../../modules/backup/drive-api.js';
import { CHANGELOG_VERSION, buildSnapshotFilename, parseSyncFilename, encodeChangeLog } from './changeLog.js';

/** Compact once at least this many DELTA logs exist on Drive. */
export const COMPACTION_THRESHOLD = 30;

/**
 * @typedef {Object} CompactionResult
 * @property {boolean} compacted
 * @property {string} [snapshot]
 * @property {number} deletedLogs
 */

/** Read the full current state of every synced table (all rows, including tombstones).
 *  Excludes never-synced rows (syncUpdatedAt 0/undefined — per-device seed scaffolding):
 *  they were never in any delta log, so the snapshot loses nothing by skipping them, and
 *  including them would leak every device's default seed rows to every peer. */
async function readFullState() {
  /** @type {Record<string, Record<string, unknown>[]>} */
  const rows = {};
  for (const { name, table } of SYNCED_TABLES) {
    rows[name] = (await table.toArray()).filter((r) => Number(r.syncUpdatedAt ?? 0) > 0);
  }
  return rows;
}

/**
 * Compact if the delta-log count is over threshold. Safe to call after any sync; it's a cheap
 * no-op (one list call) when under threshold. Never throws fatally to the caller's flow —
 * compaction is best-effort housekeeping; callers may ignore failures.
 * @param {string} passphrase
 * @param {number} [createdAt]
 * @returns {Promise<CompactionResult>}
 */
export async function maybeCompact(passphrase, createdAt = Date.now()) {
  const files = await listAppDataFiles();
  const parsed = files.map((f) => ({ ...f, meta: parseSyncFilename(f.name) })).filter((f) => f.meta != null);

  const deltaLogs = parsed.filter((f) => f.meta.kind === 'log');
  if (deltaLogs.length < COMPACTION_THRESHOLD) {
    return { compacted: false, deletedLogs: 0 };
  }

  const deviceId = getDeviceId();
  const applied = getAppliedLogs();

  // 1. Build the snapshot from fully-merged local state.
  const snapshot = {
    v: CHANGELOG_VERSION,
    deviceId,
    createdAt,
    sinceCursor: 0, // full state, not a delta
    rows: await readFullState(),
  };
  const snapshotName = buildSnapshotFilename(deviceId, createdAt);

  // 2. Upload the snapshot FIRST. If this throws, nothing is deleted.
  await uploadSyncFile(snapshotName, await encodeChangeLog(snapshot, passphrase));
  // Remember our own snapshot so we never pull it back.
  addAppliedLog(snapshotName);

  // 3. Now it's safe to delete the delta logs we've provably subsumed (in our applied-set).
  let deletedLogs = 0;
  for (const f of deltaLogs) {
    if (!applied.has(f.name)) continue; // not yet applied by us → leave it
    try {
      await deleteFile(f.id);
      deletedLogs++;
    } catch (err) {
      console.warn('[sync] failed to delete subsumed delta log', f.name, err);
    }
  }

  // 4. Bound snapshot growth: delete our OWN older snapshots (a newer full snapshot subsumes
  //    them). Never touch other devices' snapshots.
  for (const f of parsed) {
    if (f.meta.kind === 'snapshot' && f.meta.deviceId === deviceId && f.name !== snapshotName && f.meta.createdAt < createdAt) {
      try {
        await deleteFile(f.id);
      } catch (err) {
        console.warn('[sync] failed to delete superseded snapshot', f.name, err);
      }
    }
  }

  return { compacted: true, snapshot: snapshotName, deletedLogs };
}
