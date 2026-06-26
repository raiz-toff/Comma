# Comma App — Architecture, Screen Flows, and System Design

This document provides a comprehensive technical overview and design blueprint for the **Comma App**, a local-first, privacy-focused utility suite designed specifically for multi-platform gig workers (couriers, rideshare drivers, grocery shoppers, and parcel couriers). 

This guide serves as a complete reference for replicating, refactoring, or extending the application without requiring direct access to the source code.

---

## 1. Directory and File Structure

Below is the directory tree of the Comma application codebase, mapping where the screens, database configurations, business logic repositories, and utilities are located:

```text
comma/app/
├── app/                              # Expo Router file-based routing directory
│   ├── (tabs)/                       # Bottom tab navigation group
│   │   ├── _layout.tsx               # Tab bar layout, colors (#12110f background, #10b981 active tint)
│   │   ├── index.tsx                 # Home Dashboard (Bento grid layout, Active Shift Hero, today's metrics)
│   │   ├── shifts/                   # Shift history log screens
│   │   │   ├── index.tsx             # Paginated shift list, date & platform filter chips, load-more trigger
│   │   │   └── [id].tsx              # Shift details view, mileage progress bar, linked expenses, Leaflet WebView map
│   │   ├── analytics.tsx             # Earnings, efficiency charts, hours, and mileage metrics tabs
│   │   ├── expenses/                 # Expense management screens
│   │   │   └── index.tsx             # Grouped SectionList of expenses, deductible vs. non-deductible filters
│   │   ├── tax/                      # Tax dashboard
│   │   │   └── index.tsx             # YTD tax calculations, CRA/IRS write-off values, quarterly due dates
│   │   └── more.tsx                  # More options menu (navigation panel to stacked screens)
│   ├── _layout.tsx                   # App root entry point, database providers, background service initializers
│   ├── about/
│   │   └── index.tsx                 # App info, privacy disclaimer, licenses list, diagnostic log downloader
│   ├── expense/
│   │   └── add.tsx                   # Add/Edit Expense modal, receipt camera integration, vehicle linker
│   ├── goals/
│   │   └── index.tsx                 # Goals setup dashboard, targets/units configuration, visual progress
│   ├── notifications.tsx             # Global notifications inbox stack view
│   ├── reports/
│   │   └── index.tsx                 # Reports generation and data exporter (CSV & HTML-to-PDF print engine)
│   ├── schedule/
│   │   └── index.tsx                 # Monthly calendar grid, dot indicators, shift presets planner
│   ├── settings/
│   │   ├── index.tsx                 # Settings panel (profile editing, tax preset selectors, backup triggers)
│   │   └── import.tsx                # CSV shift import wizard (papaparse bulk database ingestion)
│   ├── shift/
│   │   └── add.tsx                   # Manual shift logging modal form
│   └── vehicles/
│       ├── index.tsx                 # Vehicle inventory screen, add vehicle card inline
│       └── [id].tsx                  # Vehicle detail dashboard (shifts/mileage aggregates, maintenance log CRUD)
│
├── components/                       # Shared UI widgets and wizard flows
│   ├── OnboardingSteps.tsx           # Sub-steps for onboarding wizard (11 modular React UI views)
│   ├── OnboardingWizard.tsx          # Wizard controller, full scrollable landing page, demo-mode hooks
│   └── congratulationsSheet.tsx      # Success checkmark overlay sheet triggered on goals completion
│
├── hooks/                            # Global custom React hooks
│   ├── useGPSTracking.ts             # Background location manager (Location & TaskManager bridge, auto-pause)
│   ├── useWakeLock.ts                # Keep-awake screen wakelock manager
│   ├── useGoogleDriveSync.ts         # Google OAuth and sync triggers orchestrator
│   └── useMulti.ts                   # Multi-value state utility
│
├── src/
│   ├── components/
│   │   └── ui/                       # Shadcn-inspired React Native primitives
│   │       ├── BentoCard.tsx         # Bento Grid responsive chassis with grid span configurations
│   │       ├── PlatformBadge.tsx     # Color-themed badge pill for active platform mappings
│   │       ├── CurrencyText.tsx      # Region-aware, dynamic colorizer text based on values
│   │       ├── StatCard.tsx          # Structured KPI metrics blocks with percentage indicator
│   │       ├── EmptyState.tsx        # Placeholder card fallback when queries return 0 rows
│   │       └── SectionHeader.tsx     # Section sub-header with optional right side link action
│   │
│   ├── database/                     # SQLite Drizzle ORM configuration
│   │   ├── client.ts                 # SQLite connection singleton and migration runner
│   │   ├── schema.ts                 # Database tables, relationships, and type declarations
│   │   └── queries/                  # Modular database read/write transaction helpers
│   │       ├── analytics.ts          # Bento calculations, sparkline arrays, aggregates
│   │       ├── expenses.ts           # Expense read/write operations
│   │       ├── goals.ts              # Goal progress updates
│   │       ├── maintenance.ts        # Maintenance logs insert/delete operations
│   │       ├── platforms.ts          # Gig platforms seeding and rates edits
│   │       ├── shifts.ts             # Shift paging, inserts, deletes, and coordinates attachments
│   │       ├── tax.ts                # Tax YTD aggregate summaries
│   │       └── vehicles.ts           # Vehicles inventory and details fetching
│   │
│   ├── registry/                     # Constant configurations registries
│   │   ├── countries/                # Country variables (currency, units: CA vs US vs UK)
│   │   ├── provinces/                # Provincial/State presets (CRA/IRS preset rates)
│   │   ├── tax/                      # Withholding default percentages
│   │   ├── expenseCategories.ts      # Expense taxonomy mapping
│   │   ├── platforms.ts              # Supported gig applications configuration details
│   │   └── gpsConfig.ts              # Jitter thresholds, speed limits, tracking intervals
│   │
│   ├── services/                     # Device systems services
│   │   ├── googleDrive.ts            # Google Drive application data folder upload/download client
│   │   ├── cryptoHelper.ts           # Web Crypto API wrapper (PBKDF2 key derivation, AES-GCM encryption)
│   │   └── gamification.ts           # XP levels, streaks calculations, and badge awards evaluation
│   │
│   └── global.css                    # Tailwind configurations using NativeWind v4 engine
│
├── drizzle/                          # Database schema migration assets (automatically generated)
│   ├── 0000_concerned_zodiak.sql     # Base schemas (shifts, vehicles, expenses)
│   ├── 0001_opposite_zombie.sql     # Settings table schema
│   ├── ...                           # Additional incremental structural updates
│   └── migrations.js                 # Local migration log manifests
│
└── utils/                            # Mathematical core utilities
    ├── geoCalculations.ts            # Haversine distance, speed calculations, jitter validation
    ├── taxCalculations.ts            # CRA CPP rate calculators, IRS SE Tax, HST, mileage deductions
    ├── reportGenerator.ts            # CSV serializing, HTML templates layout, expo-print PDF generator
    └── mapMatching.ts                # OSRM road matching and route path coordinates simplifier
```

---

## 2. High-Level Architecture & Data Flow

Comma is designed as an **offline-first, local-first utility**. No user data, GPS coordinates, or financial transactions are ever sent to an external service unless explicitly initiated by the user via the encrypted Google Drive Backup feature.

### System Architecture Diagram

```text
               +------------------------------------------------------------+
               |                  UI View Layer (React Native)              |
               |     (Bottom Tabs Navigation / Stacked Sub-Route Screens)   |
               +-----------------------------+------------------------------+
                                             ^
                                             | Reads/Writes
                                             v
               +------------------------------------------------------------+
               |                     State Controllers                      |
               |  - React Query: Caches shifts, metrics, and expenses db data|
               |  - Zustand Stores: useSettingsStore, useActiveShift        |
               +-----------------------------+------------------------------+
                                             ^
                                             | Updates State / Queries DB
                                             v
               +------------------------------------------------------------+
               |              SQLite Database Client (Drizzle ORM)          |
               |  - Local File: comma.db (runs migrations on initial mount) |
               +-----------------------------+------------------------------+
                                             ^
                                             | Backs up / Restores (AES-GCM)
                                             v
               +------------------------------------------------------------+
               |             Google Drive Sync (OAuth API Client)           |
               |  - Uploads encrypted database dumps (.comdb) to App Data   |
               +------------------------------------------------------------+
```

### Background Processes & Event Driven Loops

