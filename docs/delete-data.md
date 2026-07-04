# Data Deletion Request

_Last updated: July 4, 2026_

This page explains how to delete your data from **Comma** (developer: Rajkumar), and what is deleted or kept.

## How to delete your data

Comma stores your data **on your device**, so you are in direct control of it. You can delete it at any time using any of the methods below.

### 1. Delete all data inside the app
Open Comma → **Settings → Reset App**. This permanently erases all of your data from the device, including:

- Shifts (times, earnings, tips, GPS routes)
- Expenses and receipt photos
- Vehicles and odometer/maintenance history
- Profile (name, country, currency)
- Goals, achievements, and XP
- Tax history

This action cannot be undone.

### 2. Uninstall the app
Uninstalling Comma removes its private database and all locally stored data from your device.

### 3. Delete cloud backups (if you enabled Google Drive sync)
If you turned on Google Drive backup or cloud sync, encrypted backups are stored in Comma's private `appDataFolder` in **your own** Google Drive. To delete them:

- In Comma, turn off Cloud Sync / Backup, or use the in-app option to delete backups, **and/or**
- Revoke Comma's access from your Google account at
  [myaccount.google.com/permissions](https://myaccount.google.com/permissions). Removing access, together with uninstalling the app, deletes the `appDataFolder` contents.

### 4. Request deletion by email
If you need help, email **valium-banjo-badly@duck.com** with the subject "Data deletion request" and we will assist.

## What is deleted and what is kept

- **Deleted:** All personal and app data listed above — on-device data (via Reset App or uninstall) and cloud backups (via the steps above). Because Comma has **no server**, there is no additional copy of your data held by the developer.
- **Kept:** Nothing is retained by the developer after deletion. Comma does not operate a backend, does not collect analytics, and does not store your data on its own servers.
- **Retention period:** On-device and cloud data are removed immediately when you perform the steps above. There is no server-side retention because there is no server. Old Google Drive backups may also be rotated automatically (the oldest is removed when the backup limit is exceeded).

## Related

See the full [Privacy Policy](/privacy) for details on what data Comma stores and how it is handled.
