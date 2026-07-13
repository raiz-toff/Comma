# Comma — Documentation

Comma is a privacy-first earnings tracker for gig workers in Canada: it records shifts, GPS mileage, expenses, and CRA-aware tax estimates, and everything stays on your device unless you choose to sync it.

![A quiet street on a winter night, with a shift's GPS trail winding through it — a shift as Comma sees it](images/brand/hero-night.png)

---

## Get Comma

| Platform | Where | Notes |
|---|---|---|
| Android | [github.com/raiz-toff/Comma/releases/latest](https://github.com/raiz-toff/Comma/releases/latest) | Download the APK and sideload it by allowing "Install unknown apps". A Play Store listing is planned. |
| Web | [comma-psi.vercel.app](https://comma-psi.vercel.app) | Opens in any modern browser and installs as a PWA. See [Web App (PWA)](./features/web-app.md). |
| Source | [github.com/raiz-toff/Comma](https://github.com/raiz-toff/Comma) | One monorepo holding the phone app, the web app, and these docs. |

---

## What makes Comma different

- **No account.** No email, no password, no server to sign up for. You open the app and start tracking.
- **Local-first.** Your data lives in a database on your own device — SQLite on the phone, IndexedDB in the browser. Comma has no backend and cannot see your earnings.
- **Background GPS on the phone.** A native foreground service records your route during a shift and separates active delivery distance from dead distance. The web app tracks too, but only while its tab stays open.
- **CRA-aware tax.** Comma loads Canadian mileage rates, HST/GST, CPP, and province presets, and keeps a running self-employment estimate. It is an estimator, not tax advice.
- **Optional Google Drive sync.** Connect your own Drive to keep the phone and the web app in step. It is off until you connect it, and end-to-end encryption is available as an opt-in.

Comma ships for **Canada only** today. Definitions for other countries exist in the source but are deliberately not enabled.

---

## Guides

- [Introduction](./getting-started/introduction.md) — What Comma is and how it works.
- [Quick Start](./getting-started/quick-start.md) — Install, onboard, and log your first shift.
- [Core Concepts](./getting-started/core-concepts.md) — Shifts, platforms, active versus dead distance.
- [FAQ](./getting-started/faq.md) — Common questions about the phone and web apps.
- [Troubleshooting](./getting-started/troubleshooting.md) — Fixes for common issues on both apps.

---

## How-to Guides

- [Install Comma](./guides/install.md) — Sideload the Android app or install the PWA.
- [Demo Mode](./guides/demo-mode.md) — Explore the app with sample data.
- [Moving Between Devices](./guides/moving-devices.md) — Carry your data across phones and browsers.
- [Import from CSV](./guides/import-csv.md) — Bring earnings in from a spreadsheet.

---

## Features

- [Shift Tracking](./features/shift-tracking.md) — Live GPS shifts and manual log entries.
- [Mileage Tracking](./features/mileage-tracking.md) — How the GPS engine measures distance.
- [Expenses](./features/expenses.md) — Log and categorize business expenses.
- [Tax Center](./features/tax-center.md) — Self-employment tax estimates.
- [Goals and Gamification](./features/goals-and-gamification.md) — Weekly goals, XP, badges, streaks.
- [Vehicles](./features/vehicles.md) — Manage vehicles and maintenance logs.
- [Analytics and Reports](./features/analytics-and-reports.md) — Charts, trends, and exportable reports.
- [Supported Platforms](./features/platforms.md) — The gig platforms Comma covers.
- [Web App (PWA)](./features/web-app.md) — Using Comma in the browser.

---

## Reference

- [Settings](./reference/settings.md) — Every setting and what it changes.
- [Shift Fields](./reference/shift-fields.md) — Each field on a shift record.
- [Expense Fields](./reference/expense-fields.md) — Each field on an expense record.
- [Feature Flags](./reference/feature-flags.md) — The gated features and their defaults.
- [Platforms](./reference/platforms.md) — The platform registry.
- [Countries](./reference/countries.md) — The country registry and what ships.
- [Notifications](./reference/notifications.md) — The notifications Comma raises.
- [Keyboard Shortcuts](./reference/keyboard-shortcuts.md) — Shortcuts in the web app.

---

## Backup and Sync

- [Overview](./backup-and-sync/overview.md) — The local-first philosophy.
- [Google Drive Backup](./backup-and-sync/google-drive-backup.md) — Set up and use encrypted backup.
- [Cloud Sync](./backup-and-sync/cloud-sync.md) — Multi-device sync through your own Drive.
- [Encryption](./backup-and-sync/encryption.md) — How your data is protected.

---

## Architecture

- [Overview](./architecture/overview.md) — Tech stack and design principles.
- [Database](./architecture/database.md) — SQLite schema reference.
- [State Management](./architecture/state-management.md) — Zustand and React Query.
- [Navigation](./architecture/navigation.md) — Screen and routing structure.
- [GPS Engine](./architecture/gps-engine.md) — The native background location service.

---

## Development

- [Setup](./development/setup.md) — Run both apps locally.
- [Project Structure](./development/project-structure.md) — The monorepo file tree.
- [Environment Variables](./development/environment-variables.md) — `.env` configuration.
- [Native Module](./development/native-module.md) — The `comma-tracker` Kotlin module.
- [Contributing](./development/contributing.md) — Code style, PRs, and conventions.
- [Releasing](./development/releasing.md) — Building and publishing a release.

---

## License

Comma is MIT licensed. Open source, no paywall.
