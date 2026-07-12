# Sync Simplification Audit + Target Design

**Date:** 2026-07-12
**Scope:** the web↔mobile Cloud Sync engine (`src/services/sync/` + `web/src/services/sync/`)
**Status:** proposal — nothing implemented yet
**Supersedes (in part):** `sync-design.md` §3 (change-log format), §4 (algorithm), §5/§6 (compaction)

---

## 0. Verdict

The **core model is right**: per-row Last-Write-Wins over each user's own encrypted Google Drive
`appDataFolder`, with no server. That's a legitimate, well-trodden pattern for single-user /
multi-device local-first apps (Standard Notes, Joplin→Dropbox, Actual Budget all live in this
family). Keep it.

What went wrong is **sizing**. We built a delta-log CRDT-lite engine — the shape you'd reach for
with large datasets or real-time collaboration — and then carried it **twice** (mobile TS + web JS,
required to stay byte-compatible). Those two decisions are the root of most of the accidental
complexity, and of nearly every interop incident recorded in
`web-mobile-interop-audit-2026-07-03.md`.

Current engine: **~1,830 lines** (mobile) + **~1,300 lines** (web mirror) ≈ **3,100 lines** for the
protocol layer alone. The target design below preserves every product guarantee at roughly a third
of that, in **one** codebase.

### The load-bearing assumption

Everything in §2 rests on this: **total synced data stays small — single-digit MB.**

- The real user vault we tested against was 185 shifts.
- The bulky tables (`locationPoints`, `tempNativePoints`) are already excluded from sync.
- A multi-year power user is still a few MB of JSON.

If that assumption ever breaks (tens of thousands of rows, or we decide to sync something heavy),
delta logs start earning their keep and §2 should be revisited. **Validate this before building.**

---

## 1. What to keep (do not touch)

| Thing | Why it stays |
|---|---|
| Password-derived encryption (PBKDF2 210k + per-file salt, cross-device) | Correct, necessary, already cross-device compatible |
| BYO Drive `appDataFolder`, zero server | The whole point of the product decision |
| Per-row `syncUpdatedAt` LWW + `syncDeletedAt` tombstones | The correct merge model for one user across devices |
| Soft deletes (deletes must propagate, not resurrect) | Correct |
| Reset semantics (local wipe, re-mint device id, never push tombstones) | Genuinely well-reasoned; keep verbatim |
| Three-bucket data split (device-local / synced records / profile) | Correct |
| Serialized sync queue | Correct |

---

## 2. Findings, ranked by leverage

### F1 — Two byte-compatible implementations → one shared core

`src/services/sync/` and `web/src/services/sync/` are the *same protocol* implemented twice:
`changeLog`, `mergeRules`, `applyChangeLog`, `pushChanges`, `pullChanges`, `compaction`,
`syncState`. Every protocol change must land twice and stay wire-identical.

Evidence this is the bug factory (all from our own audit notes):
- migration-ordering bug (`0022_profile_sync` journal `when`)
- expense-category vocabulary divergence ("categories show as Other on phone")
- the dual-key shape layer drifting, incl. a "frozen inline copy that must stay dependency-free"

**Standard practice:** one platform-agnostic core with injected adapters. See §4.

---

### F2 — Delta logs + compaction + applied-set cursor → per-device full-state files

This is the big one. We built:

- delta change-logs (`comma-cl-{device}-{ts}.cmlog`), one per push
- snapshot compaction at 30 logs (`comma-snap-…​.cmsnap`) + subsumed-log deletion
- an **applied-set** cursor (`sync_applied_logs`) instead of a scalar watermark
- a `sync_last_pushed_at` high-water mark + `sinceCursor` per log
- "not-authored-by-me / not-already-applied" pull filtering

…all to avoid re-uploading the full dataset on each sync. **At single-digit-MB scale, that
optimization buys nothing and costs the entire complexity budget.**

**Standard simple version of the same architecture:** each device writes **exactly one file**
containing its **full current state**; sync = download every peer's file, LWW-merge row by row,
write mine back. This is state-based convergent merge — it converges trivially because you always
merge complete state, and it is order-independent and idempotent.

Adopting F2 **deletes outright**:

- `compaction.ts` (126 lines × 2) — there are no logs to compact
- the applied-set cursor + `addAppliedLog`/`getAppliedLogs`
- `sync_last_pushed_at` + `sinceCursor` + `collectChangedRows`
- the log-vs-snapshot filename grammar in `changeLog.ts`
- the pull-side "authored by me / already applied" filter
- most of the first-sync guard in `syncNow.ts:72-95` (a fresh device simply has no file yet)
- the `syncUpdatedAt > 0` snapshot-exclusion / seed-leak special case
- the poison-log quarantine subsystem (see F3)

---

### F3 — Poison-log quarantine → falls out of F2; fix the root cause instead

