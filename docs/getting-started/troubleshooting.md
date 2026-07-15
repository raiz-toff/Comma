# Troubleshooting

Fixes for the most common issues on the phone app (Android) and the web app (PWA), in problem-then-fix form, with the app each one applies to noted.

If you can, make a [Google Drive backup](../backup-and-sync/google-drive-backup.md) before you change settings — almost every fix here is safe, but a backup means nothing you try can cost you data.

<StepFlow accent="amber" steps={[{ title: "Location: allow all the time", body: "While-using-the-app stops recording the moment you switch to your delivery app." }, { title: "Battery: unrestricted", body: "Samsung and Xiaomi kill the tracking service under their default power settings." }, { title: "Confirm a shift is running", body: "Comma only records between Start Shift and the end swipe." }]} caption="Most missing distance is one of these three, in this order." />

---

## GPS and mileage (phone app)

### My shift ran but recorded no distance

Background GPS depends on a short ladder of permissions. Work down it in order:

1. **Location permission.** Comma needs "Allow all the time" to track when the screen is off. If it is set to "While using the app", tracking stops the moment you leave Comma. Fix it in your device settings, under Apps, then Comma, then Location.
2. **Location is on at the system level.** If the device's location or GPS toggle is off, the shift records nothing with no other symptom. Turn it on.
3. **Battery optimization exemption.** Aggressive OEM battery savers (Samsung, Xiaomi, and others) will kill the foreground service when you swipe the app away. Set Comma to "Unrestricted" or exclude it from optimization. Comma requests this exemption when you start a shift, but some devices need it set by hand.
4. **Notifications.** On Android 13 and later, the "recording mileage" notification only shows if notification permission is granted. Without the notification the service can be culled sooner. Allow notifications for Comma.
5. **Confirm you started a shift.** Tracking only runs during an active shift, not merely when the app is open.

### The distance looks too high or too low

- Comma filters GPS jitter: a single glitchy fix implying a speed over about 150 km/h is discarded, so a spike cannot inflate your distance. Small gaps in tunnels, garages, and dense downtown blocks are normal and usually wash out.
- If a number is still clearly wrong, edit the shift and correct the distance by hand, or enter start and end odometer readings. An odometer reading reconciles the shift and overrides the GPS estimate.

### The timer or tracking stopped mid-shift

This is almost always the OS reclaiming the background service for power. Exclude Comma from battery optimization (see above), keep the phone on its charger, and avoid using "clear all" in recents while a shift is running.

---

## GPS and mileage (web app)

### Tracking stopped when I switched tabs or locked the screen

Expected. The web app tracks only while its tab is open and in the foreground; a browser suspends a backgrounded tab, and there is no background service it can fall back on. Keep the Comma tab open and in front while you drive, or use the phone app, which does track in the background.

---

## Installation and updates

### The web app is showing an old version (web app)

The PWA caches itself so it can work offline, so an update can take one reload to apply. Close every Comma tab and window and reopen, or pull to refresh. As a last resort, clear the site's cache in your browser settings — this does not delete your data, but back up first to be safe.

### The web app won't install, or there's no Install option (web app)

- Installing is supported in Chrome and Edge (desktop and Android) and, on iOS, via Share, then Add to Home Screen. In-app browsers inside apps like Facebook or Instagram cannot install — open the site in your real browser.
- You may need to interact with the app once before the browser offers to install it.

### Android says "install unknown apps" or "app not installed" (phone app)

- The APK is sideloaded, so Android asks you to allow "Install unknown apps" for the browser or file manager you downloaded it with. Grant it under Settings, then Apps, then special access, then Install unknown apps.
- If a build with a different signature is already installed, uninstall it first, then install the new APK.
- Download the APK only from the official [GitHub Releases page](https://github.com/raiz-toff/Comma/releases/latest).

---

## Cloud sync

### A second device says there's nothing to pull

The second device has nothing to pull because the first one hasn't pushed yet. On the first device, open Settings, then Cloud Sync, and press **Sync now** to push. Then retry the sync on the second device.

### Sync is asking for a backup password

Your vault is encrypted — it always is — so this device needs the same backup password you set on the first one. Enter it and both devices align. If Comma says the password is wrong, it pauses the push rather than forking your data into two encrypted copies; enter the correct password to continue.

### I forgot my backup password

The cloud copy encrypted with that password is **unrecoverable** — there is no reset, by design. But the data on your device was never encrypted with it, so you haven't lost your records. On a device that still has your data, open Settings, then Cloud Sync, and tap **Forgot your password?**. Comma deletes the unreadable cloud backup and rebuilds it from this device under a new password — your local data is kept, and your other devices then reconnect with the new password. See [Encryption](../backup-and-sync/encryption.md).

### A number changed after syncing two devices

Sync merges whole rows by last write wins, so the newer edit of a row wins. For financial data — earnings, expenses, tax history — the version that was overwritten is written to a local recovery log first, so it is never lost without a trace. See [Cloud Sync](../backup-and-sync/cloud-sync.md).

---

## Taxes and numbers

### The tax estimate looks off

- Confirm your **province** is set correctly in Settings — it drives the rates.
- Confirm you are using the intended method, standard mileage rate or actual expenses, in the vehicle's tax profile.
- Remember the figure is a running estimate to bring to an accountant, not a filed return. See [Tax Center](../features/tax-center.md).

---

## The app behaves oddly or crashes

1. Fully close and reopen the app.
2. Update to the latest version — the version number is under Settings, then About (phone), or the About view (web).
3. On the phone, Settings, then About, then Export Diagnostics produces a log you can attach to a bug report.
4. If one screen fails to load, back out and re-enter it; the app isolates screen errors so the rest keeps working.

---

## Still stuck?

- Read the relevant [feature guide](../features/shift-tracking.md) — many "bugs" are a setting.
- Open an issue on [GitHub](https://github.com/raiz-toff/Comma).