```text
+-------------------+      GPS Tick      +-----------------------+      Matches Criteria      +--------------------+
|  Background GPS   |------------------->|   Jitter & Distance   |--------------------------->| updateActiveShift  |
|  (expo-location)  |                    |      Calculators      |                            |   Zustand Store    |
+-------------------+                    +-----------------------+                            +---------+----------+
                                                                                                        |
                                                                                                        | Updates
                                                                                                        v
+-------------------+      Triggers      +-----------------------+                            +---------+----------+
|  Active Timer     |------------------->|  Android Native Widget|                            | sqlite: settings   |
|  (1s setInterval) |                    |  (ActiveShiftWidget)  |<---------------------------| active_shift_state |
+-------------------+                    +-----------------------+                            +--------------------+
```

---

## 3. Database Strategy (SQLite & Drizzle Schema)

Drizzle ORM maps SQLite tables directly onto type-safe TypeScript interfaces. Migrations are stored in `./drizzle` and executed on device startup.

### Schema Relationships Diagram

```text
  +------------------+
  |     vehicles     |
  +------------------+
  | PK: id (text)    |<--------+
  | name (text)      |         |
  | type (text)      |         |
  | is_active (bool) |         |
  +------------------+         |
           |                   |
           | Has Many          | Has Many
           v                   |
  +------------------+         |
  | maintenance_logs |         |
  +------------------+         |
  | PK: id (text)    |         |
  | FK: vehicle_id   |         |
  | type (text)      |         |
  | cost (real)      |         |
  +------------------+         |
                               |
  +------------------+         |
  |      shifts      |         |
  +------------------+         |
  | PK: id (text)    |         |
  | FK: vehicle_id  |---------+
  | platform (text)  |
  | start_time (int) |
  | gross_rev (real) |
  | tips_rev (real)  |
  | route_path (text)|
  +------------------+
           |
           | Has Many (Cascade Delete)
           v
  +------------------+         +------------------+
  |     expenses     |         |  location_points |
  +------------------+         +------------------+
  | PK: id (text)    |         | PK: id (text)    |
  | FK: shift_id     |         | FK: shift_id     |
  | FK: vehicle_id   |         | latitude (real)  |
  | category (text)  |         | longitude (real) |
  | amount (real)    |         | speed (real)     |
  | deductible(bool) |         | timestamp (int)  |
  +------------------+         +------------------+
```

### Table Definitions & Column Metadata

1. **`vehicles`**:
   - `id` (Text, Primary Key)
   - `name` (Text, Not Null) — Nickname of the vehicle.
   - `type` (Text, Not Null) — e.g., `'car' | 'scooter' | 'ebike'`.
   - `isActive` (Integer as Boolean, Default `true`, Not Null)
   - `createdAt` (Integer as Timestamp, Not Null)
   - `make` (Text, Nullable)
   - `model` (Text, Nullable)
   - `year` (Integer, Nullable)
   - `fuelType` (Text, Nullable) — `'gas' | 'electric' | 'hybrid' | 'other'`.
   - `licensePlate` (Text, Nullable)

2. **`maintenanceLogs`**:
   - `id` (Text, Primary Key)
   - `vehicleId` (Text, Not Null, references `vehicles.id`)
   - `type` (Text, Not Null) — `'oil_change' | 'tire' | 'brake' | 'fuel' | 'wash' | 'other'`.
   - `cost` (Real, Not Null)
   - `odometer` (Real, Nullable)
   - `date` (Integer as Timestamp, Not Null)
   - `notes` (Text, Nullable)

3. **`shifts`**:
   - `id` (Text, Primary Key)
   - `vehicleId` (Text, Nullable, references `vehicles.id`)
   - `platform` (Text, Not Null) — Matches keys like `'doordash' | 'ubereats' | 'skip' | 'uber' | 'lyft' | 'instacart' | 'amazon_flex'`.
   - `startTime` (Integer as Timestamp, Not Null)
   - `endTime` (Integer as Timestamp, Not Null)
   - `grossRevenue` (Real, Default `0`, Not Null)
   - `tipsRevenue` (Real, Default `0`, Not Null)
   - `activeMileage` (Real, Default `0`, Not Null) — GPS-tracked delivery miles.
   - `deadMileage` (Real, Default `0`, Not Null) — GPS-tracked waiting/commute miles.
   - `durationSeconds` (Integer, Default `0`, Not Null) — Total elapsed shift time.
   - `pausedSeconds` (Integer, Default `0`, Not Null) — Total accumulated pause time.
   - `routePath` (Text, Nullable) — JSON serialized array of `{ latitude, longitude }` snapping points.
   - `notes` (Text, Nullable)
   - `trackedMileage` (Real, Default `0`, Not Null) — *[Deprecated, kept for backward compatibility]*

4. **`locationPoints`**:
   - `id` (Text, Primary Key)
   - `sessionId` (Text, Not Null) — Links tracking coordinates to a specific raw active session prior to shift save.
   - `shiftId` (Text, Nullable, references `shifts.id`) — Assigned on shift completion.
   - `latitude` (Real, Not Null)
   - `longitude` (Real, Not Null)
   - `altitude` (Real, Nullable)
   - `accuracy` (Real, Nullable)
   - `speed` (Real, Nullable)
   - `timestamp` (Integer as Timestamp, Not Null)
   - `source` (Text, Default `'gps'`, Not Null)
   - `isFiltered` (Integer as Boolean, Default `false`, Not Null)

5. **`expenses`**:
   - `id` (Text, Primary Key)
   - `shiftId` (Text, Nullable, references `shifts.id`) — Links shift-specific expenses.
   - `vehicleId` (Text, Nullable, references `vehicles.id`)
   - `category` (Text, Not Null) — Taxonomy matching CRA tax classifications.
   - `amount` (Real, Not Null)
   - `date` (Integer as Timestamp, Not Null)
   - `isDeductible` (Integer as Boolean, Default `true`, Not Null)
   - `notes` (Text, Nullable)
   - `receiptUri` (Text, Nullable) — Filepath to the locally stored image receipt.
   - `isRecurring` (Integer as Boolean, Default `false`, Not Null)
   - `recurringInterval` (Text, Nullable) — `'weekly' | 'monthly' | 'yearly'`.

6. **`goals`**:
   - `id` (Text, Primary Key)
   - `label` (Text, Not Null)
   - `targetValue` (Real, Not Null)
   - `unit` (Text, Not Null) — `'currency' | 'hours' | 'shifts' | 'mileage'`.
   - `period` (Text, Not Null) — `'daily' | 'weekly' | 'monthly' | 'yearly'`.
   - `isActive` (Integer as Boolean, Default `true`, Not Null)
   - `createdAt` (Integer as Timestamp, Not Null)

7. **`settings`**:
   - `key` (Text, Primary Key)
   - `value` (Text, Not Null) — Key-value metadata table (e.g., `'profile'`, `'active_shift_state'`, `'demo_mode'`).

8. **`taxHistory`**:
   - `id` (Text, Primary Key)
   - `oldRegion` (Text, Nullable)
   - `oldRate` (Real, Nullable)
   - `newRegion` (Text, Not Null)
   - `newRate` (Real, Not Null)
   - `changedAt` (Integer as Timestamp, Not Null)

9. **`platforms`**:
   - `id` (Text, Primary Key)
   - `label` (Text, Not Null)
   - `color` (Text, Not Null)
   - `textColor` (Text, Not Null)
   - `country` (Text, Not Null) — `'CA' | 'US' | 'UK' | 'NP'`.
   - `isActive` (Integer as Boolean, Default `false`, Not Null)
   - `hourlyRate` (Text, Default `'20'`, Not Null)
   - `mileageRate` (Text, Default `'0.62'`, Not Null)
   - `sortPriority` (Integer, Default `1`, Not Null)
   - `logoEmoji` (Text, Nullable)

---

## 4. State Management (Zustand & React Query)

### Zustand: Settings Store (`useSettingsStore`)
Maintains global application configurations, onboarding parameters, and the active driver profile.

- **Persistent Synced State**:
  - `isOnboardingCompleted`: Boolean driving landing/wizard routing.
  - `profile`: `DriverProfile` containing user's preferences:
    - `displayName` (string)
    - `country` (`"US" | "CA" | "UK"`)
    - `taxRegion` (e.g., `"ON"` for Ontario, `"CA"` for California)
    - `avatarType` (`"emoji" | "initials"`)
    - `avatarData` (string value of selected emoji/initials text)
    - `selectedPlatforms` (Array of active platform IDs)
    - `taxWithholdingPct` (number, default region preset)
    - `hstRegistered` (boolean, Canada tax tracking)
    - `distanceUnit` (`"km" | "mi"`)
  - `activeVehicle`: Current vehicle structure.
  - `isDemoMode`: Tracks if sample mockup data is active.
