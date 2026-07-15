# Plan 008 — Sync v2: one vault, one password, one file per device

**Status:** PROPOSED (written 2026-07-15, after the two-passwords fork was observed live)
**Depends on:** nothing — but Phase 0 should ship before anything else touches sync
**Effort:** P0 ~1 hour · P1 ~1 day · P2 ~1–2 days · P3 ~half day

---

## 1. The bug that was observed, precisely

Phone set password A and synced. Web set password B and *also* synced. Both reported
success. The vault is now forked: two parallel encrypted streams in the same
`appDataFolder`, neither device able to read the other's files, both accumulating files
forever.

Why the code allows it — `runSync` on both platforms:

- Pull runs first. Files it can't decrypt set `needsPassphrase = true` and are skipped
  (`src/services/sync/pullChanges.ts:114`, `web/src/services/sync/pullChanges.js:79`).
- **Push then runs anyway.** The only push gate is `needsPasswordSetup = !passphrase`
  (`src/services/sync/syncNow.ts` PUSH block, `web/src/services/sync/syncNow.js` same).
  A device holding the *wrong* password has a non-empty passphrase, so it sails through
  and uploads its own files encrypted under its own password.

There is **no shared definition of "the account's password" anywhere**. The password is a
per-device secret that each device merely *uses*; nothing on Drive says which password is
canonical. Two devices with different passwords is therefore not an error state the system
can even see — each side thinks the *other* side's files are "some encrypted data I'll ask
the user about," shrugs, and keeps writing.

Every other symptom follows from the same gap plus the delta-log design:

| Symptom | Cause |
|---|---|
| Multiple backup files piling up | Every push writes a NEW `comma-cl-*.cmlog`; compaction only fires at ≥30 deltas, only deletes files the compacting device itself applied, and separately per device |
| Sync files never deleted | Undecryptable files are never "applied," so compaction never touches them; nothing else deletes anything |
| Wrong password "works" | No verifier — wrong password is only detectable per-file via GCM tag failure, which is indistinguishable from "that file belongs to the other passworded stream" |
| "Requested backup not in cloud" is confusing | There's no marker distinguishing "fresh vault, no data yet" from "vault exists but the other device hasn't pushed" |

## 2. Design decision: adopt the simplified model

The 2026-07-12 sync audit (`sync-simplification-audit`) already concluded the delta-log
engine is over-built and proposed exactly what fits the stated usage — few devices,
sync-on-open / once-a-day / manual button, no realtime:

> per-device full-state files + one shared core

This plan adopts that, plus the missing piece that kills the password fork: a **vault
manifest** that makes the password an *account-level* fact instead of a device-level one.

### 2a. Drive layout after v2

```
appDataFolder/
  comma-vault.json                      ← manifest, PLAIN JSON (small, no user data)
  comma-state-{epoch}-{deviceId}.cmstate ← ONE encrypted full-state file per device
```

That's it. N devices ⇒ N+1 files, total, forever. No deltas, no snapshots, no compaction.

### 2b. The manifest (`comma-vault.json`)

```jsonc
{
  "v": 1,                    // manifest schema version; readers refuse v > known ("update the app")
  "vaultId": "…",            // random, minted at vault creation
  "epoch": 1,                // increments on every password change or cloud reset
  "createdAt": 1752566400000,
  "updatedAt": 1752566400000,
  "writerDeviceId": "dev_…",
  "verifier": "{…encryptBackup envelope of the fixed string \"comma-keycheck-v1\"…}"
}
```

- **verifier** reuses the existing byte-compatible `encryptBackup`/`decryptBackup`
  (PBKDF2-210k + AES-256-GCM) with a constant plaintext. Checking a password =
  `decryptBackup(verifier, pw) === "comma-keycheck-v1"`. No new crypto on either platform.
- **epoch** is embedded in every state filename. Any file whose epoch < manifest.epoch is
  dead by definition and **any device may delete it without decrypting it** — deletion
  needs no key. (This one fact dissolves the whole orphaned-file problem from the
  2026-07-14 diagnosis.)
- Security note: the verifier lets someone with Drive access brute-force offline — but so
  does the GCM tag on every data file already. No new exposure.

### 2c. The iron rule

> **No push, ever, unless the local password passes the manifest verifier.**

Enforced in the engine (`runSync`), not the UI — same defense-in-depth stance as the
existing `needsPasswordSetup` gate. A wrong password can no longer write a single byte.

### 2d. State files

