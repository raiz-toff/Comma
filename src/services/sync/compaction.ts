/**
 * Lazy compaction (cloud-sync P5 — see sync-design.md §5/§6).
 *
 * Change-logs accumulate forever otherwise. When enough delta `.cmlog` files pile up,
 * this collapses them into ONE snapshot (`.cmsnap`) of the device's full merged state and
 * deletes the deltas it has subsumed.
 *
 * THE SAFETY INVARIANT (§6): never delete a log until its data is provably in a snapshot.
 *   - The snapshot is built from LOCAL state, which has already merged every log in this
 *     device's applied-set. So each such log's rows are present (at ≥ their version) in the
 *     snapshot — LWW guarantees a device that never saw the log gets ≥ its data from the
 *     snapshot instead.
 *   - We therefore delete ONLY delta logs whose filename is in our applied-set, and ONLY
 *     AFTER the snapshot upload succeeds. Logs we haven't applied (or that arrived during
 *     compaction) are left untouched ("tolerate leftovers").
 *
 * A snapshot is just a ChangeLog containing ALL rows, so pull/merge handle it with no
 * special case — only the `.cmsnap` extension distinguishes it (so it isn't deleted as a
 * delta). Filename-only discovery; no manifest (the §8 v1 simplification).
 */

import { Platform } from "react-native";
import { db } from "../../database/client";
import { SYNCED_TABLES } from "../../database/syncedTables";
import { getDeviceId, getAppliedLogs, addAppliedLog } from "../../database/syncState";
import { deleteDriveFile } from "../googleDrive";
import { listAppDataFiles, uploadSyncFile } from "./driveIO";
import {
  type ChangeLog,
  CHANGELOG_VERSION,
  buildSnapshotFilename,
  parseSyncFilename,
  encodeChangeLog,
} from "./changeLog";

const isWeb = Platform.OS === "web";

/** Compact once at least this many DELTA logs exist on Drive. */
export const COMPACTION_THRESHOLD = 30;

export interface CompactionResult {
  compacted: boolean;
  snapshot?: string;
  deletedLogs: number;
}

/** Read the full current state of every synced table (all rows). */
async function readFullState(): Promise<Record<string, Record<string, unknown>[]>> {
  const rows: Record<string, Record<string, unknown>[]> = {};
  for (const { name, table } of SYNCED_TABLES) {
    if (isWeb) {
      const raw = localStorage.getItem(`comma_${name}`);
      rows[name] = raw ? JSON.parse(raw) : [];
    } else {
      rows[name] = (await db.select().from(table)) as Record<string, unknown>[];
    }
  }
  return rows;
}

/**
 * Compact if the delta-log count is over threshold. Safe to call after any sync; it's a
 * cheap no-op (one list call) when under threshold. `createdAt` is passed in for a real
 * clock. Returns what it did. Never throws fatally to the caller's flow — compaction is
 * best-effort housekeeping; callers may ignore failures.
 */
export async function maybeCompact(
  passphrase: string,
  createdAt = Date.now()
): Promise<CompactionResult> {
  const files = await listAppDataFiles();
  const parsed = files
    .map((f) => ({ ...f, meta: parseSyncFilename(f.name) }))
    .filter((f) => f.meta != null);

  const deltaLogs = parsed.filter((f) => f.meta!.kind === "log");
  if (deltaLogs.length < COMPACTION_THRESHOLD) {
    return { compacted: false, deletedLogs: 0 };
  }

  const [deviceId, applied] = await Promise.all([getDeviceId(), getAppliedLogs()]);

  // 1. Build the snapshot from fully-merged local state.
  const snapshot: ChangeLog = {
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
  await addAppliedLog(snapshotName);

  // 3. Now it's safe to delete the delta logs we've provably subsumed (in our applied-set).
  let deletedLogs = 0;
  for (const f of deltaLogs) {
    if (!applied.has(f.name)) continue; // not yet applied by us → leave it
    const ok = await deleteDriveFile(f.id);
    if (ok) deletedLogs++;
  }

  // 4. Bound snapshot growth: delete our OWN older snapshots (a newer full snapshot
  //    subsumes them). Never touch other devices' snapshots.
  for (const f of parsed) {
    if (
      f.meta!.kind === "snapshot" &&
      f.meta!.deviceId === deviceId &&
      f.name !== snapshotName &&
      f.meta!.createdAt < createdAt
    ) {
      await deleteDriveFile(f.id);
    }
  }

  return { compacted: true, snapshot: snapshotName, deletedLogs };
}
