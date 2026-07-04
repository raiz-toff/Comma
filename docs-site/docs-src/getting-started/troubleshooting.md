# Troubleshooting

Fixes for the most common issues on the **phone app** (Android/iOS) and the **web app** (PWA). Each section notes which app it applies to.

Before anything else: make a [Google Drive backup](../backup-and-sync/google-drive-backup.md) if you can. Almost every fix below is safe, but a backup means nothing you do here can cost you data.

---

## GPS & mileage *(phone app)*

### My shift ran but recorded 0 miles

1. **Check location permission.** Comma needs **"Allow all the time"** (Android) or **"Always"** (iOS) to track in the background. If it's set to "While using," tracking stops the moment you leave the app. Fix it in your device's system settings → Apps → Comma → Location.
2. **Check that location/GPS is on** at the system level.
3. **Disable battery optimization for Comma** (Android). Aggressive battery savers can kill the background service. In system settings, set Comma to "Unrestricted" / exclude it from optimization.
4. Make sure you tapped **Start Shift** (not just opened the app) — tracking only runs during an active shift.

### Mileage looks too low or too high

- Comma reconstructs your route from GPS samples; tunnels, parking garages, and dense urban canyons can briefly lose signal. Small gaps are normal.
- If a number is clearly wrong, edit the shift's mileage manually from the Shifts list — your entry overrides the GPS estimate.

### The live timer or tracking stopped mid-shift

- This is almost always the OS killing the background service to save power. Exclude Comma from battery optimization (see above) and keep the phone on its charger during shifts.
- Avoid "clear all" / swiping the app away from recents while a shift is running.

### GPS doesn't work in the web app

That's expected. Browsers suspend location access for backgrounded tabs, so the web app can't run continuous tracking. **Log mileage manually** when you save a shift in the web app, or use the phone app for automatic tracking.

---

## Installation & updates

### The web app won't install / no "Install" option *(web app)*

- The install prompt only appears on supported browsers (Chrome, Edge, Android Chrome; Safari via **Share → Add to Home Screen**). Some in-app browsers (inside Facebook, Instagram, etc.) don't support installing — open the site in your real browser instead.
- You may need to interact with the app once before the browser offers to install it.
- You can also trigger it from **Settings → About → Install COMMA**.

### The web app is showing an old version *(web app)*

The PWA caches itself to work offline, so an update may take one reload to apply. Close all Comma tabs/windows and reopen, or pull-to-refresh. As a last resort, clear the site's cache in your browser settings (this does **not** delete your data, but back up first to be safe).

### Android says "app not installed" for the APK *(phone app)*

- Enable **install from unknown sources** for your browser/file manager (Android settings → Apps → special access).
- If a different signed build is already installed, uninstall it first, then install the new APK.

---

## Data, backup & restore

### I can't connect Google Drive

- Make sure you complete the full Google sign-in and **grant the Drive permission** Comma requests — if you decline it, backup can't work.
- If sign-in fails on the web app, disable pop-up blockers for the site and retry.
- Try again on a stable connection; the OAuth handshake needs network.

### My backup won't restore / "wrong passphrase"

- The passphrase is **case-sensitive** and must match exactly what you set when the backup was created. There is no reset — if it's truly forgotten, that encrypted data can't be recovered. See [Encryption](../backup-and-sync/encryption.md).
- Make sure you're signed into the **same Google account** that holds the backup.

### Restoring wiped data I wanted to keep

A backup **restore replaces** the target device's data — it's a snapshot, not a merge. Always restore onto a fresh install or a device you're happy to overwrite. (Non-destructive merging is what [Cloud Sync](../backup-and-sync/cloud-sync.md) will provide once it ships.)

### Data on my web app and phone app don't match

They're separate local vaults and don't sync automatically yet. Move data deliberately with a backup/restore (or export/import). Continuous [Cloud Sync](../backup-and-sync/cloud-sync.md) is in development.

---

## Taxes & numbers

### Tax estimate seems off

- Confirm your **country** is set correctly (Settings) — it drives every rate.
- Confirm you're using the intended method (**standard mileage rate** vs **actual expenses**) in **Tax Center → Vehicle Tax Profile**.
- Remember estimates are running approximations to bring to your accountant, not a filed return. See [Tax Center](../features/tax-center.md).

### A platform I use isn't in the list

Add it as a custom platform: **Settings → Platforms → + Add Custom Platform**. It works exactly like a built-in one. See [Supported Platforms](../features/platforms.md).

---

## App behaves oddly / crashes

1. **Restart the app** (fully close and reopen).
2. **Update to the latest version** — the version number is on **Settings → About** (phone) or the About tab (web).
3. On the phone app, **Settings → About → Export Diagnostics** produces a system log you can share when reporting a bug.
4. If a screen fails to load, back out and re-enter it; the app isolates screen errors so the rest keeps working.

---

## Still stuck?

- Read the relevant [feature guide](../features/shift-tracking.md) — many "bugs" are a setting.
- Open an issue on [GitHub](https://github.com/raiz-toff/CommaApp).
- Reach the maintainer via the links in **Settings → About**.
