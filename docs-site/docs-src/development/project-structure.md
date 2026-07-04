# Project Structure

Complete annotated file tree for the Comma codebase.

---

## Top level

```
commaApp/
├── app/                    # Expo Router route files (screens)
├── src/                    # All application source code
├── store/                  # Zustand global state stores
├── hooks/                  # Cross-cutting React hooks
├── providers/              # React Context providers
├── components/             # Top-level shared components
├── modules/                # Native Expo modules (Kotlin/Swift)
├── utils/                  # Pure utility functions
├── docs/                   # Documentation (you are here)
│
├── app.json                # Expo configuration, plugins, permissions
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript config (strict)
├── tailwind.config.js      # NativeWind/Tailwind theme
├── babel.config.js         # Babel transforms
├── metro.config.js         # Metro bundler config
├── .env.example            # Environment variable template
└── README.md               # Quick start
```

---

## `app/` — Routes (screens)

Expo Router maps this folder to URL routes.

```
app/
├── _layout.tsx             # Root layout — providers, onboarding gate
├── notifications.tsx       # Push notification permission screen
│
├── (tabs)/                 # Main tab navigator
│   ├── _layout.tsx         # Tab bar config
│   ├── index.tsx           # Dashboard
│   ├── shifts.tsx          # Shifts list
│   ├── analytics.tsx       # Advanced analytics (flag-gated)
│   ├── expenses.tsx        # Expenses list
│   └── tax.tsx             # Tax center (flag-gated)
│
├── shift/
│   ├── add.tsx             # Shift creation wizard
│   └── [id].tsx            # Shift detail / edit
│
├── expense/
│   ├── add.tsx             # Expense creation
│   └── [id].tsx            # Expense detail / edit
│
├── vehicles/
│   ├── index.tsx           # Vehicle list
│   └── [id].tsx            # Vehicle detail
│
├── goals/
│   └── index.tsx           # Goals + gamification
│
├── reports/
│   └── index.tsx           # Reports panel
│
├── schedule/
│   └── index.tsx           # Weekly schedule (flag-gated)
│
├── settings/
│   ├── index.tsx           # Settings root
│   ├── backup.tsx          # Backup & sync
│   ├── profile.tsx         # Edit profile
│   ├── platforms.tsx       # Platform management
│   ├── import.tsx          # CSV import
│   └── developer.tsx       # Feature flags
│
├── about/
│   └── index.tsx           # About screen
│
└── docs/                   # Internal design docs (not user-facing)
    ├── sync-design.md      # Cloud sync architecture spec
    └── system_log.md       # System design notes
```

---

## `src/` — Application source

