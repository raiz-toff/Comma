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

## The two modes

The one decision you have to understand — and Comma deliberately made it a decision you can ignore.

### Default: no password

Your data goes to a hidden folder in your Google Drive that only Comma can see. It's protected the same way everything else in your Drive is: by your Google account.

Nothing to memorise, nothing to lose, nothing to type on a new device. Sign in with the same Google account and your data is there.

**Who can read it:** you, and Google — exactly like every document already in your Drive.

### Opt-in: end-to-end encryption

Set a password and Comma encrypts everything with it before it leaves the device. Google stores bytes it cannot read.

**Who can read it:** you, on a device where you've entered the password. Not Google. Not us.

**The cost:** if you forget that password, your cloud data is unrecoverable. Not "hard to recover" — mathematically gone. No reset exists, because nobody is holding a key.

The password *is* the mode: setting one turns encryption on, having none means the default.

> **Most people should use the default.** It is the WhatsApp-backup model, and it defends against every threat a driver realistically faces: a stolen phone, a dead phone, a new phone. Choose end-to-end encryption if "Google could technically read this" is a line you won't cross — and you are confident you will not lose the password.

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
- **Sync in demo mode.** Sample data never touches your cloud.

---

## Turning it on

**Settings → Data → Cloud Sync → Connect Google Drive.**

That's the whole setup. Sync switches on the moment you connect — there's no password step, no schedule to pick, no "enable sync" toggle to hunt for afterwards.

It syncs about once a day by default, plus whenever you press **Sync now**. Change that to manual or weekly under **Advanced**.

---

## Read next

- [Google Drive Backup](./google-drive-backup.md) — connecting, restoring, disconnecting
- [Cloud Sync](./cloud-sync.md) — how the merge actually works
- [Encryption](./encryption.md) — the two modes in detail
- [Moving Between Devices](./moving-devices.md) — new phone, phone ↔ laptop, exports
