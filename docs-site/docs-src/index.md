# Comma — Documentation

**Comma** is a privacy-first earnings tracker for gig workers. It tracks shifts, mileage, expenses, and taxes — everything stays on your phone unless you choose to back it up.

Built for DoorDash, Uber Eats, SkipTheDishes, Instacart, Amazon Flex, and a dozen more platforms.

---

## Get Comma

- **Android** — [download the latest APK](https://github.com/raiz-toff/CommaApp/releases/latest) from GitHub Releases. Sideload it by allowing "Install unknown apps" (a Play Store listing is planned).
- **Web** — open [comma-psi.vercel.app](https://comma-psi.vercel.app) in any modern browser and install it as an app. See [Web App (PWA)](./features/web-app.md).
- **Source** — Comma is open source on GitHub: [raiz-toff/CommaApp](https://github.com/raiz-toff/CommaApp) (phone app + docs) and [raiz-toff/comma](https://github.com/raiz-toff/comma) (web app).

---

## What makes Comma different

- **No account required.** No email, no password, no server. Your data lives in a SQLite database on your device.
- **GPS mileage tracking.** A native background service records your route, separates active delivery miles from dead miles, and calculates your deductible mileage automatically.
- **Tax-aware.** Country-specific tax rules for the US, Canada, UK, and Nepal. Standard mileage rate or actual expenses — your choice.
- **Optional cloud backup.** Connect your own Google Drive to encrypt and store a backup. No third-party servers ever see your data.

---

## Guides

### Getting started
- [Introduction](./getting-started/introduction.md) — What Comma is and how it works
- [Quick Start](./getting-started/quick-start.md) — Install, onboard, log your first shift
- [Core Concepts](./getting-started/core-concepts.md) — Shifts, platforms, active vs dead miles, and more
- [FAQ](./getting-started/faq.md) — Common questions about the web and phone apps
- [Troubleshooting](./getting-started/troubleshooting.md) — Fix common issues on web and phone

### Features
- [Shift Tracking](./features/shift-tracking.md) — Live GPS shifts and manual log entries
- [Mileage Tracking](./features/mileage-tracking.md) — How the GPS engine works
- [Expenses](./features/expenses.md) — Log and categorize business expenses
- [Tax Center](./features/tax-center.md) — Self-employment tax estimates
- [Goals & Gamification](./features/goals-and-gamification.md) — Weekly goals, XP, badges, streaks
- [Vehicles](./features/vehicles.md) — Manage multiple vehicles and maintenance logs
- [Analytics & Reports](./features/analytics-and-reports.md) — Charts, trends, and exportable reports
- [Supported Platforms](./features/platforms.md) — All gig platforms Comma supports
- [Web App (PWA)](./features/web-app.md) — Using Comma in the browser

### Backup & Sync
- [Overview](./backup-and-sync/overview.md) — Local-first philosophy
- [Google Drive Backup](./backup-and-sync/google-drive-backup.md) — Set up and use encrypted backup
- [Cloud Sync](./backup-and-sync/cloud-sync.md) — Multi-device sync design
- [Encryption](./backup-and-sync/encryption.md) — How your data is protected

### Architecture
- [Overview](./architecture/overview.md) — Tech stack and design principles
- [Database](./architecture/database.md) — SQLite schema reference
- [State Management](./architecture/state-management.md) — Zustand and React Query
- [Navigation](./architecture/navigation.md) — Screen and routing structure
- [GPS Engine](./architecture/gps-engine.md) — Native background location service

### Development
- [Setup](./development/setup.md) — Run the app locally
- [Project Structure](./development/project-structure.md) — Complete file tree
- [Environment Variables](./development/environment-variables.md) — `.env` configuration
- [Native Module](./development/native-module.md) — The `comma-tracker` Kotlin/Swift module
- [Contributing](./development/contributing.md) — Code style, PRs, conventions

---

## License

MIT. Open source, no paywall.
