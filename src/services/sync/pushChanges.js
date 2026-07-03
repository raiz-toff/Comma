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
 * No crash. But it also means a bonus amount entered on web (folded into
 * `shifts.customFields.bonusAmount` — mobile's shifts table has no bonus column at all) is
 * SILENTLY DROPPED once mobile applies that row — it will not appear on mobile, and if mobile
 * later pushes its own newer edit of that same shift back, web's LWW "overwrite" will replace
 * web's whole row (including its customFields) with mobile's fieldless version, losing the bonus
 * there too (mitigated only by the financial-overwrite audit log — see applyChangeLog.js). This
 * is an inherent limitation of mobile's own whole-row LWW design (its own mergeRules.ts comment
 * acknowledges row-level LWW can't isolate individual fields), not something introduced here.
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
  if (!passphrase) throw new Error('Enter the backup password to sync.');

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
