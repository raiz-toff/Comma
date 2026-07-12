# Plan 005: Port the mobile sync-safety guards to the web PWA (first-sync, demo mode, quarantine reset)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat fffd401..HEAD -- web/src/services/sync/syncNow.js web/src/services/sync/syncState.js web/src/services/sync/applyChangeLog.js src/services/sync/syncNow.ts`
> Written against commit `fffd401` **plus uncommitted working-tree changes**.
> On any excerpt mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (changes first-sync ordering on web; the mobile code being
  ported is battle-tested and heavily commented)
- **Depends on**: plans/001-fix-verification-baseline.md
- **Category**: bug
- **Planned at**: commit `fffd401` (+ uncommitted changes), 2026-07-12

## Why this matters

`web/src/services/sync/syncNow.js` says it "ports mobile's syncNow.ts verbatim
(logic-wise)" — but three safety guards present on mobile are MISSING on web:

1. **First-sync guard (data loss).** Mobile refuses to stamp/push the local
   profile before ever pulling (its comment calls this "issue #11": a fresh
   device stamps a blank profile with `Date.now()`, out-stamps every key of the
   real cloud profile via LWW, and the next push permanently destroys the
   user's backup). Web has NO such guard — it `exportLocalProfile()`s
   unconditionally before every pull. A browser that finishes local onboarding
   and then connects to a Drive that already has data will overwrite the real
   cloud profile. This is the exact failure mode mobile documents as
   catastrophic.
2. **Demo-mode backstop (cloud contamination).** Mobile hard-stops sync in
   demo mode inside the engine. On web, only the auto-triggers and the
   connect button are gated; the manual "Sync now" button
   (`web/src/modules/backup/backup-ui.js`, `case 'sync-now'`) calls `syncNow()`
   with no demo check — a demo-mode user with sync already enabled pushes
   seeded fake shifts into their real Drive folder.
3. **Quarantine reset on upgrade (permanent data invisibility).** Mobile
   re-tries quarantined change-logs when the apply logic's version changes
   (`resetQuarantineOnUpgrade`). Web has no version-keyed reset, so a log
   quarantined by a buggy web build stays invisible forever even after the bug
   is fixed — that device permanently loses those rows.

## Current state

**Web — the file being fixed**, `web/src/services/sync/syncNow.js` (whole
`runSync` relevant part):

```js
async function runSync(passphrase, opts) {
  if (!isSyncEnabled()) {
    throw new Error('Sync is not enabled. Unlock sync to use it.');
  }
  const doPull = opts.pull !== false;
  const doPush = opts.push !== false;

  // Mirror the users row → synced `profile` table BEFORE pulling, ...
  try {
    await exportLocalProfile();
  } catch (e) {
    console.warn('[sync] profile export skipped:', e);
  }
  ...
```

Its imports from `./syncState.js` (line 16-24): `isSyncEnabled, addAppliedLog,
setLastPushRunAt, setLastCloudSaveAt, recordLogFailure, clearLogFailure,
LOG_QUARANTINE_THRESHOLD`. After the pull loop it calls
`importSyncedProfile()`; there is NO post-import export and NO `neverSynced`
anywhere in the file.

**Mobile — the reference implementation**, `src/services/sync/syncNow.ts:63-101`:

```ts
async function runSync(passphrase: string, opts: SyncOptions): Promise<SyncResult> {
  // Hard stop in demo mode: the seeded sample data must never reach the user's real cloud copy. ...
  if (await isDemoModeActive()) {
    throw new Error("Cloud Sync is disabled while Demo Mode is active.");
  }
  if (!(await isSyncEnabled())) {
    throw new Error("Sync is not enabled. Unlock sync to use it.");
  }

  // The apply logic changed since the last run → give quarantined logs a fresh chance.
  await resetQuarantineOnUpgrade(APPLY_LOGIC_VERSION);

  // FIRST-SYNC GUARD (issue #11): a device that has never pulled or pushed must bootstrap
  // FROM the cloud, never over it. ...
  const neverSynced =
    (await getLastPushedAt()) === 0 && (await getAppliedLogs()).size === 0;

  // A first sync always pulls, even when triggered as push-only ...
  const doPull = opts.pull !== false || neverSynced;
  const doPush = opts.push !== false;

  if (!neverSynced) {
    try {
      await exportLocalProfile();
    } catch (e) { console.warn("[sync] profile export skipped:", e); }
  }
  ...
```

and `syncNow.ts:157-168` (post-import export, first sync only):

```ts
  // First sync only: NOW export the local profile — the cloud's values already won above, ...
  // Deferred to a later run if any log failed to apply OR any file was unreadable-because-
  // encrypted: ... stamping local values now would out-stamp them on the retry (issue #11).
  if (neverSynced && failedLogs === 0 && !needsPassphrase) {
    try {
      await exportLocalProfile();
    } catch (e) { console.warn("[sync] profile export skipped:", e); }
  }
```

Mobile's quarantine reset, `src/database/syncState.ts:276-282` (mobile keeps
sync state in the DB; web keeps it in localStorage via `syncState.js`):

