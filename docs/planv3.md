# MACADAM — Final Build Plan v3.0
### Everything decided. Nothing contradicted. Ready to code.
#### Supersedes all previous plan documents.

---

## WHAT THIS PLAN REFLECTS

Every architectural decision made across all planning sessions:
- esbuild + Vanilla JS + Hash router
- Registry pattern for everything
- Location-first onboarding (Country → Province → Platform)
- Ontario as the template province, fully researched
- CRA standard mileage removed — self-employed use actual costs only
- Zones removed entirely
- Dead miles as a static field on the shift form
- Money stored as integers (cents)
- Dates stored as YYYY-MM-DD strings
- Province stored on every shift record
- Generic terms + i tooltip for multi-platform onboarding
- Platform selection first on shift form — form adapts
- Backup versioned from day one
- Recurring expenses: confirm before trigger, only when due
- Service worker: static assets only, never touches data

---

## TECH STACK

| Concern | Choice |
|---|---|
| Bundler | esbuild (node build.js) |
| Language | Vanilla JS ES2022 modules |
| CSS | Vanilla CSS + custom properties |
| Router | Hash router (#/dashboard) |
| Database | Dexie.js (IndexedDB wrapper) |
| Charts | Chart.js |
| Dates | Day.js + duration + relativeTime plugins |
| CSV | Papa Parse |
| Search | Fuse.js |
| Drag & Drop | Sortable.js |
| Celebrations | canvas-confetti |
| Screenshots | html2canvas |
| QR Codes | qrcode-generator |
| Service Worker | Hand-written (~60 lines) |

All libraries vendored in `/src/libs/` — zero CDN dependency at runtime.

---

## MONEY & DATE RULES (NON-NEGOTIABLE)

```
MONEY:  Always stored as integers (cents). $84.50 → 8450
        Display layer converts. Never floats in the DB.
        Reason: 0.1 + 0.2 = 0.30000000000004 breaks financial summaries.

DATES:  Always stored as "YYYY-MM-DD" strings. Never timestamps for business dates.
        Reason: Timestamps drift with timezones. "Dec 31" must always be Dec 31.

PROVINCE: Stored on every shift record (shift.provinceId = 'ON').
        Reason: If user moves to BC, Ontario historical shifts must use Ontario HST rates.
```

---

## FILE STRUCTURE

```
macadam/
├── package.json
├── build.js                        ← esbuild config (dev + prod)
├── generate-sw-manifest.js         ← auto-generates cache file list after build
│
├── src/
│   ├── main.js                     ← entry point
│   │
│   ├── core/
│   │   ├── router.js               ← hash router
│   │   ├── db.js                   ← Dexie schema + all tables + migrations
│   │   ├── store.js                ← reactive pub/sub state
│   │   └── events.js               ← app-wide event bus + event constants
│   │
│   ├── registry/                   ← THE REGISTRY LAYER (never hardcode in engine)
│   │   ├── platforms/
│   │   │   ├── _TEMPLATE.platform.js
│   │   │   ├── doordash.platform.js
│   │   │   ├── ubereats.platform.js
│   │   │   ├── foodora.platform.js
│   │   │   ├── skip.platform.js
│   │   │   ├── instacart.platform.js
│   │   │   ├── amazonflex.platform.js
│   │   │   └── index.js            ← PlatformRegistry
│   │   ├── countries/
│   │   │   ├── _TEMPLATE.country.js
│   │   │   ├── CA.country.js
│   │   │   └── index.js            ← CountryRegistry
│   │   ├── provinces/
│   │   │   ├── CA/
│   │   │   │   ├── _TEMPLATE.province.js
│   │   │   │   └── ON.province.js   ← reference (Canada)
│   │   │   ├── US/
│   │   │   │   ├── _usStateProvince.js
│   │   │   │   ├── AL.province.js … (one file per state + DC)
│   │   │   │   └── …
│   │   │   └── index.js            ← ProvinceRegistry
│   │   ├── widgets/
│   │   │   ├── _TEMPLATE.widget.js
│   │   │   ├── [all widget files]
│   │   │   └── index.js            ← WidgetRegistry
│   │   ├── notifications/
│   │   │   ├── _TEMPLATE.notification.js
│   │   │   ├── [all notification files]
│   │   │   └── index.js            ← NotificationRegistry
│   │   ├── badges/
│   │   │   ├── _TEMPLATE.badge.js
│   │   │   ├── [all badge files]
│   │   │   └── index.js            ← BadgeRegistry
│   │   ├── metrics/
│   │   │   ├── _TEMPLATE.metric.js
│   │   │   ├── [all metric files]
│   │   │   └── index.js            ← MetricRegistry
│   │   ├── reports/
│   │   │   ├── _TEMPLATE.report-section.js
│   │   │   ├── [all report section files]
│   │   │   └── index.js            ← ReportRegistry
│   │   ├── shift-fields/
│   │   │   └── index.js            ← ShiftFieldRegistry (global fields)
│   │   ├── expense-categories/
│   │   │   └── index.js            ← ExpenseCategoryRegistry
│   │   └── goal-types/
│   │       └── index.js            ← GoalTypeRegistry
│   │
│   ├── utils/
│   │   ├── formatters.js           ← currency, date, distance, duration display
│   │   ├── calculations.js         ← earnings, vehicle costs, tax, business-use %
│   │   ├── locale.js               ← country/province config resolver
│   │   └── strings.js              ← ALL user-facing text (i18n-ready from day one)
│   │
│   ├── ui/
│   │   ├── components.js           ← modal, toast, FAB, drawer, progress ring, etc.
│   │   ├── charts.js               ← Chart.js wrappers
│   │   └── icons.js                ← SVG icon registry
│   │
│   ├── modules/
│   │   ├── onboarding/
│   │   │   ├── onboarding.js       ← orchestrator
│   │   │   └── steps.js            ← each step as a render function
│   │   ├── platforms/
│   │   │   ├── platforms.js        ← platform CRUD + switcher
│   │   │   └── platform-specific.js← platform-specific fields + analytics
│   │   ├── shifts/
│   │   │   ├── shifts.js           ← shift CRUD + timer + templates + import
│   │   │   └── shift-form.js       ← form renderer (platform-first, adapts)
│   │   ├── expenses/
│   │   │   ├── expenses.js         ← expense CRUD + auto-generation + recurring
│   │   │   └── expense-form.js     ← form renderer (province-driven categories)
│   │   ├── analytics/
│   │   │   ├── analytics.js        ← all aggregation queries + calculations
│   │   │   └── analytics-charts.js ← chart rendering for analytics views
│   │   ├── tax/
│   │   │   └── tax.js              ← tax dashboard, HST, CPP, T2125 helper
│   │   ├── vehicles/
│   │   │   └── vehicles.js         ← vehicle CRUD + maintenance + business-use %
│   │   ├── goals/
│   │   │   └── goals.js            ← goals, badges, XP, streaks, challenges
│   │   ├── reports/
│   │   │   └── reports.js          ← CSV/JSON export, print, QR, year-in-review
│   │   ├── search/
│   │   │   └── search.js           ← Fuse.js + filter panels + saved filters
│   │   ├── notifications/
│   │   │   └── notifications.js    ← engine: reads NotificationRegistry
│   │   ├── schedule/
│   │   │   └── schedule.js         ← calendar views, planning mode
│   │   └── settings/
│   │       └── settings.js         ← all settings, danger zone, debug mode
│   │
│   ├── views/                      ← one file per route
│   │   ├── dashboard.js
│   │   ├── shifts-view.js
│   │   ├── analytics-view.js
│   │   ├── tax-view.js
│   │   ├── vehicles-view.js
│   │   ├── schedule-view.js
│   │   ├── goals-view.js
│   │   ├── reports-view.js
│   │   ├── settings-view.js
│   │   └── onboarding-view.js
│   │
│   ├── css/
│   │   ├── tokens.css              ← ALL CSS custom properties
│   │   ├── reset.css
│   │   ├── themes.css              ← light/dark/auto
│   │   ├── components.css          ← all reusable component classes
│   │   ├── layout.css              ← bento grid, app shell, sidebar, nav
│   │   ├── animations.css          ← keyframes, reduced-motion overrides
│   │   └── views/                  ← per-view stylesheets
│   │
│   └── libs/                       ← vendored, never CDN
│       ├── dexie.min.js
│       ├── chart.min.js
│       ├── dayjs.min.js
│       ├── dayjs-duration.min.js
│       ├── dayjs-relativetime.min.js
│       ├── papaparse.min.js
│       ├── fuse.min.js
│       ├── sortable.min.js
│       ├── confetti.min.js
│       ├── html2canvas.min.js
│       └── qrcode.min.js
│
├── public/
│   ├── index.html
│   ├── manifest.json
│   ├── sw.js
│   ├── sw-manifest.js              ← AUTO-GENERATED by build
│   ├── icons/
│   └── avatars/                    ← 12 built-in SVG avatars
│
└── dist/                           ← esbuild output (git-ignored)
```

---

## SERVICE WORKER RULE

```
SW caches:   index.html, bundle.js, style.css, all /libs/, all /assets/
SW never:    touches IndexedDB, intercepts data reads, caches POST requests

Strategy:    Cache-first for shell assets
             On activate: wipe old cache versions
             On install: pre-cache entire sw-manifest.js list

IndexedDB:   Lives entirely in browser storage
             Dexie talks directly to IDB engine
             SW never sees it — by design
```

---

## ROUTING TABLE

```
#/                    → redirect to #/dashboard (or #/onboarding if not set up)
#/onboarding          → OnboardingView
#/dashboard           → DashboardView
#/shifts              → ShiftsView
#/shifts/new          → ShiftsView (quick-add drawer open)
#/analytics           → AnalyticsView
#/analytics/week      → AnalyticsView (week tab active)
#/tax                 → TaxView
#/vehicles            → VehiclesView
#/schedule            → ScheduleView
#/goals               → GoalsView
#/reports             → ReportsView
#/search              → SearchView
#/settings            → SettingsView
#/settings/about      → SettingsView (about tab)
#/about               → AboutView (data portability manifesto)
#/print               → PrintView
```

---

## ONBOARDING FLOW (REDESIGNED)

```
STEP 1 — Country Selection
  Show: Canada (active), others greyed out with "Coming soon"
  Stores: user.countryId = 'CA'
  Drives: currency (CAD), distance unit (km), date format

STEP 2 — Province Selection
  Show: Grid of all Canadian provinces
  Only show: Ontario for now (others greyed out "Coming soon")
  Stores: user.provinceId = 'ON'
  Drives: HST rate, available platforms, expense categories,
          tax deadlines, CPP rules, onboardingExtras injection

STEP 3 — Platform Selection
  Show: Only platforms from ProvinceRegistry.getAvailablePlatforms('ON')
        (DoorDash, Uber Eats, Skip, Foodora, Instacart, Amazon Flex)
  Multi-select. At least one required.
  Stores: user.platforms[]
  Terminology: If 1 platform selected → use that platform's terms
               If 2+ platforms selected → use generic terms throughout

STEP 4 — Driver Name + Avatar
  Display name input
  Avatar grid (12 SVG options) or custom upload
  Stores: user.displayName, user.avatarType, user.avatarData

STEP 5 — Vehicle Setup
  Vehicle type picker (Gas, Hybrid, EV, Motorcycle, Bicycle, E-Bike, Scooter, Walking)
  Gas/Hybrid: fuel efficiency (L/100km), current fuel price
  EV: kWh/100km, electricity rate
  Bike/E-Bike: maintenance cost per km
  All types: nickname field
  Province note shown if relevant (Ontario e-bike insurance note)
  Stores: vehicles table record

STEP 6 — Work Schedule Preference
  Full-Time / Part-Time / Side Hustle / Seasonal
  Drives: dashboard density (full-time = weekly KPIs prominent,
          side hustle = per-shift summaries)
  Stores: user.workSchedule

STEP 7 — Earnings Goals
  Weekly goal (numeric, large input)
  Live label: "That's $X/hr if you work 20 hrs"
  Monthly auto-populated (weeklyGoal × 4.33, editable)
  Annual auto-populated (monthly × 12, editable)
  Stores: user.weeklyGoal, user.monthlyGoal, user.annualGoal

STEP 8 — Tax Setup
  Tax withholding % (default 27% for Ontario — from ON.province.js)
  Province/territory pre-filled, editable
  [INJECTED BY ON.province.js onboardingExtras]:
    HST Registration toggle
    Info: "Required if you earn $30,000+ in any 4 consecutive quarters"
  Stores: user.taxWithholdingPct, user.hstRegistered

STEP 9 — Preferences
  Theme: Light / Dark / Auto
  Distance unit: km (pre-filled from province, editable)
  Date format (pre-filled from country, editable)
  Week start: Monday / Sunday
  Notification preferences (per type)
  Stores: user.theme, user.locale preferences

STEP 10 — Completion
  Animation: road-opening or confetti
  "Your Vault is Ready, [Name]"
  Two options: "Start Logging" → #/shifts/new
               "Take a Tour" → loads sample data, shows populated dashboard

ONBOARDING RULES:
  - "Try Demo First" link on every step → demo mode, no data saved
  - Progress saved to sessionStorage on every step
  - On re-open: "Continue" or "Start Over"
  - Generic terminology used throughout (i tooltip shows platform equivalents)
  - No zone/home base step (removed)
  - No currency selection (derived from country)
```

---

## THE "i" TOOLTIP RULE

```
In onboarding and multi-platform views:
  - Generic terms used everywhere
  - "i" icon appears ONLY on terms that genuinely differ between platforms

Terms that get an "i":
  - Driver (Dasher / Courier / Rider)
  - Bonus / Incentive Pay (Peak Pay / Surge / Boost)
  - Delivery / Order (order / trip / batch)

Terms that do NOT get an "i":
  - Tips, Earnings, Distance, Hours — universal

The tooltip reads each active platform's terminology from platform-config
and lists them: "DoorDash → Peak Pay | Uber Eats → Surge"

In single-platform views (shift form for one platform):
  Use that platform's exact terms. No "i" needed.
```

---

## SHIFT FORM FIELD ORDER

```
1. Platform (dropdown — FIRST, form adapts below based on selection)
2. Date (calendar picker, defaults today)
3. Start Time + End Time → auto-calculate duration
4. [SHIFT TIMER SHORTCUT: if timer was running, pre-fill start/end]

--- EARNINGS SECTION ---
5. Gross Earnings (large numeric keypad)
6. Tips Earned (separate field)
7. Bonus / Incentive (label from platform terminology)
8. [Platform-specific custom fields from platform.customShiftFields[]]
   (e.g., DoorDash shows Peak Pay Amount and Acceptance Rate fields)

--- DELIVERY SECTION ---
9. Number of Deliveries / Orders
10. Distance Driven (km — business km for this shift)
11. Dead Miles (static field — distance to first pickup / unloaded km)

--- TIME SECTION ---
12. Online Time (minutes app was open)
13. Active Time (minutes actually delivering)

--- CONTEXT SECTION ---
14. Vehicle Used (dropdown of saved vehicles)
15. Weather Condition
16. Mood Tag
17. Shift Notes

FORM MODES:
  Quick (FAB drawer): Fields 1–5 only + "More Fields" expander
  Full: All fields above
  Both modes: Live earnings/hr calculation shown as user types
```

---

## EXPENSE FORM RULES

```
- Categories driven by ProvinceRegistry (ON.province.js expenseCategories)
- Each category shows its CRA line reference for Ontario users
- Business-use % slider shown on mixed-use expenses (phone, vehicle insurance)
- Vehicle-type-specific categories only shown if user has that vehicle
  (e.g., bike maintenance only shown if user has bicycle or e-bike)
- Receipt photo attachment (compressed base64 in IndexedDB)
- Recurring toggle: monthly / annual / weekly
  When due: app shows "confirm this expense was paid" before creating record
- HST field shown ONLY if user.hstRegistered === true
- NOT shown in expense form: personal expenses, fines, clothing
  (non-deductible categories listed as info/warnings if user tries to add them)
```

---

## VEHICLE EXPENSE / BUSINESS-USE % CALCULATION

```
Self-employed gig workers use ACTUAL COSTS method only.
CRA standard mileage rate does NOT apply.

What the app tracks:
  - Business km per shift (logged on shift form)
  - Total km driven all purposes (odometer log, periodic entry)
  - All actual vehicle expenses (fuel, insurance, maintenance, etc.)

What the app calculates:
  business-use % = (sum of business km) ÷ (total odometer km) × 100
  deductible amount = expense amount × business-use %

Displayed clearly on:
  - Vehicle dashboard: "Your vehicle is X% business use this year"
  - Tax dashboard: "Estimated deductible vehicle expenses: $X"
  - Each expense card: shows deductible portion alongside total

REMOVED features (were in original plan, not applicable):
  ✗ CRA mileage deduction calculator
  ✗ Standard vs actual comparison
  ✗ IRS mileage rate (will be added in US province files when relevant)
```

---

## PHASE 1 — FOUNDATION
### Complete ALL tasks before Phase 2. Order matters where noted.

---

### F1 — Project Scaffold & Build System
**Depends on:** Nothing. First task.

1. Full folder structure as defined above (all dirs + placeholder files)
2. `package.json` — devDependencies: esbuild only. All runtime libs vendored.
3. Download all 10 vendor libraries into `src/libs/`
4. `build.js` — esbuild script:
   - Dev: watch mode, copy public/ → dist/, CSS concat, run sw-manifest after each build
   - Prod: minify JS, no sourcemaps, output hash for cache busting
   - CSS concat order: reset → tokens → themes → components → layout → animations → views/*
   - Post-build hook: `generate-sw-manifest.js`
5. `generate-sw-manifest.js` — scans dist/, writes `dist/sw-manifest.js`
   - Exports array of all asset paths to pre-cache
   - Includes build version hash for cache naming
6. `public/index.html` — minimal app shell:
   - `<script>` in `<head>` applies theme from localStorage (prevents FOUC — 3 lines)
   - `<link rel="stylesheet" href="style.css">`
   - `<div id="app"></div>`
   - `<div id="toast-container"></div>`
   - `<div id="modal-overlay"></div>`
   - `<script src="bundle.js" defer></script>`
   - All PWA meta tags, apple-mobile-web-app-capable
7. `.gitignore` — dist/, node_modules/
8. `npm run dev` must build without errors before this task is complete

---

### F2 — Service Worker & PWA Shell
**Depends on:** F1

1. `public/sw.js` — hand-written, ~60 lines:
   ```
   importScripts('./sw-manifest.js')  // gets CACHE_FILES array
   const CACHE_NAME = 'macadam-shell-' + CACHE_VERSION  // CACHE_VERSION from sw-manifest

   install:  cache all CACHE_FILES, skipWaiting()
   activate: delete caches not matching CACHE_NAME, clients.claim()
   fetch:    GET only → cache-first → miss → network → store → return
             non-GET → pass through untouched
             cross-origin → pass through untouched
   ```
2. SW registration in `src/main.js`:
   - Only if `'serviceWorker' in navigator`
   - On updatefound: store new worker ref, show "App updated" banner when ready
3. `public/manifest.json` — full PWA manifest:
   - name: "Macadam", short_name: "Macadam"
   - start_url: "./#/dashboard", scope: "./"
   - display: "standalone"
   - theme_color: matches `--color-brand` token
   - icons: 192, 512, maskable variants
   - shortcuts: "Log Shift" → `#/shifts/new`, "This Week" → `#/analytics/week`, "Export" → `#/reports`
4. `beforeinstallprompt` capture in `src/main.js`
5. Standalone detection → `document.documentElement.dataset.installed = 'true'`
6. SVG placeholder icons (192×192 and 512×512) in `/public/icons/`

**Features:** 239, 240, 242, 243, 250

---

### F3 — Design System & CSS
**Depends on:** F1

1. `src/css/reset.css` — modern CSS reset
2. `src/css/tokens.css` — ALL custom properties:
   - Color primitives + platform brand colors
   - Semantic color tokens (overridden by dark theme)
   - Spacing scale (--space-1 through --space-16)
   - Typography (--font-display, --font-body, --font-mono + size scale)
   - Border radii, shadows, transitions, z-index layers
   - Platform colors: DoorDash #FF3008, Uber Eats #142328, Foodora #E2006A,
     Skip #F96302, Instacart #43B02A, Amazon Flex #FF9900
3. `src/css/themes.css`:
   - `[data-theme="dark"]` overrides all semantic tokens
   - `@media (prefers-color-scheme: dark)` for auto mode
   - `@media (prefers-reduced-motion: reduce)` sets all transition tokens to 0ms
4. `src/css/components.css` — complete component library as CSS classes:
   - Buttons: .btn, .btn-primary, .btn-secondary, .btn-ghost, .btn-danger, .btn-sm, .btn-lg
   - Cards: .card, .card-raised, .card-interactive
   - Form: .input, .input-group, .input-label, .input-error, .select, .toggle
   - Badges: .badge, .badge-platform (takes --platform-color custom prop)
   - Progress: .progress-bar, .progress-fill, .progress-ring (SVG-based)
   - Layout helpers: .pill, .divider, .avatar, .stat-card, .empty-state, .skeleton
   - Data: .trend-up, .trend-down, .tag, .tag-removable
   - Navigation: .fab, .bottom-nav, .tab-bar, .platform-tab
   - Info tooltip: .info-tooltip, .info-icon (the "i" component)
5. `src/css/layout.css`:
   - App shell: sticky header, bottom nav (mobile), sidebar (desktop)
   - .bento-grid + .bento-cell-1x1, 2x1, 1x2, 2x2
   - Bottom drawer: .drawer, .drawer-overlay, .drawer-handle
   - Responsive: mobile-first, breakpoints 640px and 1024px
   - `@media print` stylesheet for report printing
6. `src/css/animations.css`:
   - @keyframes: fadeIn, slideUp, slideDown, scaleIn, shimmer (skeleton)
   - @keyframes: ringFill (progress ring), pulsGlow (streak), confettiFall
   - All wrapped in `@media (prefers-reduced-motion: no-preference)` — static fallback exists
7. Create empty view CSS files with comment structure (agents fill in Phase 2)

**Features:** 15, 169–172, 174, 252 — visual foundation for all 303 features

---

### F4 — Database Layer
**Depends on:** F1
**This is the most critical foundation task. Schema wrong = rework everything.**

`src/core/db.js` — Dexie database, MacadamVault, version 1:

```
TABLE: users (single record, id=1)
  id, displayName, avatarType, avatarData(base64)
  countryId, provinceId
  platforms[]         ← active platform IDs
  primaryPlatform
  workSchedule        ← 'fulltime'|'parttime'|'sidehustle'|'seasonal'
  locale: {
    distanceUnit, dateFormat, weekStartDay,
    timeFormat, language, numberFormat
  }
  weeklyGoal(cents), monthlyGoal(cents), annualGoal(cents)
  taxWithholdingPct, hstRegistered
  theme, accentColor, fontSize, layoutDensity
  dashboardWidgets[], heroStats[]
  notificationPrefs: { disabled[] }
  onboardingComplete, onboardingStep
  createdAt, updatedAt

TABLE: platforms (one record per active platform)
  id (string — platform slug, &primary key)
  weeklyGoal(cents), monthlyGoal(cents)
  taxRatePct, notes, priority
  active, addedAt, deactivatedAt
  platformSpecific: {}  ← flexible JSON for platform-specific tracked data

TABLE: shifts
  id (auto), platformId, provinceId    ← province stored for historical accuracy
  date (YYYY-MM-DD string)
  startTime (HH:MM string), endTime (HH:MM string)
  durationMinutes
  grossEarnings(cents), tips(cents), bonusEarnings(cents)
  deliveryCount, distanceKm, deadMilesKm
  onlineMinutes, activeMinutes
  vehicleId, weather, moodTag, notes
  isTemplate, templateName, isPlaceholder
  isMultiApp, multiAppSplit: {}
  customFields: {}    ← platform-specific field values (peakPay, surgeMultiplier, etc.)
  deletedAt, createdAt, updatedAt
  Indexes: date, platformId, vehicleId, deletedAt

TABLE: expenses
  id (auto), category, customCategory
  amount(cents), businessUsePct
  date (YYYY-MM-DD string)
  platformId, provinceId
  notes, receiptData(base64 compressed)
  hstPaid(cents)      ← for ITC tracking if hstRegistered
  isRecurring, recurringInterval, recurringNextDate
  confirmedPaid       ← recurring expenses require this before counting
  deletedAt, createdAt, updatedAt
  Indexes: date, category, platformId, deletedAt

TABLE: vehicles
  id (auto), nickname, type
  make, model, year, color
  fuelEfficiencyL100km, currentFuelPriceCents
  kwPer100km, electricityRateCents
  maintenanceCostPerKm(cents)
  purchasePriceCents, expectedLifespanKm
  active, createdAt, updatedAt

TABLE: vehicleOdometerLog
  id (auto), vehicleId
  reading (total km), date (YYYY-MM-DD)
  notes

TABLE: vehicleMaintenanceLogs
  id (auto), vehicleId, type
  date (YYYY-MM-DD), odometerKm, cost(cents)
  notes, nextDueKm, nextDueDateStr

TABLE: fuelPriceLog
  id (auto), vehicleId
  priceCentsPerLiter, date (YYYY-MM-DD)

TABLE: goals
  id (auto), type, scope
  platformId (null=all), target(cents or count)
  active, createdAt

TABLE: goalHistory
  id (auto), goalId, periodStart, periodEnd
  target, actual, hit, createdAt

TABLE: badges
  id (string slug, &primary), name, description, icon
  unlockedAt (null=locked), notified

TABLE: xpLog
  id (auto), action, xp, description, createdAt

TABLE: challenges
  id (string slug, &primary), name, description
  target, current, active, startedAt, expiresAt, completedAt

TABLE: notificationLog
  id (auto), type, firedAt

TABLE: backupLog
  id (auto), exportType, recordCount, sizeBytes, createdAt

TABLE: appState (key-value store)
  key (&primary), value (JSON string), updatedAt
  Keys used:
    'schema_version'
    'active_shift_timer': { startTime, platformId }
    'onboarding_session': { step, data }
    'streak_last_date', 'streak_count', 'streak_frozen_this_month'
    'weekly_goal_streak', 'weekly_goal_notified_week'
    'xp_total', 'xp_level'
    'personal_records': { bestHourlyRate, bestShiftEarnings, ... }
    'demo_mode'
    'install_prompt_shown'
    'dismissed_banners': []
    'last_backup': timestamp
    'app_version'
```

Helper functions exported from db.js:
- `getUser()` / `saveUser(patch)` — always upsert id=1
- `getAppState(key)` / `setAppState(key, value)`
- `softDelete(table, id)` — sets deletedAt
- `restoreDeleted(table, id)` — clears deletedAt
- `purgeOldDeleted(table, days)` — permanent delete
- `getActiveShifts(filters)` — where deletedAt is null
- `getActiveExpenses(filters)` — where deletedAt is null

Migration engine:
- `db.version(1).stores({...})` — base schema
- On every app start: check stored schema_version vs current
- If behind: run pending migrations, update stored version
- Migrations are pure data transforms, additive only

DB initialization on first run (new user):
- Insert default badge records (all locked) from BadgeRegistry
- Insert default platform records for all 7 platforms (inactive)
- Insert default appState keys with null values

**Features:** 267 (schema versioning) — data storage for all 303 features

---

### F5 — App Shell, Hash Router & Event Bus
**Depends on:** F1, F3

1. `src/core/events.js` — EventBus class + singleton + event name constants:
   ```
   SHIFT_SAVED, SHIFT_DELETED, SHIFT_TIMER_START, SHIFT_TIMER_STOP
   EXPENSE_SAVED, EXPENSE_DELETED
   GOAL_UPDATED, BADGE_UNLOCKED, XP_EARNED, CHALLENGE_COMPLETED
   PLATFORM_CHANGED, PLATFORM_ADDED, PLATFORM_DEACTIVATED
   THEME_CHANGED, LANGUAGE_CHANGED
   NAVIGATION, DATA_IMPORTED, VAULT_RESET, ONBOARDING_COMPLETE
   ```

2. `src/core/router.js` — hash router per routing table above:
   - Route guard: if !user.onboardingComplete → force #/onboarding
   - `router.navigate(route)` — updates hash, triggers render
   - Active nav link highlighting from current hash
   - Error boundary: wrap each view render in try/catch → show friendly error card
   - Stores current route in `window.__macadam.currentRoute`

3. `src/main.js` — entry point, startup sequence:
   ```
   1. Apply theme from localStorage (before any render, prevents FOUC)
   2. Register service worker
   3. Open Dexie DB (triggers migration check)
   4. store.loadFromDB() — hot state into memory
   5. Render app shell (header + nav + main + drawers + containers)
   6. router.init() — reads hash, renders view, wires hashchange
   7. checkAllNotifications() — on-open notification pass
   8. generateRecurringExpenses() — check + prompt for due recurring
   9. purgeOldDeleted() — clean up 30+ day soft-deleted records
   10. Capture beforeinstallprompt
   ```

4. App shell HTML (rendered into #app):
   - `<header>` sticky: avatar, platform switcher slot, date/time, online indicator, settings icon
   - `<nav>` bottom on mobile / left sidebar on desktop
   - `<div id="shift-timer-bar">` collapsed unless shift active
   - `<main id="view-container">` — router renders here
   - `<div id="toast-container">` — outside #app for z-index
   - `<div id="modal-overlay">` — outside #app for z-index

5. `window.__macadam = { db, store, bus, router, version, triggerInstall: null }`

**Features:** 165 (offline indicator), 271 (dashboard header), 299 (error handling)

---

### F6 — Reactive State Store
**Depends on:** F4, F5

`src/core/store.js`:

State shape loaded on init:
```js
{
  user: null,
  countryDef: null,       ← CountryRegistry.getById(user.countryId)
  provinceDef: null,      ← ProvinceRegistry.getById(user.provinceId)
  activePlatformId: 'all',
  platforms: [],          ← active platforms
  activeShiftTimer: null, ← { startTime, platformId } or null
  currentWeekEarnings: 0, ← cents
  currentWeekGoal: 0,     ← cents
  streakDays: 0,
  xpTotal: 0,
  xpLevel: 1,
  theme: 'auto',
  isOnline: navigator.onLine,
  pendingBadgeUnlock: null,
}
```

Methods: `get(key)`, `set(key, value)`, `subscribe(key, fn)`, `unsubscribe(key, fn)`, `loadFromDB()`

DOM binding helpers: `bindText()`, `bindClass()`, `bindVisibility()`

online/offline events → update `store.isOnline` → header indicator reacts

---

### F7 — Utility Layer
**Depends on:** F1

`src/utils/formatters.js`:
- `formatCurrency(cents, locale)` — converts cents to display string
- `formatDuration(minutes, style)` — "2h 30m" or "2.5 hrs"
- `formatDistance(km, unit)` — "42.3 km" or "26.3 mi"
- `formatDate(dateStr, format)` — respects user.locale.dateFormat
- `formatTime(timeStr, use24h)`
- `formatPercent(value, decimals)`
- `formatLargeNumber(n, locale)`
- `formatHourlyRate(cents, locale)` — "$22.50/hr"
- `formatDateRelative(dateStr)` — "2 days ago" (Day.js)
- `getTerminology(term, platforms, activePlatformId)` — generic or platform-specific

`src/utils/calculations.js`:
- **Shift metrics** (all take cents, return cents or ratios):
  - `calcHourlyRateCents(grossCents, durationMinutes)`
  - `calcNetHourlyRateCents(grossCents, expenseCents, durationMinutes)`
  - `calcEarningsPerOrder(grossCents, count)`
  - `calcTipRate(tipsCents, grossCents)` → ratio
  - `calcBonusDependencyRatio(bonusCents, grossCents)` → ratio
  - `calcUtilizationRate(activeMinutes, onlineMinutes)` → ratio
  - `calcEarningsPerKm(grossCents, distanceKm)`
- **Vehicle / expense**:
  - `calcFuelCostCents(distanceKm, efficiencyL100km, pricePerLiterCents)`
  - `calcEVCostCents(distanceKm, kwPer100km, electricityRateCents)`
  - `calcBusinessUsePct(businessKm, totalKm)` → ratio
  - `calcDeductibleAmountCents(expenseCents, businessUsePct)`
  - `calcDepreciationPerKmCents(purchasePriceCents, lifespanKm)`
- **Tax**:
  - `calcTaxSetAsideCents(grossCents, rate)`
  - `calcCPP1Cents(netIncomeCents, exemption, ympe, rate)` — Ontario/federal
  - `calcCPP2Cents(netIncomeCents, ympe, yampe, rate)`
  - `calcHSTRemittableCents(collected, itcCents)`
  - `calcEstimatedTaxCents(netIncomeCents, provinceDef)` — uses brackets from province
- **Analytics**:
  - `aggregateByDayOfWeek(shifts)` → { Mon: avgCents, ... }
  - `aggregateByHourOfDay(shifts)` → { 0: avgCents, ..., 23: avgCents }
  - `calcLinearRegression(dataPoints)` → { slope, intercept }
  - `calcStreakDays(shiftDates)` → number
  - `calcPersonalRecords(shifts)` → records object
  - `projectWeekEarnings(completedShifts, currentDate)` → cents

`src/utils/locale.js`:
- `getCountryDef(countryId)` → from CountryRegistry
- `getProvinceDef(provinceId)` → from ProvinceRegistry
- `getNextTaxDeadline(provinceDef)` → { date, daysUntil, label }
- `getNextHSTDeadline(provinceDef)` → { date, daysUntil, label }

`src/utils/strings.js` — ALL user-facing text:
- `export const strings = { en: { onboarding: {}, shifts: {}, ... }, fr: {} }`
- `export const t = (key, lang = 'en') → string`
- French values empty stubs for now — architecture exists for Quebec

`src/ui/icons.js` — SVG icon registry:
- `getIcon(name, size, className)` → SVG HTML string
- ~35 icons covering all app needs (inline SVG, no font dependency)

---

### F8 — Core UI Components
**Depends on:** F3, F5, F7

`src/ui/components.js`:

**MacadamModal** — `showModal({ title, content, actions, onClose, size })`
- Focus trap (Tab cycles within modal only)
- Esc key closes
- Backdrop click closes (configurable)
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby`
- Slide-up in, fade-out on close

**MacadamConfirm** — `showConfirm({ title, message, confirmLabel, confirmClass, requireType, onConfirm })`
- `requireType`: user must type string before confirm activates (danger zone)
- Built on MacadamModal

**MacadamToast** — `showToast({ message, type, duration, action, actionLabel })`
- Types: success, error, warning, info, celebration
- Stacks max 3
- Auto-dismiss with configurable duration
- `role="alert"` + `aria-live="polite"`

**MacadamNotifyCard** — `showNotifyCard({ title, message, icon, actions, type })`
- Full-card notification (not a toast)
- types: info, celebration, warning

**InfoTooltip** — `renderInfoTooltip(content)` → HTML
- The "i" component used for terminology explanations in onboarding
- Mobile: tap to show overlay. Desktop: hover.
- Renders: "DoorDash → Peak Pay | Uber Eats → Surge"

**FAB** — `initFAB()`
- Floating action button
- Click → open bottom drawer with quick-add shift form
- Morphs to "End Shift" button while timer is active
- Hides when keyboard visible on mobile

**BottomDrawer** — `showDrawer({ content, title, onClose })`
- Swipe-to-close on mobile
- 50% / 90% snap points

**NumericKeypad** — `showNumericKeypad({ value, onConfirm, currency })`
- Large tap-friendly overlay for amount entry
- Used for all earnings/expense amount fields

**ProgressRing** — `renderProgressRing({ value, max, size, color, label })` → SVG HTML
- CSS animation for fill (respects reduced motion)
- `aria-valuenow`, `aria-valuemin`, `aria-valuemax`

**SkeletonLoader** — `renderSkeleton(shape)` → HTML
- Shapes: card, list-item, stat, chart

**EmptyState** — `renderEmptyState({ icon, title, message, action, actionLabel })` → HTML

`src/ui/charts.js` — Chart.js wrappers:
- `renderBarChart(canvas, data, options)` → Chart instance
- `renderLineChart(canvas, data, options)` → Chart instance
- `renderDonutChart(canvas, data, options)` → Chart instance
- `renderScatterChart(canvas, data, options)` → Chart instance
- `renderGitHubHeatmap(container, data)` → CSS grid (52 weeks × 7 days)
- `renderHeatStrip(canvas, hourlyData)` → horizontal heat visualization
- `destroyChart(canvas)` — cleanup before re-render
- All: responsive, custom tooltip style matching app theme

**Features:** 31, 36, 253, 254, 255, 256 — core UI for all features

---

### F9 — Registry Layer
**Depends on:** F1, F7
**This task creates the skeleton files. Agents fill them with data in F10–F13 and Phase 2.**

1. All registry index files with validate() functions and empty arrays
2. All _TEMPLATE files for each registry type
3. Country file: `src/registry/countries/CA.country.js`
   - Currency: CAD, distanceUnit: km, dateFormat: YYYY-MM-DD
   - taxYear: calendar (Jan–Dec)
   - expenseMethod: actual_costs
   - Filing deadlines: June 15 (self-employed file), April 30 (payment due)
   - Installment dates: Mar/Jun/Sep/Dec 15, threshold $3,000
   - CPP1: rate 0.119, exemption 3500, ympe 71300, max 8068.20
   - CPP2: rate 0.08, range 71300–81200, max 792
   - recordRetentionYears: 6
   - filingForm: T2125

4. Province file: `src/registry/provinces/CA/ON.province.js` — fully populated:
   - salesTax: HST 13%, registration threshold $30k, ITC enabled, quarterly filing
   - HST quarterly due dates: Apr 30, Jul 31, Oct 31, Jan 31
   - incomeTax: federal + Ontario brackets (2025), suggestedSetAsidePct: 27
   - pensionContribution: CPP (federal rates from CA.country.js reference)
   - vehicleExpenseMethod: actual_costs, all deductible expense list with CRA lines
   - expenseCategories: full list as defined in Ontario Province File doc
   - availablePlatforms: doordash, ubereats, skip, foodora, instacart, amazonflex
   - vehicleNotes: Ontario e-bike rules, commercial insurance note
   - onboardingExtras: HST registration step

5. Platform files — all 6 platforms with full data per platform schema:
   - doordash: color #FF3008, terminology (Dasher/order/Peak Pay), customShiftFields [peakPayAmount, dashZone], analyticsModules.bonusTracking: true
   - ubereats: color #142328, terminology (Courier/trip/Surge), customShiftFields [surgeMultiplier], analyticsModules.surgeAnalysis: true, statusTiers (Blue/Gold/Platinum/Diamond)
   - skip: color #F96302, terminology (Courier/order/Promotions), analyticsModules.promotionsTracking: true, cityScore config
   - foodora: color #E2006A, terminology (Rider/order/Boost), analyticsModules.orderTypeTracking: true, attendanceScore config
   - instacart: color #43B02A, terminology (Shopper/batch/—), analyticsModules.batchTracking: true
   - amazonflex: color #FF9900, terminology (Driver/block/—), analyticsModules.blockEarnings: true

6. Metric files — all metrics per metric schema:
   grossHourlyRate, netHourlyRate, earningsPerOrder, tipRate,
   bonusDependencyRatio, utilizationRate, earningsPerKm, deadMilesRatio

7. Badge files — all badges per badge schema (initially locked in DB)

8. Notification skeleton files (condition logic wired in P8)

9. Widget skeleton files (render logic wired in P1)

**All registries validated on startup in dev mode.**

---

### F10 — Onboarding Flow
**Depends on:** F4, F5, F6, F7, F8, F9

`src/modules/onboarding/onboarding.js` — orchestrator:
- Check user.onboardingComplete → skip if true
- Save step progress to sessionStorage after each step
- On re-open: detect partial progress → "Continue" or "Start Over"
- "Try Demo First" link on every step → sets demo_mode, skips to populated dashboard
- buildOnboardingSteps(provinceId): reads province.onboardingExtras, inserts extra steps
- On complete: emit ONBOARDING_COMPLETE, fire celebration, navigate to #/dashboard

`src/modules/onboarding/steps.js` — all steps as render functions:
- **Step 1 — Country**: Canada active, others greyed "Coming soon"
- **Step 2 — Province**: Ontario active, others greyed. On select → resolves platform list
- **Step 3 — Platform Selection**: `PlatformRegistry.getByCountry('CA')` filtered by province. Multi-select. Logo cards. If 1 selected → use platform terms. If 2+ → generic + i tooltips.
- **Step 4 — Driver Name + Avatar**: name input, 12 SVG avatar grid, custom upload
- **Step 5 — Vehicle Setup**: type picker, conditional fields per type, province notes
- **Step 6 — Work Schedule**: 4 options, drives dashboard density
- **Step 7 — Earnings Goals**: weekly (cents), auto-populate monthly/annual, live label
- **Step 8 — Tax Setup**: withholding % (pre-filled from province.incomeTax.suggestedSetAsidePct). Province onboardingExtras injected here (HST toggle for Ontario)
- **Step 9 — Preferences**: theme, distance unit, date format, week start, notifications
- **Step 10 — Completion**: celebration animation, "Your Vault is Ready, [Name]", Start / Tour options

Each step: collapsible "Why we ask this" info section

Sample data tour:
- `loadSampleData()` — 2 weeks of realistic fake shifts + expenses
- Watermarked throughout as sample data
- `clearSampleData()` — one-button removal

Onboarding config export (preferences only, no earnings):
- Export as tiny JSON after completion
- Import on new device to skip preferences re-entry

**Features:** 1–20, 261–265

---

### F11 — Platform Management
**Depends on:** F4, F5, F6, F7, F8, F9, F10

`src/modules/platforms/platform-config.js` → REMOVED. Replaced by PlatformRegistry.

`src/modules/platforms/platforms.js`:
- `initPlatforms()` — load active platforms into store
- `addPlatform(platformId)` — activate, run mini-onboarding wizard
- `deactivatePlatform(platformId)` — soft deactivate (keeps historical data)
- `reactivatePlatform(platformId)`
- `updatePlatformGoal(platformId, weekly, monthly)` (cents)
- `reorderPlatforms(newOrder)` via Sortable.js

Platform Switcher UI:
- `renderPlatformSwitcher(mode)` → tab bar or dropdown
- "All" tab always first
- Color-coded tabs from platform.color
- Hidden if only 1 platform
- Switching emits PLATFORM_CHANGED → all views react
- Tabs reorderable via Sortable.js drag

**Features:** 2, 21–30, 260, 261

---

### F12 — Shift Logging Core
**Depends on:** F4, F5, F6, F7, F8, F9, F11

`src/modules/shifts/shift-form.js`:
- Platform picker FIRST — form adapts below
- After platform selected: load platform.customShiftFields[]
- Standard fields in order per Shift Form Field Order section above
- Dead miles field (static, no estimation)
- Live earnings/hr display updates as user types (cents math)
- Province note on vehicle field if vehicle type has province-specific notes
- "Basic" vs "Full" toggle
- i tooltips on generic terms if multi-platform

`src/modules/shifts/shifts.js`:
- `saveShift(data)` — validates, converts to cents, inserts, emits SHIFT_SAVED, awards XP, checks badges + records, shows summary card
- `updateShift(id, patch)` — recalculates dependent metrics
- `softDeleteShift(id)` / `restoreShift(id)` / `purgeOldShifts()`
- `duplicateShift(id)` — opens form pre-filled
- `saveAsTemplate(data, name)` / `getTemplates()` / `applyTemplate(id)`
- `checkConflict(date, startTime, endTime)` → conflicting shift or null
- `checkDailyHoursWarning(date)` → total minutes logged today
- Shift timer: `startTimer(platformId)` → saves to appState + localStorage
  `stopTimer()` → opens form pre-filled with duration
  Screen Wake Lock requested on timer start

Shift list view:
- Paginated/scrollable list
- Each card: date, platform badge, earnings, hourly rate, duration
- Tap → full detail
- Edit / Delete / Duplicate actions

Bulk CSV import (Papa Parse):
- Upload + column mapping UI
- Preview 5 rows before confirming
- Append or replace modes

Recurring shifts: define pattern → creates 4 weeks of placeholders → "Pending Shifts" view

**Features:** 31–56

---

### F13 — Expense Core
**Depends on:** F4, F5, F6, F7, F8, F9, F11

`src/modules/expenses/expense-form.js`:
- Category picker driven by ProvinceRegistry (shows ON.province.js expenseCategories)
- Each category shows CRA line reference as hint text
- Business-use % slider on mixed-use categories
- Vehicle-type-specific categories only shown if user has that vehicle type
- Amount field (NumericKeypad, cents)
- Date picker
- Platform assignment or "All"
- Notes field
- Receipt photo → compress to base64
- HST paid field: ONLY shown if user.hstRegistered === true (ITC tracking)
- Recurring toggle → shows interval options
- Non-deductible category warning if user tries to log one

`src/modules/expenses/expenses.js`:
- `saveExpense(data)` — cents, inserts, emits EXPENSE_SAVED, awards XP
- `updateExpense(id, patch)` / `softDeleteExpense(id)`
- `generateRecurringExpenses()` — on app start: find due recurring, prompt "confirm paid?" before creating record
- `calcAutoVehicleCost(vehicleId, distanceKm)` — fuel or EV cost in cents
- `getMonthlyByCategory(month, year, provinceId)` → for dashboard widget
- `getTotalForPeriod(startDate, endDate)` → cents
- `getExpenseRatioPct(startDate, endDate)` → percent

Expense categories:
- Read from `ProvinceRegistry.getById('ON').expenseCategories`
- Custom category: name + emoji, saved to user.customExpenseCategories
- All categories editable

**Features:** 83–100

---

## PHASE 2 — FEATURE MODULES
### All Phase 1 tasks must be complete. Most P tasks run in parallel.

---

### P1 — Earnings Analytics & Dashboard Widgets
**Depends on:** F11, F12, F13, F6, F7, F8, F9

Analytics queries (all return cents or ratios, never raw floats):
- Per-shift derived metrics via MetricRegistry.calcShift()
- getDailySummary / getWeeklySummary / getMonthlySummary / getAnnualSummary
- getRolling30DayTrend() + linear regression
- getBestDayOfWeek() / getBestTimeOfDay()
- getPlatformComparison()
- getIncomeSourceBreakdown() (base / tips / bonuses)
- getPersonalRecords() from MetricRegistry.getPersonalRecord()
- getZeroDays(month, year)

Dashboard widgets (all defined in WidgetRegistry, engine loops them):
- Goal ring (weekly earnings progress)
- Streak counter + flame
- Weekly earnings + vs last week
- YTD gross + net (side by side)
- Hourly rate trend
- Expense ratio gauge
- Estimated tax owing (tappable → #/tax)
- Days until next tax deadline
- Earnings thermometer (monthly goal)
- Earnings velocity (only during active shift timer)
- Last shift summary card
- Recent activity feed
- 52-week GitHub heatmap
- Top 10 earning shifts
- What-if earnings simulator (slider)
- Cumulative YTD line chart + goal trajectory dashed line
- Earnings vs hours scatter plot
- Income source donut (base / tips / bonuses)

**Global analytics view:** When activePlatformId = 'all':
- Platform-specific fields (Peak Pay, Pro Status) → show per-platform breakdown columns
- Combined totals shown with per-platform breakdown beneath
- Platform-specific terms hidden; generic terms used

**Features:** 57–82, 271–280

---

### P2 — Tax Module
**Depends on:** F7, F4, F8, F9 (province data)

All tax logic reads from provinceDef and countryDef — no hardcoded rates.

- Tax dashboard: YTD gross, estimated taxable income, deductible expenses, estimated tax owing, "tax jar" balance
- Tax year selector (current, last year, 2 years back)
- Tax set-aside tracker: every shift logged → auto-allocates X% to virtual jar
- Business-use % summary: shows annual business km, total km, business-use %, estimated deductible vehicle expenses
- HST collected tracker (if hstRegistered): per-shift HST, running YTD total
- ITC tracker: HST paid on expenses, net HST remittable
- CPP estimator: reads CA.country.js CPP rates, calculates CPP1 + CPP2
- T2125 helper: guided line-by-line walkthrough (informational, not filing software)
- Province income tax estimator: uses provinceDef.incomeTax brackets
- HST quarterly deadline widget: reads provinceDef.salesTax.quarterlyDueDates
- Export tax summary JSON + CSV (versioned export format)
- CRA reference links from provinceDef.vehicleExpenseMethod.referenceUrl

**Features:** 101–114 (minus removed mileage rate features)

---

### P3 — Vehicle & Mileage
**Depends on:** F4, F8, F13, F9

- Vehicle profile CRUD + cards
- Business-use % dashboard: business km (from shifts) ÷ total km (from odometer log) = %
- Odometer log: periodic entry of total km reading
- Vehicle maintenance log + service type tracking
- Oil change / tire / insurance / registration reminders
- Vehicle cost per km: all expenses × business-use % ÷ business km
- Depreciation estimator per km
- Multi-vehicle performance comparison
- Fuel price tracker with history chart

**Features:** 115–125

---

### P4 — Schedule & Calendar
**Depends on:** F11, F8, F7

- Week grid calendar: color-coded shift blocks per platform
- Month grid: earnings per day, platform dots, above-average star
- Planning mode: placeholder shifts (light/dashed blocks)
- Non-delivery day marking: Off / Sick / Vacation / Holiday
- Hours-per-week tracker bar
- Optimal hours calculator: "to hit $X you need Y hrs at your current rate"
- Peak hours overlay from historical data (heat stripe)
- Rest period tracker: flag <8hrs between shifts
- Night shift auto-tag (10pm–6am)

**Features:** 126–135

---

### P5 — Goals & Gamification
**Depends on:** F4, F5, F6, F8, F11, F9

- Multi-tier goal system: daily/weekly/monthly (all in cents where applicable)
- Custom goal types via GoalTypeRegistry
- Goal history log (hit/miss per period)
- Badge system: BadgeRegistry.checkAll(stats) runs on every SHIFT_SAVED
- Badge unlock animation: canvas-confetti + slide-in card
- XP + level system: all award triggers per action map
- Streak counter (days worked) + streak counter (weeks goal hit)
- Streak freeze: once per month
- Challenges: pre-built + progress tracking via ChallengeRegistry
- Personal records: MetricRegistry.getPersonalRecord() metrics tracked
- Earnings thermometer widget (monthly goal, mercury rises)

**Features:** 136–145, 73–75

---

### P6 — Reports & Exports
**Depends on:** F4, F7, F11, F12, F13, P1

Export format (all exports):
```json
{
  "schemaVersion": 1,
  "exportedAt": "2025-06-15T14:30:00Z",
  "exportType": "full_vault",
  "provinceId": "ON",
  "countryId": "CA",
  "data": { ... }
}
```

- Weekly / monthly / annual report cards
- Per-platform filtered report
- Custom date range report
- CSV export: all shifts (amounts in dollars, not cents, for human readability)
- CSV export: all expenses
- JSON export: full vault backup (versioned)
- JSON import: vault restore with schema version check + diff preview
- Print view: `@media print` stylesheet, charts → tables
- Copy summary to clipboard (plain text)
- QR code for weekly stats (qrcode-generator)
- Report template builder: toggle sections
- Year-in-review screen: html2canvas → shareable image (Jan 1 trigger)

**Features:** 146–158, 303

---

### P7 — Search & Filtering
**Depends on:** F4, F7, F8

- Global search overlay (Ctrl+K shortcut) via Fuse.js
  - Searches: shift notes, expense notes, vehicle names, platform names
  - Results grouped by type with preview cards
- Shift filter panel: platform, date range, vehicle, weather, mood, min earnings, min hourly rate
- Expense filter panel: category, platform, date range, amount range, receipt attached
- Saved filters: save combination as named preset
- Multi-key sort: primary + secondary sort on all list views

**Features:** 184–189

---

### P8 — Notifications System
**Depends on:** F4, F5, F7, F8, P5, F9

Engine: `checkAllNotifications()` → iterates NotificationRegistry.getEnabled()

All 14 notification types defined as individual files in registry/notifications/:
- daily-summary (type: toast, cooldown: 1d)
- weekly-goal-hit (type: celebration, cooldown: 7d)
- weekly-goal-miss (type: card, cooldown: 7d, constructive language)
- midweek-behind (type: toast, cooldown: 7d)
- personal-best (type: card, cooldown: always)
- tax-deadline (type: card, cooldown: always — reads province installment dates)
- hst-deadline (type: card, cooldown: always — reads province HST due dates)
- maintenance-due (type: toast, cooldown: 7d)
- insurance-expiry (type: card, cooldown: always)
- streak-at-risk (type: toast, cooldown: 1d, toggleable)
- backup-overdue (type: toast, cooldown: 7d)
- low-hourly-rate (type: card, cooldown: 7d)
- high-expenses (type: card, cooldown: 30d)
- milestone-proximity (type: toast, cooldown: always)
- arbitrage-alert (type: card, cooldown: 30d, multi-platform only)

**Features:** 195–207

---

### P9 — Settings & Personalization
**Depends on:** F4, F5, F6, F7, F8, F10

- Profile: display name, avatar
- Currency display (symbol only — no conversion, warning shown)
- Theme toggle
- Accent color picker (12 options + hex)
- Font size (Small/Medium/Large/XL — CSS class on <html>)
- Layout density (compact/spacious)
- Dashboard widget customizer (drag-drop via Sortable.js)
- Hero stats config (top 3 prominent stats)
- Date format, week start, duration format
- Notification toggles per type
- Keyboard shortcuts overlay (desktop)
- Danger zone: reset single platform (requires typing platform name)
- Danger zone: export-before-wipe enforced (reset disabled until export downloaded)
- Vault storage usage meter
- Data integrity check
- Auto-archive data older than 2 years
- Backup history: "Last backup: X days ago" (color-coded)
- DB stats: shift count, expense count, date range, total km
- App version + changelog
- Support / tip jar link
- Share Macadam link
- About / Data Portability Manifesto page
- Install Macadam prompt (if not yet installed as PWA)
- Driver Financial Glossary (searchable)
- Debug mode (tap version number 5 times):
  - Raw vault inspector (JSON tree)
  - IndexedDB query timing
  - Synthetic data generator
  - State dump

**Features:** 159–165, 166–183, 266–270, 281–283, 295, 301

---

### P10 — Platform-Specific Features
**Depends on:** F9, F11, F12, P5, P8

All logic reads from platform definition files — no hardcoding.

Platform-specific tracking enabled per platform's analyticsModules flags:
- DoorDash: Peak Pay tracker (from customShiftFields), Acceptance Rate, Customer Rating + alert
- Uber Eats: Surge multiplier log, Pro Status tracker, Completion Rate, Quest tracker
- Skip: Credits/Promos, City Score tracker
- Foodora: Order type split (pickup vs delivery), Attendance Score
- Instacart: Batch tracker (items, store, tip)
- Amazon Flex: Block duration tracker (2/3/4hr), reserved vs last-minute
- Cross-platform arbitrage alert (if multi-platform, >20% rate difference → notification)
- Multi-app simultaneous shift: split earnings across 2 platforms in one time block
- Platform payout day tracker + countdown widget
- Instant cashout fee tracker (sub-category of platform fees expense)

**Features:** 208–218, 284–291

---

### P11 — Advanced Analytics
**Depends on:** P1, F7, F11, F12, F13

- Cohort: first month vs current month comparison
- Diminishing returns: earnings per hour by position within shift (hour 1, 2, 3...)
- Day-part analysis: 4 time blocks × 7 days × N platforms matrix
- Holiday vs regular day comparison (tagged holidays in calendar)
- Weather correlation: hourly rate by weather condition
- Orders-per-hour proxy metric
- Earnings seasonality 12-month heatmap
- Compound growth rate month-over-month and YoY
- Break-even analysis: hours needed to cover monthly vehicle costs
- Efficiency quartile ranking: label each shift as top 25% / above avg / below avg / bottom 25%
- Predictive weekly earnings (mid-week projection)
- Platform shift-of-activity analysis over time
- Income stability score (variance of weekly earnings, 1–10)
- Mood trend chart (if mood tags used — colored dot timeline)

**Features:** 226–238, 221, 224

---

### P12 — PWA Deep & Accessibility
**Depends on:** F2, F5, F8

PWA:
- Background Sync for deferred exports (if offline during export)
- Share Target API in manifest (share earnings screenshot to Macadam)
- File System Access API for desktop export (pick save directory)
- Notification API for timed reminders (local, not push)
- Vibration API: single pulse (shift saved), double pulse (badge), triple pulse (goal hit)
- Screen Wake Lock during active shift timer
- Fullscreen mode toggle (Fullscreen API)

Accessibility:
- Full ARIA audit: roles, labels, descriptions on all interactive elements
- Screen reader table optimization: caption, thead, th scope on all data tables
- Voice input compatibility: all fields properly typed and labeled
- Touch target audit: all tappable elements ≥ 44×44px
- Color contrast audit: all pairs meet 4.5:1 minimum
- Zone management (removed from main app — no zone features remain)

**Features:** 241–256

---

### P13 — Polish & Completion Features
**Depends on:** All Phase 2 tasks

- Branded SVG splash screen (~800ms on cold start, road-line animation)
- Changelog popup on version update (detect version change in localStorage)
- "Did You Know?" rotating tip system (50+ delivery driver tips, never repeated)
- Driver Community Tips board (static, curated, read-only)
- App review nudge (10th shift or first goal hit, once only)
- Error boundaries with friendly messages + reload button + data export link
- Zen Mode: full-screen focus view (today's earnings, active timer, one motivational quote)
- Break reminder toast (after 4+ continuous hours, toggleable)
- Long-day mileage note (>300km shift: "make sure to stretch")
- End-of-year review screen (Jan 1 trigger, html2canvas shareable)
- MacadamAPI spec — [`MacadamAPI.md`](MacadamAPI.md) (future cloud sync spec)
- Competitor comparison informational page

**Features:** 219–225, 292–303

---

## PHASE 3 — YOUR POLISH PASS

Every view, one by one:
- [ ] Typography: data numbers use --font-mono, headings use --font-display
- [ ] Spacing: every gap uses spacing scale tokens
- [ ] Platform colors: exact hex matches verified
- [ ] Animation feel: tweak --transition-slow for spring vs ease
- [ ] Mobile: every tap target ≥ 44×44px, no precision required
- [ ] Empty states: every list has a beautiful empty state
- [ ] Error states: every input has a styled error state
- [ ] Loading states: every async op shows skeleton
- [ ] Reduced motion: test with system setting on
- [ ] Dark mode: every component correct
- [ ] Print: every report clean in black and white

---

## DEPENDENCY MAP

```
F1 (Scaffold)
├── F2 (Service Worker)
├── F3 (Design System)
├── F4 (Database) ──────────────────────────────────┐
├── F5 (Router/Shell) ──────────────────────────────┤
├── F6 (Store) ← F4, F5 ──────────────────────────┤
├── F7 (Utils) ────────────────────────────────────┤
└── F8 (UI Components) ← F3, F5, F7               │
                                                   │
F9 (Registry Layer) ← F1, F7 ─────────────────────┤
F10 (Onboarding) ← F4,F5,F6,F7,F8,F9             │
F11 (Platforms) ← F4,F5,F6,F7,F8,F9,F10          │
F12 (Shifts) ← F4,F5,F6,F7,F8,F9,F11             │
F13 (Expenses) ← F4,F5,F6,F7,F8,F9,F11           │
                                                   │
Phase 2: all F tasks complete ─────────────────────┘
P1 (Analytics)         P8 (Notifications)
P2 (Tax)               P9 (Settings)
P3 (Vehicles)          P10 (Platform-Specific)
P4 (Schedule)          P11 (Advanced Analytics)
P5 (Goals)             P12 (PWA Deep)
P6 (Reports)           P13 (Polish)
P7 (Search)
```

---

## CURSOR AGENT HEADER TEMPLATE

Paste this at the top of every agent session:

```
TASK: [F# or P#] — [Task Name]
PROJECT: Macadam — Local-first gig delivery earnings tracker
STACK: Vanilla JS ES2022, esbuild bundler, vanilla CSS, Dexie.js for IndexedDB
ARCHITECTURE: Hash router (#/route), single index.html, SW caches static assets only
DATA RULES:
  - Money stored as integers (cents). $84.50 = 8450. Display layer converts.
  - Dates stored as "YYYY-MM-DD" strings. Never timestamps for business dates.
  - Province stored on every shift record (shift.provinceId)
  - IndexedDB via Dexie only. SW NEVER touches data.
REGISTRY RULE: Engine never contains if(platformId==='doordash') or if(country==='CA').
  Engine reads registries. Definitions drive behavior.
LIBS: /src/libs/ — dexie, chart.js, dayjs+plugins, papaparse, fuse.js, sortable.js,
  confetti, html2canvas, qrcode. Use ES module imports. All vendored locally.
COMPLETED DEPS: [list completed tasks]
FILES TO CREATE/MODIFY: [specific files from task]
FEATURES: [feature numbers from original 303-feature spec]

DO NOT:
  - Use any framework (no React, Vue, Svelte)
  - Use npm packages at runtime
  - Store data in the Service Worker
  - Write inline styles (use CSS classes from tokens.css + components.css)
  - Hardcode user-facing text (use strings.js t() function)
  - Store money as floats (always cents as integers)
  - Use the CRA standard mileage rate — self-employed use actual costs only
  - Add zone/home-base features (removed from plan)
  - Hardcode platform names or country codes in engine logic
```

---

## FEATURE COVERAGE

| Part | Domain | Phase |
|---|---|---|
| 1 — Onboarding | Features 1–20, 261–265 | F10 |
| 2 — Platform Management | Features 21–30 | F11 |
| 3 — Shift Logging | Features 31–56 | F12 |
| 4 — Earnings Analytics | Features 57–82 | P1 |
| 5 — Expense Tracking | Features 83–100 | F13 |
| 6 — Tax Management | Features 101–114* | P2 |
| 7 — Vehicle & Mileage | Features 115–125 | P3 |
| 8 — Schedule | Features 126–135 | P4 |
| 9 — Goals & Gamification | Features 136–145, 73–75 | P5 |
| 10 — Reports & Exports | Features 146–158 | P6 |
| 11 — Data Health | Features 159–165 | P9 |
| 12 — Settings | Features 166–183 | P9 |
| 13 — Search | Features 184–189 | P7 |
| 14 — Maps & Zones | REMOVED | — |
| 15 — Notifications | Features 195–207 | P8 |
| 16 — Multi-App | Features 208–218 | P10 |
| 17 — Wellbeing | Features 219–225 | P11, P13 |
| 18 — Advanced Analytics | Features 226–238 | P11 |
| 19 — PWA | Features 239–250 | F2, P12 |
| 20 — Accessibility | Features 251–256 | F8, P12 |
| 21 — Localization | Features 257–260 | F7, F9 |
| 22 — Onboarding Extended | Features 261–265 | F10 |
| 23 — Dev/Power User | Features 266–270 | P9 |
| 24 — Dashboard Deep | Features 271–280 | P1 |
| 25 — Monetization-Ready | Features 281–283 | P9 |
| 26 — Platform Deep Dives | Features 284–291 | P10 |
| 27 — Polish & Depth | Features 292–303 | P13 |

*Features 97 (CRA mileage) and 99 (standard vs actual comparison) removed.
All other 301 features remain. Zones section (190–194) removed.

---

*Macadam Final Build Plan v3.0*
*13 Foundation Tasks · 13 Feature Modules · 1 Polish Pass*
*esbuild · Vanilla JS · Dexie.js · Registry Pattern · Ontario-first · Local-first*
*The engine reads registries. Registries grow. The engine never changes.*