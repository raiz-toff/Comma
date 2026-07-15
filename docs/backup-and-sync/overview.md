# Backup & Sync Overview

Comma has no server. That is the point, and it is also the catch.

Your data is a database on your device — nobody can breach it, sell it, or switch it off. But nobody can recover it for you either. If the phone goes in a river with a year of records on it, those records are gone. There is no "forgot password" link, because there is no account.

So Comma gives you one thing to turn on: **sync through your own Google Drive.** It takes one tap.

<VaultFlow accent="cyan" nodes={["Phone — SQLite", "Browser — IndexedDB"]} hub="Drive appDataFolder" caption="Comma has no server. Your own Drive holds a private folder only Comma can see — that is both the backup and the sync." />

---

## Backup and sync are different words

| | Backup | Sync |
|---|---|---|
| **Direction** | One way — device → Drive | Two way — every device converges |
| **When** | A snapshot, at a moment | Continuously, in the background |
| **Restoring** | Replaces what's on the device | Nothing is replaced; changes merge |
| **Use it for** | A safety net, and moving to a new phone | Keeping a phone and a laptop in step |

Turning on sync gives you both: the change-logs on Drive **are** your backup, and Comma can rebuild a blank device from them.

---

## How it works

```
   Phone                    your Google Drive                 Browser
  ┌────────────┐            (appDataFolder —                ┌────────────┐
  │  SQLite    │──push──▶    a private folder      ◀──push──│  IndexedDB │
  │            │◀──pull──    only Comma can see)   ──pull─▶ │            │
  └────────────┘                                            └────────────┘
```

Drive is dumb storage. It holds files; it merges nothing. **All the sync logic runs on your devices.** No Comma server sees your data, because there is no Comma server.

When you change something, that row is stamped with a timestamp. On sync, Comma uploads the rows that changed since last time as a change-log file, and applies everyone else's. Newer edits win. Deletions travel as tombstones, so they propagate instead of resurrecting.

Full mechanics: [Cloud Sync](./cloud-sync.md).

---

## Always encrypted

Cloud Sync has one mode, and it's the private one. When you connect Google Drive, Comma asks you to set a **backup password** and encrypts everything with it before it leaves the device. Google stores bytes it cannot read.

**Who can read it:** you, on a device where you've entered the password. Not Google. Not us.

**The cost:** you need that password on every device, and Comma cannot recover it. If you forget it, the cloud copy is unreadable — but the data on your device is untouched, so you rebuild the cloud copy from it under a new password and lose nothing that was already synced there.

The files land in a hidden folder only Comma can see (`appDataFolder`), so even the ciphertext is out of the way of the rest of your Drive.

Details: [Encryption](./encryption.md).

---

## What syncs

| | Syncs | Note |
|---|---|---|
| Shifts, expenses, vehicles, goals | Yes | Full records, including saved route paths |
| Maintenance logs, tax history, platforms | Yes | |
| Profile — name, country, units, goals, tax rate | Yes | Which is why a new device comes up already configured |
| Tax jar balances | Yes | |
| Raw GPS scratch points | **No** | Enormous, and worthless once the route is simplified |
| Device ID, sync cursors, sync on/off | **No** | Per-device by definition |

---

## What Comma never does

- **Send your data to a Comma server.** There isn't one.
- **Read the rest of your Drive.** The permission it requests (`drive.appdata`) can only see its own private folder — not your documents, not your photos.
- **Sync or back up in demo mode.** Sample data never touches your cloud, and exporting or restoring a backup file is blocked too.

---

## Turning it on

**Settings → Data → Cloud Sync → Connect Google Drive.**

Connect the account, set a backup password, and sync switches on — no schedule to pick and no separate "enable sync" toggle to hunt for afterwards. The password is the one thing setup asks of you, because nothing reaches Drive unencrypted.

It syncs about once a day by default, plus whenever you press **Sync now**. Change that to manual or weekly under **Advanced**.

---

## Read next

- [Google Drive Backup](./google-drive-backup.md) — connecting, restoring, disconnecting
- [Cloud Sync](./cloud-sync.md) — how the merge actually works
- [Encryption](./encryption.md) — how the backup password protects your cloud copy
- [Moving Between Devices](./moving-devices.md) — new phone, phone ↔ laptop, exports