- **Methods**:
  - `completeOnboarding(profile, vehicle, vehicle2, useMileagePreset)`: Seeds platforms, persists config, inserts goals, creates active vehicle.
  - `loadSampleData()`: Generates 14 days of mock data (using Leaflet snapped coordinates, mock shift details, fuel expenses) and flags demo mode.
  - `clearSampleData()`: Triggers hard wipe of SQLite tables and routes back to the Welcome/Onboarding flow.
  - `updateProfile(patch)`: Modifies key driver attributes and dynamically updates distance units and regional presets.

### Zustand: Shift Store (`useActiveShift`)
Maintains real-time, in-memory status of active tracking sessions.

- **Variables**:
  - `isActive`: True if active stopwatch/GPS tracking is running.
  - `platform`: ID of the gig app currently worked.
  - `vehicleId`: ID of the vehicle driven during the shift.
  - `startTime`: Milliseconds timestamp when started.
  - `elapsedSeconds`: Cumulative active work duration.
  - `isPaused`: Pause toggle.
  - `pausedSeconds`: Cumulative paused duration.
  - `activeMileage`: Captured distance since order acceptance.
  - `deadMileage`: Captured distance waiting/commuting.
  - `isFirstOrderReceived`: Boolean state used for classifying active vs. dead miles.
  - `routePath`: Array of coordinates `{ latitude, longitude, timestamp }`.
- **Methods**:
  - `startShift(platform, vehicleId, targetTime)`: Initializes timer and flags active GPS tracking. Updates local SQLite configurations to share with native extensions.
  - `endShift()`: Stops tracking, fetches raw location points, matches coordinates via road-snapping algorithm, writes completed shift record to Drizzle database, and wipes memory store.
  - `incrementTimer()`: Runs on a 1-second interval, adding to active or paused duration.
  - `updateMileage(active, dead)`: Accurately accumulates mileage splits.

### React Query Integration
Handles data query caching, background syncing, and database cache invalidations.
- Queries cached globally: `['todayStats']`, `['weekStats']`, `['shifts']`, `['expenses']`, `['vehicles']`, `['goals']`.
- Saving a manual shift or updating expenses calls `queryClient.invalidateQueries()`, ensuring all screens immediately display fresh calculations.

---

## 5. Screen-by-Screen Breakdown & Logic

### Onboarding Wizard Flow (11 Steps)
Rendered automatically if `isOnboardingCompleted` is false.

```text
                  +-----------------------------------+
                  |        Landing/Welcome Page       |
                  |  - Show Logo & Core Features List |
                  |  - [START SETUP]  /  [TRY DEMO]   |
                  +-----------------+-----------------+
                                    | [START SETUP]
                                    v
+------------------------+     Next     +------------------------+
| 1. Country Selection   |------------->| 2. Tax Region Selection|
|    - US / CA / UK      |              |    - Preset rates flag |
+------------------------+              +-----------+------------+
                                                    | Next
                                                    v
+------------------------+     Next     +------------------------+
| 4. Avatar Setup        |<-------------| 3. Platforms Selector  |
|    - Emoji / Initials  |              |    - Grid of badge cards|
+------------------------+              +------------------------+
            | Next
            v
+------------------------+     Next     +------------------------+
| 5. Vehicle Profile     |------------->| 6. Work Schedule Preset|
|    - Dual profile toggle|             |    - Flex/Weekdays/etc.|
+------------------------+              +-----------+------------+
                                                    | Next
                                                    v
+------------------------+     Next     +------------------------+
| 8. Long-Term Target    |<-------------| 7. Weekly Earnings Goal|
|    - Monthly / Annual  |              |    - Auto-scales targets|
+------------------------+              +------------------------+
            | Next
            v
+------------------------+     Next     +------------------------+
| 9. Tax Withholding %   |------------->| 10. Sales Tax (HST/GST)|
|    - Auto Preset Slider|              |     - CA users only    |
+------------------------+              +-----------+------------+
                                                    | Next
                                                    v
                                        +------------------------+
                                        | 11. Completion Screen  |
                                        |  - Connect Drive Sync  |
                                        |  - [COMPLETE SETUP]    |
                                        +------------------------+
```

*Logic details per step*:
- **Step 1: Country Select**: Selects currency and default system distance unit.
- **Step 2: Region Select**: Displays states/provinces dynamically. Standard mileage preset checkbox lets the app fetch regional default rates.
- **Step 3: Platforms**: High-fidelity selector grid using custom badge components (e.g., DoorDash, Uber, Instacart). Must select at least one.
- **Step 4: Driver Profile**: Captures display name. Initializes avatar data.
- **Step 5: Vehicle Profile**: Basic vehicle data (make, model, year, type). A toggle switch allows adding a second vehicle profile.
- **Step 6: Work Schedule**: Selection preset used for scheduling integrations.
- **Step 7: Weekly Revenue**: Inputs target weekly payout. Automates monthly target (`* 4.33`) and annual target (`* 52`).
- **Step 8: Long-Term Target**: Allows overrides for monthly and annual goal metrics.
- **Step 9: Tax Withholding**: Integrates a preset withholding lookup based on state/province. User can fine-tune with a slider.
- **Step 10: Sales Tax**: Visible only to Canadian drivers. Gathers GST/HST registration status.
- **Step 11: Completion**: Displays setup validation details. Allows connecting Google Drive backup, exporting config templates, or launching the app.

---

### Bottom Tab Navigation Screen Group

#### Screen 1: Home Dashboard (`app/(tabs)/index.tsx`)
A Bento Grid layout that acts as the primary cockpit for tracking.

```text
+-----------------------------------------------------------+
| GREETING & HEADER                   [Notification bell]    |
| "Good morning, Jane Doe"                                  |
+-----------------------------------------------------------+
|                                                           |
|             ACTIVE SHIFT LOGGING HERO CARD                |
|             - platform branding colors                    |
|             - stopwatch timer counter                     |
|             - active vs. dead mileage splits              |
|             - [First Order Received] Switch toggle        |
|             - [PAUSE / RESUME] & [END SHIFT] buttons      |
|                                                           |
+-----------------------------------------------------------+
| TODAY'S PROJECTIONS           | WEEKLY PERFORMANCE        |
| Gross: $X.XX                  | Total: $X.XX              |
| Tips:  $X.XX                  | shifts: X                 |
| Net:   $X.XX                  | [Sparkline graph visual]  |
+-------------------------------+---------------------------+
| KM TRACKED                    | WEEKLY GOAL PROGRESS      |
| Active: X km                  | Progress ring layout      |
| Dead:   X km                  | $X / $Y goal target       |
+-----------------------------------------------------------+
| [START SHIFT ACTION FOOTER BAR]                           |
+-----------------------------------------------------------+
```

*Core UI Elements & Logic*:
- **Active Shift Hero Card**: Displays when a shift is active. Evaluates live states from `useActiveShift`. Shows a switch labeled **"Got First Order?"** which, when toggled, switches the classification of GPS distance from Dead Miles to Active Miles. Contains *End Shift* and *Pause* buttons. If inactive, displays a grid of platform buttons to instantly launch a shift.
- **Projections Bento Card**: Displays YTD and daily tax-deducted net income based on standard mileage write-offs.
- **Weekly Performance Bento Card**: Includes a dynamic SVGCurve Sparkline rendering daily progress over the past 7 days.
- **Weekly Goal Card**: Standard progress ring displaying current progress toward the driver's revenue target.
- **Action Footer Bar**: A bottom action panel that allows launching new shifts or adding manual shift entry records.

#### Screen 2: Shifts List (`app/(tabs)/shifts/index.tsx`)
A paginated history ledger showing all past logged driving sessions.

*Core Features & Logic*:
- **Filter Bar**: Contains horizontal scroll chips mapping selected platforms, alongside date pickers (native calendar on iOS/Android, input box fallback on web).
- **History list**: Groups shifts by Month-Year headers. Displays platform badge, shift start time, shift duration, active distance, gross payout, tips indicators, and notes.
- **Loads more**: Includes infinite scroll pagination via `getShiftsPaginated()` using query cursor limits.
- **Row deletion**: Slide-to-reveal or delete button which triggers a confirmation dialog before database removal.

#### Screen 3: Shift Details (`app/(tabs)/shifts/[id].tsx`)
Displays deep analytics for a specific shift session.

*Core Features & Logic*:
- **WebView Interactive Map**: Integrates Leaflet.js rendering CartoDB Dark Matter tile layers. It receives coordinates from the shift's `routePath` column, tracing the exact route driven. This is completely free and eliminates the need for expensive Google Maps API keys.
- **Mileage Split Visual**: Features a dual-colored bar showing the exact proportion of active miles vs. dead miles driven during the shift.
- **Expense integration**: Lists all expenses linked to this shift. Includes an inline form to add category-specific receipts (e.g. fuel, tolls) immediately.
- **Analytics row**: Shows true hourly earnings (Gross Payout divided by Shift Duration) and net hourly earnings (net of standard mileage deductions).

