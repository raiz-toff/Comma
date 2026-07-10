# COMMA — Changelog

All notable changes to the COMMA project will be documented in this file.

## [1.3.0] - 2026-05-17

### Added

- **High-Accuracy Geolocation Tracker (`GPSTracker`)**: Custom background GPS tracking engine using Haversine calculation, featuring stationary low-noise jitter filter ($< 10\text{m}$) and speed telemetry filter ($> 150\text{ km/h}$).
- **First Order / Dead Miles Split**: Interactive "Got First Order" checkered flag action in the circular active timer overlay to dynamically partition dead commute miles from active delivery miles.
- **Two-Tone Theming**: Responsive amber/yellow (`#f59e0b`) glow and dial ring theme while waiting for the first order, transitioning smoothly to native platform brand coloring (e.g. DoorDash red) once active tracking starts.
- **End-Shift Form Integration**: Seamlessly pre-populates the Total Distance and Dead Miles fields inside the stop shift form parsed automatically into the user's active units (`mi` or `km`).

### Changed

- Refined circular clock overlay layout and spacing, upgrading typography to Outfit sans-serif (`var(--font-body)`) for a premium native look.
- Enhanced top floating shift status bar with a subtle skull emoji (`💀`) when running in dead-miles mode.

### Fixed

- **Pause-State Geolocation Watcher Guard**: Implemented bulletproof `localStorage` verification that ignores GPS coordinates when the shift is paused or stopped, preventing phantom mileage accumulation.
- **White Mode High-Contrast Contrast**: Restructured hardcoded text and container styling in [shell.js](file:///home/coder/Production/macadam_web/src/core/shell.js) with semantic design system CSS variables, ensuring perfect legibility in both light and dark modes.

## [1.2.0] - 2026-05-16

### Added

- **Google Drive Backup Suite**: Secure, local-first cloud synchronization.
- **Resilient Authentication**: Silent token renewal and concurrent request management for Drive API.
- **Vault Branding**: Integrated custom "Vault" and "Google Drive" iconography across the UI.
- **Demo Mode Safety**: Added strict guards to prevent sample data from overwriting cloud backups.
- **Changelog System**: Automatic "What's New" prompts for version updates.
- **Privacy Policy**: Dedicated, self-hosted privacy documentation for Google verification.

### Changed

- Refined Onboarding landing page with clearer purpose and footer links.
- Updated Google OAuth Client ID to production credentials.
- Improved Settings layout with better iconography and spacing.

### Fixed

- Resolved translation key mismatches in backup alerts.
- Fixed layout "jitter" when exiting Demo Mode.

## [1.1.0] - 2026-05-15

### Added

- **Partial Data Import**: Import shifts, expenses, and incomes separately.
- **CSV Import Guide**: Centralized documentation for data migration.
- **Internationalization (i18n)**: Full French translation support.

### Changed

- Rebranded project from "Macadam" to "COMMA".
- Updated file extensions to `.comdb` for vault backups.

---

*For older changes, see the git commit history.*
