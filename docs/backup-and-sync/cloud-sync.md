# Cloud Sync

> **Status: in development.** Cloud Sync is designed but not yet built. This document describes the final design. The manual backup feature described in [Google Drive Backup](./google-drive-backup.md) is fully working today.

---

## What cloud sync is

Cloud Sync keeps your data consistent across multiple devices automatically. Log a shift on your iPhone, open Comma on your Android tablet, and the shift is there — without pressing any buttons.

Unlike the current backup (which is a destructive restore — last one wins), sync is **non-destructive and bi-directional**. Both devices stay current. Neither is ever wiped.

---

## Mental model

```
  Phone A                          Google Drive                     Phone B
  ┌──────────────┐                 (appDataFolder)                  ┌──────────────┐
  │ local SQLite │ ──push delta──▶ │ change-log    │ ◀──push delta─ │ local SQLite │
  │  + updatedAt │ ◀──pull delta── │ files (.cmlog)│ ──pull delta─▶ │  + updatedAt │
  │  + deletedAt │                 │ (encrypted)   │                │  + deletedAt │
  └──────────────┘                 └────────────────┘               └──────────────┘
```

Google Drive is **dumb encrypted storage** — not a sync engine. All sync logic runs on your devices. No server, no cloud compute, no Comma servers involved.

---

## How it works

### Change-logs

When you modify a record (create a shift, log an expense, edit a vehicle), Comma stamps the row with `syncUpdatedAt = now()`. When your device syncs, it collects all rows changed since its last push and uploads them as an encrypted **change-log file** (`.cmlog`) to Drive.

A change-log file contains:
```json
{
  "v": 1,
  "deviceId": "abc123",
  "createdAt": 1750000000000,
  "sinceCursor": 1749900000000,
  "rows": {
    "shifts": [ ...changed rows... ],
    "expenses": [ ...changed rows... ]
  }
}
```

The file is encrypted with your backup passphrase before upload.

### Merge (Last-Write-Wins)

When your device pulls change-logs from Drive, it applies them using **Last-Write-Wins (LWW)** merge: for each incoming row, if the incoming `syncUpdatedAt` is newer than the local row's `syncUpdatedAt`, the incoming row wins.

```
if (incoming.syncUpdatedAt > local.syncUpdatedAt) {
  UPSERT incoming row
}
// else: my local copy is newer — keep it, ignore incoming
```

This is simple, predictable, and requires no server to arbitrate conflicts.

### Deletions (soft deletes)

Deleting a record doesn't remove it from the database. Instead, it sets `syncDeletedAt = now()`. Soft-deleted rows are excluded from all queries (`WHERE syncDeletedAt IS NULL`) but remain in the database so the deletion can propagate to other devices via the normal LWW merge.

### Applied-set cursor

Each device tracks which change-log files it has already applied, stored as a JSON array of filenames (`sync_applied_logs`). When pulling, the device applies any file not in this set. This design is order-independent and self-healing — a failed pull just means the file isn't in the set yet, so the next sync retries it automatically.

---

## Sync triggers

Sync runs automatically at session boundaries, not continuously:

| Trigger | Action |
|---|---|
| **App opens / foreground** | Pull — check Drive for new change-logs and apply them |
| **App closes / background** | Push — if your schedule allows, upload your changes |
| **Manual "Sync Now"** | Full push + pull, ignores schedule |

The push frequency is controlled by your schedule setting:

| Schedule | Behavior |
|---|---|
| **Manual** | Only syncs when you tap "Sync Now" |
| **Daily** | Auto-pushes at most once per day |
| **Weekly** | Auto-pushes at most once per week |

Pull always runs on every app open regardless of schedule — it's cheap (just checks if there are new files).

---

## What syncs

| Data | Syncs? | Notes |
|---|---|---|
| Shifts | Yes | Full record sync |
| Expenses | Yes | Full record sync |
| Vehicles | Yes | Full record sync |
| Maintenance logs | Yes | Full record sync |
| Goals | Yes | Full record sync |
| Platforms | Yes | Your custom platform settings |
| Tax history | Yes | Append-only audit log |
| Profile / preferences | Separately | Name, country, currency, units — lightweight sync |
| GPS scratch (`locationPoints`, `tempNativePoints`) | No | Local ephemeral data, too large to sync |
| Device state (`sync_enabled`, sync cursors) | No | Per-device settings, never synced |

---

## Financial data protection

Silent data overwrite is acceptable for a shift's `notes` field. It is not acceptable for money.

For financial tables (`expenses`, `taxHistory`, and the revenue fields on `shifts`), Comma records a conflict audit trail: when an incoming row overwrites a local financial row that had real edits, the superseded version is saved to a local `sync_overwrite_log` table before the overwrite. This means no financial edit is ever silently lost — it's recoverable from the audit log.

---

## Conflict resolution

**Scenario:** You edit a shift on Phone A while offline. Phone B also edits the same shift while offline. Both devices then sync.

**Result:** The edit with the later `syncUpdatedAt` timestamp wins. The older edit is recorded in `sync_overwrite_log` for recovery if needed.

**Known limitation:** LWW operates at the row level. If you edited the `notes` field on Phone A and the `grossRevenue` on Phone B (different fields, same row), only the whole newer row survives — the other field's edit is lost. For a no-server consumer app, this trade-off is acceptable given that most gig workers edit records on one device at a time.

Clock skew: LWW trusts device clocks. Phones are NTP-synced and skew is typically <1 second, so this is fine in practice.

---

## Reset under sync

**Resetting the app wipes your local device only. It never touches your cloud data.**

What happens on reset:
1. Sync is turned off (before the wipe — critical ordering).
2. Local database is wiped.
3. Sync cursors are reset.
4. A new device ID is minted.
5. Cloud change-logs are untouched.

The new device ID is essential: without it, the re-enabled device would see all of its old change-logs as "authored by me" and skip them, resulting in an empty database even though the data is sitting on Drive. By re-minting the ID, old logs look like they came from a different device and are pulled down normally.

To recover data after a reset: re-enable sync. The device will pull all existing change-logs from Drive and restore your history.

---

## Compaction

As you use Comma over months and years, change-log files accumulate on Drive. Compaction periodically collapses many small change-logs into a single snapshot file, then removes the individual logs. This keeps Drive storage manageable.

Compaction runs lazily — not on every sync, only when the number of log files exceeds a threshold. It is designed to be safe: a log is never deleted from Drive until its data is confirmed in the snapshot.

---

## Setup

Cloud Sync shares its setup with Google Drive Backup:

1. Connect a Google account in **Settings → Backup & Sync**.
2. Set a backup passphrase (same passphrase encrypts both backups and sync change-logs).
3. Enable sync in **Settings → Backup & Sync → Cloud Sync: On**.

That's it. Sync starts automatically on the next app open.

---

## Privacy

Cloud Sync is zero-knowledge. Comma's encrypted change-logs on Drive contain:
- Your rows in JSON format, encrypted with your passphrase-derived key
- A device ID (a random UUID, not tied to your identity)
- Timestamps

Google cannot read the contents. Comma's developers cannot read the contents. Only a device with your passphrase can decrypt the data.

---

## Build phases

For contributors tracking development progress:

| Phase | Description | Status |
|---|---|---|
| **P1** | Schema — add `syncUpdatedAt`/`syncDeletedAt`, soft-delete wrappers | In progress |
| **P2** | Change-log push/pull on Drive | Not started |
| **P3** | Merge engine (LWW, audit log) | Not started |
| **P4** | Sync triggers (auto on app open/close) | Not started |
| **P5** | Compaction | Not started |
