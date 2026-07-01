# Google Drive Backup

Comma's backup feature creates an encrypted snapshot of your entire database and stores it in your Google Drive. It takes about 5 seconds to back up and is the recommended way to protect against phone loss.

---

## Prerequisites

- A Google account
- A Google OAuth client ID configured in `.env` (for self-built versions — official app builds have this pre-configured)

---

## Setup

### Step 1 — Connect Google Drive

1. Go to **Settings → Backup & Sync**.
2. Tap **Connect Google Drive**.
3. A Google sign-in screen appears. Sign in with the Google account you want to use for backup storage.
4. Grant Comma permission to manage its own files in Drive.

Comma requests the `drive.appdata` scope — this gives access only to Comma's hidden app folder, not to your personal Drive files.

### Step 2 — Set a backup passphrase

After connecting, you'll be prompted to **set a backup passphrase**. This passphrase encrypts your data before it leaves your phone.

Rules:
- Minimum 8 characters
- No recovery mechanism — if you forget it, your cloud backups are permanently unrecoverable
- The passphrase is stored in your device's secure enclave; you won't be prompted for it on every backup

**Write it down and store it somewhere safe.** This is the most important step.

---

## Creating a backup

Once connected and a passphrase is set:

1. Go to **Settings → Backup & Sync**.
2. Tap **Backup Now**.
3. Comma encrypts your entire database and uploads it to Drive.
4. A success message shows the backup size and timestamp.

The status line on the Backup screen shows the time of your last successful backup.

---

## What's included in a backup

Everything in your local database:

- All shifts (including GPS route paths)
- All expenses
- All vehicles and maintenance logs
- All goals
- All platforms
- Tax history
- Settings and profile

What's not included:
- Receipt photos (stored as local file paths; the files themselves are not uploaded)
- Temporary GPS scratch data (`locationPoints` table)
- Active shift state (a shift in progress is saved when the shift ends)

---

## Automatic backup schedule

You can configure automatic backups in **Settings → Backup & Sync → Schedule**:

| Option | Behavior |
|---|---|
| **Off** | Manual only — no automatic backups |
| **Daily** | Backs up once per day when the app is opened |
| **Weekly** | Backs up once per week |
| **Wi-Fi only** | Auto-backs up daily but only on Wi-Fi |

Automatic backups run silently in the background. You'll see a success notification if the backup runs.

---

## Restoring from backup

> **Warning:** Restoring overwrites your current local data. This cannot be undone. Make sure you want to replace your local database before restoring.

1. Go to **Settings → Backup & Sync → Restore**.
2. Comma lists your available backups from Drive, sorted by date.
3. Tap the backup you want to restore.
4. Enter your **backup passphrase** to decrypt.
5. Confirm the restore. Comma wipes local data and inserts all records from the backup.
6. The app restarts automatically.

If you're restoring to a new phone, connect to the same Google account and enter your passphrase — the backup list will load from Drive.

---

## Multiple backups

Comma keeps the last **5 backups** in Drive by default (configurable in Settings). When a new backup is created and the limit is exceeded, the oldest backup is deleted automatically.

Each backup filename includes a timestamp, so you can see exactly when it was created.

---

## Troubleshooting

**"Failed to connect to Google Drive"**
- Check your internet connection.
- Sign out and re-authorize in **Settings → Backup & Sync → Disconnect**, then reconnect.
- On Android, ensure Comma has network access (not blocked by a VPN or firewall).

**"Invalid passphrase"**
- You entered the wrong passphrase. There is no way to recover a forgotten passphrase — the backup cannot be decrypted.
- If you remember the passphrase but it's not working, check for typos (especially uppercase/lowercase and special characters).

**"No backups found"**
- Ensure you're signed into the same Google account you used when backing up.
- Check that Comma's Drive permission wasn't revoked (Settings → Google Account → Data & Privacy → Third-party apps).

**Backup is slow**
- Large databases (many shifts, GPS routes) can take 10–30 seconds. This is normal.
- Run backups on Wi-Fi for best performance.

---

## Disconnecting Google Drive

Go to **Settings → Backup & Sync → Disconnect Google Account**.

This removes Comma's access token and stops automatic backups. Your local database is not affected. Your backup files remain in Drive until you manually delete them or delete the app's Drive data from your Google account settings.
