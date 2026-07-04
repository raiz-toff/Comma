# Frequently Asked Questions

Answers to the most common questions about Comma — on both the **phone app** (Android/iOS) and the **web app** (the browser-based PWA). Where an answer differs between the two, it's called out explicitly.

If your question isn't here, check [Troubleshooting](./troubleshooting.md) or reach out via **Settings → About → Help & Docs**.

---

## General

### What is Comma?

Comma is a privacy-first earnings tracker for gig workers. It tracks your shifts, mileage, expenses, and taxes across DoorDash, Uber Eats, Instacart, Amazon Flex, and a dozen other platforms. Everything is stored locally on your device — no account, no server, no subscription required for the core features. See the [Introduction](./introduction.md) for the full picture.

### Do I need an account to use Comma?

No. There is no sign-up, no email, no password. You open the app and start tracking. The only time Google sign-in appears is if you *choose* to connect your own Google Drive for backup — and even then, Comma only touches a private app folder in your own Drive.

### Is Comma free?

Yes. Every core feature — shift tracking, GPS mileage, expenses, tax estimates, goals, analytics, and manual Google Drive backup — is free. There is no paywall on your own data.

### Is Comma open source?

Yes. Comma is MIT-licensed and open source. See the [project on GitHub](https://github.com/raiz-toff/CommaApp).

---

## Web app vs. phone app

### What's the difference between the web app and the phone app?

| | Phone app (Android/iOS) | Web app (PWA) |
|---|---|---|
| **Install** | Play Store / App Store / APK | Open the site in a browser, "Add to Home Screen" |
| **GPS mileage tracking** | ✅ Full background GPS engine | ⚠️ Limited — no reliable background tracking in a browser |
| **Live shifts** | ✅ Native timer + location | ✅ Timer works; manual mileage entry recommended |
| **Manual logging** | ✅ | ✅ |
| **Expenses, taxes, goals, analytics** | ✅ | ✅ |
| **Offline** | ✅ Fully offline | ✅ Works offline once loaded |
| **Google Drive backup** | ✅ | ✅ |
| **Data storage** | SQLite on device | IndexedDB / local storage in the browser |

The two share the same data model, so a backup made on one can be restored on the other.

### Should I use the web app or the phone app?

Use the **phone app** if you want automatic GPS mileage tracking while you drive — that's what the background location engine is built for. Use the **web app** if you prefer to log shifts from a laptop, want to review your analytics on a bigger screen, or can't install the native app. Many drivers use the phone app to track and the web app to review.

### Can I use both at the same time?

Yes, but they're separate local vaults. Data does **not** automatically flow between them yet — you'd move data with a Google Drive backup/restore or an export/import. Continuous [Cloud Sync](../backup-and-sync/cloud-sync.md) that keeps devices in step is in development.

### How do I install the web app?

Open the Comma web app in your browser, then:

- **Chrome / Edge (desktop or Android):** look for the install icon in the address bar, or open the menu → **Install Comma** / **Add to Home screen**.
- **Safari (iOS):** tap the Share button → **Add to Home Screen**.

Once installed it runs in its own window, works offline, and behaves like a native app. In the web app you can also trigger this from **Settings → About → Install COMMA**.

---

## Shifts & mileage

### How does GPS mileage tracking work?

On the phone app, when you start a live shift Comma runs a native background location service that records your route. It separates **active miles** (driving with an order) from **dead miles** (commuting, waiting) and totals your deductible mileage automatically. See [Mileage Tracking](../features/mileage-tracking.md) and the [GPS Engine](../architecture/gps-engine.md) for details.

### Does GPS tracking work in the web app?

Not reliably. Browsers throttle or suspend location access when the tab is in the background, so Comma's web app can't run the same continuous tracker. On the web, log your mileage manually (odometer start/end or a known trip distance) when you save the shift.

### Why does the phone app ask for "always allow" location?

Background mileage tracking needs location access even when the screen is off or the app is backgrounded — that's the whole point of automatic tracking. If you only grant "while using the app," tracking will stop the moment you switch apps or lock your phone. You can change this in your device's system settings anytime.

### Will GPS tracking drain my battery?

The tracker is tuned to sample only as often as needed to reconstruct your route, and it stops the moment you end a shift. Keep your phone on its car charger during shifts — most drivers do — and battery impact is negligible over a normal shift.

### I forgot to start a shift. Can I add it afterward?

Yes. Tap **Log Past Shift**, enter the start/end times, earnings, tips, and mileage (leave mileage blank if you don't know it). You can edit any field later from the Shifts list. See [Shift Tracking](../features/shift-tracking.md).

### What are "active" vs "dead" miles?

**Active miles** are driven while you have an accepted order — these are the miles you're being paid to drive. **Dead miles** are everything else: driving to a hotspot, waiting, or heading home. Both are typically deductible as business miles, but Comma tracks them separately so you can see your true efficiency. [Core Concepts](./core-concepts.md) explains this fully.

---

## Expenses & taxes

### Which countries does Comma support for taxes?

The US 🇺🇸, Canada 🇨🇦, the UK 🇬🇧, and Nepal 🇳🇵. Comma loads the correct mileage rates, self-employment tax brackets, and currency for your country. You pick your country during onboarding and can change it in Settings.

### How accurate are the tax estimates?

Comma uses the official standard mileage rate (IRS, CRA, etc.) and self-employment tax brackets to give you a running estimate. It's built to give you real numbers to bring to your accountant — **it is not tax advice or a filing service.** Always verify with a professional before filing. See [Tax Center](../features/tax-center.md).

### Standard mileage rate or actual expenses — which should I use?

That's your choice (and often your accountant's advice). Comma pre-fills the standard mileage rate but lets you switch to actual expenses per vehicle in **Tax Center → Vehicle Tax Profile**. See [Tax Center](../features/tax-center.md).

### Which expenses are deductible?

Comma lets you categorize each expense (fuel, phone, maintenance, gear, etc.) and marks its typical deductibility. The [Expenses](../features/expenses.md) guide walks through categories and how they flow into your tax estimate.

---

## Backup, sync & data

### Where is my data stored?

Locally. On the phone app it's a SQLite database inside the app's private sandbox; on the web app it lives in your browser's storage. Comma has no server and cannot see your data. See [Backup & Sync Overview](../backup-and-sync/overview.md).

### What happens if I lose my phone?

If you don't have a backup, you lose your data — that's the one real tradeoff of local-first. This is exactly why Comma offers encrypted **Google Drive backup**. If you back up regularly, you can restore onto a new device in minutes. See [Google Drive Backup](../backup-and-sync/google-drive-backup.md).

### Is my Google Drive backup private?

Yes. Your data is **encrypted on your device before it's uploaded** (AES-256, key derived from your passphrase). It goes into a hidden app-only folder in *your* Drive that even you can't browse directly, and that no one else — not Google, not Comma's developers — can read. See [Encryption](../backup-and-sync/encryption.md).

### What if I forget my backup passphrase?

Your cloud data becomes **permanently unrecoverable.** The passphrase is the sole input to the encryption key by design — there is no reset and no recovery. Write it down somewhere safe. See [Encryption](../backup-and-sync/encryption.md).

### Can I move my data between the web app and the phone app?

Yes — make a Google Drive backup (or export a vault file) on one, then restore/import it on the other. They share the same data format. Note that a restore **replaces** the target device's data, so restore onto a fresh install or one you're happy to overwrite.

### Does cloud sync between two devices work yet?

Continuous multi-device [Cloud Sync](../backup-and-sync/cloud-sync.md) is in development. For now, backup-and-restore is the supported way to move data between devices.

### How do I delete all my data?

In the app you can reset the vault (Settings → Data), which wipes local data. To also delete anything stored in your Google Drive, disconnect Comma's Drive access. For the formal, Play Store–compliant process, see the [Data Deletion Request](/delete-data) page.

---

## Privacy

### Does Comma track me or sell my data?

No. Comma collects no analytics, no telemetry, and no usage data of any kind. It has no server to send anything to. Your earnings, location, and expenses never leave your device unless *you* enable Google Drive backup — and even then they're encrypted so only you can read them. See the [Privacy Policy](/privacy).

### Can Comma's developers see my earnings?

No. There is no backend that receives your data, and cloud backups are encrypted with a key only you hold.

---

## Next steps

- [Quick Start](./quick-start.md) — Install and log your first shift
- [Troubleshooting](./troubleshooting.md) — Fix common issues on web and phone
- [Core Concepts](./core-concepts.md) — The terminology behind the numbers
