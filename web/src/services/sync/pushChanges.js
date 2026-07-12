/**
 * Push half of sync (interop plan Workstream 3). Ports mobile's
 * `commaApp/src/services/sync/pushChanges.ts` against Dexie queries.
 *
 * Collects this device's local changes since the last push (rows where
 * syncUpdatedAt > sync_last_pushed_at, INCLUDING soft-deleted tombstones), wraps them in a
 * ChangeLog, encrypts, and uploads ONE `.cmlog` file to Drive's appDataFolder. Then advances the
 * cursor and records the new filename in the applied-set so this device never pulls its own log
 * back.
 *
 * No merge logic here — push only emits; pull + merge live in pullChanges.js/applyChangeLog.js.
 *
 * A note on web-only fields (customFields, the derived `date` convenience column, onlineMinutes,
 * activeMinutes, weather, mood, isMultiApp, multiAppPlatformIds, receiptData — see db.js STORES_V5
 * doc): these are pushed AS-IS, unstripped. Verified against commaApp's actual installed
 * `drizzle-orm` (`node_modules/drizzle-orm/sqlite-core/dialect.js` `buildInsertQuery` /
 * `mapUpdateSet`): mobile's `applyChangeLog.ts` does `tx.insert(table).values(incoming)` /
 * `tx.update(table).set(values)`, and Drizzle's SQL builder iterates the TABLE's OWN defined
 * columns (not the input object's keys) when building the query — so an extra key like
 * `customFields` on the pushed row is silently ignored, never even reaching a query parameter.
 * No crash. Note that `shifts.bonusAmount` is NOT one of these web-only fields as of Dexie v7 —
 * mobile's shifts table now has its own real top-level `bonusAmount` column (interop plan
 * Workstream 1 follow-up), so a bonus amount entered on web round-trips through sync like any
 * other shift field (grossRevenue, tipsRevenue, etc.) instead of being silently dropped.
 */

import { getDeviceId, getLastPushedAt, setLastPushedAt, addAppliedLog } from './syncState.js';
import { SYNCED_TABLES } from './syncedTables.js';
import { uploadSyncFile } from '../../modules/backup/drive-api.js';
import { CHANGELOG_VERSION, buildChangeLogFilename, encodeChangeLog } from './changeLog.js';

/**
 * @typedef {Object} PushResult
 * @property {boolean} pushed false when there was nothing to push (no upload performed)
 * @property {string} [filename]
 * @property {number} rowCount total rows across all tables included in the pushed log
 */

/**
 * Gather changed rows per synced table where syncUpdatedAt > cursor. Returns the rows map plus
 * the max syncUpdatedAt seen (the new cursor — advancing by exactly the data pushed, not
 * wall-clock, so nothing is skipped if a write lands mid-push).
 * @param {number} cursor
 */
async function collectChangedRows(cursor) {
  /** @type {Record<string, Record<string, unknown>[]>} */
  const rows = {};
  let maxUpdatedAt = cursor;
  let rowCount = 0;

  for (const { name, table } of SYNCED_TABLES) {
    const changed = await table.where('syncUpdatedAt').above(cursor).toArray();

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
 * Push local changes since the last push. Requires the backup passphrase (the encryption key).
 * No-ops (returns {pushed:false}) when there's nothing new.
 * @param {string} passphrase
 * @param {number} [createdAt]
 * @returns {Promise<PushResult>}
 */
export async function pushChanges(passphrase, createdAt = Date.now()) {
  // An EMPTY passphrase is legal — it's the default one-tap mode, where encodeChangeLog
  // writes a plain envelope into the Drive appDataFolder sandbox (see cryptoEnvelope.js).

  const cursor = getLastPushedAt();
  const { rows, maxUpdatedAt, rowCount } = await collectChangedRows(cursor);

  if (rowCount === 0) {
    return { pushed: false, rowCount: 0 };
  }

  const deviceId = getDeviceId();
  const log = {
    v: CHANGELOG_VERSION,
    deviceId,
    createdAt,
    sinceCursor: cursor,
    rows,
  };

  const filename = buildChangeLogFilename(deviceId, createdAt);
  const envelope = await encodeChangeLog(log, passphrase);
  await uploadSyncFile(filename, envelope);

  // Advance cursor to exactly the data pushed, and remember our own filename so pull skips it.
  // Order: record the log first (cheap, idempotent), then move the cursor.
  addAppliedLog(filename);
  setLastPushedAt(maxUpdatedAt);

  return { pushed: true, filename, rowCount };
}
