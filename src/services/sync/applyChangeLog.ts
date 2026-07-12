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
import {
  SYNCED_TABLE_BY_NAME,
  SYNCED_PK_BY_NAME,
  reviveTimestamps,
  canonicalizeIncoming,
} from "../../database/syncedTables";
import { type ChangeLog } from "./changeLog";
import { decideMerge, shouldAuditOverwrite } from "./mergeRules";

const isWeb = Platform.OS === "web";
const genAuditId = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", 16);

/**
 * Bump whenever the apply/merge logic changes what it can successfully apply. syncNow
 * compares this against the persisted value and clears the poison-log quarantine on a
 * mismatch, so logs a BUGGY build failed on get retried under the fixed code.
 *   v2 (2026-07-12): per-table primary keys — profile rows (pk `key`, no `id` column)
 *   made every log containing them fail with a SQL syntax error and get quarantined.
 */
export const APPLY_LOGIC_VERSION = "2";

/**
 * Merchant identity key (2026-07-03 interop audit, Gap 4). Both apps mint their OWN merchant
 * ids, and `merchants.name` is UNIQUE here and on web — so an id-unknown incoming merchant
 * whose normalizedName (fallback: exact name) matches an existing row must merge into THAT
 * row (keeping the LOCAL id) instead of inserting a UNIQUE violation that aborts the whole
 * apply transaction and wedges sync. Safe to remap: merchants are a suggestion list — nothing
 * references them by id (expenses store the merchant NAME, denormalized).
 */
function merchantIdentity(row: Record<string, unknown>): { norm: string; name: string } {
  return {
    norm: String((row as any).normalizedName ?? "").trim(),
    name: String((row as any).name ?? ""),
  };
}

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
      const pk = SYNCED_PK_BY_NAME[name] ?? "id";
      const raw = localStorage.getItem(`comma_${name}`);
      const list: Record<string, unknown>[] = raw ? JSON.parse(raw) : [];
      const idx = new Map<string, number>(list.map((r, i) => [String(r[pk]), i]));

      for (const rawIncoming of rows) {
        const incoming = canonicalizeIncoming(name, rawIncoming);
        const id = String(incoming[pk]);
        let at = idx.get(id);
        // Merchant identity dedupe — see merchantIdentity() doc.
        if (at == null && name === "merchants") {
          const { norm, name: nameVal } = merchantIdentity(incoming);
          const found = list.findIndex((r) => {
            const local = merchantIdentity(r);
            return norm ? local.norm === norm : nameVal !== "" && local.name === nameVal;
          });
          if (found >= 0) at = found;
        }
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
        // Keep the LOCAL key when the merchant dedupe remapped the row.
        if (at != null) list[at] = { ...incoming, [pk]: (list[at] as any)[pk] ?? incoming[pk] };
        else {
          list.push(incoming);
          idx.set(id, list.length - 1);
        }
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
      // Per-table primary key: `key` for the profile KV, `id` everywhere else. Assuming
      // `id` here rendered `WHERE = ?` for profile rows (no such column) — a SQL syntax
      // error that failed and eventually quarantined EVERY log carrying a profile.
      const pk = SYNCED_PK_BY_NAME[name] ?? "id";
      const pkCol = (table as any)[pk];
      for (const rawIncoming of rows) {
        const incoming = canonicalizeIncoming(name, rawIncoming);
        const existing = await tx
          .select()
          .from(table)
          .where(eq(pkCol, (incoming as any)[pk]))
          .limit(1);
        let localRow = existing[0] as Record<string, unknown> | undefined;

        // Merchant identity dedupe — see merchantIdentity() doc. When it matches, the merge
        // targets the EXISTING row (its id is kept) instead of inserting a duplicate name.
        let targetId = String((incoming as any)[pk]);
        if (!localRow && name === "merchants") {
          const { norm, name: nameVal } = merchantIdentity(incoming);
          let dupe: unknown[] = [];
          if (norm) {
            dupe = await tx
              .select()
              .from(table)
              .where(eq((table as any).normalizedName, norm))
              .limit(1);
          } else if (nameVal !== "") {
            dupe = await tx
              .select()
              .from(table)
              .where(eq((table as any).name, nameVal))
              .limit(1);
          }
          if (dupe[0]) {
            localRow = dupe[0] as Record<string, unknown>;
            targetId = String((dupe[0] as any).id);
          }
        }

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
            rowId: targetId,
            supersededRow: JSON.stringify(localRow),
            winnerRow: JSON.stringify(incoming),
            mergedAt,
          });
          audited++;
        }
        // Never move the primary key: update the LOCAL row's key (equals the incoming one
        // except when the merchant dedupe remapped the target).
        const updateValues = { ...(values as Record<string, unknown>) };
        delete updateValues[pk];
        await tx.update(table).set(updateValues).where(eq(pkCol, targetId));
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