- Push = build full state (reuse `collectChangedRows(0)` — cursor 0 already yields
  everything; compaction's snapshot builder does this today), encrypt, **update in place**
  on a stable Drive fileId (`files.update` — PATCH exists on web `drive-api.js:131`; add
  the same to phone `driveIO`). Update-in-place is atomic per file: a failed upload leaves
  the previous good version.
- Pull = list peers' current-epoch `.cmstate` files, decrypt, run the **existing** row-level
  LWW merge (`applyChangeLog` + `mergeRules` + financial audit — unchanged; that part of
  the engine is correct). Merging a full state is idempotent, so no applied-set cursor is
  needed. Optimization: remember each peer file's Drive `modifiedTime` and skip re-merging
  an unchanged file — makes the daily sync one metadata list + usually zero downloads.
- Tombstones ride along free: soft-deletes are rows in the full state.

### 2e. What gets DELETED from the codebase

The simplification pays for the migration:

- `compaction.ts` / `compaction.js` — no deltas to compact
- applied-set cursor (`sync_applied_logs`) — merge is idempotent
- quarantine counters (`sync_failed_logs`, `resetQuarantineOnUpgrade`) — a corrupt peer
  file is skipped with a warning and self-heals when its owner next pushes
- forgotten-logs (`sync_forgotten_logs`, added 2026-07-14) — orphans can't exist: wrong
  passwords can't write, and epoch bumps delete stale files
- `sinceCursor` semantics in the file format (state file keeps the ChangeLog row shape so
  `applyChangeLog` is untouched, with `sinceCursor: 0` always)

`lastPushedAt` survives only as a cheap "anything changed since last push?" check.

## 3. Every scenario, and what v2 does

| # | Scenario | Today | v2 |
|---|---|---|---|
| 1 | First device, empty Drive | Silent plain… now pw prompt, but nothing marks the account | Full-screen set-password → device creates manifest (epoch 1) → pushes its state file |
| 2 | Second device joins, correct pw | Works if files decrypt | Verifier passes instantly → pull peers → merge → push own file |
| 3 | Second device joins, **wrong pw** | **Forks the vault (the observed bug)** | Verifier fails → clear "wrong password" error, **zero writes**, re-prompt / Forgot link |
| 4 | Second device joins before first ever pushed | Confusing "no data found" or fork | Manifest present + no peer state files → crisp message: "Connected — your other device hasn't backed up yet. Press Sync Now there." Manifest absent → this IS the first device (scenario 1) |
| 5 | Password changed on device A | Impossible cleanly (was the toggle mess) | A: verify old → set new → bump epoch → rewrite manifest → delete old-epoch files (no key needed) → repush. B later: stored pw fails verifier → "Your backup password was changed on another device" → enter new one → B repushes under new epoch |
| 6 | **Forgot password, device HAS local data** | We built "wipe this device" — wrong remedy | **Cloud reset, local data kept**: delete every file in folder (no key needed), write fresh manifest with new password, push full local state. User loses only peers' un-pulled changes — never their own device's data |
| 7 | Forgot password, fresh device joining | Same wipe flow | Options screen: "get the password from your other device" (preferred) or "reset the cloud backup" (runs scenario 6 *from the old device* ideally; from the new device it starts the vault empty). Full-screen warning flow already built — rewire its action from device-wipe to cloud-reset |
| 8 | Two devices push at the same time | Two new delta files (ok) but shared-nothing cursors | They write *different files* (own deviceId) — no collision by construction. Merge on next pull |
| 9 | Two fresh devices create the vault simultaneously | n/a | Manifest race: after creating, re-list; if two manifests exist, oldest `createdAt` wins, loser deletes its own, re-verifies its password against the winner (fails → prompt). Rare; bounded; deterministic |
| 10 | Row edited on both devices between daily syncs ("collision") | Row-level LWW, ties keep local, financial overwrites audited | Unchanged — this part works. Plan docs just need to SAY it plainly so it's understood behavior, not a mystery |
| 11 | Corrupt/truncated peer file | Quarantine counters, 3 strikes | Skip + warn; owner's next push overwrites it. Self-healing, zero bookkeeping |
| 12 | Old app version meets a newer manifest | n/a | `manifest.v` guard, same pattern as `CHANGELOG_VERSION`: refuse with "update the app" |
| 13 | Legacy `.cmlog`/`.cmsnap` files from v1 | Accumulate forever | Migration (§4 Phase 2): own files deleted after first v2 push (own data is local — those files are redundant); readable peers' files absorbed once; anything older than 30 days post-v2, or from a dead epoch, deleted |
| 14 | Reset App (local wipe, cloud kept) | Re-mints deviceId; old logs orphan slowly | Old state file simply goes stale on Drive (harmless: all its LWW stamps lose eventually). Acceptable residue — it doubles as a last-resort backup. Optional later: "remove old devices" list in Settings |
| 15 | Restore-from-file then sync | Cursor rewind dance | Push is always full state — nothing special needed beyond the existing "sync paused after restore" choice |
| 16 | Demo mode | Hard-blocked in engine | Unchanged |
| 17 | Clock skew (device with wrong clock wins LWW) | Existing, unmitigated | Unchanged (accepted); optional hardening later: clamp stamps > now+24h on apply |
| 18 | Drive quota full / upload dies mid-push | New delta file might be partial | `files.update` on one fileId: old version survives; retry next sync |

## 4. Phased execution

### Phase 0 — STOP THE FORK ✅ DONE 2026-07-15

One rule: **if pull saw anything it couldn't decrypt, don't push.**

- [x] `src/services/sync/syncNow.ts`: PUSH gate is now
      `if (doPush && !needsPasswordSetup && !pushBlocked)`; `pushBlocked = needsPassphrase`;
      `pushBlocked: boolean` added to `SyncResult`
- [x] `web/src/services/sync/syncNow.js`: identical twin change (§1 parity contract)
- [x] UI copy — phone `backup.tsx`: enter-password prompt reworded to the "paused so your
      devices don't drift apart" framing; dismissing it now shows a "Backup paused" dialog
      instead of going silent. Web `backup-ui.js`: same prompt copy; the manual Sync-now
      handler shows a **warning** ("Backup paused — enter the password…") instead of a false
      green "Synced" toast when `pushBlocked`
- [ ] CHANGELOG entry — DEFERRED: all sync-v2 work is uncommitted and unreleased; the entry
      goes in when this batch's version is bumped, not under the already-shipped 1.4.1

Verified: `tsc` clean, web `node --check` clean, version + country parity pass. NOT yet
exercised on a real two-device run (that's the Phase 3 gate).

This converts the silent fork into a loud, recoverable pause. Existing forked test data
stays until Phase 1's reset. Note: the background push-only path
(`{ pull: false, push: true }`) intentionally isn't gated — it never pulls, so it can't
*create* a fork; only a device that already passed a pull-gated push ever reaches it, and
password rotation (the one thing that could invalidate that) doesn't exist until Phase 1's
manifest, which will gate it via the verifier.

### Phase 1 — Vault manifest ✅ DONE 2026-07-15

- [x] New twin modules `src/services/sync/vaultManifest.ts` +
      `web/src/services/sync/vaultManifest.js`: `readManifest()` (with two-manifest race
      resolution — oldest createdTime wins, returns duplicates), `createManifest(pw, deviceId)`
      (mints + re-reads to lose gracefully to a racer), `verifyPassword(pw, manifest)`,
      `rotateManifest(ref, newPw, deviceId)`. Manifest file = plain JSON, verifier =
      `encryptBackup("comma-keycheck-v1", pw)`, byte-identical across platforms.
- [x] Drive I/O: phone `driveIO.ts` gained `downloadDriveText`, `updateDriveFile` (PATCH),
      `createDriveFile` (returns id), and `createdTime`/`modifiedTime` on the list. Web's
      `drive-api.js` already had the equivalents.
- [x] `runSync` (both): MANIFEST GATE after pull, before push. Reads the manifest on every
      push-capable sync so `vaultExists` can be surfaced. vault + password → must pass verifier
      or `wrongPassword` (push held); no manifest + password + nothing-undecryptable → mint it;
      no manifest + undecryptable files → Phase-0 `pushBlocked` holds, no manifest stamped.
      New `SyncResult` flags: `wrongPassword`, `vaultExists` (plus Phase 0's `pushBlocked`).
- [x] Join flows: web `onboarding.js handleJoinSync` restructured — reads the manifest FIRST,
      then branches ENTER (verify in a loop) vs SET (full-screen); distinguishes "wrong pw",
      "no data yet", and "brand-new account" cleanly. Phone auto-kick: `doSyncNow` branches on
      `vaultExists` when `needsPasswordSetup`, so a manifest-but-no-data vault prompts ENTER,
      not SET (the old fork trap).
- [x] "Change password" row (both): biometric/confirm → sync under current pw (merges peer
      data into local so nothing is lost) → full-screen set new → `resetCloudVault(newPw)`.
      Uses cloud-reset rather than `rotateManifest` on purpose — in the delta-log era (pre
      Phase 2) files aren't epoch-tagged, so a bare epoch bump would orphan the old deltas;
      delete-all-then-repush-merged-state is the correct Phase-1 rotation. `rotateManifest`
      stays exported for Phase 2, when epoch-tagged state files make an in-place bump safe.
- [x] Forgot-password → **cloud-reset, local data kept** (both): `cloudReset.ts`/`.js`
      `resetCloudVault(newPw)` = delete every appDataFolder file (no key needed) →
      `clearSyncTrackingForCloudReset()` → `syncNow(newPw)` mints a fresh manifest + repushes
      local state. Full-screen `ForgotPasswordScreen`/`forgot-password.js` copy rewritten from
      "wipes this device" to "rebuilds the cloud backup, keeps this device's data"; flow chains
      forgot-warning → set-new-password → reset. Old `resetVault` afterWipe/title/message opts
      reverted (device-wipe path is now only the plain "Reset app").
- [x] Two-manifest race handled in `createManifest` (scenario 9).
- [x] Password minimums: SET stays at 8 (`MIN_BACKUP_PW`), ENTER stays permissive (6).
      Deliberately NOT unified to 8 on ENTER — existing pre-manifest always-encrypted users may
      hold 6–7 char passwords, and the manifest verifier is the authoritative check anyway, so
      forcing 8 on entry would lock valid users out.

Verified: phone `tsc` clean, all touched web files `node --check` clean, SyncResult flags and
manifest-module API in exact phone/web parity, country parity passes. NOT yet run on a real
two-device pair — that's the Phase 3 gate (scenarios 1–7).

Follow-ups deferred to Phase 2 (unchanged from below): per-device state files replacing the
delta engine, deleting compaction/applied-set/quarantine/forgotten-logs, and legacy migration.
The manifest gate currently does a second Drive `list` per sync (pull already listed) — fine at
daily cadence; Phase 2's Drive-I/O restructure folds them into one.

### Phase 2 — State files replace deltas

- [ ] `pushChanges` (both): `collectChangedRows(0)` → encrypt → `files.update` in place on
      `comma-state-{epoch}-{deviceId}.cmstate` (create on first push; remember fileId).
      Add PATCH/update support to phone `driveIO.ts` (web has it, `drive-api.js:131`)
- [ ] `pullChanges` (both): list current-epoch peer `.cmstate` → skip if `modifiedTime`
      unchanged since last merge (new tiny KV `sync_peer_mtimes`) → decrypt → existing
      `applyChangeLog`
- [ ] Delete: compaction modules, applied-set, quarantine, forgotten-logs (+ their KV keys
      in `postResetSyncState`) — both platforms, same commit
- [ ] Migration on first v2 sync: absorb readable legacy `.cmlog`/`.cmsnap` once → push own
      state file → delete OWN legacy files (identifiable by deviceId in filename, no key
      needed) → legacy files from other devices left for their owners; anything from a
      dead epoch or >30 days post-v2 swept by whoever sees it
- [ ] For the currently-forked test account: don't bother migrating — use the new cloud
      reset once from the phone, then join web with the (now single) password
- [ ] Update `app/docs/sync-design.md` with a NEW dated section (don't rewrite history,
      per AGENTS.md §4) + retire references to compaction

### Phase 3 — Trust made visible + closeout

- [ ] Sync status card (both): list devices from state-file metadata — "Phone · backed up
      2h ago / This browser · just now." This is what makes "is it actually working?"
      answerable without the user reading Drive internals
- [ ] `docs/` user-facing sync page: plain-language explanation of the model — one
      password per account, last-edit-wins per record, money overwrites are logged,
      forgot-password = cloud reset that keeps device data
- [ ] CHANGELOG entries; `npx tsc --noEmit`; `node scripts/version.mjs check`; country
      parity; the AGENTS.md twin-checklist for every touched pair
- [ ] Two-device end-to-end test (phone + web, fresh Google account): scenarios 1–7 from
      the matrix, minimum. This plan is NOT done until that run happens on a real device —
      sync has shipped "code complete but never run" twice before

## 5. Explicitly rejected alternatives

- **Per-device passwords with re-encryption fan-out** (device re-encrypts peers' files it
  can read): preserves more data in exotic cases, but it's the complexity that already
  bit — rejected in favor of one account password + verifier.
- **A separate "collision resolution UI"**: row-level LWW + the financial audit log is the
  resolution policy, and it already exists. Surfacing merge diffs to drivers is bloat.
- **Realtime/push sync**: user explicitly doesn't want it; daily + manual is the target.
