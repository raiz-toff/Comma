# Changelog

All notable changes to Comma are documented here.

## [1.4.0] — 2026-07-12 (versionCode 8)

### Added
- **Tap a shift to see its details (web)**: tapping a shift — from the dashboard's recent list or the Shifts screen — now opens a full detail view (net earnings, hourly rate, distance, the per-platform and mileage breakdowns, notes and any linked expenses), like the phone app, instead of dropping you straight into the edit form. Edit and delete are one tap away from there.
- **Delivery logos in Recent activity (web)**: the dashboard's recent-shifts list now shows each app's logo instead of a plain letter.
- **Comma fits a tablet now.** It was built for a phone, and on a big screen it showed: cards stretched the full width, and a line of text ran so far across that you lost your place in it. Now the page holds a comfortable width and sits centred, and on a wide screen the Analytics cards sit two side by side instead of one enormous one. Your phone is untouched — none of this happens below tablet width. Rotating, unfolding, or dropping Comma into a split-screen now re-lays the page out properly rather than leaving it stuck at whatever size it started.
- **Light mode**: Comma can now be light. It always follows your phone's own setting — set your phone to dark for a night shift and Comma goes dark with it, no configuring required. It fades rather than snapping, so switching themes at night doesn't put a screenful of white in your eyes. Your route maps switch over too, so a light screen no longer wraps a dark map.
- **Filter by vehicle (app + web)**: if you drive more than one vehicle, the same switcher that already filters by delivery platform now filters by vehicle too, on Home, Shifts and Analytics — all of them, a few, or just one. When you only have one platform and one vehicle there's nothing to pick, so the switcher collapses to a plain readout instead of an empty menu.

### Changed
- **One typeface with the docs (web)**: the app's body and interface text now use Inter — the same face as the Comma docs site — so the app and the docs read as one product. Headlines keep their serif and money keeps its mono.
- **Bigger and comfier out of the box (web)**: new installs now start at the XL text size and comfortable spacing, and your size/density choice is applied the moment the app opens rather than only after you first visit Settings.
- **Saved-confirmations match your accent (web)**: the little "Saved" pop-ups now take on whatever accent colour you picked in Appearance, instead of always being green.
- **Clearer first-run choices (app + web)**: the welcome screen's three options now read as a ladder — **Get started**, then **Try demo first** as an outlined button, then a quieter **Restore or sync existing data** set apart below — instead of one button over two look-alike links.
- **Readable nav dividers in dark mode (web)**: the side navigation's group dividers were nearly invisible on the dark theme; they're legible now.
- **Cleaner Profile settings (web)**: dropped the "Avatar emoji" field — the web app shows your initials, and that emoji was never displayed anywhere, so it just sat there doing nothing. Your display name now spans the card on its own.
- **Tidier Appearance settings (web)**: the Interface card's controls were laid out unevenly — Theme, Font size, Layout density and a fullscreen button all crammed into one grid that arranged them raggedly. Theme now sits on its own row, Font size and Layout density line up as a neat pair, and "Toggle fullscreen" moved down beside Save where it reads as the action it is, not a setting you have to save.
- **Tidier Tax page (web)**: the tax screen used to be a stack of seven fold-out sections you had to dig through to find anything. It now opens on the two numbers that actually matter — what you've set aside for taxes, and what you're estimated to owe — with your next payment date on a single line beneath them, just like the phone app. Everything else (the full income-and-obligations breakdown, your mileage write-off, all the payment dates and your savings settings) is still there, folded into one "Full breakdown" you open when you want the detail. Dropped the tax-form worksheets that only listed the box names on a CRA or IRS form and never your own numbers.
- **Simpler Support & Feedback page (web)**: dropped the wall of diagnostic system info that used to sit at the bottom of the page — it's still attached quietly to support emails, just no longer cluttering the screen. Added a Help & Docs card linking straight to the FAQ, so you can check for an answer before filing a bug.
- **Pure black-and-white look (web)**: dark mode is now true black and light mode clean white, instead of the warmer charcoal-and-cream it shipped with. One palette drives every screen, so pages no longer drift in tone as you move between them — and the date and time pickers follow the theme now instead of staying dark on a light page.
- **Tidier Reports page (web)**: the reports screen used to lay everything out at once — period picker, a section-toggle grid, the report, a share card and a wall of export buttons all at once. It now reads top to bottom: pick a period, see the report, then a Year-in-Review card and one grouped Export & share panel. The date and platform filters only appear when the period needs them, and the print-section toggles tuck into a "Customize printed report" you open when you want them.
- **No more scrollbars (web)**: scrollbars are hidden throughout — panels, sheets and lists still scroll, they just no longer show the chrome.
- **Emptier toolbar tucks away (web)**: on a wide screen, when you run only one platform and one vehicle there is nothing to switch, so the strip that held those switchers no longer takes up space above the page.
- **Pick more than one platform to filter by (web)**: the platform switcher only ever let you look at one app at a time, or all of them. Now it works the way the phone app does — tap to add a second, tap again to drop it, and see DoorDash and Uber Eats together without Skip in the mix. The vehicle switcher works the same way.
- **App-grade interactions everywhere (web)**: the whole app now behaves like a native app. Swipe a shift, expense, vehicle or notification for its actions; pickers and forms open as bottom sheets you can drag, snap and flick away; confirms are proper dialogs, toasts and toggles feel like the ones on your phone. Same look, same speed — new touch.
- **Dashboard checklist opens a focused screen, not the general Settings (web)**: "Add your other apps," "Tell us your real vehicle" and "Set a weekly goal" now each open one small screen that does exactly that job and returns you to the dashboard — matching how the phone app already works — instead of dropping you into Settings, Vehicles or Goals to hunt for the right spot.
- **Livelier welcome screen (web)**: the logo now sits inside a slowly turning ring — *every dollar · every kilometre · every write-off* — and the headline names your work the way your app does, cycling through shift, dash, block, batch and week. Both settle into stillness if your device asks for reduced motion.

