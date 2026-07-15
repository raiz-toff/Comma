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
  getDeviceId,
  addAppliedLog,
  getAppliedLogs,
  getLastPushedAt,
  setLastPushRunAt,
  setLastCloudSaveAt,
  recordLogFailure,
  clearLogFailure,
  resetQuarantineOnUpgrade,
  LOG_QUARANTINE_THRESHOLD,
} from "../../database/syncState";
import { readManifest, verifyPassword, createManifest } from "./vaultManifest";
import { pullChanges } from "./pullChanges";
import { pushChanges } from "./pushChanges";
import { applyChangeLog, APPLY_LOGIC_VERSION } from "./applyChangeLog";
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
  /** true when the pull imported synced profile keys into the local KV (name, country,
   *  onboarding flag…) — callers should re-hydrate the settings store so the UI (incl.
   *  the onboarding gate) reflects the restored identity. */
  profileImported: boolean;
  /**
   * true when at least one file on Drive is encrypted and this device couldn't open it (no
   * password stored, or the wrong one). The sync itself still succeeded for everything
   * else — the UI should prompt for the backup password and re-run to get the rest.
   */
  needsPassphrase: boolean;
  /** Filenames behind needsPassphrase — what "Forgot password?" would abandon. */
  passphraseLockedFiles: string[];
  /**
   * true when this is a brand-new account's very first push and no password has been set
   * yet on this device. The push is SKIPPED rather than writing an unencrypted file — sync
   * has no plain mode, so the caller must collect a password before anything reaches Drive.
   */
  needsPasswordSetup: boolean;
  /**
   * true when the push was SKIPPED because the pull hit files this device can't decrypt
   * (`needsPassphrase`), OR the manifest verifier rejected our password (`wrongPassword`).
   * Pushing anyway would fork the vault — this device would write its own stream under its
   * own password alongside the one it can't read, and the two would accumulate forever with
   * neither able to open the other (see plans/008 §1). So: if we couldn't read everything on
   * Drive, we don't write. The caller should surface the "enter the password to continue —
   * backup is paused" prompt.
   */
  pushBlocked: boolean;
  /**
   * true when a vault manifest exists on Drive and this device's password did NOT decrypt its
   * verifier — the authoritative "that's the wrong password" signal (plans/008 §2b). Distinct
   * from `needsPasswordSetup` (no password at all) and from a bare `needsPassphrase` on a
   * pre-manifest legacy vault. The UI should say the password is wrong and offer the reset.
   */
  wrongPassword: boolean;
  /**
   * true when a vault manifest exists on this Google account. Lets the UI tell apart the two
   * cases that both surface as `needsPasswordSetup` (this device has no password yet): a vault
   * already exists → ask the user to ENTER its password; no vault → ask them to SET a new one.
   * Getting that fork wrong is exactly how a second device used to start a competing stream.
   */
  vaultExists: boolean;
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

  // The apply logic changed since the last run → give quarantined logs a fresh chance.
  await resetQuarantineOnUpgrade(APPLY_LOGIC_VERSION);

  // FIRST-SYNC GUARD (issue #11): a device that has never pulled or pushed must bootstrap
  // FROM the cloud, never over it. Without this, a fresh install that just finished (or
  // re-entered) onboarding stamps its blank profile with Date.now() below, out-stamps every
  // key of the real cloud profile via LWW, and the next push permanently destroys the
  // user's backup (compaction then bakes it into a snapshot).
  const neverSynced =
    (await getLastPushedAt()) === 0 && (await getAppliedLogs()).size === 0;

  // A first sync always pulls, even when triggered as push-only (e.g. a scheduled
  // background push) — pushing before ever pulling is exactly the overwrite hazard.
  const doPull = opts.pull !== false || neverSynced;
  const doPush = opts.push !== false;

  // Mirror local profile → synced `profile` table BEFORE pulling, so fresh local edits carry
  // stamps and win/lose per-key LWW honestly instead of being clobbered by an older pull.
  // Skipped on a first sync: there the cloud copy is authoritative and the local profile is
  // exported AFTER the import instead, so only keys the cloud doesn't have get pushed.
  if (!neverSynced) {
    try {
      await exportLocalProfile();
    } catch (e) {
      console.warn("[sync] profile export skipped:", e);
    }
  }

  let pulledLogs = 0;
  let appliedRows = 0;
  let skippedRows = 0;
  let auditedRows = 0;
  let failedLogs = 0;
  let profileImported = false;
  let needsPassphrase = false;
  let passphraseLockedFiles: string[] = [];

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
      await recordLogFailure(filename);
    }

    for (const { log, filename } of pulled.logs) {
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
      profileImported = await importSyncedProfile();
    } catch (e) {
      console.warn("[sync] profile import skipped:", e);
    }
  }

  // First sync only: NOW export the local profile — the cloud's values already won above,
  // so this stamps (and later pushes) only genuinely local-only keys. Deferred to a later
  // run if any log failed to apply OR any file was unreadable-because-encrypted: the cloud's
  // profile rows haven't landed yet, and stamping local values now would out-stamp them on
  // the retry — destroying the real profile via LWW (issue #11).
  if (neverSynced && failedLogs === 0 && !needsPassphrase) {
    try {
      await exportLocalProfile();
    } catch (e) {
      console.warn("[sync] profile export skipped:", e);
    }
  }

  // ── PUSH ──
  // Sync has no plain mode: never push without a password, full stop — this is the engine's
  // own backstop, not just a UI gate, so a stray background/foreground call can't slip an
  // unencrypted file onto Drive because the UI happened not to collect a password first.
  const needsPasswordSetup = !passphrase;

  // ── MANIFEST GATE (plans/008 Phase 1) ──
  // The manifest is the account's single source of truth for the password. We read it on
  // every push-capable sync (even one with no password yet) so `vaultExists` can tell the UI
  // whether to ask the user to ENTER an existing password vs SET a brand-new one — the two
  // are otherwise indistinguishable and getting it wrong forks the vault. Then, before writing:
  //  • vault exists + we have a password → it MUST decrypt the verifier, or we don't push
  //    (wrongPassword). Authoritative "wrong password" signal — sharper than Phase 0's per-file
  //    needsPassphrase, and it fires even on a push-only sync that never pulled (so a password
  //    rotated on another device is caught here too).
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
        const { ref: created, wonRace } = await createManifest(passphrase, await getDeviceId());
        vaultExists = true;
        if (!wonRace) wrongPassword = !(await verifyPassword(passphrase, created.manifest));
      }
    } catch (e) {
      // A manifest we can't read/verify (corrupt, or a newer schema) must not let a push
      // through blind — treat it as "can't confirm the password" and hold.
      console.warn("[sync] manifest gate failed:", e);
      if (!needsPasswordSetup) wrongPassword = true;
    }
  }

  // FORK GUARD (plans/008 Phase 0): if the pull couldn't decrypt something on Drive, our
  // password disagrees with whatever wrote it. Pushing now creates a SECOND encrypted stream
  // under OUR password — the vault forks and both halves pile up unreadably. So we hold the
  // push until the passwords reconcile. `needsPassphrase` is only ever set when doPull ran,
  // so a first-ever sync (which always pulls, see doPull above) can't slip past this.
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

  return {
    pulledLogs,
    appliedRows,
    skippedRows,
    auditedRows,
    failedLogs,
    pushed,
    pushedRows,
    profileImported,
    needsPassphrase,
    passphraseLockedFiles,
    needsPasswordSetup,
    pushBlocked,
    wrongPassword,
    vaultExists,
  };
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
