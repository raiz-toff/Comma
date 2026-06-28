# CommaApp Structure & Architecture Overview (ASCII Map)

This document provides a complete visual and structural picture of **CommaApp**, mapping everything from directory layout and device permissions to the SQLite database schema, user personas, screen routing, feature modules, and the custom background GPS tracking service.

---

## 1. Codebase Directory Layout
```text
/home/coder/Production/commaApp
├── android/                         # Android native project files (Gradle, AndroidManifest, etc.)
├── ios/                             # iOS native project files (CocoaPods, Info.plist, etc.)
├── assets/                          # App icons, splash screens, and system logs
├── app/                             # Expo Router Expo navigation screens
│   ├── (tabs)/                      # Tab Navigation (Main Dashboard)
│   │   ├── _layout.tsx              # Tab controller & design system
│   │   ├── index.tsx                # Dashboard index (Main shift control & OnboardingWizard portal)
│   │   ├── analytics.tsx            # Analytics home (Charts & metrics)
│   │   ├── expenses/index.tsx       # Expense list tab
│   │   ├── shifts/index.tsx         # Shift history list tab
│   │   └── tax/index.tsx            # Tax workspace tab
│   ├── about/                       # About Comma screen
│   ├── expense/add.tsx              # Create/Edit expense screen
│   ├── goals/index.tsx              # Earning Goals manager
│   ├── reports/index.tsx            # PDF/CSV Report generation center
│   ├── schedule/index.tsx           # Work calendar & Reminders
│   ├── settings/                    # Settings workspace
│   │   ├── index.tsx                # General configurations & swatch picker
│   │   └── import.tsx               # Platform statement CSV imports
│   ├── shift/add.tsx                # Manual shift log entry
│   ├── shifts/[id].tsx              # Detailed shift route viewer
│   ├── tax/index.tsx                # Region/State tax config
│   ├── vehicles/                    # Vehicle profiles
│   │   ├── index.tsx                # Vehicle list view
│   │   └── [id].tsx                 # Vehicle log & maintenance logs
│   ├── notifications.tsx            # In-app notifications settings
│   └── _layout.tsx                  # Root navigation & app context initializers
├── components/                      # Shared UI components
│   ├── OnboardingWizard.tsx         # Main Onboarding wizard flow controller
│   └── OnboardingSteps.tsx          # Step screens (Welcome, Persona, Country, etc.)
├── store/                           # Zustand state management stores
│   ├── useActiveShift.ts            # Active duty state, timer, and GPS metric processors
│   ├── useSettingsStore.ts          # Settings loader, profile, onboarding gates, database sync
│   ├── useCounterStore.ts           # Simple counter state
│   └── demoRoutes.ts                # Pre-populated routes for offline simulation
├── hooks/                           # Global application hooks
│   ├── useGPSTracking.ts            # React Native location hooks manager (bridges to Native)
│   ├── useWakeLock.ts               # Keeps CPU active during tracking
│   ├── useGoogleDriveSync.ts        # Database backups
│   ├── useFeatureEnabled.ts         # User feature gates check
│   └── ...
├── src/                             # Core framework and registry modules
│   ├── components/ui/               # Core design components
│   ├── database/                    # SQLite Drizzle Client and Schemas
│   │   ├── client.ts                # Database driver initialization and migrations
│   │   └── schema.ts                # Table schema declarations
│   ├── registry/                    # App config registers
│   │   ├── personas.ts              # Persona key details & vocabularies
│   │   ├── modules.ts               # Toggleable features & categories
│   │   ├── platforms/               # Country-specific gig platforms (US, CA, UK, NP)
│   │   ├── provinces/               # Regions & tax profiles
│   │   ├── tax/                     # Tax brackets & withholding presets
│   │   └── badges/                  # Streaks & gamification rules
│   └── global.css                   # Global styling
├── modules/
│   └── comma-tracker/               # Custom Kotlin/Swift Native Background GPS Tracking module
│       ├── android/                 # Native Android Foreground Service
│       └── ios/                     # Native iOS wrapper
├── index.ts                         # Native widget task handler entry
├── app.json                         # Expo configuration (permissions, plugins)
└── package.json                     # Node dependencies & project metadata
```

---

## 2. App Permissions Map

