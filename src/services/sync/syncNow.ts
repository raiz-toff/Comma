/**
 * Sync orchestrator (cloud-sync P2–P4 — see sync-design.md §4).
 *
 * One entry point, `syncNow(passphrase, opts)`, that PULLs new logs + merges them (real
 * LWW — applyChangeLog.ts) and/or PUSHes local changes. Callers:
 *   - manual "Sync now"  → full (pull + push)
 *   - foreground (P4)    → pull only (the cheap "check on open")
 *   - background/due (P4)→ push only (or full when also due)
 *
 * Runs are SERIALIZED through a queue (not a bare single-flight): a manual full-sync
 * queued behind an in-flight pull-only still performs its push instead of being handed
 * the pull-only's result. Serialization also prevents concurrent Drive races.
 */

import {
  isSyncEnabled,
  addAppliedLog,
  setLastPushRunAt,
  setLastCloudSaveAt,
} from "../../database/syncState";
import { pullChanges } from "./pullChanges";
import { pushChanges } from "./pushChanges";
import { applyChangeLog } from "./applyChangeLog";
import { maybeCompact } from "./compaction";

export interface SyncOptions {
  pull?: boolean;
  push?: boolean;
}

export interface SyncResult {
  pulledLogs: number;
  /** rows the merge inserted or overwrote (incoming won) */
  appliedRows: number;
  /** rows kept because the local copy was newer-or-equal */
  skippedRows: number;
  /** financial overwrites recorded to the audit log */
  auditedRows: number;
  pushed: boolean;
  pushedRows: number;
}

async function runSync(passphrase: string, opts: SyncOptions): Promise<SyncResult> {
  if (!(await isSyncEnabled())) {
    throw new Error("Sync is not enabled. Unlock sync to use it.");
  }
  const doPull = opts.pull !== false;
  const doPush = opts.push !== false;

  let pulledLogs = 0;
  let appliedRows = 0;
  let skippedRows = 0;
  let auditedRows = 0;

  // ── PULL + merge ──
  if (doPull) {
    const pulled = await pullChanges(passphrase);
    pulledLogs = pulled.length;
    for (const { log, filename } of pulled) {
      const { upserted, skipped, audited } = await applyChangeLog(log);
      appliedRows += upserted;
      skippedRows += skipped;
      auditedRows += audited;
      // Record AFTER the merge transaction commits, so a crash mid-batch leaves the log
      // un-applied and it's simply retried next pull (the applied-set is the cursor).
      await addAppliedLog(filename);
    }
  }

  // ── PUSH ──
  let pushed = false;
  let pushedRows = 0;
  if (doPush) {
    const push = await pushChanges(passphrase);
    pushed = push.pushed;
    pushedRows = push.rowCount;
    // Stamp the schedule timer on every push ATTEMPT (even an empty no-op push), so a
    // due-but-nothing-changed device doesn't re-attempt every session boundary.
    const nowMs = Date.now();
    await setLastPushRunAt(nowMs);
    // A successful push means the cloud copy is current — reset the "data is safe" timer
    // that the Dashboard reminder reads (last_backup_at, formerly written by backup).
    await setLastCloudSaveAt(new Date(nowMs).toISOString());

    // ── COMPACT (best-effort housekeeping) ──
    // Only after a push (so local state is current and the new delta is on Drive). A
    // failure here must not fail the sync — compaction is housekeeping, not data flow.
    try {
      await maybeCompact(passphrase);
    } catch (e) {
      console.warn("[sync] compaction skipped:", e);
    }
  }

  return { pulledLogs, appliedRows, skippedRows, auditedRows, pushed, pushedRows };
}

// Serialize all syncs: each call waits for the previous to settle, then runs its own.
let queue: Promise<unknown> = Promise.resolve();

/**
 * Run a sync. `opts` defaults to a full pull+push (the manual button). Auto-triggers
 * pass `{ pull: true, push: false }` (foreground) or `{ pull: false, push: true }`
 * (scheduled push). Serialized — never races another sync.
 */
export function syncNow(passphrase: string, opts: SyncOptions = {}): Promise<SyncResult> {
  const run = queue.then(() => runSync(passphrase, opts));
  // Keep the chain alive even if this run rejects, so a failure doesn't wedge the queue.
  queue = run.catch(() => undefined);
  return run;
}
