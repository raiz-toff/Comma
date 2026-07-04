# Changelog

All notable changes to Comma are documented here.

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