`syncState.ts:233-291` (+ `APPLY_LOGIC_VERSION`, `resetQuarantineOnUpgrade`, `sync_failed_logs`)
exists because **an immutable bad row inside an immutable Drive log re-fails forever** and wedges
every log behind it. That immutability is a property of the delta-log design.

With per-device full-state files, a bad row is re-evaluated from fresh peer state every sync and
**self-heals** the moment the peer rewrites it. A per-row `try/catch` skip is sufficient — no
persistent failure counters, no version-reset dance.

And the deeper point: the poison rows were never a *sync engine* problem. They were **schema
divergence** (`shifts.platform NOT NULL` vs web `platformId`; `merchants.name UNIQUE`;
goals/vehicles shape mismatches). The standard fix is to align the wire schema (F4), not to build a
quarantine that survives a broken one.

---

### F4 — Dual-key interop shape → one canonical wire DTO

`web/src/services/sync/interopShape.js` makes every web row physically carry **both** the mobile and
web key vocabularies (`mobile*Keys()` at write time, `normalizeIncoming()` at apply time), because
the two apps grew different column names and types (ISO vs epoch-ms, cents vs dollars, `nickname` vs
`name`).

**Standard practice:** define **one canonical wire format**, give each platform a single
`toWire()` / `fromWire()` adapter at the sync boundary. Translate once on the way in/out; never
store both shapes in the DB forever.

We already declared *mobile schema = canonical*. The clean end state is the web store adopting the
canonical field names so translation trends toward zero.

---

### F5 — Merchant dedupe / independently-minted IDs → deterministic IDs

The merchant identity-dedupe branch (`applyChangeLog.ts:52-57`, `:152-176`) exists **only** because
both apps mint their own ids for the same merchant while `merchants.name` is `UNIQUE` → a same-name
merchant from a peer is a UNIQUE violation that aborts the whole apply transaction.

**Standard trick for serverless sync: content-derived deterministic IDs.**

```
merchants.id = shortHash(normalizedName)
```

Both devices independently produce the **same id for the same entity**, so it merges for free — no
dedupe code, no UNIQUE violation, no transaction abort. The same idea retires the collision classes
in `platforms`, `shiftPlatforms`, and the seeded goal scaffolds.

Rule to adopt generally: **never put a `UNIQUE` constraint on a synced column** unless the id is
deterministic.

---

### F6 — Financial overwrite audit log → drop or downgrade for v1

`mergeRules.ts:16-21` + the `sync_overwrite_log` table (+ migration, + web mirror, + an apply
branch) records every LWW overwrite of a financial row that carried local edits.

For **one user syncing their own devices**, two genuinely conflicting edits to the same shift inside
one sync window is a corner of a corner. Most LWW engines simply accept last-writer-wins.

Defensible gold-plating. Recommend: downgrade to a `console.warn` (or cut) until a real user
actually hits a conflict. Re-add if/when there's evidence.

---

### F7 — Schedule cadence → optional config surface

`schedule.ts` (`manual` / `daily` / `weekly` + `isSyncDue` + `sync_last_push_run_at`) is cheap and
harmless, but it is **product config, not a sync requirement**. The standard minimum is "sync on
foreground, sync on background, debounced."

Keep only if the WhatsApp-style cadence is a feature users actually asked for. Otherwise it's a knob.

---

### F8 — "Should we have used something off the shelf?"