```ts
export async function resetQuarantineOnUpgrade(applyVersion: string): Promise<void> {
  const stored = await readSyncKey(SYNC_KEYS.applyVersion);
  if (stored === applyVersion) return;
  await writeSyncKey(SYNC_KEYS.failedLogs, "{}");
  await writeSyncKey(SYNC_KEYS.applyVersion, applyVersion);
}
```

`APPLY_LOGIC_VERSION` lives at `src/services/sync/applyChangeLog.ts:42`
(`export const APPLY_LOGIC_VERSION = "2";`). The web
`web/src/services/sync/applyChangeLog.js` has no version constant.

**Web sync-state module**, `web/src/services/sync/syncState.js` — synchronous
localStorage-backed; already exports `getLastPushedAt()` (line 117) and
`getAppliedLogs()` (line 133, returns a Set), `resetLogFailures()` (line 232),
`getLogFailureCounts()` (line 193). It has NO apply-version key.

**Web demo flag**: `web/src/modules/backup/backup-triggers.js:71` reads it as
`store.get('demoMode')`, with `import { store } from '../../core/store.js';`
(line 32). From `web/src/services/sync/syncNow.js` the relative path is
`../../core/store.js`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Web build | `cd web && npm run build` | exit 0, "build complete (prod)" |
| Grep gates | see per-step verifies | as stated |

(The web sync modules import Dexie and the DOM event bus, so they aren't
covered by the Node unit suite — verification is build + structural greps +
the review checklist in "Test plan".)

## Scope

**In scope**:
- `web/src/services/sync/syncNow.js`
- `web/src/services/sync/syncState.js` (add version-keyed quarantine reset)
- `web/src/services/sync/applyChangeLog.js` (add the exported
  `APPLY_LOGIC_VERSION` constant only)