#### Screen 4: Analytics Dashboard (`app/(tabs)/analytics.tsx`)
Visualizes work trends and efficiency scores.

*Core Features & Logic*:
- **Timeframe Selector**: Toggles metrics between Daily, Weekly, Monthly, and Yearly aggregates.
- **Hourly Rate Chart**: SVGCurve bar chart showcasing which hours of the day generate the highest average payouts.
- **Platform Breakdown**: Pie chart showing gross revenue contributions from each active platform (e.g. 60% DoorDash, 40% Uber).
- **Efficiency KPIs**: StatCards showing average revenue per mile, average tips ratio, and active-to-dead mileage efficiency percentages.

#### Screen 5: Expenses (`app/(tabs)/expenses/index.tsx`)
A ledger of all recorded expenses and receipts.

*Core Features & Logic*:
- **Grouped list**: Groups records by month with category tags. Shows a photo icon if a receipt is attached. Clicking the icon opens a full-screen preview.
- **Filter toggle**: Filters expenses between "Deductible Only" (CRA/IRS compliant) and "All Expenses".
- **Floating Action Button**: Launches the Add Expense Modal.

#### Screen 6: Tax Workspace (`app/(tabs)/tax/index.tsx`)
A localized tax estimator dashboard.

*Core Features & Logic*:
- **YTD Tax Aggregator**: Sums all earnings, subtracts deductible expenses and mileage write-offs, and displays the net taxable income.
- **Withholding Estimator**: Multiplies net income by the profile's tax withholding percentage to show the recommended tax savings.
- **CRA/IRS Specific Engine**:
  - *Canada (CRA)*: Displays estimated Canada Pension Plan (CPP) contributions, HST tracking (collected vs. Input Tax Credits), and maps deductions to T2125 form lines.
  - *United States (IRS)*: Displays Self-Employment Tax estimates, maps write-offs to Schedule C lines, and schedules IRS quarterly payment alerts.
- **Installment Milestones**: Displays upcoming estimated tax due dates with countdown indicators.

#### Screen 7: More Menu (`app/(tabs)/more.tsx`)
A clean navigation hub for stacked configuration routes.

*List navigation options*:
- **Goals Setup** (`app/goals/index.tsx`): CRUD configuration for daily, weekly, and monthly targets.
- **Schedule Calendar** (`app/schedule/index.tsx`): Monthly calendar grid with platform-colored dot indicators showing logged/scheduled shifts.
- **Vehicle Profiles** (`app/vehicles/index.tsx`): Manage vehicle inventories and maintenance records.
- **App Settings** (`app/settings/index.tsx`): Configure driver profile and data syncs.
- **CSV Data Import** (`app/settings/import.tsx`): Open CSV wizard.
- **About Comma** (`app/about/index.tsx`): Display legal disclaimers and export diagnostic system logs.

---

### Stacked Sub-Route Screens

#### Screen 8: Manual Shift Entry Modal (`app/shift/add.tsx`)
A form to manually log a shift if background tracking wasn't used.

*Inputs & Validation*:
- **Platform Selector**: Radio badge grid. Validates that a platform is selected.
- **Vehicle Linker**: Radio list of active vehicles from the database.
- **Date & Time Pickers**: Captures start and end dates/times, ensuring the end time is after the start time.
- **Revenue Fields**: Numeric inputs for Gross Revenue and Tips.
- **Distance Inputs**: Numeric inputs for Active and Dead mileage.
- **Notes Textbox**: Optional text field.
- **Save Action**: Triggers database insertion and invalidates cache queries.

#### Screen 9: Add/Edit Expense Modal (`app/expense/add.tsx`)
Captures financial expenses and receipt photos.

*Inputs & Validation*:
- **Category Dropdown**: Pre-defined classifications (Fuel, Maintenance, Phone, Insurance, Parking, Tolls, Other).
- **Amount & Date**: Numeric input and date picker.
- **Deductible switch**: Default true. Can be toggled off for personal expenses.
- **Vehicle Linker**: Optional selection.
- **Receipt Attachment**: Buttons to capture a photo using the device camera or select a photo from the gallery. Saves files locally in the application's document directory and persists the filepath.

#### Screen 10: Goals Workspace (`app/goals/index.tsx`)
Manage and track active earnings goals.

*Features & Logic*:
- **Goal Form**: Set custom labels, select units (Currency, Hours, Shifts, Distance), target values, and timeframe periods (Daily, Weekly, Monthly, Yearly).
- **Active tracking**: Renders progress cards comparing current SQLite aggregates against target goals.
- **Success trigger**: Crossing a goal target triggers the Congratulations success overlay sheet.

#### Screen 11: Schedule & Shift Templates (`app/schedule/index.tsx`)
A calendar to plan upcoming work schedules.

*Features & Logic*:
- **Monthly Grid**: Custom rendering of a calendar grid where dates containing logged shifts display a dot matching the platform's color.
- **Day Selector**: Displays a summary card of shifts logged on the selected day.
- **Shift Presets**: Lets users define template presets (e.g. "Friday Lunch: 11:30 AM - 2:30 PM on DoorDash").
- **Local Alerts**: Schedules local reminders via `expo-notifications` 30 minutes before a planned shift starts.

#### Screen 12: Vehicle Profiles & Maintenance (`app/vehicles/index.tsx` & `[id].tsx`)
Inventory control and maintenance tracking for delivery vehicles.

*Features & Logic*:
- **Vehicle details**: Displays aggregate metrics for each vehicle (total shifts logged, total distance tracked).
- **Maintenance log CRUD**: Records maintenance entries (Oil Change, Tires, Brakes, Fuel, Car Wash, Repair). Captures service date, cost, odometer readings, and notes.
- **Log history**: Lists past maintenance logs with category-specific emojis (e.g. 🛢️ for oil change, 🔧 for repairs).

#### Screen 13: Settings Panel (`app/settings/index.tsx`)
Manage profile settings and data backups.

*Sections & Logic*:
- **Profile Configuration**: Modify display name, country, and tax region. Changing the country automatically updates distance units (miles vs. kilometers) and default currencies.
- **Platforms Inventory**: Toggle available platforms on/off in the registry.
- **Data & Backups**:
  - *Google Drive Connection*: Sign in or out of Google Account. Displays list of available backups.
  - *Manual Export/Import*: Triggers local CSV exports.
- **Danger Zone**: Hard reset trigger to wipe all database tables.

#### Screen 14: CSV Import Wizard (`app/settings/import.tsx`)
Bulk ingestion of external platform data.

*Ingestion Wizard steps*:
- **Step 1: Document Pick**: Uses `expo-document-picker` to select local CSV files.
- **Step 2: Schema Matching**: A mapping screen lets users match CSV columns (Date, Platform, Revenue, Tips, Mileage) to the database schema fields.
- **Step 3: Preview**: Parses and displays the first 5 records using PapaParse, validating correct column mappings.
- **Step 4: Import**: Runs a bulk database transaction to import the shifts, displaying success statistics on completion.

---

## 6. Background Services & Native Features

### Background GPS Tracking (`hooks/useGPSTracking.ts`)
Tracks driver coordinates while the app is in the background.

- **System Hooking**: Starts when a shift is active. Registers the task globally using `TaskManager.defineTask("COMMA_BACKGROUND_LOCATION_TASK")`.
- **Location Config**: Requests foreground and background permissions. Starts background tracking with high accuracy, a 10-meter distance interval, and a 5-second time interval. Runs a persistent foreground service notification on Android.
- **Movement calculations**:
  - Evaluates distance between coordinates using the Haversine formula:
    $$d = 2R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)}\right)$$
  - Calculates speed between points to distinguish driving from standstills.
- **Jitter Filtering**: Compares speed between coordinate updates. If speed exceeds the threshold configured in `gpsConfig.ts` (e.g., > 150 km/h), the update is classified as GPS jitter and discarded.
- **Auto-Pause Engine**: Tracks standstill duration. If speed stays below 5 km/h for 3 consecutive updates (15 seconds), the shift is auto-paused to prevent battery drain. Movement above 5 km/h automatically resumes tracking.

### Wake Lock prevention (`hooks/useWakeLock.ts`)
Keeps the device screen on during active delivery shifts.

- Calls `expo-keep-awake` when a shift starts.
- Keeps the screen active so drivers can view navigation maps safely.
- Deactivates keep-awake automatically when the shift is ended.

---

## 7. Cloud Backup & Encryption Logic

To ensure absolute privacy, data backup does not rely on a central server. Backups are saved directly to the user's private Google Account.

### Encryption Pipeline Diagram

