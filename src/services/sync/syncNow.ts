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
  isDemoModeActive,
  addAppliedLog,
  setLastPushRunAt,
  setLastCloudSaveAt,
  recordLogFailure,
  clearLogFailure,
  LOG_QUARANTINE_THRESHOLD,
} from "../../database/syncState";
import { pullChanges } from "./pullChanges";
import { pushChanges } from "./pushChanges";
import { applyChangeLog } from "./applyChangeLog";
import { maybeCompact } from "./compaction";
import { exportLocalProfile, importSyncedProfile } from "./profileBridge";

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
  /** pulled logs whose apply threw this run (retried next sync, quarantined after 3) */
  failedLogs: number;
  pushed: boolean;
  pushedRows: number;
}

async function runSync(passphrase: string, opts: SyncOptions): Promise<SyncResult> {
  // Hard stop in demo mode: the seeded sample data must never reach the user's real cloud
  // copy. This backstops the UI gate on the sync screen and, crucially, the auto-sync
  // triggers (foreground pull / background push) that would otherwise run for a user who
  // had sync enabled before switching into demo mode.
  if (await isDemoModeActive()) {
    throw new Error("Cloud Sync is disabled while Demo Mode is active.");
  }
  if (!(await isSyncEnabled())) {
    throw new Error("Sync is not enabled. Unlock sync to use it.");
  }
  const doPull = opts.pull !== false;
  const doPush = opts.push !== false;

  // Mirror local profile → synced `profile` table BEFORE pulling, so fresh local edits carry
  // stamps and win/lose per-key LWW honestly instead of being clobbered by an older pull.
  try {
    await exportLocalProfile();
  } catch (e) {
    console.warn("[sync] profile export skipped:", e);
  }

  let pulledLogs = 0;
  let appliedRows = 0;
  let skippedRows = 0;
  let auditedRows = 0;
  let failedLogs = 0;

  // ── PULL + merge ──
  if (doPull) {
    const pulled = await pullChanges(passphrase);
    pulledLogs = pulled.length;
    for (const { log, filename } of pulled) {
      try {
        const { upserted, skipped, audited } = await applyChangeLog(log);
        appliedRows += upserted;
        skippedRows += skipped;
        auditedRows += audited;
        // Record AFTER the merge transaction commits, so a crash mid-batch leaves the log
        // un-applied and it's simply retried next pull (the applied-set is the cursor).
        await addAppliedLog(filename);
        await clearLogFailure(filename);
      } catch (e) {
        // One bad log must not wedge every log behind it (interop-audit Gap 5): count the
        // failure (pull skips it entirely after LOG_QUARANTINE_THRESHOLD) and keep going —
        // LWW merge is order-independent, so applying the rest first is safe.
        failedLogs += 1;
        const failures = await recordLogFailure(filename);
        console.warn(
          `[sync] failed to apply ${filename} (attempt ${failures}` +
            `${failures >= LOG_QUARANTINE_THRESHOLD ? " — quarantined" : ""})`,
          e
        );
      }
    }

    // Newly-won profile rows → local settings (name, country, units, onboarding flag…),
    // so a joining device is fully set up straight from the cloud snapshot.
    try {
      await importSyncedProfile();
    } catch (e) {
      console.warn("[sync] profile import skipped:", e);
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

  return { pulledLogs, appliedRows, skippedRows, auditedRows, failedLogs, pushed, pushedRows };
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
