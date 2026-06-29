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

## 2. Schema changes (the foundation — do this first)

Every **synced** table gets two columns. (We sync the same 11 tables as `BACKUP_TABLES`; we do NOT sync `locationPoints` / `tempNativePoints` — too bulky, already excluded from backup.)

```ts
syncUpdatedAt: integer('sync_updated_at', { mode: 'number' }).notNull().default(0),
// epoch ms of the last LOCAL mutation to this row. The LWW clock.

syncDeletedAt: integer('sync_deleted_at', { mode: 'number' }),
// epoch ms when soft-deleted, else null. Tombstone so deletions propagate.
```

Plus device identity + cursor, stored in `settings` KV (no new table needed):

| key | value |
|---|---|
| `sync_device_id` | random uuid, generated once per install |
| `sync_last_pulled_at` | epoch ms cursor — "I've applied everything up to here" |
| `sync_enabled` | `'1'` only when the premium entitlement is active |

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

  # ── PULL ──
  remoteLogs = list .cmlog files newer than sync_last_pulled_at, not authored by me
  for each remoteLog (oldest → newest):
     changeLog = decrypt(download(remoteLog), passphrase)
     for each (table, rows) in changeLog:
        for each row:
           local = SELECT by pk
           if local is null OR row.syncUpdatedAt > local.syncUpdatedAt:
              UPSERT row            # LWW: newer wins, tombstones included
           # else: my local copy is newer, ignore incoming

  # ── PUSH ──
  myChanges = SELECT * FROM each table WHERE syncUpdatedAt > sync_last_pushed_at
  if myChanges not empty:
     upload new .cmlog file (encrypted)

  sync_last_pulled_at = max(createdAt of applied logs, now)
  release lock-file
```

**Triggers (this is what makes it feel "smooth"):**
- On app foreground (`AppState` → active).
- Debounced ~5s after any local write settles.
- Every N minutes while foregrounded (a `setInterval`, or reuse a background task).
- Manual "Sync now" button (always available).

All wrapped in the same single-flight + `fetchWithTimeout` patterns already in `googleDrive.ts`.

---

## 5. Conflict resolution

With **LWW**, the row with the larger `syncUpdatedAt` wins, field-for-field at the row level. Simple, predictable, no server needed. Known trade-off: if two devices edit *different fields of the same row* offline, the older edit's fields are lost (whole-row replace). For Comma's data (a shift, an expense — usually edited on one device at a time) this is acceptable. **Document it for users:** "edits made offline on two devices to the same item: the most recent edit wins."

Clock skew caveat: LWW trusts device clocks. Phones are NTP-synced in practice, so this is fine; note it as a known limitation rather than engineering a vector-clock (overkill for a no-server consumer app).

---

## 6. The hard parts (be honest about these)

1. **No atomic multi-file ops on Drive.** A push = upload one file = atomic enough. Compaction (rewrite many → one, then delete old) is the risky bit — do it lazily, tolerate leftover logs, never delete a log until its data is provably in a snapshot.
2. **Concurrent push race.** Two devices pushing at once is fine (different filenames, both get pulled later). A best-effort `sync.lock` file avoids most overlap; full correctness doesn't require it because LWW is commutative.
3. **First sync on a fresh install** with existing local data: treat all local rows as "changed since 0" and push them, then pull. Or, on a brand-new device, pull-only then adopt.
4. **Schema migrations across devices.** A `ChangeLog.v` + `BACKUP_SCHEMA_VERSION` guard: a newer device must not corrupt an older one. Refuse to apply logs from a higher schema version than the local app understands; prompt to update.
5. **The write-path refactor (§2)** is the single biggest chunk of work and touches every existing query file.

---

## 7. Premium gating (no server)

Decision: **sync to the user's own Drive, we host nothing.** So gating is purely a local entitlement flag that flips `sync_enabled`.

- Free tier: today's manual whole-DB backup/restore stays exactly as-is. Fully functional. This is the honest free offering.
- Paid tier: `sync_enabled = '1'` → the sync orchestrator turns on; auto background sync, multi-device.
- **Gating mechanism is still open** — see §8. Because there's no server, the entitlement check is client-side, which means it's crackable. That's an accepted reality of no-server apps (same as Obsidian's older model). Choose how much that matters.

---

## 8. Open decisions before building

1. **Entitlement mechanism.** With no backend, realistic options:
   - **RevenueCat / store IAP** — still no server *you* run; RevenueCat is the entitlement source of truth. Recommended even in a "no-server" design, because it's the only tamper-resistant option and it's what app stores expect for subscriptions.
   - **One-time license key** you issue manually — cheap, but trivially shareable.
   - **Pure honor-system unlock** — simplest, leakiest.
2. **Compaction strategy** — eager (every sync) vs lazy (every N logs / size threshold). Lazy is simpler and safer for v1.
3. **Manifest or filename-only discovery** — filename-only is a fine v1 simplification.
4. **Sync granularity** — per-row in the change log (chosen above) vs per-table-delta. Per-row is simplest to merge.

---

## 9. Suggested build phases

- **P1 — Schema + write-path refactor.** Add `syncUpdatedAt`/`syncDeletedAt`, the `syncedWrites.ts` wrapper, soft-delete, `notDeleted()` filter. Migrate every query. *(Ship nothing user-facing; this is plumbing. Biggest phase.)*
- **P2 — Change-log read/write on Drive.** `pushChanges()` / `pullChanges()` in a new `src/services/sync/` module, reusing `encryptBackup`/`getValidAccessToken`/`fetchWithTimeout`. Manual "Sync now" button only.
- **P3 — Merge engine + cursor.** LWW upsert, `sync_last_pulled_at`, single-flight, conflict rules.
- **P4 — Auto triggers.** Foreground + debounced-write + interval. The "smooth" layer.
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