```text
+-------------------+
|  Local SQLite DB  |
|  (Shifts, Goals,  |
|  Expenses, etc.)  |
+---------+---------+
          |
          | 1. Serialize to JSON Payload
          v
+---------+---------+
|  JSON String Data |
+---------+---------+
          |
          | 2. Generate 256-bit Key (PBKDF2: Local Seed + User 4-digit PIN)
          v
+---------+---------+
|   Crypto Key      |
+---------+---------+
          |
          | 3. AES-GCM Encrypt (with Random 12-byte IV)
          v
+---------+---------+      4. Encrypted JSON Payload      +-----------------------+
|  Ciphertext Data  |------------------------------------>| Google Drive OAuth API|
|  (iv, content,    |                                     | (appDataFolder upload)|
|   tag)            |                                     +-----------------------+
+-------------------+
```

- **Authentication**: Authenticates via Google Sign-In on native mobile and OAuth implicit flow on web. Requests scope for the private `drive.appdata` folder (invisible to other applications).
- **Key Derivation (PBKDF2)**: Generates a persistent random 32-byte seed in secure storage. Uses PBKDF2 (1000 iterations, SHA-256) to combine the seed with the user's 4-digit security PIN, deriving a unique 256-bit key.
- **Encryption (AES-GCM)**: Encrypts the serialized JSON payload using AES-GCM 256-bit with a random 12-byte IV, returning the IV, ciphertext content, and 16-byte authentication tag.
- **Upload**: Uploads the encrypted payload as a `.comdb` file to Google Drive.
- **Restore**: Downloads the backup file, decrypts it using the same 4-digit PIN, validates the JSON schema, and restores the database tables inside an SQLite transaction.

---

## 8. Localized Taxation and Market Customization

Comma adapts its tax formulas, terminology, and preset values dynamically based on the driver's country and region.

### Market Adaptations Table

| Dimension | Canada (CA) | United States (US) | United Kingdom (UK) |
| :--- | :--- | :--- | :--- |
| **Primary Currency** | CAD ($) | USD ($) | GBP (£) |
| **Metric Units** | Kilometers / km | Miles / mi | Miles / mi |
| **Tax Authority** | Canada Revenue Agency (CRA) | Internal Revenue Service (IRS) | HM Revenue & Customs (HMRC) |
| **Mileage Deduction Preset** | $0.70 per km (first 5,000 km) / $0.64 thereafter | $0.67 per mile | £0.45 per mile (first 10,000 mi) / £0.25 thereafter |
| **Self-Employment Contribution** | Canada Pension Plan (CPP) Self-Employed Engine | Self-Employment Tax (SE Tax: 15.3% on 92.35%) | National Insurance Class 2 & 4 |
| **Sales Tax Obligations** | GST/HST Collected & Input Tax Credit (ITC) reconciliation | N/A | VAT schemes (if registered) |
| **Standard Regulatory Forms** | Form T2125 (Business Statement) | Schedule C (Profit/Loss) | SA103F (Self-Employment) |

### Key Tax Calculation Implementations

#### 1. Canada Pension Plan (CPP) Calculation
Self-employed workers pay both the employee and employer portions of CPP (11.9% total) up to the Year's Maximum Pensionable Earnings (YMPE) limit, after subtracting the basic exemption:

$$\text{CPP Earnings} = \max\left(0, \min(\text{Net Income}, \$68,500) - \$3,500\right)$$

$$\text{Total CPP Contribution} = \text{CPP Earnings} \times 0.119$$

#### 2. United States Self-Employment (SE) Tax
Self-employment tax applies to 92.35% of net profit at a rate of 15.3%:

$$\text{Taxable Profit} = \text{Net Profit} \times 0.9235$$

$$\text{SE Tax Amount} = \text{Taxable Profit} \times 0.153$$

#### 3. GST/HST Input Tax Credits (ITC)
Canadian drivers track HST/GST collected on fares and subtract the sales tax paid on business expenses, calculating the net tax owed or refundable:

$$\text{Net Sales Tax} = \text{Fares HST Collected} - \text{Expenses HST Paid (ITC)}$$

---

## 9. UI Chassis & Styling Guidelines

The application's UI system is built on a dark mode design palette with emerald green brand highlights.

### Brand Design Palette
- **System Background**: Deep warm-slate `#12110f` (flat color, no card frames on onboarding).
- **Secondary Card Backgrounds**: Charcoal `#1c1b18` with subtle slate borders `#3d3a35`.
- **Primary Brand Accent**: Emerald Green `#10b981` (active tabs, start actions, platform selection indicator).
- **Primary Typography Text**: Warm Off-White `#f4f2ed`.
- **Muted Labels Text**: Warm Muted Gray `#b8b4ab`.

### Standard Layout Chassis Components

1. **BentoCard**:
   - Accepts width and height grid spans (`'1x1' | '2x1' | '1x2' | '2x2'`).
   - Renders a clean card using the charcoal background, warm off-white typography, and responsive touch feedback.
2. **StatCard**:
   - Displays key performance indicators.
   - Shows a large main metric, category label, and an optional percentage badge (green for positive trends, red for negative).
3. **PlatformBadge**:
   - Renders platform-colored pills (e.g. red for DoorDash, green for UberEats, orange for SkipTheDishes) based on registry configs.
4. **CurrencyText**:
   - Formats currency values dynamically based on the driver's country selection (e.g., CAD vs. USD formats).
   - Colorizes text automatically: green for positive numbers, red for negative numbers, and muted gray for zero.
5. **EmptyState**:
   - Standard fallback container displaying a Lucide vector icon, title, description, and an optional action button. Used when query lists return empty database tables.

---

## 10. Gamification Engine (Streaks, XP, & Badges)

Comma incorporates a local-first gamification service (`src/services/gamification.ts`) designed to increase driver engagement through achievement systems, challenges, level pacing, and streaks.

### A. Gamification State Schema
The gamification system status is stored as a JSON string under the key `'gamification_state'` in the settings table:
*   `xpTotal` (Number): Total Experience Points accumulated (e.g., +40 for badges, +60 for challenge completions, +30 for personal best records).
*   `xpLevel` (Number): Calculated dynamically as:
    $$\text{Level} = \max\left(1, \lfloor \text{xpTotal} / 100 \rfloor + 1\right)$$
*   `streakDays` (Number): Current consecutive working day streak.
*   `streakLastDay` (String): ISO Date representation of the last logged shift day (`YYYY-MM-DD`).
*   `streakFrozenCount` (Number): Number of streak freeze tokens available (default 1).
*   `personalRecords` (Object):
    *   `bestShiftGross` (Number): Highest gross payout (revenue + tips) logged for a single shift.
    *   `bestNetHourly` (Number): Highest net hourly rate (gross payout divided by active shift hours) achieved.
*   `unlockedBadgeIds` (Array of Strings): Identifiers of earned badges.
*   `challenges` (Array of Objects): Progress states on active weekly challenges.
*   `notifications` (Array of Objects): History ledger of notifications shown inside the Inbox screen.

### B. Dynamic Streak Evaluation
Streaks are calculated automatically inside `evaluateAll()`:
1.  Loads all shift records from the SQLite database.
2.  Extracts the starting date of each shift and formats it as a `YYYY-MM-DD` string, resolving duplicate dates to produce a unique, chronologically sorted array of active working days.
3.  Evaluates sequential days. If the gap between two successive active days is exactly 1 day, the streak increments.
4.  If the gap is greater than 1 day, the engine checks `streakFrozenCount`. If a freeze token is available, it is consumed, the freeze count decrements by 1, and the streak is preserved. If no freeze tokens are available, the streak resets to 1 day.
5.  If a driver has a streak but has not logged a shift today, the system inserts a high-priority "Day Streak at Risk!" warning notification.

### C. Personal Record Tracking
Every time a shift is saved, the engine recalculates the gross revenue and net hourly rate. If the new values exceed `bestShiftGross` or `bestNetHourly`, the system triggers:
-   An update to the record bounds.
-   An award of +30 XP.
-   A success notification in the driver's inbox.

### D. Active Challenges Registry
The store initializes three default weekly challenges:
1.  **"Earn 500 This Week"** (`challenge_earn_500_week`): Tracked by summing the gross revenue of all shifts logged since the starting day of the current calendar week. Reaching $500 completes the challenge, awarding +60 XP.
2.  **"20 Deliveries"** (`challenge_20_deliveries_week`): Tracked by counting deliveries completed. The engine parses the shift's `notes` using a regular expression (`/(\d+)\s*deliver/i`) to count specific delivery metrics entered by the driver. If no notes exist, it defaults to a mock metric of 8 deliveries per logged shift. Reaching 20 deliveries awards +60 XP.
3.  **"5 Shift Streak"** (`challenge_5_shift_streak`): Completed when the consecutive streak counter reaches 5 days, awarding +60 XP.

