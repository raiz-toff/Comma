/**
 * Push half of sync (cloud-sync P2 — see sync-design.md §4 "PUSH").
 *
 * Collects this device's local changes since the last push (rows where
 * syncUpdatedAt > sync_last_pushed_at, INCLUDING soft-deleted tombstones), wraps them
 * in a ChangeLog, encrypts, and uploads ONE `.cmlog` file to Drive's appDataFolder.
 * Then advances the cursor and records the new filename in the applied-set so this
 * device never pulls its own log back.
 *
 * No merge logic here — push only emits; pull + merge live elsewhere.
 */

import { Platform } from "react-native";
import { gt } from "drizzle-orm";
import { db } from "../../database/client";
import { SYNCED_TABLES } from "../../database/syncedTables";
import {
  getDeviceId,
  getLastPushedAt,
  setLastPushedAt,
  addAppliedLog,
} from "../../database/syncState";
import { uploadSyncFile } from "./driveIO";
import {
  type ChangeLog,
  CHANGELOG_VERSION,
  buildChangeLogFilename,
  encodeChangeLog,
} from "./changeLog";

const isWeb = Platform.OS === "web";

export interface PushResult {
  /** false when there was nothing to push (no upload performed). */
  pushed: boolean;
  filename?: string;
  /** total rows across all tables included in the pushed log. */
  rowCount: number;
}

/**
 * Gather changed rows per synced table where syncUpdatedAt > cursor. Returns the rows
 * map plus the max syncUpdatedAt seen (the new cursor — advancing by exactly the data
 * pushed, not wall-clock, so nothing is skipped if a write lands mid-push).
 */
async function collectChangedRows(cursor: number): Promise<{
  rows: Record<string, Record<string, unknown>[]>;
  maxUpdatedAt: number;
  rowCount: number;
}> {
  const rows: Record<string, Record<string, unknown>[]> = {};
  let maxUpdatedAt = cursor;
  let rowCount = 0;

  for (const { name, table } of SYNCED_TABLES) {
    let changed: Record<string, unknown>[];
    if (isWeb) {
      const raw = localStorage.getItem(`comma_${name}`);
      const list: Record<string, unknown>[] = raw ? JSON.parse(raw) : [];
      changed = list.filter((r) => Number(r.syncUpdatedAt ?? 0) > cursor);
    } else {
      changed = (await db
        .select()
        .from(table)
        .where(gt((table as any).syncUpdatedAt, cursor))) as Record<string, unknown>[];
    }

    if (changed.length > 0) {
      rows[name] = changed;
      rowCount += changed.length;
      for (const r of changed) {
        const u = Number(r.syncUpdatedAt ?? 0);
        if (u > maxUpdatedAt) maxUpdatedAt = u;
      }
    }
  }

  return { rows, maxUpdatedAt, rowCount };
}

/**
 * Push local changes since the last push. Requires the backup passphrase (the encryption
 * key). No-ops (returns {pushed:false}) when there's nothing new.
 *
 * Caller stamps the timestamp: `createdAt` comes in as a param because the Drizzle expo
 * sandbox forbids argless Date in some contexts and, more importantly, push is invoked
 * from app code where Date.now() is fine — defaulting here keeps the signature simple.
 */
export async function pushChanges(passphrase: string, createdAt = Date.now()): Promise<PushResult> {
  if (!passphrase) throw new Error("Enter the backup password to sync.");

  const cursor = await getLastPushedAt();
  const { rows, maxUpdatedAt, rowCount } = await collectChangedRows(cursor);

  if (rowCount === 0) {
    return { pushed: false, rowCount: 0 };
  }

  const deviceId = await getDeviceId();
  const log: ChangeLog = {
    v: CHANGELOG_VERSION,
    deviceId,
    createdAt,
    sinceCursor: cursor,
    rows,
  };

  const filename = buildChangeLogFilename(deviceId, createdAt);
  const envelope = await encodeChangeLog(log, passphrase);
  await uploadSyncFile(filename, envelope);

  // Advance cursor to exactly the data pushed, and remember our own filename so pull
  // skips it. Order: record the log first (cheap, idempotent), then move the cursor.
  await addAppliedLog(filename);
  await setLastPushedAt(maxUpdatedAt);

  return { pushed: true, filename, rowCount };
}
