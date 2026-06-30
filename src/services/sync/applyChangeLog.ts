/**
 * Apply incoming change-log rows to the local DB — the real Last-Write-Wins merge
 * (cloud-sync P3 — see sync-design.md §5). Replaces the P2 naive-upsert stub.
 *
 * For each incoming row:
 *   - no local row              → INSERT it (tombstones included, so remote deletes land)
 *   - incoming strictly newer    → OVERWRITE local; if it's a FINANCIAL row that had real
 *                                  local edits, record the superseded version to the
 *                                  append-only sync_overwrite_log FIRST (never silently
 *                                  drop a money edit)
 *   - otherwise (local newer/equal) → SKIP, keep local
 *
 * The whole apply runs in ONE transaction (native) so a crash leaves the log un-applied
 * and it's simply retried next pull. The merge DECISION logic lives in pure functions in
 * mergeRules.ts (unit-tested without a DB).
 */

import { Platform } from "react-native";
import { eq } from "drizzle-orm";
import { customAlphabet } from "nanoid/non-secure";
import { db } from "../../database/client";
import { syncOverwriteLog } from "../../database/schema";
import { SYNCED_TABLE_BY_NAME, reviveTimestamps } from "../../database/syncedTables";
import { type ChangeLog } from "./changeLog";
import { decideMerge, shouldAuditOverwrite } from "./mergeRules";

const isWeb = Platform.OS === "web";
const genAuditId = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", 16);

export interface ApplyResult {
  /** rows inserted or overwritten (i.e. incoming won) */
  upserted: number;
  /** rows where the local copy was newer-or-equal and kept */
  skipped: number;
  /** financial overwrites recorded to the audit log */
  audited: number;
}

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Apply one change-log with real LWW + financial audit. `mergedAt` is passed in (callers
 * have a real clock) so the audit timestamps are consistent across a single apply.
 */
export async function applyChangeLog(log: ChangeLog, mergedAt = Date.now()): Promise<ApplyResult> {
  let upserted = 0;
  let skipped = 0;
  let audited = 0;

  if (isWeb) {
    for (const [name, rows] of Object.entries(log.rows)) {
      if (!SYNCED_TABLE_BY_NAME[name]) continue; // unknown/non-synced table — ignore
      const raw = localStorage.getItem(`comma_${name}`);
      const list: Record<string, unknown>[] = raw ? JSON.parse(raw) : [];
      const idx = new Map<string, number>(list.map((r, i) => [String(r.id), i]));

      for (const incoming of rows) {
        const id = String(incoming.id);
        const at = idx.get(id);
        const localRow = at != null ? list[at] : undefined;
        const decision = decideMerge({
          localExists: localRow != null,
          localUpdatedAt: num(localRow?.syncUpdatedAt),
          incomingUpdatedAt: num(incoming.syncUpdatedAt),
        });

        if (decision === "skip") {
          skipped++;
          continue;
        }
        if (
          decision === "overwrite" &&
          localRow &&
          shouldAuditOverwrite({ decision, tableName: name, localUpdatedAt: num(localRow.syncUpdatedAt) })
        ) {
          appendWebAudit({ tableName: name, rowId: id, supersededRow: localRow, winnerRow: incoming, mergedAt });
          audited++;
        }
        if (at != null) list[at] = incoming;
        else list.push(incoming);
        upserted++;
      }
      localStorage.setItem(`comma_${name}`, JSON.stringify(list));
    }
    return { upserted, skipped, audited };
  }

  await db.transaction(async (tx: any) => {
    for (const [name, rows] of Object.entries(log.rows)) {
      const table = SYNCED_TABLE_BY_NAME[name];
      if (!table) continue; // unknown/non-synced table — ignore
      for (const incoming of rows) {
        const existing = await tx
          .select()
          .from(table)
          .where(eq((table as any).id, incoming.id))
          .limit(1);
        const localRow = existing[0] as Record<string, unknown> | undefined;

        const decision = decideMerge({
          localExists: localRow != null,
          localUpdatedAt: num(localRow?.syncUpdatedAt),
          incomingUpdatedAt: num(incoming.syncUpdatedAt),
        });

        if (decision === "skip") {
          skipped++;
          continue;
        }

        const values = reviveTimestamps(name, incoming);

        if (decision === "insert") {
          await tx.insert(table).values(values);
          upserted++;
          continue;
        }

        // decision === "overwrite"
        if (
          localRow &&
          shouldAuditOverwrite({ decision, tableName: name, localUpdatedAt: num(localRow.syncUpdatedAt) })
        ) {
          await tx.insert(syncOverwriteLog).values({
            id: genAuditId(),
            tableName: name,
            rowId: String(incoming.id),
            supersededRow: JSON.stringify(localRow),
            winnerRow: JSON.stringify(incoming),
            mergedAt,
          });
          audited++;
        }
        await tx.update(table).set(values).where(eq((table as any).id, incoming.id));
        upserted++;
      }
    }
  });

  return { upserted, skipped, audited };
}

/** Append one audit entry to the web localStorage audit log (mirror of the native table). */
function appendWebAudit(entry: {
  tableName: string;
  rowId: string;
  supersededRow: Record<string, unknown>;
  winnerRow: Record<string, unknown>;
  mergedAt: number;
}): void {
  const KEY = "comma_sync_overwrite_log";
  const raw = localStorage.getItem(KEY);
  const list: unknown[] = raw ? JSON.parse(raw) : [];
  list.push({
    id: genAuditId(),
    tableName: entry.tableName,
    rowId: entry.rowId,
    supersededRow: JSON.stringify(entry.supersededRow),
    winnerRow: JSON.stringify(entry.winnerRow),
    mergedAt: entry.mergedAt,
  });
  localStorage.setItem(KEY, JSON.stringify(list));
}