### Fixed
- **A restored phone now asks for location.** Restoring your vault onto a new phone left that phone with no location access — Comma saw the restored setup, decided you were already sorted, and never asked. But a location permission belongs to a *phone*, not to a backup: it cannot travel in your vault. The cost was invisible. Tracking would stop the moment you switched to your delivery app, so shifts logged short and you under-claimed the write-off, with nothing on screen to suggest anything was wrong. A phone that has never been asked is now asked, once.
- **No more Google sign-in prompts on every open (web)**: the app kept its Drive session only in memory and tried to re-authenticate itself on every launch, which threw the Google login screen at you on each open or reload. The session now survives reloads, and the app never asks to sign in on its own — only when you tap a sync or backup action yourself.
- **Tapping some icon buttons silently did nothing (web)**: a few icon-only buttons weren't registering taps at all. They respond now.
- **Janky arrow navigation on Expenses and Analytics (web)**: paging between weeks/months with the arrow buttons stuttered. Now smooth.
- **Bottom sheets on desktop (web)**: sheets no longer hide their own footer, and sheets whose content is taller than the screen now scroll instead of clipping.
- **Multi-vehicle drivers got the wrong mileage write-off and earnings (app + web)**: mileage was totalled across every vehicle and then had one vehicle's rate applied to all of it, and a car expense (fuel, insurance) logged the same week as a bike-only shift was silently deducted from that shift's earnings. Mileage now resolves each vehicle's own rate against only the distance it drove, and an expense only counts against a vehicle you actually used in that period.

## [1.3.1] — 2026-07-12 (versionCode 7)

### Added
- **Over-the-air updates**: builds now carry the `production` update channel, so JS-only fixes and improvements arrive automatically on next app launch — no store update or reinstall needed. Native changes still ship as regular releases.

### Fixed
- **Invisible text in release builds**: the experimental Metro tree-shaking used for 1.3.0 stripped NativeWind's runtime styles, leaving most text unreadable in the production APK (debug builds were unaffected). Tree-shaking is permanently disabled for release builds. (The 1.3.0 download was replaced in-place with a fixed build; 1.3.1 supersedes both.)
- **Web app reported the wrong version**: the web app still identified itself as 1.3.0 — in its "What's New" panel and in the version line attached to support requests — and that panel still described features from an older release. It now reports 1.3.1 and describes what actually shipped: two-step setup, one-tap cloud sync, optional end-to-end encryption, and the redesigned interface.

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