Preempting the obvious question. RxDB, WatermelonDB-sync, PowerSync, ElectricSQL, and Turso embedded
replicas all cover this class of problem — but **every one of them assumes a server endpoint.** Our
hard constraint (no infra, free, syncs to the *user's own* Drive) is precisely why they don't fit,
and it's what justifies a custom engine.

**Custom is the right call. It just needs to be a much smaller custom.** RxDB is the closest model
worth studying (documented replication protocol + pluggable conflict handlers), but adopting it
would not remove the Drive-adapter work.

---

## 3. Target design — per-device full-state sync

### 3.1 What lives on Drive

One file per device, overwritten in place:

```
comma-state-{deviceId}.cmstate     ← encryptBackup(JSON.stringify(DeviceState), passphrase)
```

That's it. No deltas, no snapshots, no manifest, no compaction. `N` devices → `N` files.

```ts
interface DeviceState {
  v: 1;                    // format version (starting fresh with State-Based sync)
  deviceId: string;
  writtenAt: number;       // epoch ms — informational only, NOT a merge input
  rows: Record<string, WireRow[]>;   // tableName -> ALL non-scaffold rows, incl. tombstones
}
```

Every row carries `syncUpdatedAt` (epoch ms, the LWW clock) and `syncDeletedAt` (tombstone or null).
Merge reads **only those two fields** — never file mtime, never `writtenAt`.

Drive writes are `PATCH /upload/drive/v3/files/{fileId}` (update in place) rather than always-POST,
so the folder never accumulates files.

### 3.2 The whole algorithm

```
sync(passphrase):
  # PULL
  files = listAppDataFiles().filter(isStateFile)
  for f in files where f.deviceId != myDeviceId:
      peer = decrypt(download(f))
      for (table, rows) in peer.rows:
          for row in rows:
              try:   mergeRow(table, fromWire(table, row))   # per-row try/catch
              catch: log-and-skip                            # self-heals next sync
  # PUSH
  mine = readFullLocalState()          # all synced tables, excl. syncUpdatedAt == 0 scaffolds
  upload(myStateFile, encrypt(mine))   # overwrite in place
```

`mergeRow` is the existing `decideMerge` — unchanged:

```
no local row                  → insert
incoming.syncUpdatedAt > local.syncUpdatedAt → overwrite
otherwise                     → skip (ties keep local)
```

Convergence: merge is **commutative, associative, idempotent** (per-row max on a total order), so
device order, partial failures, and re-runs are all safe. **No cursor is required at any point** —
that's the property the delta design forfeited and then spent ~600 lines re-buying.

### 3.3 Reset semantics — preserved exactly

Reset still: wipes local, sets `sync_enabled = 0`, **re-mints `sync_device_id`**, never touches the
cloud, never pushes tombstones. Under full-state sync it gets *simpler*: the re-minted device writes
a **new** state file and its old one is just a stale peer — which the user can delete from the sync
screen ("forget this device"), a UI affordance the delta design couldn't cleanly offer.

### 3.4 Costs, honestly

| Cost | Assessment |
|---|---|
| Re-uploads full state each push | A few MB, at a daily/weekly cadence. Fine. |
| Downloads N peer files each pull | N = 2–3 devices in practice. Fine. |
| Whole-file rewrite = larger blast radius on a corrupt write | Mitigate: write-then-verify-decrypt before considering the push done; peers' files remain untouched, so any single bad file can only be *skipped*, never poison others. |
| Stale device files accumulate if a device is retired | Add "forget this device" in the sync UI; optionally auto-prune files untouched for >180d. |

---

## 4. Shared core module

```
packages/sync-core/            ← plain TS, zero platform imports
  types.ts                     DeviceState, WireRow, SyncedTable
  merge.ts                     decideMerge  (moved verbatim from mergeRules.ts)
  state.ts                     buildDeviceState / applyDeviceState
  crypto.ts                    interface only — impl injected
  wire.ts                      toWire / fromWire (canonical DTO, F4)
  ids.ts                       deterministic id helpers (F5)
  sync.ts                      the ~40-line orchestrator in §3.2
```

Everything platform-specific is injected:

```ts
interface SyncAdapters {
  db: {
    readTable(name: string): Promise<Row[]>;
    upsertRow(name: string, pk: string, row: Row): Promise<void>;
    findRow(name: string, pk: string, id: string): Promise<Row | undefined>;
  };
  drive: {
    list(): Promise<DriveFileRef[]>;
    download(fileId: string): Promise<string>;
    upsert(filename: string, body: string): Promise<void>;
    remove(fileId: string): Promise<void>;
  };
  crypto: {
    encrypt(plain: string, passphrase: string): Promise<string>;
    decrypt(envelope: string, passphrase: string): Promise<string>;
  };
  kv: { get(k: string): Promise<string | null>; set(k: string, v: string): Promise<void> };
}
```

Mobile supplies drizzle + `googleDrive.ts` + `cryptoHelper.native.ts`. Web supplies Dexie +
`drive-auth.js` + Web Crypto. **The merge logic, wire format, and file format exist once.**

The crypto envelope is already byte-compatible across both platforms (`encryptBackup` /
`decryptBackup`, format v2) — that part of the port was done right and carries over unchanged.

---

## 5. Cutover plan

Since this is a fresh database with no existing users or legacy `.cmlog`/`.cmsnap` files on Google Drive, we do not need backward compatibility code or a staged rollout. We can perform a clean, direct cutover.

**Sequencing (implemented across both apps simultaneously to maintain interop):**

| Step | Change | Risk |
|---|---|---|
| 1 | Extract `sync-core` shared module | Low — pure refactor, moves merge/crypto to a shared place |
| 2 | Replace reader & writer with `.cmstate` file engine directly | Low — fresh start, no legacy parsing code |
| 3 | Implement deterministic IDs + canonical wire DTO | Low — ensures web and mobile match schemas perfectly |
| 4 | Delete legacy code (compaction, quarantine, change logs, and `sync_overwrite_log`) | Low |

---

## 6. Expected outcome

Preserved, unchanged: offline-first, encrypted, zero-server, cross-device merge, deletes propagate,
reset stays clean, demo mode never leaks, profile travels with the user.

Removed: compaction, applied-set cursors, push watermarks, snapshot/delta filename grammar,
poison-log quarantine + apply-version resets, dual-key interop shapes, merchant dedupe, financial
overwrite audit — **and one of the two codebases.**

Rough size: **~3,100 lines → ~1,000**, single implementation.
