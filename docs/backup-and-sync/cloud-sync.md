# Cloud Sync

Sync keeps every device you use in step, through your own Google Drive, with no server in between. It is built, shipped, and on by default the moment you connect Drive.

Log a shift on the phone. Open the browser. It's there.

<LayerStack accent="teal" layers={[{ name: "local vault", note: "every row stamped syncUpdatedAt" }, { name: "change log (.cmlog)", note: "what changed since the last cursor" }, { name: "Drive appDataFolder", note: "dumb file storage — no logic, no server" }]} caption="Newer edit wins, whole row at a time. Deletions travel as tombstones, and superseded money rows are kept in a local overwrite log." />

---

## Setup

**Settings → Data → Cloud Sync → Connect Google Drive.**

When the connection succeeds, Comma asks you to set a **backup password** — the key that encrypts everything before it reaches Drive. Sync has no unencrypted mode, so nothing uploads until the password is set. Once it is, sync turns itself on; there's no separate toggle to find. A second device joins by entering the same password — see [Encryption](./encryption.md).

---

## The model

```
  Phone A                      Google Drive                      Browser
  ┌──────────────┐            (appDataFolder)                ┌──────────────┐
  │ local vault  │ ──push──▶  ┌────────────────┐  ◀──push──  │ local vault  │
  │ + updatedAt  │            │ change-log     │             │ + updatedAt  │
  │ + deletedAt  │ ◀──pull──  │ files (.cmlog) │  ──pull──▶  │ + deletedAt  │
  └──────────────┘            └────────────────┘             └──────────────┘
```

Google Drive is **storage, not a sync engine**. It holds files. Every decision about what wins, what merges, and what gets deleted is made on your devices. Comma runs no server and sees none of this.

The files live in `appDataFolder` — a per-app private folder. It does not appear in your Drive, and the OAuth scope Comma requests (`drive.appdata`) cannot reach anything else in your account.

---

## Change-logs

Every row Comma writes carries a `syncUpdatedAt` stamp. When a device pushes, it collects the rows that changed since its last push and uploads them as one change-log file:

```json
{
  "v": 1,
  "deviceId": "abc123",
  "createdAt": 1750000000000,
  "sinceCursor": 1749900000000,
  "rows": {
    "shifts":   [ …changed rows… ],
    "expenses": [ …changed rows… ]
  }
}
```

Pulling is the mirror image: fetch the files this device hasn't applied yet, and apply them.

Each device remembers the filenames it has already applied. That makes the whole thing order-independent and self-healing — a pull that dies halfway just leaves the file unapplied, and the next sync picks it up.

---

## Merge: last write wins

For each incoming row: if its `syncUpdatedAt` is newer than the local copy's, it wins.

```
if (incoming.syncUpdatedAt > local.syncUpdatedAt) upsert(incoming)
else                                              keep local
```

Simple, predictable, and it needs no server to arbitrate.

**The known limitation:** last-write-wins works on whole rows. Edit a shift's *notes* on the phone and the same shift's *earnings* in the browser, and the newer of the two rows survives intact — the other edit is lost, even though the two changes didn't overlap. For an app where you're realistically editing one device at a time, that is an acceptable trade for having no server.

Clock skew matters here, in principle. In practice phones and laptops are NTP-synced to within a second.

---

## Deletions

Deleting doesn't remove the row. It stamps `syncDeletedAt`, and the row stays in the database as a tombstone — excluded from every query, but still able to travel.

Without this, deletion doesn't propagate: the other device, which still has the row, would happily push it back and resurrect it.

---

## Money is treated differently

Silently overwriting a shift's `notes` is a nuisance. Silently overwriting **earnings** is not acceptable.

For financial data — expenses, tax history, and the revenue fields on shifts — when an incoming row overwrites a local row that had real edits, the superseded version is written to a local overwrite log **before** it is replaced. No financial edit is ever lost without a trace; it's recoverable from that log.

---

## When it syncs

| Trigger | What happens |
|---|---|
| App opens / comes to foreground | Pull — apply anything new |
| App closes / backgrounds | Push, if your schedule allows |
| **Sync now** | Full push + pull, ignores the schedule |

The push schedule is under **Advanced**:

| Schedule | Behaviour |
|---|---|
| Manual | Only when you press Sync now |
| **Daily** (default) | At most once a day |
| Weekly | At most once a week |

Pull runs on every open regardless — it's cheap, and it's what makes the other device's work show up.

---

## Your profile syncs too

Name, country, province, units, currency, goals, tax rate. This is why signing into a fresh device doesn't dump you into setup: the profile arrives with the data and the app comes up already configured.

There's a guard on this. A brand-new device has a blank profile with a fresh timestamp — under naive last-write-wins, that blank would be "newer" than your real profile and wipe it. Comma detects the first sync on an empty device and refuses to let it out-stamp the cloud.

---

## Compaction

Change-log files pile up over months. Compaction periodically collapses many small logs into one snapshot and deletes the originals, so Drive doesn't fill with thousands of tiny files.

It runs lazily — only past a threshold — and never deletes a log until its contents are confirmed in the snapshot.

---

## Resetting a device

**Resetting wipes the device. It never touches your cloud data.**

In order: sync is turned off, the local database is wiped, cursors are reset, and **a new device ID is minted**.

That last step is the one that matters. Change-logs record who wrote them, and a device skips its own. Without a fresh ID, a reset device would look at every log it ever pushed, think "that's mine, already applied", and skip them all — leaving you with an empty app and a full Drive.

To get your data back after a reset: reconnect and enter your backup password. The device pulls everything down. Resetting also signs the device out of Google and clears its stored backup password, so a fresh start is genuinely fresh.

---

## Demo mode

Sync is disabled while demo data is loaded — sample shifts never reach your Drive. Exporting or restoring a backup file is blocked in demo mode too, so seeded data can't escape as a file either.

---

## Troubleshooting

**"No synced data found yet"** when joining from a second device — that device has nothing to pull because the first one hasn't pushed. On the phone: Settings → Cloud Sync → **Sync now**, then retry.

**It asks for a backup password** — your vault is encrypted (it always is), and this device needs the same password you set on the first one. Enter it and both devices align.

**It says the password is wrong, and sync is paused** — the password here doesn't match the one on your vault, so Comma holds the push rather than forking your data into two encrypted copies. Enter the correct password. If you no longer have it, use **Forgot your password?** to rebuild the cloud copy from this device (your local data is kept) — see [Encryption](./encryption.md#forgetting-the-password).

**A number is wrong after syncing two devices** — see *Money is treated differently* above; the superseded version is in the overwrite log.
