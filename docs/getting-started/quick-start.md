# Quick Start

Get Comma installed and log your first shift in about 5 minutes.

---

## Install

Comma is built with Expo and distributed as a native app for Android and iOS, plus an installable web app for the browser.

### Android (APK / Play Store)

[Download the latest APK](https://github.com/raiz-toff/CommaApp/releases/latest) from GitHub Releases, or install from the Play Store listing when available. For direct APK installs you may need to allow installation from unknown sources ("Install unknown apps").

### iOS

Install from the App Store listing or run locally via Expo Go / a development build (see [Development Setup](../development/setup.md)).

### Web (PWA)

No install needed — open [comma-psi.vercel.app](https://comma-psi.vercel.app) in a modern browser, and optionally install it to your home screen or desktop. See [Web App (PWA)](../features/web-app.md).

---

## First launch — Onboarding Wizard

The first time you open Comma you'll be walked through a short setup wizard. It takes about 60 seconds.

### Step 1 — Choose your country

Comma uses your country to load the correct tax rules (mileage rates, self-employment tax brackets, currency symbol). You can change this later in Settings.

Supported: 🇺🇸 United States · 🇨🇦 Canada · 🇬🇧 United Kingdom · 🇳🇵 Nepal

### Step 2 — Select your platforms

Pick the gig platforms you work on. This controls which platforms appear in the shift creation screen and analytics filters.

You can add or remove platforms anytime from **Settings → Platforms**.

### Step 3 — Add your vehicle

Enter a name (e.g. "My Honda"), type (car / bike / scooter / van), and optionally the make, model, and year. Comma uses your vehicle for mileage logs and tax calculations.

You can add multiple vehicles and switch between them per shift.

### Step 4 — Set a mileage rate (optional)

Comma pre-fills the IRS standard mileage rate for the current year. If you're using actual expenses instead of the standard rate, change this in **Tax Center → Vehicle Tax Profile**.

---

## Log your first shift

### Option A — Live shift with GPS tracking (recommended)

1. Tap the **Start Shift** button at the bottom of the Dashboard.
2. Choose your platform for this shift.
3. Choose your vehicle.
4. Optionally set a target time (Comma will alert you when time is up).
5. Tap **Start** — the app starts the GPS tracker and a live timer.

While the shift is running:
- The **clock overlay** shows elapsed time and live earnings.
- Tap **First Order Received** when you pick up your first delivery — Comma switches from dead miles (commute) to active miles.
- Tap **Pause** if you take a break — paused time is excluded from your hourly rate.
- Tap **End Shift** when you're done. You'll be prompted to enter final earnings and tips.

### Option B — Log a past shift manually

If you forgot to start Comma before heading out:

1. Tap **Log Past Shift** at the bottom of the Dashboard.
2. Enter the start and end time.
3. Enter earnings, tips, and mileage (or leave mileage blank if you don't know).
4. Tap **Save**.

You can edit any field later from the Shifts list.

---

## Set up a weekly goal (optional)

Tap the **Goals** section on the Dashboard to set a weekly earnings or hours target. Comma shows your progress as a donut chart and unlocks the streak tracker once you hit your first goal.

---

## Next steps

- [Shift Tracking](../features/shift-tracking.md) — Full details on GPS tracking, pausing, reconciliation
- [Expenses](../features/expenses.md) — Log your first fuel fill-up
- [Tax Center](../features/tax-center.md) — See your running self-employment tax estimate
- [Google Drive Backup](../backup-and-sync/google-drive-backup.md) — Protect your data
