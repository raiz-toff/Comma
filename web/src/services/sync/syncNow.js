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
  isDemoModeActive,
  getDeviceId,
  addAppliedLog,
  setLastPushRunAt,
  setLastCloudSaveAt,
  recordLogFailure,
  clearLogFailure,
  LOG_QUARANTINE_THRESHOLD,
} from './syncState.js';
import { readManifest, verifyPassword, createManifest } from './vaultManifest.js';
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
 * @property {boolean} needsPassphrase true when a file is encrypted and this browser
 *   couldn't open it (no password stored, or the wrong one)
 * @property {string[]} passphraseLockedFiles filenames behind needsPassphrase — what
 *   "Forgot password?" would abandon
 * @property {boolean} needsPasswordSetup true when the push was skipped because no
 *   password has ever been set here — sync has no plain mode
 * @property {boolean} pushBlocked true when the push was skipped because the pull hit files
 *   this browser can't decrypt (needsPassphrase) OR the manifest verifier rejected our
 *   password (wrongPassword). Pushing anyway would fork the vault into two encrypted streams
 *   under different passwords (see plans/008 §1), so we hold the push until they reconcile.
 * @property {boolean} wrongPassword true when a vault manifest exists and this browser's
 *   password did not decrypt its verifier — the authoritative "wrong password" signal.
 * @property {boolean} vaultExists true when a vault manifest exists on this Google account.
 *   Lets the UI tell apart the two cases behind needsPasswordSetup: a vault exists → ENTER
 *   its password; no vault → SET a new one.
 */

/**
 * @param {string} passphrase
 * @param {SyncOptions} opts
 * @returns {Promise<SyncResult>}
 */
async function runSync(passphrase, opts) {
  // Hard stop in demo mode: the seeded sample data must never reach the user's real cloud
  // copy. This backstops the UI gate on the sync screen and the auto-sync triggers — mirrors
  // mobile's `src/services/sync/syncNow.ts` hard stop, which this file otherwise ports verbatim.
  if (await isDemoModeActive()) {
    throw new Error('Cloud Sync is disabled while Demo Mode is active.');
  }
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
  let needsPassphrase = false;
  let passphraseLockedFiles = [];

  // ── PULL + merge ──
  if (doPull) {
    const pulled = await pullChanges(passphrase);
    pulledLogs = pulled.logs.length;
    needsPassphrase = pulled.needsPassphrase;
    passphraseLockedFiles = pulled.passphraseLockedFiles;

    // Files that failed to DOWNLOAD/DECODE (corrupt — not merely encrypted) still go through
    // the quarantine counter, so a permanently-broken file stops being re-fetched forever.
    for (const filename of pulled.failed) {
      failedLogs += 1;
      recordLogFailure(filename);
    }

    for (const { log, filename } of pulled.logs) {
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
  // Sync has no plain mode: never push without a password, full stop — this is the engine's
  // own backstop, not just a UI gate, so a stray call can't slip an unencrypted file onto
  // Drive because the UI happened not to collect a password first.
  const needsPasswordSetup = !passphrase;

  // ── MANIFEST GATE (plans/008 Phase 1) ──
  // The manifest is the account's single source of truth for the password. We read it on every
  // push-capable sync (even one with no password yet) so `vaultExists` can tell the UI whether
  // to ask the user to ENTER an existing password vs SET a brand-new one — the two are
  // otherwise indistinguishable and getting it wrong forks the vault. Then, before writing:
  //  • vault exists + a password → it MUST decrypt the verifier or we don't push (wrongPassword).
  //    Authoritative "wrong password" signal; fires even on a push-only sync that never pulled,
  //    so a password rotated on another device is caught here too.
  //  • no manifest + a password + nothing we couldn't read → we're the vault's creator (fresh)
  //    or its first upgrader (legacy pre-manifest files, all decryptable). Mint the manifest.
  //  • no manifest + files we COULDN'T read → a legacy fork; Phase 0's pushBlocked already
  //    holds us, and we must NOT stamp a manifest over a vault we can't fully read.
  let wrongPassword = false;
  let vaultExists = false;
  if (doPush) {
    try {
      const { ref } = await readManifest();
      vaultExists = !!ref;
      if (ref) {
        if (!needsPasswordSetup) wrongPassword = !(await verifyPassword(passphrase, ref.manifest));
      } else if (!needsPasswordSetup && !needsPassphrase) {
        const { ref: created, wonRace } = await createManifest(passphrase, getDeviceId());
        vaultExists = true;
        if (!wonRace) wrongPassword = !(await verifyPassword(passphrase, created.manifest));
      }
    } catch (e) {
      console.warn('[sync] manifest gate failed:', e);
      if (!needsPasswordSetup) wrongPassword = true;
    }
  }

  // FORK GUARD (plans/008 Phase 0): if the pull couldn't decrypt something on Drive, our
  // password disagrees with whatever wrote it. Pushing now creates a SECOND encrypted stream
  // under OUR password — the vault forks and both halves pile up unreadably. Hold the push
  // until the passwords reconcile. `needsPassphrase` is only set when doPull ran, so a
  // first-ever sync (which always pulls) can't slip past this.
  const pushBlocked = needsPassphrase || wrongPassword;
  let pushed = false;
  let pushedRows = 0;
  if (doPush && !needsPasswordSetup && !pushBlocked) {
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

  return {
    pulledLogs,
    appliedRows,
    skippedRows,
    auditedRows,
    failedLogs,
    pushed,
    pushedRows,
    needsPassphrase,
    passphraseLockedFiles,
    needsPasswordSetup,
    pushBlocked,
    wrongPassword,
    vaultExists,
  };
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
