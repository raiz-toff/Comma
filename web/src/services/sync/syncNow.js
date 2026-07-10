/**
 * Sync orchestrator (interop plan Workstream 3). Ports mobile's
 * `commaApp/src/services/sync/syncNow.ts` verbatim (logic-wise).
 *
 * One entry point, `syncNow(passphrase, opts)`, that PULLs new logs + merges them (real LWW —
 * `applyChangeLog.js`) and/or PUSHes local changes. Callers:
 *   - manual "Sync now"   → full (pull + push)
 *   - foreground (tab shown) → pull only (the cheap "check on open")
 *   - background/due (tab hidden / debounced data change) → push only (or full when also due)
 *
 * Runs are SERIALIZED through a queue (not a bare single-flight): a manual full-sync queued
 * behind an in-flight pull-only still performs its own push instead of being handed the
 * pull-only's result. Serialization also prevents concurrent Drive races.
 */

import {
  isSyncEnabled,
  addAppliedLog,
  setLastPushRunAt,
  setLastCloudSaveAt,
  recordLogFailure,
  clearLogFailure,
  LOG_QUARANTINE_THRESHOLD,
} from './syncState.js';
import { pullChanges } from './pullChanges.js';
import { pushChanges } from './pushChanges.js';
import { applyChangeLog } from './applyChangeLog.js';
import { maybeCompact } from './compaction.js';
import { exportLocalProfile, importSyncedProfile } from './profileBridge.js';
import { bus } from '../../core/events.js';

/**
 * @typedef {Object} SyncOptions
 * @property {boolean} [pull]
 * @property {boolean} [push]
 */

/**
 * @typedef {Object} SyncResult
 * @property {number} pulledLogs
 * @property {number} appliedRows rows the merge inserted or overwrote (incoming won)
 * @property {number} skippedRows rows kept because the local copy was newer-or-equal
 * @property {number} auditedRows financial overwrites recorded to the audit log
 * @property {number} failedLogs pulled logs whose apply threw this run (retried/quarantined)
 * @property {boolean} pushed
 * @property {number} pushedRows
 */

/**
 * @param {string} passphrase
 * @param {SyncOptions} opts
 * @returns {Promise<SyncResult>}
 */
async function runSync(passphrase, opts) {
  if (!isSyncEnabled()) {
    throw new Error('Sync is not enabled. Unlock sync to use it.');
  }
  const doPull = opts.pull !== false;
  const doPush = opts.push !== false;

  // Mirror the users row → synced `profile` table BEFORE pulling, so fresh local edits carry
  // stamps and win/lose per-key LWW honestly instead of being clobbered by an older pull.
  try {
    await exportLocalProfile();
  } catch (e) {
    console.warn('[sync] profile export skipped:', e);
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
        addAppliedLog(filename);
        clearLogFailure(filename);
      } catch (err) {
        // One bad log must not wedge every log behind it (interop-audit Gap 5): count the
        // failure (pull skips it entirely after LOG_QUARANTINE_THRESHOLD) and keep going —
        // LWW merge is order-independent, so applying the rest first is safe.
        failedLogs += 1;
        const failures = recordLogFailure(filename);
        console.warn(
          `[sync] failed to apply ${filename} (attempt ${failures}` +
            `${failures >= LOG_QUARANTINE_THRESHOLD ? ' — quarantined' : ''})`,
          err,
        );
      }
    }

    // Newly-won profile rows → the users row (name, country, goals, onboarding flag…), so a
    // joining browser is fully set up straight from the cloud snapshot.
    try {
      const profileChanged = await importSyncedProfile();
      if (profileChanged) bus.emit('sync:changed', { profile: true });
    } catch (e) {
      console.warn('[sync] profile import skipped:', e);
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
    setLastPushRunAt(nowMs);
    // A successful push means the cloud copy is current — reset the "data is safe" timer that
    // the Dashboard reminder reads (last_backup_at, shared with the manual .comdb backup).
    setLastCloudSaveAt(new Date(nowMs).toISOString());

    // ── COMPACT (best-effort housekeeping) ──
    // Only after a push (so local state is current and the new delta is on Drive). A failure
    // here must not fail the sync — compaction is housekeeping, not data flow.
    try {
      await maybeCompact(passphrase);
    } catch (e) {
      console.warn('[sync] compaction skipped:', e);
    }
  }

  if (appliedRows > 0 || pushed) {
    bus.emit('sync:changed', { appliedRows, pushed, pushedRows });
  }

  return { pulledLogs, appliedRows, skippedRows, auditedRows, failedLogs, pushed, pushedRows };
}

// Serialize all syncs: each call waits for the previous to settle, then runs its own.
let queue = Promise.resolve();

/**
 * Run a sync. `opts` defaults to a full pull+push (the manual button). Auto-triggers pass
 * `{ pull: true, push: false }` (foreground) or `{ pull: false, push: true }` (scheduled push).
 * Serialized — never races another sync.
 * @param {string} passphrase
 * @param {SyncOptions} [opts]
 * @returns {Promise<SyncResult>}
 */
export function syncNow(passphrase, opts = {}) {
  bus.emit('sync:started', {});
  const run = queue
    .then(() => runSync(passphrase, opts))
    .then(
      (result) => {
        bus.emit('sync:success', result);
        return result;
      },
      (err) => {
        bus.emit('sync:failed', { error: err?.message || String(err) });
        throw err;
      },
    );
  // Keep the chain alive even if this run rejects, so a failure doesn't wedge the queue.
  queue = run.catch(() => undefined);
  return run;
}
