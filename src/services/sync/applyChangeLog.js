/**
 * Apply incoming change-log rows to the local DB — the real Last-Write-Wins merge (interop plan
 * Workstream 3). Ports mobile's `commaApp/src/services/sync/applyChangeLog.ts` against Dexie.
 *
 * For each incoming row:
 *   - no local row               → INSERT it (tombstones included, so remote deletes land)
 *   - incoming strictly newer    → OVERWRITE local; if it's a FINANCIAL row that had real local
 *                                  edits, record the superseded version to the append-only
 *                                  `comma_sync_overwrite_log` FIRST (never silently drop a money
 *                                  edit — mirrors mobile's `sync_overwrite_log` table)
 *   - otherwise (local newer/equal) → SKIP, keep local
 *
 * The whole apply runs in ONE Dexie transaction so a mid-apply crash/reload leaves the log
 * un-applied and it's simply retried next pull (nothing to roll back — Dexie transactions are
 * all-or-nothing). The merge DECISION logic lives in pure functions in `mergeRules.js`.
 *
 * A note on unknown/extra fields (see the interop plan's `customFields` question): incoming rows
 * from mobile never carry web-only fields like `customFields`/`date`/`onlineMinutes` in the first
 * place (mobile's schema has no such columns to populate them from), so there's nothing to strip
 * on THIS (pull) side — Dexie also has no strict per-row column schema, so even if an incoming
 * row somehow carried an unrecognized key, `bulkPut`/`put` would just store it harmlessly. The
 * asymmetric risk is on the PUSH side (see `pushChanges.js` doc) — mobile's Drizzle insert is
 * column-driven and silently ignores unknown keys, so web's extra fields don't survive a
 * round-trip through mobile, but they don't crash it either.
 */

import { db } from '../../core/db.js';
import { newId } from '../../core/id.js';
import { SYNCED_TABLE_BY_NAME } from './syncedTables.js';
import { decideMerge, shouldAuditOverwrite } from './mergeRules.js';

const OVERWRITE_LOG_KEY = 'comma_sync_overwrite_log';

/**
 * @typedef {Object} ApplyResult
 * @property {number} upserted rows inserted or overwritten (i.e. incoming won)
 * @property {number} skipped rows where the local copy was newer-or-equal and kept
 * @property {number} audited financial overwrites recorded to the audit log
 */

function num(v) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Append one audit entry to the localStorage overwrite log (mirrors mobile's `sync_overwrite_log` table). */
function appendOverwriteAudit(entry) {
  try {
    const raw = localStorage.getItem(OVERWRITE_LOG_KEY);
    const list = raw ? JSON.parse(raw) : [];
    list.push({
      id: newId('audit'),
      tableName: entry.tableName,
      rowId: entry.rowId,
      supersededRow: JSON.stringify(entry.supersededRow),
      winnerRow: JSON.stringify(entry.winnerRow),
      mergedAt: entry.mergedAt,
    });
    // Bound growth — keep the most recent 500 entries (device-local recovery log, not synced).
    localStorage.setItem(OVERWRITE_LOG_KEY, JSON.stringify(list.slice(-500)));
  } catch (err) {
    console.warn('[sync] failed to append overwrite audit entry', err);
  }
}

/**
 * Apply one change-log with real LWW + financial audit. `mergedAt` is passed in so the audit
 * timestamps are consistent across a single apply.
 * @param {import('./changeLog.js').ChangeLog} log
 * @param {number} [mergedAt]
 * @returns {Promise<ApplyResult>}
 */
export async function applyChangeLog(log, mergedAt = Date.now()) {
  let upserted = 0;
  let skipped = 0;
  let audited = 0;
  /** @type {Array<{ tableName: string, rowId: string, supersededRow: Record<string, unknown>, winnerRow: Record<string, unknown> }>} */
  const auditQueue = [];

  const tableNames = Object.keys(log.rows).filter((name) => SYNCED_TABLE_BY_NAME[name]);
  const tables = tableNames.map((name) => SYNCED_TABLE_BY_NAME[name]);

  if (tableNames.length === 0) {
    return { upserted, skipped, audited };
  }

  await db.transaction('rw', tables, async () => {
    for (const name of tableNames) {
      const table = SYNCED_TABLE_BY_NAME[name];
      const rows = log.rows[name] || [];
      for (const incoming of rows) {
        if (incoming == null || incoming.id == null) continue;
        const localRow = await table.get(incoming.id);

        const decision = decideMerge({
          localExists: localRow != null,
          localUpdatedAt: num(localRow?.syncUpdatedAt),
          incomingUpdatedAt: num(incoming.syncUpdatedAt),
        });

        if (decision === 'skip') {
          skipped++;
          continue;
        }

        if (
          decision === 'overwrite' &&
          localRow &&
          shouldAuditOverwrite({ decision, tableName: name, localUpdatedAt: num(localRow.syncUpdatedAt) })
        ) {
          auditQueue.push({
            tableName: name,
            rowId: String(incoming.id),
            supersededRow: localRow,
            winnerRow: incoming,
          });
          audited++;
        }

        // decision is 'insert' or 'overwrite' — both are a straight put() in Dexie (no separate
        // insert-vs-update API; `put` upserts by primary key either way).
        await table.put(incoming);
        upserted++;
      }
    }
  });

  // Audit entries are written AFTER the transaction commits (localStorage isn't part of the
  // Dexie transaction) — safe because the transaction having committed is the only thing that
  // matters for data correctness; the audit log is best-effort bookkeeping.
  for (const entry of auditQueue) {
    appendOverwriteAudit({ ...entry, mergedAt });
  }

  return { upserted, skipped, audited };
}