### E. Badge Definitions & Conditions
Achievements are evaluated across 4 categories defined in `src/registry/badges/index.ts`:

*   **Milestone Badges**:
    *   *First Shift* (`first_shift`): `stats.shiftCount >= 1`.
    *   *Century Day* (`century_day`): Single shift gross earnings $\ge \$100$.
    *   *Power Week* (`five_hundred_week`): Weekly gross earnings $\ge \$500$.
    *   *Thousand Club* (`thousand_month`): Monthly gross earnings $\ge \$1,000$.
    *   *Marathon* (`marathon_shift`): Shift duration $\ge 8\text{ hours}$.
    *   *Multi-App* (`multi_app_master`): Shift platform matches `"multiapp"` or flag `isMultiApp = true`.
    *   *Tip Champion* (`tip_champion`): Tips-to-gross ratio $\ge 25\%$.
    *   *Bonus Hunter* (`bonus_hunter`): Promotional surge/bonus payout-to-gross ratio $\ge 15\%$.
    *   *Expense Savvy* (`expense_savvy`): Cumulative logged expenses count $\ge 10$.
    *   *Vehicle Caretaker* (`vehicle_caretaker`): Custom active vehicle profile initialized.
    *   *Goal Achiever* (`goal_week_hit`): Hit weekly revenue target.
    *   *Monthly Master* (`goal_month_hit`): Hit monthly revenue target.
*   **Streak Badges**:
    *   *7-Day Streak* (`streak_7`), *30-Day Streak* (`streak_30`), *Centurion Streak* (`streak_100`): Hit respective consecutive day counts.
    *   *Perfect Week* (`perfect_week`): Log a shift every calendar day of a week.
*   **Record Badges**:
    *   *Record Breaker* (`personal_best_earnings`): Sets a new single-shift gross record.
    *   *Efficiency Expert* (`personal_best_hours`): Sets a new net-hourly rate record.
*   **Special Badges**:
    *   *Weekend Warrior* (`weekend_warrior`): Logged shifts on Saturdays/Sundays $\ge 10$.
    *   *Rain Rider* (`rain_rider`): Parses shift notes for terms like `"rain"`, `"storm"`, or `"wet"`.
    *   *Peak Collector* (`peak_collector`): Parses notes for promo terms like `"peak"`, `"surge"`, or `"promo"`.

---

## 11. Map Matching & Path Optimization (simplify-js & OSRM)

To ensure that GPS coordinates do not bloat the local SQLite database and that route paths display cleanly on navigation maps, Comma implements a two-stage coordinate cleaning pipeline (`utils/mapMatching.ts`).

### A. Stage 1: Douglas-Peucker path simplification
Raw GPS tracking records coordinate crumbs continuously. The system filters this noise using `simplify-js`:
*   Translates coordinate objects `{ latitude, longitude }` into `{ x, y }` Cartesian coordinates.
*   Runs the Douglas-Peucker reduction algorithm with a tolerance boundary of `0.00005` degrees (approximately ~5 meters).
*   Eliminates redundant points (e.g. coordinates recorded while at red lights or in straight lines), preserving curves and corners.

### B. Stage 2: Road Snapping via Project-OSRM API
To match simplified points to the actual road network, Comma queries the Open Source Routing Machine (OSRM) service:
1.  Filters the simplified coordinates. If the array length exceeds 100 points, it downsamples the array to fit OSRM's limit of 100 coordinates per request.
2.  Formats coordinates into a semicolon-separated string: `longitude,latitude;longitude,latitude...`.
3.  Queries the OSRM Match API:
    `https://router.project-osrm.org/match/v1/driving/{coords}?overview=full&geometries=geojson&annotations=false&gaps=ignore`
4.  Sets an abort timeout of 8 seconds (`AbortController`) to handle offline scenarios.
5.  Extracts the snapped road geometry from the response GeoJSON coordinates, translating `[longitude, latitude]` pairs back into `{ latitude, longitude }` objects.

### C. Graceful Fallback
If the device has no internet access, OSRM returns an error, or the API call times out, the system catches the exception and falls back to saving the simplified Douglas-Peucker coordinates directly. This ensures the app remains fully functional offline.

---

## 12. Android Home Screen Widget (ActiveShiftWidget)

Comma includes a native Android widget implementation using `react-native-android-widget`. This allows drivers to monitor their active shift metrics directly from their phone's home screen.

### A. Widget Layout Structure
The widget UI is defined in `src/widgets/ActiveShiftWidget.tsx` using specialized native elements (`FlexWidget` and `TextWidget`):
*   **Chassis Background**: Standard dark-theme `#000000` layout with rounded corners (`16dp` radius). Contains a click action mapping to `"OPEN_APP"`, allowing drivers to tap the widget to open the main app.
*   **Status Header Row**: Displays the app title `"COMMA"`. Contains a status badge component:
    *   *If Tracking*: Green background pill (`rgba(34, 197, 94, 0.2)`) containing green text `"TRACKING"`.
    *   *If Offline*: Slate background pill (`rgba(100, 116, 139, 0.2)`) containing gray text `"OFFLINE"`.
*   **Active Shift Info Area**: Renders only if `isActive` is true:
    *   *Platform Name*: Displays the name of the active platform in uppercase (e.g. `"DOORDASH"`).
    *   *Stopwatch Timer*: Renders elapsed time formatted as `HH:MM:SS`.
    *   *Mileage Indicator*: Shows cumulative active and dead miles tracked during the shift (e.g. `"14.2 miles tracked"`).
*   **Offline State Area**: Renders if no shift is active:
    *   Displays placeholder texts: `"No active shift"` and `"Tap to log dynamic metrics"`.

### B. Widget State Synchronization
1.  When any shift action is triggered in the Zustand store (`startShift`, `endShift`, `pauseShift`, `resumeShift`, or `reset`), the app calls `updateWidgetState`.
2.  `updateWidgetState` serializes the current active shift properties (tracking status, platform, vehicle, startTime, pausedSeconds, and mileage splits) and writes them to the settings table under the key `"active_shift_state"`.
3.  The app then triggers a native broadcast:
    ```typescript
    const { requestWidgetUpdate } = require("react-native-android-widget");
    requestWidgetUpdate({ widgetName: "ActiveShiftWidget" });
    ```
4.  On the native side, the broadcast fires `widgetTaskHandler` (`src/widgets/widgetTaskHandler.tsx`). This background task reads `"active_shift_state"` from the SQLite database, parses the shift state, and re-renders `ActiveShiftWidget` on the home screen.

---

## 13. Localized Expense Classifications

To ensure write-offs comply with regional tax guidelines, expense categories adapt dynamically based on the driver's country selection:

*   **Canada (CRA Guidelines)**: Maps directly to CRA Form T2125 lines.
    *   `fuel` (Fuel & Oil) - ⛽
    *   `maintenance` (Maintenance & Repairs) - 🔧
    *   `insurance` (Auto Insurance) - 🛡️
    *   `licensing` (License & Registration fees) - 🪪
    *   `interest` (Loan Interest on vehicle finance) - 📈
    *   `leasing` (Leasing Costs) - 🤝
    *   `fees` (Dues, Subscriptions & Association fees) - 💼
    *   `phone` (Mobile Phone and Internet packages) - 📱
    *   `supplies` (Delivery bags, tools) - 🎒
    *   `wash` (Cleaning & Car Wash) - 🚿
    *   `other` (General other expenses) - 💵

*   **United States (IRS Schedule C Guidelines)**:
    *   `fuel` (Gas & Fuel) - ⛽
    *   `maintenance` (Maintenance) - 🔧
    *   `insurance` (Auto Insurance) - 🛡️
    *   `licensing` (Taxes & Licenses) - 🪪
    *   `interest` (Vehicle Loan Interest) - 📈
    *   `leasing` (Lease & Rental payments) - 🤝
    *   `phone` (Phone & Data packages) - 📱
    *   `supplies` (Tools & Supplies) - 🎒
    *   `parking` (Tolls & Parking fees) - 🅿️
    *   `other` (Other miscellaneous expenses) - 💵

*   **United Kingdom (HMRC SA103F Guidelines)**:
    *   `fuel` (Fuel & Oil) - ⛽
    *   `maintenance` (Repairs & Servicing) - 🔧
    *   `insurance` (Car Insurance) - 🛡️
    *   `licensing` (Road Tax & Registration) - 🪪
    *   `interest` (Finance Interest) - 📈
    *   `leasing` (Vehicle Hire/Rental) - 🤝
    *   `phone` (Mobile Phone & Data plans) - 📱
    *   `supplies` (Equipment & Uniforms) - 🎒
    *   `parking` (Parking & Tolls) - 🅿️
    *   `other` (Other business expenses) - 💵