```
src/
│
├── components/             # Reusable React components
│   │
│   ├── ui/                 # UI primitives (shadcn-style)
│   │   ├── Text.tsx
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── AppBottomSheet.tsx
│   │   ├── CelebrationSheet.tsx
│   │   ├── PlatformBadge.tsx
│   │   ├── BentoCard.tsx
│   │   ├── StatCard.tsx
│   │   └── SectionHeader.tsx
│   │
│   ├── widgets/            # Dashboard widgets
│   │   ├── RollingTrendWidget.tsx
│   │   ├── StreakWidget.tsx
│   │   ├── IncomeBreakdownWidget.tsx
│   │   ├── WeeklyProjectionWidget.tsx
│   │   ├── BestDayWidget.tsx
│   │   ├── BestHourWidget.tsx
│   │   ├── DeadMilesWidget.tsx
│   │   ├── PlatformActivityWidget.tsx
│   │   └── TaxJarWidget.tsx
│   │
│   ├── shifts/             # Shift-specific components
│   │   ├── LiveRouteMap.tsx        # Real-time GPS route SVG
│   │   ├── RouteMinimap.tsx        # Compact route preview
│   │   └── ShiftCard.tsx
│   │
│   ├── celebration/        # Badge / milestone animations
│   │   └── BadgeCelebration.tsx
│   │
│   ├── GlobalTopHeader.tsx         # Top bar (menu + platform filter)
│   ├── CircularProgress.tsx        # Donut chart for goals
│   └── Sparkline.tsx               # Inline trend chart
│
├── database/               # Data access layer
│   ├── schema.ts           # Drizzle table definitions (source of truth)
│   ├── client.ts           # SQLite init, migrations, db export
│   │
│   ├── queries/            # Query helpers (grouped by domain)
│   │   ├── analytics.ts    # Earnings totals, trends, best day/hour
│   │   ├── shifts.ts       # Shift list, shift detail, recent
│   │   ├── expenses.ts     # Expense list, by category, by date
│   │   ├── vehicles.ts     # Vehicle list, detail
│   │   ├── goals.ts        # Goal list, progress calculation
│   │   ├── platforms.ts    # Active platforms
│   │   ├── tax.ts          # Tax history
│   │   └── reports.ts      # Pre-formatted report data
│   │
│   ├── syncedWrites.ts     # syncedInsert/syncedUpdate/syncedDelete wrappers
│   ├── syncState.ts        # Sync cursor + enablement helpers
│   └── syncedTables.ts     # List of tables participating in cloud sync
│
├── services/               # Business logic
│   │
│   ├── googleDrive.ts      # OAuth tokens, backup upload/download/list
│   ├── backupPassword.ts   # Passphrase storage (Secure Store abstraction)
│   ├── cryptoHelper.ts     # AES-256-CBC encrypt/decrypt, PBKDF2
│   ├── notify.ts           # Local push notification scheduling
│   ├── gamification.ts     # XP, badge unlock, streak evaluation
│   │
│   └── sync/               # Cloud sync engine (under development)
│       ├── syncNow.ts      # Main orchestrator (pull + push)
│       ├── pushChanges.ts  # Build and upload change-log
│       ├── pullChanges.ts  # Download and apply change-logs
│       ├── driveIO.ts      # Drive file list/download/upload helpers
│       ├── schedule.ts     # Sync schedule (daily/weekly/manual)
│       ├── changeLog.ts    # ChangeLog type definition and serialization
│       ├── mergeRules.ts   # LWW merge, audit trail
│       ├── compaction.ts   # Collapse many logs → one snapshot
│       └── applyChangeLog.ts # Transaction-based merge application
│
├── registry/               # Static read-only definitions
│   ├── platforms/          # Built-in platform definitions (by country)
│   ├── countries/          # Country tax rules, mileage rates, CPP/SE tax
│   ├── operationalModels/  # Work types (delivery, rides, tasks)
│   ├── badges/             # Badge definitions (id, label, condition)
│   ├── expenseCategories.ts # Category list with deductibility defaults
│   └── market/             # Regional market context
│
├── hooks/                  # App-specific hooks
│   ├── usePlatformTheme.ts # Colors derived from active platform
│   ├── useVocabulary.ts    # Locale-sensitive terms ("shift" vs "session")
│   ├── useFeatureEnabled.ts # Feature flag resolution
│   └── useMulti.ts         # Multi-item selection helper
│
├── lib/                    # Pure utilities
│   ├── geoCalculations.ts  # Haversine distance, speed filter
│   ├── polyline.ts         # Google Encoded Polyline encode/decode
│   └── installGlobalErrorHandler.ts
│
└── global.css              # Tailwind/NativeWind global styles
```

---

## `store/` — Zustand stores

```
store/
├── useActiveShift.ts       # Live shift state (timer, mileage, pause)
├── useSettingsStore.ts     # Profile, preferences, gamification
├── useCounterStore.ts      # Demo counter (example store)
└── demoRoutes.ts           # Demo mode sample data
```

---

## `hooks/` — Cross-cutting hooks

```
hooks/
├── useGPSTracking.ts       # Start/stop native GPS, poll tempNativePoints
├── useAutoSync.ts          # AppState listener → auto pull/push
├── useGoogleDriveSync.ts   # Backup UI state (list, restore wizard)
├── useBackupStatus.ts      # Last backup time, next scheduled backup
├── useWakeLock.ts          # Keep device awake during shifts
├── useNotificationRouting.ts # Handle notification tap deep-links
└── useSyncNow.ts           # Manual sync trigger
```

---

## `modules/comma-tracker/` — Native GPS module

```
modules/comma-tracker/
├── android/
│   └── src/main/java/.../  # Kotlin foreground service
├── ios/
│   └── CommaTracker.swift  # Swift background location task
└── src/
    ├── index.ts            # TypeScript bridge (startTracking, stopTracking)
    └── CommaTrackerModule.ts
```

---

## `providers/`

```
providers/
└── QueryProvider.tsx       # TanStack React Query client setup
```

---

## `components/` (top-level)

```
components/
├── OnboardingWizard.tsx    # First-run setup flow
└── ErrorBoundary.tsx       # Global React error boundary
```

---

## `utils/`

```
utils/
├── geoCalculations.ts      # Shared geo math (mirror of src/lib/)
└── polyline.ts             # Polyline encoding/decoding
```

---

## Configuration files

| File | Purpose |
|---|---|
| `app.json` | Expo config: bundle ID, version, plugins, permissions, icons |
| `tsconfig.json` | TypeScript strict mode |
| `tailwind.config.js` | NativeWind theme (colors, spacing, fonts) |
| `babel.config.js` | Expo Babel preset + NativeWind transform |
| `metro.config.js` | Metro bundler: CSS support, SVG handling |
| `.env` | Google OAuth client ID (not committed) |
| `.env.example` | Template with all required env vars |
