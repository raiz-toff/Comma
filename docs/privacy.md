# Privacy

## Summary

Comma collects no data about you. It sends no analytics, no telemetry, no crash reports to any server. Your earnings, location, and financial records stay on your device.

---

## What data Comma stores

All data is stored locally in a SQLite database in your app's private storage (not accessible to other apps without root/jailbreak):

- Shifts: start/end time, earnings, tips, GPS route
- Expenses: amount, category, merchant, receipt photos
- Vehicles: name, type, odometer readings, maintenance history
- Profile: name, country, currency preference
- Goals and achievements: targets, XP, badges
- Tax history: regional rate changes

None of this is transmitted to any server except optionally to your own Google Drive (see below).

---

## Google Drive (optional)

If you enable Google Drive backup or cloud sync:

- Comma requests the `drive.appdata` scope — this gives Comma access only to its own hidden folder in your Drive, not to any of your personal files.
- Your data is **encrypted on your device** before upload. The encryption key is derived from your backup passphrase. Comma's developers cannot decrypt your files. Google cannot decrypt your files.
- Backups appear only in Comma's `appDataFolder` — they don't show in your Drive file browser.
- You can revoke Comma's Drive access at any time from your Google account's security settings.

---

## Location data

Comma accesses your device's GPS during an active shift to track mileage. Location data is:

- Stored locally in the SQLite database
- Not transmitted to any server
- Not included in Google Drive backups (GPS points are excluded from backup; only the encoded route polyline on the shift record is included)
- Never sold or shared with third parties

---

## Analytics and telemetry

Comma does not include:
- Crash reporting (Sentry, Crashlytics, etc.)
- Analytics (Firebase, Amplitude, etc.)
- Advertising SDKs
- Any third-party SDK that transmits user data

The app makes no network requests except:
- To Google APIs (for Drive backup/sync, only if enabled by you)
- To Google's token endpoint (to refresh your Drive OAuth token, only if enabled by you)

---

## Advertising identifiers

Comma does not access the Advertising Identifier (IDFA on iOS, GAID on Android). It does not track users across apps or websites.

---

## Data retention

Your data remains on your device until you delete the app or use the "Reset App" function. There is no server-side retention because there is no server.

If you enabled Google Drive backup, your backup files remain in Drive until:
- Comma automatically rotates old backups (the oldest is deleted when the limit is exceeded)
- You manually delete them from your Google account
- You remove Comma's access to Drive (the `appDataFolder` is deleted with app data when access is revoked and the app is uninstalled)

---

## Data portability

You own your data and can export it at any time:

- **CSV export:** Settings → Export → all shifts, expenses, mileage log
- **PDF reports:** Reports panel → any report → Export as PDF
- **Raw database:** technically accessible via file managers on rooted/jailbroken devices

---

## Contact

For privacy questions or data-related requests, open an issue on the GitHub repository.
