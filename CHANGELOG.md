# Changelog

All notable changes to Comma are documented here.

## [1.3.1] — 2026-07-12 (versionCode 7)

### Added
- **Over-the-air updates**: builds now carry the `production` update channel, so JS-only fixes and improvements arrive automatically on next app launch — no store update or reinstall needed. Native changes still ship as regular releases.

### Fixed
- **Invisible text in release builds**: the experimental Metro tree-shaking used for 1.3.0 stripped NativeWind's runtime styles, leaving most text unreadable in the production APK (debug builds were unaffected). Tree-shaking is permanently disabled for release builds. (The 1.3.0 download was replaced in-place with a fixed build; 1.3.1 supersedes both.)

## [1.3.0] — 2026-07-12 (versionCode 5)

### Added
- **Redesigned first-run welcome gate** (app + web): one calm screen — headline, one-line promise, a single "Get started" button, with demo and restore as quiet links. The web version drops the marketing scroller (screenshots, feature sections) and now mirrors the app. Privacy Policy links to the docs site.
- **2-step onboarding**: setup is now just *where you drive* → *your last shift*, ending in the reveal of what that shift was really worth. Everything else (name, vehicle, goals, theme, sync) is defaulted and offered later by a dashboard checklist.
- **One-tap cloud sync**: connecting Google Drive is enough — no sync password required by default. End-to-end encryption stays available as an opt-in toggle, and joining from a device with E2E on prompts for that device's password.
- **Pluggable country registry**: adding a country is now a single registry file per platform (Canada, US, UK, Nepal shipped) — currency, units, tax and mileage rules all flow from it.

### Changed
- **Design-system pass across the app**: dark tokens are now the runtime default and every screen was remediated to use them (surfaces, hairlines, semantic colors — no invented hexes or shadows).
- **Performance**: long lists virtualized, R8 + resource shrinking enabled, Metro tree-shaking on (JS bundle 6.78 → 5.34 MB), and PBKDF2 key derivation moved off the UI thread.
- Clearer GPS tracking permission prompt on first shift start.

## [1.2.1] — 2026-07-07 (versionCode 4)

### Added
- **Vehicle-type-aware mileage write-off with opt-out**: onboarding now asks whether the mileage tax write-off applies to your vehicle, lets you set a custom rate, or opt out entirely — seeded into a per-vehicle, per-tax-year profile. Absent a saved profile, the researched default now depends on vehicle type (a bicycle/e-bike/scooter isn't eligible for the IRS/CRA automobile mileage rate) instead of a flat country rate.
- **Analytics tab redesign**: consolidated from 21 single-purpose widgets down to 6 grouped cards (Trends, Work Rhythm, Income Sources, Outlook, Efficiency & Stability, Order Economics), each grouping widgets that answer the same underlying question. The Avg Rate, Expenses, and Tax Set-Aside stat cards are now tap-to-expand for the detail that used to need its own card.

### Changed
- **Mileage write-off no longer reduces "earned" totals**: it's a tax estimate, not real money, so it's shown as a separate note (home screen, shift detail, tax center) instead of being subtracted from gross/net earnings everywhere.
- **Tax Center calculation order fix**: the mileage deduction now reduces taxable income *before* pension/self-employment-tax/state-tax are computed, so it actually flows into the total estimated tax instead of being calculated and silently discarded.
- Clearer tax deadline and obligation labels (e.g. "Yearly Tax Return Due" instead of "Self-Employed Filing", "Pension Plan"/"Self-Employment Tax" instead of "CPP"/"SE Tax").

## [1.2.0] — 2026-07-04 (versionCode 3)

### Added
- **Profile sync**: new `profile` table with a two-way bridge (`profileBridge.ts`) that syncs local profile settings to the cloud-synced database. Only changed values are written, keeping sync payloads minimal.
- **First-sync backfill**: SQL migration (`0021_first_sync_backfill`) that backfills `sync_updated_at` for historical records across tables so existing data participates in sync.
- **Local backup/restore service** (`backupFile.ts`): export and restore data via local JSON files for safe, offline data management.
- **New home-screen / dashboard widgets**:
  - Deliveries (completed orders count)
  - Effective Rate (effective vs. average rate)
  - Hours Compare (active vs. online hours with efficiency tiers)
  - Month Hourly (hourly rate + tier for the current month)
  - Month Orders (monthly order count + daily average)
  - Out of Pocket (expenses as a % of gross earnings)
  - Per Delivery (earnings per delivery)
  - Recent Shifts (recent shifts with revenue detail)
  - Scatter (hours worked vs. gross earnings correlation)
  - Schedule (upcoming shifts placeholder)
  - Stability Score (stability score + weekly gross trend)
  - Tips Total (total tips + % of earnings)
  - Week Compare (this week vs. last week)
  - Zero Days (zero-earning days with performance feedback)
- **Shift bonus amount**: new field and migration (`0020_shift_bonus_amount`) to track bonuses on shifts.

### Changed
- Web/mobile interop hardening from the 2026-07-03 audit: dual-key shape layer, tombstone handling, and quarantine of malformed synced records (see `app/docs/web-mobile-interop-audit-2026-07-03.md`).
- Refined analytics, shift, and goal queries to support the new sync state and widgets.
- Onboarding wizard and steps updated.
- Backup settings screen reworked to support the new local backup/restore flow.

### Removed
- Removed the standalone Next.js web package and its configuration (moved out of this app's build).

## [1.1.0] — versionCode 2

- Cloud Sync UX fixes, notification-sound fixes during active recording, demo-mode improvements, and dead-mileage summary. (See git history for details.)
