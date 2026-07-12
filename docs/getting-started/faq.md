# Frequently Asked Questions

Answers to the most common questions about Comma, on both the phone app (Android) and the web app (the browser-based PWA), with the differences between the two called out where they matter.

If your question isn't here, check [Troubleshooting](./troubleshooting.md) or open an issue on [GitHub](https://github.com/raiz-toff/Comma).

---

## General

### Is Comma really free?

Yes. Comma is MIT-licensed and open source, and there is no paywall on any feature. Shift tracking, GPS mileage, expenses, tax estimates, goals, analytics, and Google Drive backup and sync all cost nothing.

### Do I need an account?

No. There is no sign-up, no email, and no password. You open the app and start tracking. The only time Google sign-in appears is if you choose to connect your own Google Drive for backup or sync, and even then Comma only touches a private, app-only folder in your Drive.

### Is Comma open source?

Yes. The full source for both apps and these docs lives at [github.com/raiz-toff/Comma](https://github.com/raiz-toff/Comma).

### Does Comma connect to my DoorDash or Uber account?

No. Comma never signs in to a gig platform on your behalf and reads nothing from those accounts. You enter your earnings when you save a shift, or import them from a CSV export. This keeps Comma independent of every platform's terms and API.

---

## Web app versus phone app

Both apps share the same data model and the same features. The one real difference is background GPS.

| | Phone app (Android) | Web app (PWA) |
|---|---|---|
| Install | [APK from GitHub Releases](https://github.com/raiz-toff/Comma/releases/latest) | Open [comma-psi.vercel.app](https://comma-psi.vercel.app), then Add to Home Screen |
| GPS while the app is open | Yes | Yes |
| GPS in the background | Yes, via a native foreground service | No — tracking runs only while the tab stays open |
| Manual and past-shift logging | Yes | Yes |
| Expenses, taxes, goals, analytics | Yes | Yes |
| Works offline | Yes | Yes, once loaded |
| Google Drive backup and sync | Yes | Yes |
| Data storage | SQLite | IndexedDB (Dexie) |

Use the **phone app while you drive** so mileage keeps recording when the screen is off or you switch to your maps app. Use the **web app** to review analytics on a bigger screen or to log from a laptop. Connect both to the same Google Drive and they stay in step.

---

## Data and privacy

### Where is my data stored?

On your device. The phone app keeps a SQLite database in the app's private sandbox; the web app keeps its data in the browser's IndexedDB. Comma has no server and cannot see any of it.

### What happens if I lose my phone?

If you had not turned on Google Drive sync, the data on that phone is gone. Because there is no account, there is no recovery link and no password reset — nothing was ever uploaded for us to send back. This is the trade-off of a local-first app, and it is exactly why Comma offers sync: connect your Drive on both a phone and the web app, and a lost phone costs you nothing you had already synced.

### Do the phone and web apps sync?

Yes. Connect both to the **same Google Drive account** (Settings, then Data, then Cloud Sync). Sync turns on the moment the connection succeeds, and each device pushes its changes and pulls the other's through your Drive. There is no server in the middle. See [Cloud Sync](../backup-and-sync/cloud-sync.md).

### Is my cloud data encrypted?

There are two modes:

- **Default (no password).** Your sync files sit in a private, app-only folder in your Drive, reachable only through your Google account. Comma requests a scope that cannot touch anything else in your Drive, and anyone else would need your Google login to read them.
- **End-to-end encryption (opt-in).** Turn this on under Advanced and Comma encrypts each file on your device before upload with AES-256-GCM, using a key derived from a password only you know. Not even someone with your Google login can read the files.

If you enable end-to-end encryption and then **forget that password, the cloud copy is unrecoverable** — there is no reset by design. The data still on your original device is unaffected; you can turn encryption off there to re-upload it. See [Encryption](../backup-and-sync/encryption.md).

### Does Comma track me or sell my data?

No. Comma collects no analytics and no telemetry, and it has no server to send anything to. Your earnings, location, and expenses never leave your device unless you turn on Google Drive backup or sync, and with end-to-end encryption on, only you can read them.

---

## Shifts and mileage

### How does GPS mileage tracking work?

When you start a live shift, Comma records your route and separates **active distance** (driving with an accepted order) from **dead distance** (commuting, waiting, heading home). On the phone this runs in a native foreground service, so it keeps going when the screen is off. On the web it runs while the app's tab is open. See [Mileage Tracking](../features/mileage-tracking.md).

### Does the web app track GPS?

Yes, while its tab is open. The web app uses the browser's geolocation and accumulates distance in real time. What it cannot do is run in the background: a browser suspends a backgrounded tab, so there is no equivalent of the phone's foreground service. For driving, use the phone app; the web app is best for reviewing and for manual entry.

### Why does the phone app ask to "allow all the time" for location?

Background mileage tracking needs location access even when the screen is off or you are in another app. If you only grant "while using the app", tracking pauses the moment you leave Comma. You can change this any time in your device's location settings.

### Will tracking drain my battery?

The tracker samples only as often as it needs to reconstruct your route and stops the moment you end the shift. Keep the phone on its car charger during a shift, as most drivers do, and the impact over a normal shift is small.

### I forgot to start a shift. Can I add it afterward?

Yes. Use Log Past Shift and enter the times, earnings, and distance (leave distance blank if you don't know it). You can edit any field later from the shifts list.

---

## Taxes

### Which countries does Comma support?

Canada only, today. Comma loads Canadian mileage rates, HST/GST, CPP, and province presets. Definitions for the US, the UK, and Nepal are written into the source but are deliberately not enabled — Comma will not offer a country whose tax rules haven't been signed off — so you will not see them in the app.

### Are the tax numbers advice?

No. Comma gives you a running estimate built from the official mileage rate and self-employment figures, so you have real numbers to bring to an accountant. It is not tax advice and not a filing service. Verify with a professional before you file. See [Tax Center](../features/tax-center.md).

### A platform I use isn't listed. Can I add it?

Yes. Add it as a custom platform in Settings, then Platforms. It behaves exactly like a built-in one.

---

## Next steps

- [Quick Start](./quick-start.md) — Install and log your first shift.
- [Troubleshooting](./troubleshooting.md) — Fixes for common issues on both apps.
- [Core Concepts](./core-concepts.md) — The terminology behind the numbers.
