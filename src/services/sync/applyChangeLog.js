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
 * 2026-07-03 interop-audit hardening (see `interopShape.js` + the audit report in
 * `commaApp/app/docs/web-mobile-interop-audit-2026-07-03.md`):
 *   - Rows are written via `normalizeIncoming(...)` instead of a bare `put(incoming)`: incoming
 *     values are merged OVER the surviving local row (a mobile row can no longer wipe web-only
 *     fields like `date`/`customFields`/`receiptData` — audit Gap 7), mobile's ISO-string
 *     timestamps are coerced to web's epoch-ms / `YYYY-MM-DD` formats (Gap 6), and the web
 *     convenience fields (`date`, `platformId`, `nickname`, `active`, goal `type`/`scope`/
 *     `target`) are re-derived from the mobile-canonical values.
 *   - Merchants dedupe by identity, not id (Gap 4): both apps mint their own merchant ids, and
 *     `merchants.name` is UNIQUE here (`&name`) and on mobile — so an incoming merchant whose id
 *     is unknown but whose `normalizedName` (fallback: exact `name`) matches an existing row is
 *     treated as THAT row (LWW against it, local id kept). Without this, "Shell" created on two
 *     devices is a ConstraintError that aborts the transaction and wedges sync permanently.
 *     Safe to remap because neither app references merchants by id — it's a suggestion list.
 */

import { db } from '../../core/db.js';
import { newId } from '../../core/id.js';
import { SYNCED_TABLE_BY_NAME } from './syncedTables.js';
import { decideMerge, shouldAuditOverwrite } from './mergeRules.js';
import { normalizeIncoming } from './interopShape.js';

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
 * Find the local merchant row an id-unknown incoming merchant actually IS, by identity:
 * `normalizedName` when the incoming row has one, else exact `name`. Empty identities never
 * match (mobile defaults `normalizedName` to '' — matching '' to '' would collapse rows).
 * @param {import('dexie').Table} table
 * @param {Record<string, unknown>} incoming
 * @returns {Promise<Record<string, unknown> | undefined>}
 */
async function findMerchantByIdentity(table, incoming) {
  const norm = String(incoming.normalizedName ?? '').trim();
  if (norm) return table.where('normalizedName').equals(norm).first();
  const name = String(incoming.name ?? '').trim();
  if (name) return table.where('name').equals(name).first();
  return undefined;
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

        let localRow = await table.get(incoming.id);
        // Merchant identity dedupe (audit Gap 4): unknown id + known name → merge into the
        // existing row (keep the LOCAL id) instead of inserting a UNIQUE-name violation.
        let targetId = incoming.id;
        if (localRow == null && name === 'merchants') {
          const dupe = await findMerchantByIdentity(table, incoming);
          if (dupe && dupe.id != null) {
            localRow = dupe;
            targetId = dupe.id;
          }
        }

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
            rowId: String(targetId),
            supersededRow: localRow,
            winnerRow: incoming,
          });
          audited++;
        }

        // Merge over the local row + coerce mobile wire formats + re-derive web fields
        // (see interopShape.js). Insert and overwrite are both a `put` in Dexie; the row's
        // id stays the LOCAL one when the merchant dedupe remapped it.
        const finalRow = normalizeIncoming(name, incoming, localRow);
        finalRow.id = targetId;
        await table.put(finalRow);
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