---

## 14. Internationalization & Country Profiles

Comma is pre-configured with support for multiple countries. Each country definition is registered in `src/registry/countries/index.ts`:

### A. Canada (CA)
*   **Currency**: CAD ($)
*   **Distance Units**: Metric (km)
*   **Tax Authority**: Canada Revenue Agency (CRA)
*   **Standard Mileage Preset**: $0.70/km up to 5,000 km, $0.64/km thereafter.
*   **Canada Pension Plan (CPP)**: Self-employed rate of 11.9% applied.
*   **Sales Tax**: Gathers GST/HST registration status. Displays HST Collected and Input Tax Credit (ITC) reconciliation tools.
*   **Quarterly Payment Schedule**: March 15, June 15, September 15, December 15.

### B. United States (US)
*   **Currency**: USD ($)
*   **Distance Units**: Imperial (miles)
*   **Tax Authority**: Internal Revenue Service (IRS)
*   **Standard Mileage Preset**: $0.67/mile.
*   **Self-Employment (SE) Tax**: 15.3% tax rate applied to 92.35% of net profits.
*   **Sales Tax**: None.
*   **Quarterly Payment Schedule**: April 15, June 15, September 15, January 15.

### C. United Kingdom (UK)
*   **Currency**: GBP (£)
*   **Distance Units**: Imperial (miles)
*   **Tax Authority**: HM Revenue & Customs (HMRC)
*   **Standard Mileage Preset**: £0.45/mile up to 10,000 miles, £0.25/mile thereafter.
*   **National Insurance**: Supports standard Class 2 and Class 4 calculations.
*   **Quarterly Payment Schedule**: Self-Assessment deadline (January 31), First Payment on Account (January 31), Second Payment on Account (July 31).

### D. Nepal (NP)
*   **Currency**: Nepalese Rupee (₨)
*   **Distance Units**: Metric (km)
*   **Primary Gig Platforms**: Pathao, Pathao Food, InDriver, Foodmandu, Bhoj.
*   **Cash Economy Optimization**: Set to `cashEconomyPrimary: true`. This dynamically updates the UI to show cash transaction inputs, change-making calculations, and receipt formatting parameters prominently, reflecting the cash-dominant nature of the local market.
*   **Tax Installments**: Disabled (Nepal has no formal estimated quarterly tax schedule). Default tax withholding is set to 0%.

---

## 15. Developer Tools & Secret Debugger Route

Comma provides a hidden developer panel for internal diagnostics and sandbox testing:
*   **Trigger Mechanism**: Tapping the app version text (e.g., `v1.0.0 (SDK 56.0.0)`) on the **About Screen** exactly 5 times.
*   **Interval Guard**: Taps must occur within a 5.5-second window. A state counter `debugTapCount` registers sequential taps, resetting if the elapsed time between taps exceeds 5.5 seconds (`debugTapTs`).
*   **Action**: Unlocks developer tools and prompts a confirmation dialog with the option `"Open dev tools"`. Selecting this redirects the navigation stack to the hidden route `/debug`.

---

## 16. Snapped Demo Route Dataset (`store/demoRoutes.ts`)

During demo mode setup, Comma seeds mock shifts with realistic GPS paths. Instead of generating random linear coordinates, the app utilizes pre-calculated road paths:
*   **Route Inventory**: Pre-defined geo-coordinate trails matching Toronto, Montreal, Ottawa, and St. Johns, categorized by vehicle type:
    *   `car`: City-wide delivery routes with coordinate grids (~120 to 250 coordinates).
    *   `scooter`: Neighborhood delivery loops.
    *   `ebike`: Local neighborhood street pathways.
*   **OSRM Pre-Snapping**: These routes are pre-calculated using the Open Source Routing Machine `/route/v1/driving` API with `overview=full` and `geometries=geojson` options to guarantee points follow real roads.
*   **Chronological Timestamp Simulation**: When generating demo shifts, the array of `[longitude, latitude]` pairs is transformed:
    *   Coordinates are mapped to `{ latitude, longitude, timestamp }` objects.
    *   Timestamps are incremented sequentially between points to simulate driving speeds:
        $$\text{Point Time} = \text{Previous Time} + 6000\text{ms} + \left(\left(\text{Shift ID} \times 7 + \lfloor |\text{Longitude} \times 10| \rfloor\right) \bmod 8000\right)\text{ms}$$
    *   This formula ensures variations in simulated travel times, avoiding static intervals.

---

## 17. Cross-Platform Web Compatibility Layer (LocalStorage Schema)

Comma is a hybrid application compiled for Android, iOS, and Web. Since SQLite is not natively supported in standard web browsers, a compatibility layer handles web execution:

### A. Conditional SQLite Bypassing
In `app/_layout.tsx` and `src/database/client.ts`, the app checks `Platform.OS === 'web'`:
*   Conditionally excludes `SQLiteProvider` from the React node tree.
*   Bypasses Drizzle SQLite connections on web platforms to prevent WASM file resolution crashes (`wa-sqlite.wasm`).
*   Wraps native alert configurations (`Alert.alert`) in browser-compatible conditional logic (`window.confirm` / `window.alert`).

### B. Web LocalStorage Key Map
On Web platforms, Zustand state and local tables are stored directly in the browser's `localStorage` using serialized JSON structures:
*   `comma_onboarding_completed`: Represents the completion flag of the wizard (`"true"`/`"false"`).
*   `comma_profile`: Contains the JSON representation of the `DriverProfile` object.
*   `comma_vehicle`: Persists the primary active vehicle metadata.
*   `comma_vehicle2`: Persists the optional secondary vehicle metadata.
*   `comma_demo_mode`: Tracks whether the seeded mockup data is active.
*   `comma_active_platform_filter`: The currently selected platform key filter.
*   `comma_preferred_vehicle_id`: Stores the string ID of the preferred vehicle.
*   `comma_shifts`: Serialized array of shift objects representing the shifts table.
*   `comma_expenses`: Serialized array of expense objects representing the expenses table.
*   `comma_goals`: Serialized array of goals objects representing the goals table.
*   `comma_last_backup_at`: ISO timestamp string of the last successful backup.
*   `comma_gdrive_tokens`: Encrypted JSON credentials representing Google Drive OAuth tokens.

---

## 18. Architectural Fundamentals: Ground-Up Modularity

Comma is engineered using a decoupled, modular architecture. The core design principle is **data-driven execution over hardcoded logic**. This ensures that regional expansion, regulatory updates, platform addition, and platform-specific styling can be performed with minimal changes to the screen components.

Below are the six core design strategies that implement this modularity:

### A. The Registry Pattern (Configuration Decoupling)
Instead of embedding business rules directly in screens or forms, Comma abstracts configuration into centralized registries (`src/registry/`):
*   **Country Registry** (`countries/index.ts`): Houses core parameters (distance units, currency formatting, tax profiles, and regional boundaries) for CA, US, UK, and NP. Adding a new country takes less than 30 lines of declarative code.
*   **Province Registry** (`provinces/index.ts`): Maps state/provincial sales taxes, available platforms, and mileagePresets (e.g. California Prop 22 vs. Federal IRS rates).
*   **Expense Category Registry** (`expenseCategories.ts`): Customizes tax-deduction categories based on country guidelines.
*   **Platform Registry** (`platforms.ts`): Stores gig app names, default colors, text ratios, and priority values.

*Impact*: Pages query these registries dynamically:
```typescript
const countryDef = getCountryDef(profile.country);
const categories = getExpenseCategories(profile.country);
```
The view layer automatically adapts its labels, currency symbols, metric systems, and input lists based on the resolved configurations.

### B. State & Database Decoupling
The application separates volatile live-work states from cold database records:
*   **In-Memory Session Store (Zustand)**: `useActiveShift` manages active timers, pause accumulators, and real-time GPS coordinate logging in RAM.
*   **Query Repository (Drizzle/SQLite)**: Cold queries, bulk inserts, pagination, and multi-table operations are encapsulated inside standalone modules in `src/database/queries/`.
*   **Bridge Layer**: On shift completion, Zustand compiles the in-memory coordinate trail and stopwatch totals, passes the payload to `insertShift()`, and resets itself. This prevents heavy SQLite transaction locks from interrupting the smooth execution of active UI animations and foreground stopwatch timers.

### C. Isolated Custom UI Chassis Primitives
UI primitives are decoupled under `src/components/ui/` with clean properties and unified layout chassises.