Both platform permissions and background service settings are configured in [app.json](file:///home/coder/Production/commaApp/app.json) to request permissions during onboarding/tracking:

```text
               +------------------------------------------------------+
               |                  ONBOARDING WIZARD                   |
               +--------------------------+---------------------------+
                                          |
                                          v
               +------------------------------------------------------+
               |             Location Permissions Request             |
               +--------------------------+---------------------------+
                                          |
                     +--------------------+--------------------+
                     |                                         |
                     v                                         v
       +---------------------------+             +---------------------------+
       |     Android System        |             |        iOS System         |
       +---------------------------+             +---------------------------+
       | ACCESS_FINE_LOCATION      |             | NSLocationWhenInUseUsage  |
       | (Precise GPS tracking)    |             | (Active app tracking)     |
       |                           |             |                           |
       | ACCESS_BACKGROUND_LOCATION|             | NSLocationAlwaysAndWhenInUse|
       | (Tracking when closed)    |             | (Background location fix) |
       |                           |             |                           |
       | FOREGROUND_SERVICE        |             | UIBackgroundModes         |
       | (Keeps process alive)     |             | - "location"              |
       |                           |             +---------------------------+
       | FOREGROUND_SERVICE_LOCATION|
       | (Explicit GPS access)     |
       |                           |
       | RECEIVE_BOOT_COMPLETED    |
       | (Widget auto-resume)      |
       +---------------------------+
```

---

## 3. Database ER Diagram & Architecture

The database is built on **SQLite** (`comma.db`) managed via **Drizzle ORM** [schema.ts](file:///home/coder/Production/commaApp/src/database/schema.ts).

```text
 +---------------------+            +---------------------+            +---------------------+
 |      vehicles       |            |       shifts        |            |      expenses       |
 +---------------------+            +---------------------+            +---------------------+
 | id (PK, Text)       |<---+       | id (PK, Text)       |<---+       | id (PK, Text)       |
 | name (Text)         |    |       | platform (Text)     |    |       | amount (Real)       |
 | type (Text)         |    +------[| vehicleId (FK)      |    +------[| shiftId (FK)        |
 | isActive (Int)      |    |       | startTime (Int)     |    |       | category (Text)     |
 | make/model/year     |    |       | endTime (Int)       |    |       | date (Int)          |
 | fuelType (Text)     |    |       | activeMileage (Real)|    |       | isDeductible (Int)  |
 | licensePlate (Text) |    |       | deadMileage (Real)  |    +------[| vehicleId (FK)      |
 +---------------------+    |       | grossRevenue (Real) |    |       | notes (Text)        |
           |                |       | tipsRevenue (Real)  |    |       | receiptUri (Text)   |
           |                |       | durationSeconds(Int)|    |       | isRecurring (Int)   |
           |                |       | pausedSeconds (Int) |    |       +---------------------+
           |                |       | routePath (Text)    |    |
           v                |       | notes (Text)        |    |
 +---------------------+    |       +---------------------+    |
 |  maintenance_logs   |    |                  |               |
 +---------------------+    |                  v               |
 | id (PK, Text)       |    |       +---------------------+    |
 | vehicleId (FK) ]----+    |       |   location_points   |    |
 | type (Text)         |    |       +---------------------+    |
 | cost (Real)         |    |       | id (PK, Text)       |    |
 | odometer (Real)     |    +------[| shiftId (FK)        |    |
 | date (Int)          |            | sessionId (Text)    |    |
 | notes (Text)        |            | latitude/longitude  |    |
 +---------------------+            | timestamp/speed/acc |    |
                                    +---------------------+    |
                                                               |
 +---------------------+                                       |
 |      platforms      |                                       |
 +---------------------+                                       |
 | id (PK, Text)       |                                       |
 | label/color (Text)  |                                       |
 | country (Text)      |                                       |
 | isActive (Int)      |                                       |
 | hourlyRate/mileage  |                                       |
 +---------------------+                                       |
                                                               |
 +---------------------+            +---------------------+    |
 |        goals        |            |  temp_native_points |    |
 +---------------------+            +---------------------+    |
 | id (PK, Text)       |            | id (PK, Autoincrem) |    |
 | label/target (Real) |            | lat (Real)          |    |
 | unit/period (Text)  |            | lon (Real)          |    |
 | isActive (Int)      |            | timestamp (Int)     |    |
 +---------------------+            +---------------------+    |
                                       ^                       |
                                       |                       |
                                    [Kotlin Tracking Service   |
                                     Writes Coordinates Here]  |
                                                               |
 +---------------------+            +---------------------+    |
 |      settings       |            |     tax_history     |    v
 +---------------------+            +---------------------+  [Note: expenses can
 | key (PK, Text)      |            | id (PK, Text)       |   link to vehicle and/
 | value (Text)        |            | oldRegion/Rate      |   or active shift]
 +---------------------+            | newRegion/Rate      |
                                    | changedAt (Int)     |
                                    +---------------------+
```

---

## 4. Persona Implementation & Vocabulary Registry

The application dynamically shifts terminology and features depending on the selected persona. Defined in [personas.ts](file:///home/coder/Production/commaApp/src/registry/personas.ts):

| Persona Key (`PersonaKey`) | Target Driver Persona | Primary Active Session | Segment Platform | Mileage Labels | Default Gated Features |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`gig_worker`** | Courier (Food/Grocery) | `shift` (Shifts) | `platform` (e.g. DoorDash) | active miles / dead miles | GPS + Manual shifts, Expenses, Basic analytics, Vehicle Profiles, Backup, CSV Export |
| **`rideshare`** | Passenger Transport | `drive` (Drives) | `app` (e.g. Uber) | fare miles / deadhead miles | Same as Gig Worker + **Advanced Analytics** |
| **`business_driver`** | Realtors/Consultants | `drive` (Drives) | `purpose` (e.g. Client) | business miles / personal miles | Same as Gig Worker + **Tax Workspace**, **Business/Personal Split**, **Mileage Log Export** |
| **`contractor`** | Freelance/Trades | `job` (Jobs) | `client` (e.g. Site A) | work miles / personal miles | Same as Business Driver |
| **`mileage_tracker`** | Personal / Reimbursement | `trip` (Trips) | `purpose` (e.g. Commute) | tracked miles / personal miles | Same as Gig Worker + **Business/Personal Split**, **Mileage Log Export** (Analytics & Tax workspace off) |

### Vocabulary Key Translator (`useVocabulary` hook):
Translates dynamic tokens in UI widgets according to the persona vocabulary configurations:
- `session` / `session_plural` (e.g., "shift" vs "job")
- `active_miles` / `dead_miles` (e.g., "fare miles" vs "work miles")
- `revenue` (e.g., "earnings" vs "reimbursement")
- `start_cta` / `end_cta` (e.g., "Go online" vs "Start job")

---

## 5. Feature Modules List & Categories

Features are registered in [modules.ts](file:///home/coder/Production/commaApp/src/registry/modules.ts) under distinct categories. A feature can be **Core** (always active) or **Optional** (toggleable in Settings / gated by persona):

```text
+----------------------------------------------------------------------------------+
|                              FEATURE CATEGORIES                                  |
+------------+------------+-----------+-------+----------+---------------+---------+
|  tracking  | financial  | analytics |  tax  |  export  | productivity  | native  |
+------------+------------+-----------+-------+----------+---------------+---------+

  [CORE FEATURES] — Always compiled, active, and hidden from toggle menu
  ├── session_tracking_gps     (Tracking)      -> Background GPS coordinates logging
  ├── session_tracking_manual  (Tracking)      -> Manual shift adjustments
  ├── expense_tracking         (Financial)     -> Expense receipts and ledger
  ├── analytics_basic          (Analytics)     -> Dashboard basic KPIs
  ├── vehicle_profiles         (Productivity)  -> Vehicles profiles and records
  ├── csv_export               (Export)        -> Raw data tabular exports
  └── google_drive_backup      (Productivity)  -> Encrypted vault backups

  [OPTIONAL FEATURES] — Toggleable by user or activated by persona profile
  ├── analytics_advanced       (Analytics)     -> Platform comparison & hourly efficiency
  ├── tax_workspace            (Tax)           -> Self-Employed tax estimator (Schedule C/T2125)
  ├── goals                    (Productivity)  -> Revenue & hours tracking limits
  ├── schedule                 (Productivity)  -> Shift scheduling calendar & reminders
  ├── gamification             (Productivity)  -> Badges and weekly streaks rewards
  ├── pdf_reports              (Export)        -> Performance PDF summary reports
  ├── csv_import               (Export)        -> Bulk CSV statements importer
  ├── android_widget           (Platform Native)-> Active tracker home screen widget
  ├── business_personal_split  (Tracking)      -> Flag logs as Personal or Business
  └── mileage_log_export       (Export)        -> Audit-ready log PDF (requires split)
```

---

## 6. Onboarding & Screen Flow

### Onboarding Steps Map
When settings show `isOnboardingCompleted: false`, the app locks into the **Onboarding Wizard** [OnboardingWizard.tsx](file:///home/coder/Production/commaApp/components/OnboardingWizard.tsx):

```text
[Welcome Screen] (Get Started / Demo / Dev Mode Setup)
      │
      ▼
[Step 1: Persona Select] (Courier, Rideshare, Realtor, Contractor, Tracker)
      │
      ▼
[Step 2: Country Select] (NP, CA, US, UK)
      │
      ▼
[Step 3: Tax Region Select] (Province/State dropdown e.g. CA-ON, US-CA)
      │
      ▼
[Step 4: Platform Select] (DoorDash, Uber, Skip, etc. Gated: gig_worker/rideshare only)
      │
      ▼
[Step 5: Vehicle Profile Creation] (Name, make, model, year, fuel type, plate)
      │
      ▼
[Step 6: Weekly Goal Setup] (Optional weekly earning targets)
      │
      ▼
[Step 7: Display Name Input] (Saves driver profile nickname)
      │
      ▼
[Step 8: GPS Background Permissions] (Requests Background Location approvals)
      │
      ▼
[Step 9: Finish & Hydrate] (Saves settings to database, writes demo data if demo selected)
```

---

### Main App Routing Map
Once onboarding is completed, the app mounts the main tab router:

```text
                  +----------------------------------------+
                  |            Root Stack Router           |
                  +-------------------+--------------------+
                                      |
                                      v
                  +----------------------------------------+
                  |         Tab Navigator (Tabs)           |
                  +-----+------+------+------+------+------+
                        |      |      |      |      |
      +-----------------+      |      |      |      +-----------------+
      |                        |      |      |                        |
      v                        v      v      v                        v
+------------+  +-------------+  +----+  +---------+  +------------+
| Dashboard  |  |  Analytics  |  |Tax |  |Expenses |  | More Tab   |
| (index.tsx)|  | (charts/KPI)|  |Tab |  | (list)  |  | (more.tsx) |
+------------+  +-------------+  +----+  +---------+  +-----+------+
      |                                                     |
      |-- [Active Tracker Panel]                            |-- About Comma
      |                                                     |-- Goals Manager
      |-- Start Shift -> Activates Native Tracking          |-- Reports Center
      |-- End Shift -> Launches review modals               |-- Calendar Scheduler
                                                            |-- Vehicles Profiles
                                                            |-- General Settings
```

---

## 7. GPS Background Tracking Architecture (Native Bridge)

The background tracker utilizes a **dual-state architecture**: React Native manages UI and active shifts, while native Kotlin runs a foreground service writing points directly to SQLite, bypassing the JS thread.

```text
  React Native Layer (JS/TS)             Expo Module Bridge                 Native Android (Kotlin)
=============================           ====================               =========================

+---------------------------+
|      Dashboard UI         |
|  (User clicks Start Duty) |
+-------------+-------------+
              |
              v
+---------------------------+
|    useActiveShift Store   |
|  - Generates sessionId    |
|  - Clears temp_native_pts |
+-------------+-------------+
              |
              v
+---------------------------+
|    useGPSTracking Hook    |
|  - Request GPS Perms      |          +--------------------+
|  - Triggers start         +--------->| CommaTrackerModule |
+---------------------------+          |  (startTracking)   |
                                       +---------+----------+
                                                 | (StartForegroundService)
                                                 v
                                       +-------------------------------------------------+
                                       |          LocationTrackingService.kt             |
                                       |  - Spawns Foreground Service Notification      |
                                       |  - Hooks FusedLocationProviderClient            |
                                       +-----------------+-------------------------------+
                                                         | (LocationResult callback)
                                                         v
                                       +-------------------------------------------------+
                                       |           Native Filtering Pipeline             |
                                       |  - Calculates Haversine distance                |
                                       |  - Filters out points under 20m                 |
                                       |  - Filters out speeds > 150 km/h (jitter)       |
                                       +-----------------+-------------------------------+
                                                         | (If Valid Coord)
                                                         v
                                       +-------------------------------------------------+
                                       |           Direct SQLite Insertion               |
                                       |  - Opens DB "/databases/comma.db"               |
                                       |  - Inserts row directly into:                   |
                                       |    `temp_native_points`                         |
                                       +-------------------------------------------------+
                                                                 .
                                                                 . (Driver completes shift)
                                                                 .
+---------------------------+                                    v
|  RN User Ends Shift       |          +--------------------+    |
|  - Stops background timer |--------->| CommaTrackerModule |<---+
|  - Calls end shift        |          |  (stopTracking)    |  [Stops LocationTrackingService]
+-------------+-------------+          +--------------------+
              |
              v
+---------------------------+
|    Zustand Data Fetch     |
|  - Reads coordinates from |
|    `temp_native_points`   |
+-------------+-------------+
              |
              v
+---------------------------+
|   Post-Processing Math    |
|  - Splits mileage:        |
|    * Speed < 5 km/h       |
|      -> Dead Miles        |
|    * Speed >= 5 km/h      |
|      -> Active Miles      |
|  - Compresses paths       |
|    using RDP Simplification|
|  - Encodes Polyline string|
+-------------+-------------+
              |
              v
+---------------------------+
|     Database Commit       |
|  - Inserts record into    |
|    `shifts` table         |
|  - Deletes all points in  |
|    `temp_native_points`   |
+---------------------------+
```

---

## 8. SQLite Concurrency & Thread-Safety Rules (Write Lock Strategy)

### The Problem
React Native runs in a JavaScript runtime, utilizing `expo-sqlite` and `drizzle-orm` to perform database reads and writes. At the same time, the native Kotlin background service (`LocationTrackingService.kt`) runs in a separate process thread, opening a direct SQLite connection to the same physical database file `/databases/comma.db` to insert location updates into the `temp_native_points` scratchpad.
Because SQLite only allows a single writer at any given time, concurrent writes (e.g., a user adding an expense in the JS thread while the background service writes a coordinate) will cause a transaction deadlock, triggering an `SQLITE_BUSY` error.

### Write Lock & Concurrency Strategy
To ensure database operations never crash or block each other, CommaApp enforces the following strategy:

1. **Write-Ahead Logging (WAL) Mode**:
   - **How it works**: By default, `expo-sqlite` initializes the database in WAL mode. WAL allows concurrent reads to proceed without locking the database, even while a write transaction is active. Readers read a snapshot of the database, while writers append changes to a separate `-wal` file.
   - **Kotlin Native Link**: The native Kotlin service opens the database without altering the journal mode. Since WAL mode is a persistent property of the SQLite database file, once set by the JS engine, it applies to the native database connection as well.
2. **Native Thread-Safe Database Pool & Write Retries**:
   - The native code handles database access on a background thread. If `db.insert(...)` encounters an `SQLITE_BUSY` exception, it retries with an exponential backoff (e.g., waiting 50ms, 150ms, then 300ms) up to 3 times before discarding or caching the location coordinates.
3. **JS-Thread Busy Timeout**:
   - The Drizzle ORM client configures the database connection with a `busy_timeout` (typically 5000ms), letting write queries wait for locks to release rather than failing instantly.

```text
       JS Thread (Drizzle ORM)                  Native Kotlin Service
   ===============================             =========================
                  |                                        |
     [User adds Shift / Expense]               [New location coordinate]
                  |                                        |
                  v                                        v
     Starts Write Transaction                  Direct sqlite insert (temp_native_points)
                  |                                        |
                  +--- Acquire EXCLUSIVE write lock -------+
                  |                                        | (Blocked)
                  |                                        v
                  |                            [SQLITE_BUSY Database Lock]
                  |                                        |
                  |                                        v
                  |                            Retries with Exponential Backoff
                  |                               (50ms -> 150ms -> 300ms)
                  |                                        |
     Commits to WAL file & Releases Lock ----------------->| (Success)
                  |                                        v
                  v                                    Writes coordinate & Closes
             Done (WAL mode)
```

---

## 9. OS Kill & "Orphaned Session" Reconciliation

### The Problem
During a 6-hour shift, the Android/iOS operating system may aggressively kill the main React Native UI process to reclaim memory (Low Memory Killer / LMK). When this occurs, the React Native Javascript thread and the Zustand state engine (`useActiveShift`) are completely wiped from memory. However:
1. The Kotlin foreground service (`LocationTrackingService.kt`) runs in its own process context and remains alive, continuing to collect coordinates in the background.
2. If the OS kills the service too, the `temp_native_points` scratchpad still contains raw GPS coordinates collected up to the crash.

### Session Recovery Flow
When the app is re-opened (cold boot), the system triggers a hydration sequence inside `useWakeLock.ts` to reconcile the active session.

```text
                         [ App Cold Boot (layout.tsx) ]
                                       │
                                       ▼
                       [ Read "active_shift_state" ]
                         from settings SQLite table
                                       │
                    ┌──────────────────┴──────────────────┐
                    ▼ (No Session Found)                  ▼ (Active Session Payload Found)
            [ Normal Boot ]                       [ Check state.isActive ]
                                                          │
                                         ┌────────────────┴────────────────┐
                                         ▼ (isActive: false)               ▼ (isActive: true)
                                  [ Normal Boot ]                 [ Check Elapsed Time ]
                                                                  Restore timer offset:
                                                                  elapsed = now - startTime
                                                                          - pausedSeconds
                                                                           │
                                                                           ▼
                                                                  [ Hydrate Zustand Store ]
                                                                  - useActiveShift hydrates state
                                                                  - Continues background tracking
                                                                  - No data is lost
```

- **Persistence Layer**: Whenever the user starts/pauses/resumes a shift, the state is serialized and stored in the database `settings` table under `"active_shift_state"`.
- **Clock Adjustment**: On recovery, the app calculates how long it was dead by subtracting the `startTime` and `pausedSeconds` from the current system time (`now`). This ensures that the active shift timer remains 100% accurate despite process death.
- **Orphaned Cleanups**: If a restored session is found to be extremely stale (e.g. `now - startTime > 24 hours`), the app handles the cleanup automatically, presenting a prompt to either discard the data or auto-save the shift.

---

## 10. Battery Optimization & Doze Mode Topology

### The Problem
On Android 6.0+, the operating system places the device into **Doze Mode** if it is stationary and unplugged. Doze mode throttles CPU wake-locks, schedules network requests in bulk windows, and suspends standard background GPS sensors. 
Additionally, aggressive OEM battery management (e.g., Samsung Device Care, Xiaomi battery saver) can force-stop foreground services or sleep background processes, resulting in "straight-line tracking gaps" when the driver puts the phone in their pocket.

### Battery Whitelisting Workflow
To achieve reliable, gap-free background location updates, CommaApp implements a Battery Whitelisting flow:

```text
     [ Onboarding GPSStep / Settings ]
                    │
                    ▼
     [ Check if App is Battery Optimized ]
       (Using PowerManager.isIgnoringBatteryOptimizations())
                    │
           ┌────────┴────────┐
           ▼ (Already Exempt) 🧭             ▼ (Optimized / Restrained) ⚠️
     [ Proceed with Tracking ]        [ Show Custom Warning Banner ]
                                      "Background tracking requires unrestricted battery."
                                                   │
                                                   ▼
                                      [ Prompt User to Disable Optimization ]
                                                   │
                                                   ▼
                                      [ Fire Native Android Intent ]
                                      - Action: Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
                                      - Requires: REQUEST_IGNORE_BATTERY_OPTIMIZATIONS permission
                                                   │
                                                   ▼
                                      [ Android Settings Overlay Opens ]
                                      User toggles Comma to "Unrestricted" / "Don't Optimize"
```

* **Core Permissions**: `android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` is requested in AndroidManifest.xml.
* **Auto-Pause Fallback**: When Doze Mode or pauses in driving occur, the background tracker is kept alive with low latency by keeping the Foreground Service notification active. If no movement is detected for 15 seconds, tracking is internally suspended to protect battery health.

---

## 11. Data Promotion Lifecycle: `location_points` vs. `temp_native_points`

### Purpose and Contrast
There are two location tables in the database schema. They serve different stages of the tracking lifecycle:

1. **`temp_native_points` (Scratchpad Table)**:
   - **Scope**: Write-heavy, temporary cache.
   - **Writer**: Native Kotlin Foreground Service.
   - **Format**: Raw coordinate points (latitude, longitude, speed, timestamp).
   - **Lifecycle**: Cleared when starting a shift. Receives new records in real-time as coordinates are captured. Once the shift ends, Javascript reads these points, performs simplification, and then deletes all rows in this table.
2. **`location_points` (High-Resolution Backup Table)**:
   - **Scope**: Read-heavy, permanent archive.
   - **Writer**: React Native JavaScript Thread (via queries).
   - **Format**: Clean coordinate history linked to a finalized `shiftId`.
   - **Lifecycle**: If high-resolution tracking is enabled in Settings, the raw coordinates from `temp_native_points` are written to `location_points` during the end-shift commit phase *before* the scratchpad is wiped. If high-resolution tracking is disabled, data is only stored as a compressed polyline string inside the `shifts.routePath` column, keeping the SQLite database file size small.

### Lifecycle Flow
```text
  [Location Sensor]
         │
         ▼
[Kotlin Foreground Service]
         │
         ▼ (Real-time Raw Write)
 [temp_native_points] (SQLite)
         │
         ▼ (End Shift Event)
[JavaScript Post-Processor]
   - Fetches raw points from temp_native_points
   - Calculates Active vs. Dead mileage
   - Runs Rade-Douglas-Peucker (RDP) Simplification
         │
         ├─────────────────────────────────────────┐
         ▼ (Compress & Stringify)                  ▼ (High-Res Audit Mode Enabled?)
  [shifts.routePath]                               │
  (Saved as Polyline JSON)                         ▼ (Export Backup Write)
         │                                  [location_points] (SQLite)
         │                                         │
         v                                         v
   (Final Step: Wipe temp_native_points table from database)
```

---

## 12. External Network & Security Boundary

Although CommaApp is designed primarily offline-first, certain integrations require communication with external networks and the storage of secure access credentials.

### API Secrets Hierarchy
To secure user access tokens, API keys, and credentials, CommaApp separates configuration into public registries and secure native keychains:

```text
                               +-------------------------------------+
                               |          Security Boundary          |
                               +------------------+------------------+
                                                  |
                  ┌───────────────────────────────┴───────────────────────────────┐
                  ▼                                                               ▼
   +------------------------------+                                +------------------------------+
   |  Public Config & Endpoints   |                                | Secure Native Keystore       |
   |  - Placed in source code     |                                | - Encrypted via AES/Keychain |
   |  - Public API URLs           |                                | - Handled by expo-secure-store|
   +--------------+---------------+                                +--------------+---------------+
                  |                                                               |
  ┌───────────────┴───────────────┐                               ┌───────────────┴───────────────┐
  ▼                               ▼                               ▼                               ▼
[OSRM Matching API]       [OAuth Client Config]           [Google OAuth Tokens]          [Database Crypto Key]
https://router.project-   Public Client IDs for           Google Access & Refresh        AES-256-GCM symmetric
osrm.org/match/v1         OAuth redirection.              tokens for backup vaults.      key generated locally.
```

### Directory Structure & Requests Pipeline
HTTP requests and authentication logic are structured as follows:

```text
src/
├── services/
│   ├── api/
│   │   ├── client.ts                 # Base Axios/Fetch client with offline interceptors & retry logic
│   │   └── mapSnapping.ts            # OSRM road snapping requests handler
│   ├── googleDrive.ts                # Google Drive backup sync and token management
│   └── cryptoHelper.native.ts        # Keystore wrapper via SecureStore and quick-crypto
```

* **Offline Queue & Retries**: The `client.ts` uses an offline queue interceptor. If a network request is fired while offline (e.g. backing up data or checking OSRM road snapping), the request is queued. Once internet connectivity is restored (monitored via `NetInfo`), requests are re-sent sequentially.
* **Token Rotation**: Google OAuth tokens are stored in the platform-native encrypted keystore (`expo-secure-store`). Access tokens expire every hour; when needed, `getValidAccessToken()` automatically requests a new access token via the Google OAuth token endpoint using the stored refresh token.

---

## 13. The Domain Isolation Map (The "Flutter Test")

This map categorizes all logic in the codebase to evaluate UI framework independence. If React Native is replaced (e.g. to target Flutter or a web-based dashboard), this map shows what survives.

```text
+---------------------------------------------------------------------------------------+
|                                    APPLICATION CODE                                   |
+--------------------------+----------------------------+-------------------------------+
|  UI LAYER (React Native) | PLATFORM BINDINGS (Native) |  PURE DOMAIN LOGIC (Vanilla)  |
|  - Renders UI / Layouts  |  - Interacts with device   |  - Core business equations    |
|  - UI-bound state hooks  |  - Process lifecycles      |  - No UI or framework imports |
+--------------------------+----------------------------+-------------------------------+
| * app/                   | * modules/comma-tracker/   | * utils/taxCalculations.ts    |
|   - Layout files         |   - LocationTrackingService|   - CRA & IRS rules/formulas  |
|   - Tab components       |   - Kotlin Native bindings | * utils/geoCalculations.ts    |
|   - Screen forms         | * android/                 |   - Haversine, distance math  |
| * components/            |   - Gradle, Manifests      | * utils/polyline.ts           |
|   - OnboardingWizard.tsx | * ios/                     |   - Route compression, RDP    |
|   - Option swatches UI   |   - Xcode project, Plist   | * src/registry/               |
| * store/useActiveShift.ts|                            |   - Personas configs & vocab  |
|   - Zustand UI state     |                            |   - Feature registers         |
|   - Layout timers        |                            |   - Platform definitions      |
+--------------------------+----------------------------+-------------------------------+
```

### The Business Scalability Question (Flutter Test)
* **Survival Rate**: **~45%** of the codebase (measured in logic complexity) survives a total UI rewrite.
* **What Survives**: The entire tax estimation logic, GPS math filters, custom platforms metadata, vocabulary translations dictionary, and the SQLite schema definitions.
* **What is Lost**: The React Native views (`app/`), styling (`global.css`), state-store wrappers (Zustand instances), and Expo notifications configurations.

### Core Architecture Blindspot
The primary coupling bottleneck is inside `store/useActiveShift.ts`. It manages both **UI state** (is the timer ticking? is the menu modal open?) and **business calculations** (splitting dead miles at the 5 km/h threshold).
* **Fix Strategy**: To achieve 100% domain isolation, the calculations engine should be refactored into a pure TypeScript file (e.g. `src/domain/shiftCalculations.ts`) containing stateless functions like `calculateMileageSplits(rawPoints)`. The Zustand store then behaves strictly as an orchestrator that pulls database rows, passes them to the pure domain function, and binds the return values to the UI.

---

## 14. The Entitlement Seam (Monetization Topology)

This diagram maps how a subscription paywall (e.g., via RevenueCat or Stripe) gates features without hard-coding rules directly into the user interface.

```text
               +------------------------------------------------------+
               |                  USER INTERACTIONS                   |
               +--------------------------+---------------------------+
                                          |
                                          v
               +------------------------------------------------------+
               |             Feature Gating Hook Check                |
               |           useFeatureEnabled('tax_workspace')         |
               +--------------------------+---------------------------+
                                          |
                                          v
               +------------------------------------------------------+
               |              Zustand Settings Store                  |
               |     Reads current profile entitlements from DB       |
               +--------------------------+---------------------------+
                                          |
                     +--------------------+--------------------+
                     |                                         |
                     v                                         v
       +---------------------------+             +---------------------------+
       |   User is Entitled (Pro)  |             |  User is Not Entitled     |
       +-------------+-------------+             +-------------+-------------+
                     |                                         |
                     v                                         v
       +---------------------------+             +---------------------------+
       |   Render Target Feature   |             |   Redirect to Paywall UI  |
       |   (Self-Employed Tax)     |             |   "Unlock Comma Premium"  |
       +---------------------------+             +-------------+-------------+
                                                               |
                                                               v
                                                 +---------------------------+
                                                 |   RevenueCat / Stripe     |
                                                 |  - User purchases token   |
                                                 |  - Validates receipt      |
                                                 |  - Updates `isPro` in DB  |
                                                 +---------------------------+
```

### Entitlement Mapping Schema
Rather than a flat `Persona -> Feature` mapping, the app introduces an intermediary entitlement layer:

```text
+-------------------+       +-----------------------+       +-------------------+
|    User Class     | ----> |      Entitlement      | ----> |  Feature Modules  |
+-------------------+       +-----------------------+       +-------------------+
|  Free Tier User   |       | 'basic_tracking'      |       | - manual_shifts   |
|                   |       |                       |       | - expense_ledger  |
+-------------------+       +-----------------------+       +-------------------+
|  Paid Tier User   |       | 'basic_tracking' +    |       | - tax_workspace   |
|  (Comma Premium)  |       | 'premium_analytics' + |       | - adv_analytics   |
|                   |       | 'tax_estimator'       |       | - mileage_exports |
+-------------------+       +-----------------------+       +-------------------+
```

* **Injecting Monetization**: When a user purchases a subscription, the external payment service (Stripe Webhook or RevenueCat SDK) returns an active entitlement token. The client database records this entitlement in the `settings` table (`key: 'user_entitlements', value: '["premium_analytics", "tax_estimator"]'`).
* **Zero UI Impact**: The `useFeatureEnabled` hook checks this entitlement array directly. Gating or shifting a feature from a paid tier to a free tier requires changing only the database entry or the remote entitlements metadata, leaving UI screens unchanged.

---

## 15. The "File Backup" vs. "State Sync" Chasm

A local database backup (e.g. copying `comma.db` to Google Drive) is not a synchronization engine. When multiple devices write to the database offline, a merge conflict resolution protocol is required.

```text
                        [ Offline Database Divergence ]
                                       │
     ┌─────────────────────────────────┴─────────────────────────────────┐
     ▼ (Device A: Android Phone)                                         ▼ (Device B: iPad)
 Logs active shift: 40 miles                                         Logs oil change expense: $20
 Inserts shift ID: `shift_A1B2`                                      Inserts expense ID: `exp_C3D4`
 Saves Local Timestamp: 18:00:00                                     Saves Local Timestamp: 18:00:05
     │                                                                   │
     └─────────────────────────────────┬─────────────────────────────────┘
                                       ▼
                       [ Both Devices Connect to Wi-Fi ]
                                       │
                                       ▼
                       [ Sync Server / Peer Merge Stage ]
                                       │
                    ┌──────────────────┴──────────────────┐
                    ▼ (Primary Keys Collision Check)      ▼ (Same Row Modified Collision)
             [ UUID Validation ]                    [ Last Write Wins (LWW) ]
             Primary keys generated as random       Check record modification
             strings (UUID v4 / v7).                timestamps (`updated_at` / `device_ts`).
             IDs `shift_A1B2` and `exp_C3D4`        The row with the latest timestamp
             never collide. Both merge.             is kept; old row moves to history.
```

### Schema Rules for Multi-Device Syncing:
1. **No Auto-Increment Primary Keys**:
   - Except for local scratchpads (`temp_native_points`), all synchronized database tables (`shifts`, `expenses`, `vehicles`) use **Text UUID v4** keys (prefixed strings: e.g., `shift_` + random unique hash). This prevents primary key collisions when merging offline records.
2. **Conflict Resolution Registers (LWW)**:
   - Every synchronized record contains a tracking register:
     - `device_updated_at`: Unix timestamp tracking when the local user committed the change.
     - `sync_status`: Flag status (`'synced'`, `'pending_insert'`, `'pending_update'`).
   - During synchronization, the system compares timestamps. If two devices modify the same record offline, the device with the most recent local write timestamp wins (**Last Write Wins**), while the older version is logged in a local revision table if recovery is required.

---

## 16. The Module "Blast Radius" Graph (Directed Acyclic Graph)

This graph displays the strict one-way dependency rules of CommaApp. Modules downstream cannot import or access upstream states, establishing a clean boundary that prevents circular dependency deadlocks and app freezes.

```text
               +------------------------------------------------------+
               |                  UI COMPONENTS                       |
               |  (app/*.tsx, components/OnboardingWizard.tsx)        |
               +--------------------------+---------------------------+
                                          |
                                          | (Reads UI State & Triggers Actions)
                                          v
               +------------------------------------------------------+
               |                  ZUSTAND STORES                      |
               |  (useActiveShift.ts, useSettingsStore.ts)            |
               +--------------------------+---------------------------+
                                          |
                                          | (Fires Queries & Commits Records)
                                          v
               +------------------------------------------------------+
               |              DATABASE QUERIES / MATH                 |
               |  (queries/shifts.ts, utils/taxCalculations.ts)       |
               +------------------------------------------------------+
                                          |
                                          | (Translates DB Types / Math Rules)
                                          v
               +------------------------------------------------------+
               |               PURE SCHEMAS & REGISTRIES              |
               |  (database/schema.ts, registry/personas.ts)          |
               +------------------------------------------------------+
```

### Crash Isolation & Reliability
* **Blast Radius Boundary**: The UI runtime and the native background tracker are strictly decoupled.
* **The Core Isolation Rule**: If a junior developer introduces a syntax or rendering error inside `expenses/index.tsx`, **it is physically impossible for that bug to crash the background Kotlin tracking service**.
* **Reasoning**: The Kotlin `LocationTrackingService` runs in a separate native OS process thread. It does not import, reference, or communicate with the JavaScript thread during tracking. It writes coordinates directly to the SQLite file using its own thread-isolated database connection. Even if the React Native JS runtime completely crashes or freezes, the native Kotlin background tracker remains fully operational.
* **Circular Dependencies Check (Red Flags)**: Any import of a Zustand store or a React hook inside files in `src/database/` or `utils/` is strictly prohibited. Database helpers and math scripts must remain stateless, accepting pure parameters (e.g. `(db, payload)`) rather than pulling state from client stores.

---

## 17. The Release Velocity Matrix (OTA vs. Binary)

To maintain high development velocity, CommaApp isolates volatile business rules (which change frequently due to tax laws or platform shifts) from static hardware services (which require slow App Store reviews).

```text
   +-----------------------------------------------------------------------------------+
   |                                 CODEBASE MODULES                                  |
   +------------------------------------------+----------------------------------------+
   |        GREEN (Over-The-Air Ship)         |        RED (App Store Jail / Binary)   |
   |  - Shippable instantly in 60 seconds     |  - Requires Apple/Google review        |
   |  - Bypasses App Store submission approvals|  - Release cycles take 2 to 5 days    |
   +------------------------------------------+----------------------------------------+
   | * app/                                   | * modules/comma-tracker/               |
   |   - All screen layouts and flows         |   - Kotlin background GPS service      |
   | * components/                            |   - Native Swift iOS wrappers          |
   |   - Onboarding components                | * android/ & ios/                      |
   | * src/registry/                          |   - Native project config structures   |
   |   - Platform configurations & rates      | * app.json                             |
   |   - Tax tables and bracket schemas       |   - Native app permissions             |
   | * utils/                                 |   - SDK and third-party plugin lists   |
   |   - CSV import parsers                   |                                        |
   |   - Tax calculations rules               |                                        |
   +------------------------------------------+----------------------------------------+
```

### The Velocity Strategy (CSV Importer Scenario)
* **The Scenario**: A major gig platform (e.g. DoorDash) changes its CSV statement export headers on Tuesday morning, breaking the import feature for users.
* **The Solution**: Since the CSV parser logic lives in `utils/` (Green Zone), developers can rewrite the parsing regex, deploy it via **EAS Update** (Over-The-Air), and push the fix directly to all active user devices in **under 60 seconds**, completely bypassing the 3-day App Store approval cycle.
* **Rule for Volatile Logic**: All scraping rules, platform rates, tax rules, province parameters, and database query conversions must live in pure JS/TS files in the Green zone. Native binary structures (Red Zone) must only handle low-level device mechanisms (GPS tracking service, SQLite database files connections, local file system locks, or widget intents).

