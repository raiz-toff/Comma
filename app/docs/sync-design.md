# Comma — Cloud Sync Design (Premium Feature)

> Status: **design / not yet built**. Decisions locked 2026-06-29:
> 1. Full **record-level sync** (not just auto-backup) — two devices stay live simultaneously.
> 2. Syncs to **each user's own Google Drive `appDataFolder`** — we host nothing, run no server.
> 3. Monetized as a **paid unlock** (free tier keeps today's manual backup; paid tier gets sync).

---

## 0. Mental model: backup vs. sync

What exists today (`src/services/googleDrive.ts`) is a **backup**: whole-DB JSON snapshot, encrypted, one `.comdb` file, restore = wipe + bulk-insert. It is destructive and one-directional. Last restore wins; anything the other device did is lost.

**Sync** is continuous, automatic, non-destructive, multi-directional. Both phones stay consistent without ever wiping each other. The user never presses a button.

The key insight that makes this buildable with no server:

> **Google Drive is not the sync engine. It is dumb encrypted storage. ALL sync logic — delta tracking, merge, conflict resolution — runs on-device.**

This is exactly how Obsidian Sync / Notesnook-style local-first apps work.

---

## 1. Architecture overview

```
  Phone A                          Google Drive                     Phone B
  ┌──────────────┐                 (appDataFolder)                  ┌──────────────┐
  │ local SQLite │                 ┌────────────────┐               │ local SQLite │
  │  + updatedAt │ ──push delta──▶ │ changelog files│ ◀──push delta─│  + updatedAt │
  │  + deletedAt │ ◀──pull delta── │  (encrypted)   │ ──pull delta─▶│  + deletedAt │
  │  + merge LWW │                 │ manifest.json  │               │  + merge LWW │
  └──────────────┘                 └────────────────┘               └──────────────┘
```

- Each device pushes only the rows it changed since its last sync, as an **encrypted append-only change-log file**.
- Each device pulls change-log files it hasn't applied yet, and merges them.
- Merge is **Last-Write-Wins (LWW)** by `updatedAt`. No server arbitration needed.
- Periodic **compaction** collapses many small logs into one snapshot so Drive doesn't grow forever.

---

## 1a. Three data buckets (DECIDED 2026-06-30)

Not everything syncs the same way. Three buckets, three rules:

| Bucket | Examples | Sync rule |
|---|---|---|
| **Records** | shifts, expenses, vehicles, goals, maintenanceLogs, taxHistory, platforms, shiftPlatforms, merchants, vehicleTaxProfiles | Full record-level sync (this doc's main engine): `syncUpdatedAt`/`syncDeletedAt`, LWW merge, tombstones. |
| **Profile / preferences** | name, country/region, currency, distance unit, active platforms | Travels with the **user**. Lightweight, per-setting newest-wins. Handled **separately** — NOT pushed through the record-merge engine. Small bag, not thousands of rows. |
| **Device-local** | `sync_enabled`, sync cursors, active-shift-in-progress scratch, **cached RevenueCat entitlement**, GPS scratch (`tempNativePoints`, `locationPoints`) | **Never synced.** Describes one device's state; syncing it causes bugs. (The entitlement's source of truth is RevenueCat/the store, not our DB — we only cache it locally.) |

The current `settings` KV table mixes **profile/preferences** and **device-local** keys. P1 leaves `settings` out of record-sync entirely; a later phase splits its keys into the profile bucket vs. the device-local bucket and gives the profile bucket its own lightweight sync.

---

## 2. Schema changes (the foundation — do this first)

Every **synced record** table gets two columns. The record set is the **10 tables** in `BACKUP_TABLES` **minus `settings`** (settings is the profile/device-local KV — §1a — handled separately, NOT record-synced). We also do NOT sync `locationPoints` / `tempNativePoints` (bulky GPS scratch, already excluded from backup). So: vehicles, platforms, merchants, goals, taxHistory, shifts, maintenanceLogs, expenses, shiftPlatforms, vehicleTaxProfiles.

```ts
syncUpdatedAt: integer('sync_updated_at', { mode: 'number' }).notNull().default(0),
// epoch ms of the last LOCAL mutation to this row. The LWW clock.

syncDeletedAt: integer('sync_deleted_at', { mode: 'number' }),
// epoch ms when soft-deleted, else null. Tombstone so deletions propagate.
```

Plus device identity + cursors, stored in `settings` KV (no new table needed):

| key | value |
|---|---|
| `sync_device_id` | random uuid, generated once per install (re-minted on Reset — see §4a) |
| `sync_applied_logs` | **JSON array (a set) of changelog filenames already applied.** NOT a scalar timestamp — see the box below. |
| `sync_last_pushed_at` | epoch ms — the high-water mark of my OWN local changes already pushed, used to build the next push delta |
| `sync_enabled` | `'1'` only when the premium entitlement is active |

> ### ⚠️ The cursor MUST be an applied-set, not a scalar watermark
> An earlier draft used a single `sync_last_pulled_at` epoch-ms watermark. **That is a data-loss bug** and was corrected here.
>
> Two writers stamp filenames with their own clocks and upload out of order. Failure case: Phone A pushes a log stamped `100`; you pull it and advance the watermark to `100`. Phone B (clock slightly behind, or just slow to upload) then lands a log stamped `90`. Your next pull skips it **forever** because `90 < 100`. The same scalar also strands logs on partial failure: apply logs 1–29, choke on 30, and a watermark that moved past 30 never retries it.
>
> **Fix:** track the *set of applied changelog filenames* (`sync_applied_logs`), not a scalar. Pull logic becomes: "list all `.cmlog` files, apply those **not in my applied-set AND not authored by me**, add each to the set as it's applied." This is order-independent, commutative, and self-heals after partial failure (a stranded log simply isn't in the set yet, so the next pull picks it up). Filenames already carry `deviceId`+timestamp, so the set stays meaningful. (Compaction, §6, prunes both the Drive logs and this set together.)

### Consequence: every write path must touch `syncUpdatedAt`

This is the invasive part. Every `insert`/`update` must set `syncUpdatedAt = Date.now()`, and every **delete becomes a soft-delete** (`syncDeletedAt = Date.now()`, `syncUpdatedAt = Date.now()`), never a hard `DELETE`. Every read query must add `WHERE syncDeletedAt IS NULL`.

To keep this from leaking everywhere, centralize it: a thin `syncedInsert / syncedUpdate / syncedDelete` wrapper in `src/database/syncedWrites.ts` that stamps the columns, and a shared `notDeleted()` filter helper. Migrate existing queries to use them. **This refactor is the real cost of sync — budget for it.**

> IDs: we already use text PKs (good). To guarantee phone A and phone B never mint the same id offline, generate row ids as `${sync_device_id}:${uuid}` or just keep uuidv4 (collision risk negligible). Either is fine; document the choice.

---

## 3. The change-log file format (what lives on Drive)

One file per push, encrypted with the **existing `encryptBackup` helper** (password-derived key — already cross-device, already in place):

```
filename:  comma-cl-{deviceId}-{epochMs}.cmlog
content:   encryptBackup(JSON.stringify(ChangeLog), passphrase)
```

```ts
interface ChangeLog {
  v: 1;
  deviceId: string;
  createdAt: number;            // epoch ms
  sinceCursor: number;          // the from-cursor this delta covers
  rows: Record<string, Row[]>;  // tableName -> changed rows (incl. soft-deleted)
}
```

A tiny `manifest.json` (also in `appDataFolder`, encrypted) lists known logs + the latest compaction snapshot id, so a device can discover what to pull with one read. (Optional v1 simplification: skip the manifest, just `listBackups()`-style list all `.cmlog` files by name — the filename carries deviceId + timestamp, which is enough to decide what's new.)

---

## 4. The sync algorithm (runs on-device, automatically)

```
sync():
  if not sync_enabled: return            # premium gate
  if a sync is already in flight: return # single-flight, like refreshGoogleToken
  acquire a Drive lock-file (best-effort, see §6)

  # ── PULL ── (applied-SET, not a scalar watermark — see §2 box)
  allLogs  = list ALL .cmlog files in appDataFolder
  appliedSet = JSON.parse(settings['sync_applied_logs'] ?? '[]')
  toApply  = allLogs where filename NOT in appliedSet AND deviceId(filename) != my sync_device_id
  for each log in toApply (oldest → newest by filename timestamp):
     changeLog = decrypt(download(log), passphrase)
     apply changeLog inside ONE local transaction:
        for each (table, rows) in changeLog:
           for each row:
              local = SELECT by pk
              if local is null OR row.syncUpdatedAt > local.syncUpdatedAt:
                 UPSERT row         # LWW: newer wins, tombstones included
              # else: my local copy is newer, ignore incoming
     # record per-log, AFTER its transaction commits, so a crash mid-batch
     # strands nothing — an un-recorded log is simply retried next pull.
     appliedSet.add(log.filename); persist settings['sync_applied_logs']

  # ── PUSH ──
  myChanges = SELECT * FROM each synced table WHERE syncUpdatedAt > sync_last_pushed_at
  if myChanges not empty:
     upload new .cmlog file (encrypted)
     sync_last_pushed_at = max(syncUpdatedAt of pushed rows)
     # also add my own new filename to appliedSet so I never re-pull my own log

  release lock-file
```

Note the per-log commit-then-record: there is no scalar "pulled up to" timestamp anywhere. Correctness comes from the set membership test, not from time ordering.

**Triggers — DECIDED 2026-06-30: check-on-open + scheduled push, NOT always-on background sync.**
The user explicitly does not want continuous mid-day syncing. Model is WhatsApp-style:
- **PULL on app open:** when the app becomes active, peek at the cloud — "anything newer than my cursor?" If yes, pull + merge. If no, do nothing. Cheap and quiet.
- **PUSH on a user-chosen schedule:** a settings control (WhatsApp-style) picks upload frequency — `Off / Daily / Weekly / Wi-Fi-only` (exact options TBD). Push runs on that cadence, not after every write.
- **Manual "Sync now" button** (always available) for an immediate push+pull.
- No `setInterval` background loop, no debounced-after-every-write push.

**DECIDED 2026-06-30: push on app background/close, schedule as floor.**
Pull-on-open + push-only-on-schedule would let the user's own two devices drift for up to a week. Final trigger model:
- **Pull on app open/foreground.**
- **Push on app background/close** — a session boundary (same category as pull-on-open), NOT a mid-day `setInterval` loop, so it respects the "no always-on" intent while closing the multi-device gap to ~one session.
- **User's Daily/Weekly/Wi-Fi-only schedule as a floor** (guarantees a push even if the app is rarely closed cleanly).
- **Manual "Sync now"** for an immediate push+pull.
No background interval loop; no debounced-after-every-write push.

The merge engine (LWW, tombstones, no-wipe) is identical — only the *triggers* differ from a continuous model. All wrapped in the same single-flight + `fetchWithTimeout` patterns already in `googleDrive.ts`.

**P4 implementation reconciliation (2026-06-30):** the design above lists "push on every background" (responsiveness) alongside the user's WhatsApp-style "how often to back up" (frequency control). Those mildly conflict. **Resolved in favor of the user's explicit request:** the user-chosen **schedule is the auto-push cadence** (`manual` / `daily` / `weekly`), evaluated at session boundaries — push fires on foreground OR background only when `now - lastPushRunAt >= scheduleInterval` (`manual` = never auto-push). **Pull still happens on every foreground** regardless of schedule (the cheap "check on open"). **Manual "Sync now"** ignores the schedule. This keeps "no mid-day sync", honors the frequency control, and still closes the multi-device gap at the user's chosen cadence. (Wi-Fi-only deferred — needs a netinfo dependency not currently installed.) Auto-triggers are serialized through a queue (replacing the bare single-flight) so a manual full-sync can't be swallowed by an in-flight pull-only.

---

## 4a. Reset App semantics under sync (DECIDED 2026-06-30)

**Rule: Reset wipes THIS DEVICE only. It can never touch the cloud.** The cloud copy is the safe master; the Reset button has no power to delete it. One tap can never wipe everything.

Chosen behavior: **Reset = stop syncing + go blank (a true clean slate that sticks).**

```
resetApp():
  sync_enabled = '0'           # turn sync OFF first, BEFORE wiping — critical ordering
  cancel any in-flight/queued sync
  hard-wipe all local tables   # local only; never push tombstones, never delete .cmlog files
  clear sync_applied_logs = [] # forget which logs I've seen
  sync_last_pushed_at = 0
  sync_device_id = NEW uuid    # ← RE-MINT. This is what makes re-enable recover data. See box.
  # phone now genuinely empty and STAYS empty — sync_enabled is off, nothing refills it
  # cloud .cmlog history is untouched and waiting
  # paid status is NOT cleared — it lives in RevenueCat/the store account, not app data; user stays paid
```

Why this and not "refill from cloud": the user asked for a real start-over that doesn't secretly undo itself. If sync stayed on, the next sync would see "cloud has data, I have none" and pull everything back within seconds — surprising. So Reset deliberately flips `sync_enabled` off.

> ### ⚠️ Reset MUST re-mint `sync_device_id` — otherwise the common case silently fails to recover
> The pull step skips logs "authored by me." Consider the most common user: **one device**, 100 shifts, all in their own `.cmlog` file(s). They Reset, then re-enable sync.
> - If `sync_device_id` is **preserved**, their old logs are still "mine" → pull skips them → **the phone stays empty even though the data is sitting right there on Drive.** ❌
> - If `sync_device_id` is **re-minted**, the old logs are now authored by a *different* id → "not mine" → pulled → **data restored.** ✅
>
> So Reset re-mints the device id. Clearing `sync_applied_logs` (a local cursor, wiped with everything else) is required too, or the re-minted device would still skip logs it thinks it already applied. Both together = re-enable does a clean full pull of all cloud history. (Alternative considered: make "re-enable after reset" a special bootstrap that pulls ALL logs regardless of author. Re-minting is simpler and needs no special path — chosen.)

To get data back after a reset, the user **re-enables sync** (or restores a backup) as a deliberate action — at which point the full cloud history pulls down. Re-enabling on an empty (re-minted) device = pull-everything adoption.

Critical implementation notes:
- **Order matters:** set `sync_enabled = '0'` and cancel any in-flight/debounced sync BEFORE the wipe, so no half-wiped state gets pushed as tombstones.
- Reset must **NOT** push soft-delete tombstones for the wiped rows — that would wipe every other device too. Reset is a *local hard wipe*, distinct from a user deleting one item (which IS a synced soft-delete).
- Paid status survives reset for free — it lives in RevenueCat / the store account, not in app data, so a local wipe can't touch it. A paying user who resets is still paid; they just re-enable sync. (On a fresh device, a RevenueCat "restore purchases" re-establishes it.)

---

## 5. Conflict resolution

With **LWW**, the row with the larger `syncUpdatedAt` wins, field-for-field at the row level. Simple, predictable, no server needed. Known trade-off: if two devices edit *different fields of the same row* offline, the older edit's fields are lost (whole-row replace). For Comma's data (a shift, an expense — usually edited on one device at a time) this is acceptable. **Document it for users:** "edits made offline on two devices to the same item: the most recent edit wins."

Clock skew caveat: LWW trusts device clocks. Phones are NTP-synced in practice, so this is fine; note it as a known limitation rather than engineering a vector-clock (overkill for a no-server consumer app).

### Financial tables get more care than a shift note (DECIDED 2026-06-30)

Silent LWW loss is fine for a shift's `notes` field. It is **not** fine for money: a silently overwritten `amount` in `expenses` or a clobbered row in `taxHistory` is *wrong tax data with no audit trail*. Same mechanism, very different blast radius.

For the financial tables (`expenses`, `taxHistory`, and the revenue fields on `shifts`/`shiftPlatforms`):
- **Never silently drop a losing financial edit.** When a merge overwrites a financial row whose pre-merge `syncUpdatedAt` was non-zero (i.e. it had real local edits), record the superseded version. Cheapest implementation: an append-only `sync_overwrite_log` (local, or a synced table) capturing `{table, pk, supersededRow, winnerRow, mergedAt}`.
- This gives an **audit trail** so a wrong number is recoverable, and lets a future UI surface "this expense was changed on another device" instead of the change vanishing.
- `taxHistory` is *already* an append-only audit table by design — for it, prefer "insert both rows / keep the conflicting entry" over overwrite, since losing a tax-rate-change record is the worst case here.

This is a P3 concern (it lives in the merge engine), noted now so the merge step is built with it from the start rather than retrofitted.

---

## 6. The hard parts (be honest about these)

1. **No atomic multi-file ops on Drive.** A push = upload one file = atomic enough. Compaction (rewrite many → one, then delete old) is the risky bit — do it lazily, tolerate leftover logs, never delete a log until its data is provably in a snapshot.
2. **Concurrent push race.** Two devices pushing at once is fine (different filenames, both get pulled later). A best-effort `sync.lock` file avoids most overlap; full correctness doesn't require it because LWW is commutative.
3. **First sync on a fresh install** with existing local data: treat all local rows as "changed since 0" and push them, then pull. Or, on a brand-new device, pull-only then adopt.
4. **Schema migrations across devices.** A `ChangeLog.v` + `BACKUP_SCHEMA_VERSION` guard: a newer device must not corrupt an older one. Refuse to apply logs from a higher schema version than the local app understands; prompt to update.
5. **The write-path refactor (§2)** is the single biggest chunk of work and touches every existing query file.
6. **The backup passphrase is now load-bearing — and there's no key rotation.** With manual backup it protected occasional snapshots; with sync it protects *continuous, ongoing data*. Consequences to name: (a) **lose the passphrase = the entire cloud dataset is permanently unrecoverable** (it's the sole input to the AES key, by design — §10). (b) **No rotation:** changing the passphrase can't retroactively re-encrypt old `.cmlog` files on Drive without downloading, decrypting, re-encrypting, and re-uploading the whole history. For v1, treat the passphrase as fixed-at-setup; if rotation is ever needed it's a full re-encrypt pass during a compaction. Surface (a) loudly in the UI at setup ("if you forget this, your synced data cannot be recovered").

---

## 7. Gating

> ### 🟢 SUPERSEDED 2026-06-30 — NO PAYWALL. The app is open source; Cloud Sync is FREE for everyone.
> All monetization was dropped at the user's request. **The entire RevenueCat / entitlement layer was deleted** (`src/services/entitlement.ts`, `src/config/revenuecat.ts`, and the `refreshSyncEntitlement` call in `useAutoSync`). There is no payment, no entitlement, no Apple/Stripe consideration.
>
> `sync_enabled` is now simply **"the user turned Cloud Sync on"** — auto-set when Drive is connected + a sync password is set ("connect then done"), cleared on disconnect. The whole rest of §7 and the monetization parts of §8 below are **historical only** and no longer reflect the build.

Two independent axes — don't conflate them:
- **Storage** of synced data = the **user's own Google Drive.** We host nothing here. (Unchanged.)
- **Entitlement** (who's paid) = **RevenueCat over store IAP**, NOT a self-hosted token. (Changed from the earlier Stripe/JWT plan.)

Gating flow:
- Free tier: today's manual whole-DB backup/restore stays exactly as-is. Fully functional. The honest free offering.
- Paid tier: app queries RevenueCat → if the `sync` entitlement is active → `sync_enabled = '1'` → orchestrator turns on (check-on-open + push-on-leave + schedule, multi-device).

### Why this beats the earlier no-server token (the risks it removes)

The previously-planned self-signed JWT had three real weaknesses; RevenueCat removes all three:
- ~~**Token sharing unmitigated**~~ → store accounts + RevenueCat tie the entitlement to the buyer; sharing is the store's problem, not ours.
- ~~**No revocation without a server**~~ → RevenueCat/store handle expiry, renewal, refund-revocation server-side. No backend we run.
- ~~**Client-side-only check, casually crackable**~~ → store receipt validation is server-verified by RevenueCat. Still not unbreakable on a jailbroken device, but far stronger than a local boolean and standard for the category.

Residual: RevenueCat needs network to verify on first entitlement check — cache the last-known entitlement so an offline launch doesn't wrongly lock out a paid user (grace window). And the store takes its cut (~15-30%) — the accepted cost of this path.

---

## 8. Open decisions before building

1. **Entitlement mechanism — SUPERSEDED 2026-06-30: RevenueCat in-app purchase on BOTH platforms.**
   - *(Previous plan was Stripe-on-own-site + a self-signed JWT unlock. Dropped — see the Apple-risk note below for why.)*
   - User buys sync **inside the app** via store IAP (Apple IAP on iOS, Google Play Billing on Android). **RevenueCat** wraps both behind one SDK and is the entitlement source of truth ("is the `sync` entitlement active for this user?").
   - On launch / purchase / restore, the app asks RevenueCat → if the `sync` entitlement is active, flip `sync_enabled = '1'`. RevenueCat handles validation, expiry, renewal, **and revocation** server-side — so the §7 "no-server gating" risks (token sharing, no revocation, load-bearing self-signed JWT) **largely evaporate.**
   - Cost trade-off accepted: the store takes ~15-30% (vs Stripe's ~3%), in exchange for zero backend, no key management, proper cross-store entitlements, and **no App Store rejection risk** (see below). RevenueCat itself is free under a revenue threshold.
   - ⚠️ Still keep distinct: a Google *login* token (Drive access, every free user has one for sync storage) is NOT the entitlement. The entitlement comes from RevenueCat.
   - "Follows the user across devices" is satisfied natively: store purchases + RevenueCat restore tie the entitlement to the store account, not the device.
   - Until P6, the gate is just the `sync_enabled` boolean; the engine doesn't depend on how it gets set.

### ✅ iOS App Store risk — RESOLVED by choosing RevenueCat IAP (researched 2026-06-30)

The original Stripe-external-checkout + silent-in-app-unlock plan was **the single most rejection-prone case on iOS outside the US** (cloud sync is an app-only feature → Apple Guideline **3.1.1**: "must use in-app purchase; may not use your own mechanisms to unlock functionality"; it is not a reader app nor cleanly a multiplatform service). **Switching to RevenueCat IAP does exactly what Apple requires, so this risk is gone — US and global.** Kept here as the rationale for the decision above, and in case external checkout is ever reconsidered.

Research detail retained for the record: post-Apr-2025 Epic v. Apple injunction, US-storefront apps *may* link out to external checkout at 0% commission, but that freedom is **US-only**; EU allows external links but commissionable (~5% Core Technology Commission); rest-of-world still requires IAP. The Netflix/Spotify "log in and it just works" pattern is tolerated *enforcement practice for reader/cross-platform content*, not a written exemption for an app-only feature. Sources: Apple App Store Review Guidelines (fetched 2026-06-30); Apple dev news id=9txfddzf (2025-05-01); 9th Cir. No. 25-2935 (2025-12-11); SCOTUS stay denied (2026-05-06).

### 8.5 Platform — DECIDED 2026-06-30: RevenueCat IAP on both iOS and Android.

No external-checkout path; no per-platform legal split. P6 wires RevenueCat for both stores. Does NOT block P1–P5 (the engine is platform-agnostic).

2. **Compaction strategy** — eager (every sync) vs lazy (every N logs / size threshold). Lazy is simpler and safer for v1.
3. **Manifest or filename-only discovery** — filename-only is a fine v1 simplification.
4. **Sync granularity** — per-row in the change log (chosen above) vs per-table-delta. Per-row is simplest to merge.

---

## 9. Suggested build phases

- **P1 — Schema + write-path refactor.** Add `syncUpdatedAt`/`syncDeletedAt`, the `syncedWrites.ts` wrapper, soft-delete, `notDeleted()` filter. Migrate every query. *(Ship nothing user-facing; this is plumbing. Biggest phase.)*
- **P2 — Change-log read/write on Drive.** `pushChanges()` / `pullChanges()` in a new `src/services/sync/` module, reusing `encryptBackup`/`getValidAccessToken`/`fetchWithTimeout`. Manual "Sync now" button only.
- **P3 — Merge engine + cursor.** LWW upsert, `sync_last_pulled_at`, single-flight, conflict rules.
- **P4 — Triggers (per the §4 decision, NOT continuous).** Pull on app-open/foreground; push on the user's chosen schedule (`Off/Daily/Weekly/Wi-Fi-only`) plus push-on-background/close if adopted (see §4 open item); manual "Sync now". **No `setInterval` loop, no debounced-after-every-write push** — that model was explicitly rejected.
- **P5 — Compaction + manifest.** Keep Drive from growing unbounded.
- **P6 — Premium gate.** Wire entitlement → `sync_enabled`. Free/paid UI split in `app/settings/backup.tsx`.

---

## 10. What carries over from today (good news)

- `encryptBackup`/`decryptBackup` (password-derived, cross-device) — **reused as-is** for change-log files.
- `getValidAccessToken` / token refresh / `fetchWithTimeout` / single-flight — **reused as-is**.
- `appDataFolder` storage + Drive upload/list/download plumbing — **reused**, just different filenames/payloads.
- Text PKs — **already compatible** with multi-device id generation.

The backup code is a solid foundation; sync is built *beside* it, not by throwing it away. Free tier keeps using the backup path verbatim.
```