**Out of scope** (do NOT touch):
- Mobile files (`src/services/sync/*`) — they are the reference, not the target.
- `web/src/modules/backup/backup-ui.js` / `backup-triggers.js` — the engine
  backstop makes UI-level gating redundant; leave UI code alone. (The engine
  throw's message will surface through the existing `sync:failed` toast path.)
- `profileBridge.js`, `pullChanges.js`, `pushChanges.js`, `compaction.js`.
- Any change to the change-log file format or merge logic.

## Git workflow

- Branch from the current working state; conventional commit, e.g.
  `fix(web-sync): port first-sync guard, demo-mode backstop, quarantine reset from mobile`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add `APPLY_LOGIC_VERSION` to web applyChangeLog and a version-keyed reset to syncState

- In `web/src/services/sync/applyChangeLog.js`, export
  `export const APPLY_LOGIC_VERSION = '2';` near the top (mirror the mobile
  constant and its meaning: bump it whenever apply/merge logic changes so
  quarantined logs get retried).
- In `web/src/services/sync/syncState.js`, add (following the module's existing
  localStorage key conventions — read how `resetLogFailures` and the failure
  counts are stored first):

  ```js
  export function resetQuarantineOnUpgrade(applyVersion) {
    // key naming: match the module's existing prefix convention for sync keys
    const stored = localStorage.getItem(<applyVersion key>);
    if (stored === applyVersion) return;
    resetLogFailures();
    localStorage.setItem(<applyVersion key>, applyVersion);
  }
  ```

  Use the same key prefix the other sync keys in this file use (inspect lines
  around `getLastPushedAt`/`recordLogFailure` for the prefix).

**Verify**: `cd web && npm run build` → exit 0.

### Step 2: Port the guards into `runSync`

Edit `web/src/services/sync/syncNow.js`, mirroring mobile exactly (adapted to
web's synchronous syncState — no `await` on those calls):

1. Import `store` from `../../core/store.js`, `resetQuarantineOnUpgrade`,
   `getLastPushedAt`, `getAppliedLogs` from `./syncState.js`, and
   `APPLY_LOGIC_VERSION` from `./applyChangeLog.js`.
2. At the very top of `runSync`, BEFORE the `isSyncEnabled` check, add the
   demo backstop with mobile's comment and message:
   `if (store.get('demoMode')) throw new Error('Cloud Sync is disabled while Demo Mode is active.');`
3. After the `isSyncEnabled` check: `resetQuarantineOnUpgrade(APPLY_LOGIC_VERSION);`
4. Compute `const neverSynced = getLastPushedAt() === 0 && getAppliedLogs().size === 0;`
   then `const doPull = opts.pull !== false || neverSynced;` (replacing the
   current doPull line). Keep `doPush` as is.
5. Wrap the existing pre-pull `exportLocalProfile()` block in
   `if (!neverSynced) { ... }`.
6. After the `importSyncedProfile()` block (still inside `if (doPull)` — match
   mobile, which runs its post-import export AFTER the pull section; place it
   immediately after the pull block closes, before the PUSH section), add the
   first-sync-only export, gated exactly like mobile:
   ```js
   if (neverSynced && failedLogs === 0 && !needsPassphrase) {
     try { await exportLocalProfile(); }
     catch (e) { console.warn('[sync] profile export skipped:', e); }
   }
   ```
   Note: `needsPassphrase` is already a local in `runSync` (set from
   `pulled.needsPassphrase`).
7. Copy mobile's explanatory comments for each guard (the FIRST-SYNC GUARD
   comment block especially) — they are load-bearing documentation.

**Verify**: `cd web && npm run build` → exit 0. Then all four greps return a match:
`grep -n "demoMode" web/src/services/sync/syncNow.js`;
`grep -n "resetQuarantineOnUpgrade(APPLY_LOGIC_VERSION)" web/src/services/sync/syncNow.js`;
`grep -n "neverSynced" web/src/services/sync/syncNow.js` (≥ 4 hits);
`grep -n "APPLY_LOGIC_VERSION" web/src/services/sync/applyChangeLog.js`.

### Step 3: Line-by-line parity review

Diff your edited `runSync` against mobile `src/services/sync/syncNow.ts:63-193`
guard-by-guard (demo → enabled → quarantine reset → neverSynced → conditional
pre-pull export → pull loop → post-import first-sync export → push). Confirm
ordering matches and that you changed NOTHING else in the file (the pull loop,
push, compaction, queue, and event emissions are untouched).

**Verify**: `git diff --stat web/src/services/sync/syncNow.js` shows only this
file's expected line count changed (~+30/-5); `cd web && npm run build` → exit 0.

## Test plan

The web sync modules aren't Node-testable (Dexie/DOM deps) and no browser test
harness exists — verification is structural (greps above) plus this manual
checklist to run in the browser (`cd web && npm run preview`), which your
report should note as done or explicitly not done:

- Demo mode ON + manual "Sync now" → sync fails with the demo-mode message
  (surfaced via the existing failed-sync toast), and NO file appears in Drive.
- Fresh browser profile (no sync state) + connect to a Drive with existing
  data → after first sync, local profile shows the CLOUD's values (not blanks).

## Done criteria

ALL must hold:

- [ ] All four Step 2 verify-greps match
- [ ] Pre-pull `exportLocalProfile` is inside `if (!neverSynced)`
- [ ] Post-import export exists and is gated on `neverSynced && failedLogs === 0 && !needsPassphrase`
- [ ] `cd web && npm run build` exits 0
- [ ] Only the three in-scope files modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `runSync` in `syncNow.js` doesn't match the "Current state" excerpt.
- `getLastPushedAt()` or `getAppliedLogs()` on web have different semantics
  than assumed (e.g. `getLastPushedAt` doesn't default to 0, or
  `getAppliedLogs` doesn't return a Set) — check their bodies in
  `syncState.js:117-151` first.
- You find `store.get('demoMode')` unavailable/circular from `syncNow.js`
  after one import attempt.
- The task seems to require touching pull/push/apply logic beyond the guards.

## Maintenance notes

- These guards are ports; if mobile's `syncNow.ts` guard logic changes, web
  must change in lockstep (this duplication is the known #1 architecture
  hazard — see DEBT-01 in `plans/README.md`; the decided sync-engine rewrite
  in `app/docs/sync-simplification-2026-07-12.md` will eventually collapse the
  two files into one shared core, which supersedes this parity burden).
- Reviewer should scrutinize the placement of the post-import export relative
  to the `if (doPull)` block — mobile runs it after the pull section
  unconditionally-of-doPull but gated on `neverSynced` (and `neverSynced`
  forces `doPull` true, so the distinction is moot; keep it simple and match
  mobile's position).
- `APPLY_LOGIC_VERSION` on web starts at `'2'` to match mobile — from now on
  bump BOTH when apply logic changes on either side.
