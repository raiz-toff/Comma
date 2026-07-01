# Backup & Sync Overview

## Local-first

Comma is designed to work completely offline. Your data lives in a SQLite database on your device — no account required, no server to sign up for, no monthly fee to keep your history accessible.

This is an intentional design choice, not a limitation. Gig workers' earnings records are sensitive financial data. Comma's position is that you should own your data, not us.

**What this means in practice:**
- Open Comma on an airplane with no signal — everything works.
- Comma has no servers that can go down and take your data with them.
- No subscription can expire and lock you out of your history.
- Comma cannot see your earnings, location, or expenses — even if we wanted to.

---

## The tradeoff

Local-first has one real tradeoff: **if you lose your phone, you lose your data** — unless you have a backup.

Comma offers two ways to protect against data loss:

1. **Manual backup** — a whole-database snapshot encrypted and saved to your Google Drive. You press a button, it uploads. Available to everyone, free.

2. **Cloud sync** *(coming soon)* — automatic, continuous, multi-device. Changes on Phone A appear on Phone B within one session boundary. Designed for users with two devices or who upgrade phones frequently.

---

## Backup vs. sync — what's the difference?

These terms get confused. In Comma, they mean specific things:

| | Backup | Cloud Sync |
|---|---|---|
| **How it works** | Point-in-time snapshot of the whole database | Record-level change-logs merged continuously |
| **Direction** | One-directional (save or restore) | Multi-directional (both devices stay current) |
| **Trigger** | Manual (you press "Backup Now") | Automatic (on app open and app close) |
| **Restore** | Wipes local data and replaces it | Non-destructive merge — neither device is wiped |
| **Multiple devices** | Clunky — last restore wins | Native — designed for this |
| **Status** | Available now | In development |

If you have one phone and just want protection against losing it, **backup is everything you need.**

If you use two phones, recently got a new phone, or want seamless history across devices, **cloud sync is what you're waiting for.**

---

## Where your data lives

### Local database

`/data/data/com.comma.app/databases/comma.db` (Android) or the equivalent app sandbox on iOS.

This is a standard SQLite file. All your shifts, expenses, vehicles, and goals are in this file. Comma uses Drizzle ORM to read and write it.

### Google Drive (if enabled)

Data backed up to Google Drive goes into the **`appDataFolder`** — a special hidden folder that is:
- Only accessible by Comma (not visible in your Drive file browser)
- Tied to your Google account
- Deleted if you remove Comma's Drive access

Your backup files are named `comma-backup-{timestamp}.comdb` for full backups, and `comma-cl-{deviceId}-{timestamp}.cmlog` for sync change-logs. Both are encrypted before upload.

---

## Encryption

All cloud data (backups and sync change-logs) is **encrypted on your device before upload**. Google never sees your plaintext data.

Encryption uses AES-256-CBC with a key derived from your **backup passphrase** via PBKDF2. The passphrase is stored in your device's secure enclave (iOS Keychain or Android Keystore), never in plaintext.

**Warning: if you forget your passphrase, your cloud data is permanently unrecoverable.** There is no password reset — the passphrase is the sole input to the encryption key, by design. Comma cannot recover it for you.

See [Encryption](./encryption.md) for full technical details.

---

## Privacy guarantee

Comma's cloud integration uses Google Drive's `appDataFolder`, which means:

- Your backup files do not appear in your Drive file browser.
- No one else with access to your Drive (shared drives, family plans) can see them.
- The files are encrypted — even Google cannot read the contents.
- Comma's developers cannot access your Google account or your files.

Comma does not collect analytics, telemetry, or usage data of any kind.

---

## Next steps

- [Google Drive Backup](./google-drive-backup.md) — Set up your first backup
- [Cloud Sync](./cloud-sync.md) — How multi-device sync will work
- [Encryption](./encryption.md) — Technical encryption details