```text
               +--------------------------------------------+
               |              Standard UI Chassis           |
               +--------------------------------------------+
                                     |
      +-----------------+------------+-----------+------------------+
      |                 |                        |                  |
      v                 v                        v                  v
+-----------+    +---------------+        +--------------+    +------------+
| BentoCard |    | PlatformBadge |        | CurrencyText |    |  StatCard  |
| (Layout)  |    | (Theming)     |        | (Formatting) |    | (KPI Card) |
+-----------+    +---------------+        +--------------+    +------------+
```

*   **BentoCard**: Responsible only for card bounds, responsive grid spans, and tap feedback.
*   **PlatformBadge**: Binds color configurations to platforms defined in the registry.
*   **CurrencyText**: Responsible only for localization formatting and color-coding positive/negative numbers.
*   **StatCard**: Combines labels, icons, values, and percentage indicators into a reusable layout block.

These chassis primitives enforce a consistent aesthetic and make the UI easy to extend.

### D. Encapsulated Native Hooks (Background Services Separation)
Native hardware integrations (GPS tracking, Wake Lock, Google Sign-In) are encapsulated inside custom React hooks:
*   **`useGPSTracking`**: Configures permissions, registers background tasks, and performs distance calculations.
*   **`useWakeLock`**: Keeps the screen active during shifts.
*   **`useGoogleDriveSync`**: Manages OAuth authentication flows.

*Impact*: Screens do not interact directly with native hardware modules. Instead, they interact with the Zustand store (e.g. toggling `isActive = true`). The background hooks react to these state changes, decoupling the view layer from device APIs.

### E. Stateless Step-Based Onboarding
The 11-step onboarding process is split into separate modules:
*   **Container (`OnboardingWizard.tsx`)**: Coordinates state (country, taxRegion, displayName) and manages forward/back transitions.
*   **Steps (`OnboardingSteps.tsx`)**: Houses 11 pure, presentation-only steps (`CountrySelectStep`, `PlatformsStep`, etc.).

*Impact*: This separation keeps step logic clean and maintainable. Steps can be re-ordered, added, or removed from the wizard without touching other wizard steps.

### F. Unified Storage Abstract (Cross-Platform compatibility)
The database client handles cross-platform storage configurations:
*   On mobile devices, Drizzle queries are routed directly to the local SQLite database.
*   On web browsers, queries redirect to a synchronized `localStorage` fallback.

*Impact*: This compatibility layer allows the entire app to run seamlessly on iOS, Android, and Web browsers, with zero platform-specific configuration changes required in the view components.

---

## 19. Local Alert Notification Triggering (`expo-notifications`)

To remind drivers of their planned shifts without requiring active internet connectivity, Comma integrates local notifications (`app/schedule/index.tsx`):
*   **Time Offset Calculation**: When saving a planned shift, the system extracts the start time (e.g., `17:00`) and subtracts exactly 30 minutes to set the reminder trigger.
*   **Notification Scheduling Pipeline**:
    *   *One-off Shifts*: For single shifts, the system schedules a non-repeating calendar notification targeting the exact year, month, day, hour, and minute of the warning time:
        ```typescript
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Scheduled Shift Reminder",
            body: `Your planned ${planPlatform} shift starts in 30 minutes!`,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            year, month, day, hour, minute,
            repeats: false,
          },
        });
        ```
    *   *Recurring Shifts*: For weekly repeating shift templates, the app loops over the selected days and schedules recurring triggers tied to specific weekdays (`weekday = day + 1`) at the calculated warning time:
        ```typescript
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Scheduled Shift Reminder",
            body: `Your planned ${planPlatform} shift starts in 30 minutes!`,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            hour, minute,
            repeats: true,
            weekday: day + 1,
          },
        });
        ```

---

## 20. EAS Build Cloud Pipeline & Windows Compilation Gotchas

For native compilation, Comma depends on an automated cloud build pipeline via **EAS Build** (Expo Application Services) to avoid compilation issues on local machines:
*   **The NDK Windows Path Space Bug**: Native modules like `react-native-worklets`, `react-native-reanimated`, and `react-native-screens` use native C++ bridges. If compile-time paths contain spaces (e.g., Windows user paths containing spaces, such as `C:\Users\Rajkumar Neupane\`), the Android NDK C++ linker (`lld`) fails to resolve standard library symbols (e.g. `__cxa_guard_acquire`), crashing the build.
*   **EAS Build Solution**: Rather than compiling native assets locally on Windows, native compilation is delegated to Linux build environments in the Expo Cloud using `eas build --platform android`. The resulting compiled APK is then downloaded to the device.
*   **Babel Worklets Plugin Mapping**: To support Reanimated worklets on Expo 56, `babel.config.js` is locked with:
    *   `react-native-reanimated/plugin` registered under plugins.
    *   `react-native-worklets` package dependency aligned to version `0.8.3` to match Expo SDK's internal modules.

---

## 21. Native App Configurations & Permissions (`app.json`)

To enable background tracking, local alerts, and home widgets on compiled iOS and Android devices, the `app.json` configuration specifies native permissions and configuration plugins:

### A. Location Permissions Statements
Both Apple (App Store) and Google (Play Store) mandate explicit descriptions when location tracking is active. These are declared inside the `ios.infoPlist` and `plugins[expo-location]` settings:
*   `NSLocationWhenInUseUsageDescription`: `"Comma uses your location during active shifts to track delivery mileage."`
*   `NSLocationAlwaysAndWhenInUseUsageDescription` / `locationAlwaysAndWhenInUsePermission`: `"Comma tracks GPS in the background during active delivery shifts to calculate active delivery miles vs dead miles (commuting and waiting). All location data stays 100% on your device and is never uploaded."`

### B. Android System Permissions
The following native permissions are declared under the `android.permissions` block to prevent background processes from sleeping:
*   `ACCESS_FINE_LOCATION`: Accesses precise GPS points.
*   `ACCESS_BACKGROUND_LOCATION`: Enables the tracking task to read coords while the device screen is off.
*   `FOREGROUND_SERVICE` / `FOREGROUND_SERVICE_LOCATION`: Launches the persistent top bar active tracking notifications.
*   `RECEIVE_BOOT_COMPLETED`: Resumes scheduling loops and alarm managers on device reboot.

### C. Build Plugins Configurations
Plugins orchestrate automated code insertions during compiled builds:
*   `expo-sqlite`: Bundles SQLite engine support.
*   `expo-secure-store`: Enables biometric or encrypted keychain store parameters.
*   `expo-notifications`: Connects local alarm triggers to system tray managers.
*   `expo-build-properties`: Configures `minSdkVersion` to `24` on Android to support worklets libraries.
*   `react-native-android-widget`: Orchestrates code injection interfaces for Android desktop widgets.

---

## 22. Replicator Dependencies Checklist (`package.json`)

To replicate the project setup, the following critical libraries and dependencies must be present in the node environment:

### Core Frameworks
*   `expo` (~56.0.12) - Universal application runtime environment.
*   `react` (19.2.3) & `react-native` (0.85.3) - Core UI frameworks.
*   `expo-router` (~56.2.11) - Directory-based routing logic.

### Database & Storage
*   `drizzle-orm` (^0.45.2) - Drizzle mapping interface.
*   `expo-sqlite` (~56.0.5) - Local SQLite execution engine.
*   `expo-secure-store` (~56.0.4) - Local Keychain credentials encryptor.
*   `expo-drizzle-studio-plugin` (^0.2.1) - Drizzle visual studio plugin.

### Real-Time State & Cache
*   `zustand` (^5.0.9) - Active shift and profile memory stores.
*   `@tanstack/react-query` (^5.90.11) - Server state/local cache synchronization.

### Native Hardware Bridges
*   `expo-location` (~56.0.18) - Active GPS coordinate hooks.
*   `expo-task-manager` (~56.0.19) - Background task runner.
*   `expo-keep-awake` (~56.0.3) - Screen wake lock manager.
*   `expo-notifications` (~56.0.18) - Push notifications engine.
*   `react-native-android-widget` (^0.20.3) - Custom desktop widgets controller.

### Mathematical & Exporters Utilities
*   `simplify-js` (^1.2.4) - Douglas-Peucker path coordinate simplifier.
*   `papaparse` (^5.5.4) - CSV parser for shifts and reports.
*   `expo-print` (~56.0.4) - HTML-to-PDF compiler.
*   `react-native-webview` (13.16.1) - CartoDB/Leaflet interactive map chassis.

### Encryption & Auth
*   `react-native-quick-crypto` (^1.1.5) - Hardware accelerated cryptography.
*   `@react-native-google-signin/google-signin` (^16.1.2) - Google Account Drive backing OAuth client.
*   `expo-auth-session` (~56.0.14) & `expo-web-browser` (~56.0.5) - OAuth redirect dialog frames.





