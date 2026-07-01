# Architecture Overview

## Design principles

1. **Local-first.** No network required for any core feature. The SQLite database on the device is the single source of truth.
2. **No backend.** Comma has no servers, no APIs, no user accounts. Google Drive is the only external service — and only if the user opts in.
3. **TypeScript strict.** No `any`. The compiler catches data-shape bugs before users do.
4. **Queries via ORM.** All database access goes through Drizzle. No raw SQL string-building; no JS-level filtering of data that belongs in a query.
5. **Native where it matters.** GPS tracking and wake locks run in a native module (Kotlin/Swift) to guarantee reliability that pure JS cannot provide on mobile.

---

## Tech stack

| Layer | Technology | Version |
|---|---|---|
| **Framework** | React Native | 0.85.3 |
| **UI layer** | React | 19.2.3 |
| **Build tool** | Expo SDK | 56 |
| **Routing** | Expo Router | 56.2.11 |
| **Database** | SQLite via expo-sqlite | 56.0.5 |
| **ORM** | Drizzle ORM | 0.45.2 |
| **Global state** | Zustand | 5.0.9 |
| **Server state / cache** | TanStack React Query | 5.90.11 |
| **Styling** | NativeWind v4 (Tailwind CSS) | v4 |
| **Animations** | React Native Reanimated | 4.3.1 |
| **Gestures** | React Native Gesture Handler | 2.31.1 |
| **Icons** | Lucide React Native | 1.21.0 |
| **Charts** | react-native-svg (custom) | — |
| **Bottom sheets** | @gorhom/bottom-sheet | 5.2.8 |
| **Google auth** | @react-native-google-signin/google-signin | 16.1.2 |
| **HTTP** | axios | 1.13.2 |
| **Crypto** | react-native-quick-crypto | 1.1.5 |
| **CSV** | papaparse | 5.5.4 |

---

## High-level architecture

```
┌───────────────────────────────────────────────────────┐
│                   Expo Router (file-based)             │
│   app/(tabs)/   app/shift/   app/settings/   etc.     │
└──────────────────────────┬────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   Zustand stores    React Query       Custom Hooks
   (global state)  (DB cache layer)   (GPS, sync, etc.)
          │                │
          └────────────────┘
                   │
          ┌────────▼────────┐
          │  Drizzle ORM    │
          │  (queries/)     │
          └────────┬────────┘
                   │
          ┌────────▼────────┐
          │  SQLite DB      │
          │  (local file)   │
          └─────────────────┘

   ┌──────────────────┐        ┌──────────────────┐
   │  Native Module   │        │  Google Drive    │
   │  (GPS service)   │        │  (backup/sync)   │
   │  Kotlin / Swift  │        │  appDataFolder   │
   └──────────────────┘        └──────────────────┘
```

---

## Data flow

### Reading data

```
Screen component
  → calls React Query hook (e.g. useQuery(['shifts', 'recent']))
  → React Query checks cache (stale-while-revalidate)
  → if stale: calls queryFn (a Drizzle query in src/database/queries/)
  → Drizzle generates SQL → expo-sqlite executes → rows returned
  → React Query updates cache → component re-renders
```

### Writing data

```
User action (e.g. "End Shift")
  → calls mutation (useMutation)
  → calls syncedInsert/syncedUpdate/syncedDelete (src/database/syncedWrites.ts)
     → stamps syncUpdatedAt = Date.now()
     → executes Drizzle insert/update/soft-delete
  → on success: invalidates relevant React Query keys
  → React Query re-fetches → UI updates
```

### GPS tracking

```
Shift starts
  → useGPSTracking hook starts native module (comma-tracker)
  → Native module runs foreground service (Android) / background task (iOS)
  → GPS points written to tempNativePoints table by native code
  → JS polls tempNativePoints → applies jitter filter → appends to locationPoints
  → On shift end: calculates route distance, assigns to shift record
```

---

## Folder map

```
commaApp/
├── app/                    # Expo Router routes (screens)
├── src/
│   ├── components/         # Reusable React components
│   ├── database/           # Drizzle schema, migrations, queries
│   ├── services/           # Business logic (GPS, backup, sync, gamification)
│   ├── registry/           # Static data (platforms, countries, badges)
│   ├── hooks/              # App-specific hooks
│   └── lib/                # Pure utilities
├── store/                  # Zustand stores
├── hooks/                  # Cross-cutting hooks (GPS, sync, backup)
├── providers/              # React context providers
├── modules/
│   └── comma-tracker/      # Native GPS module (Kotlin + Swift)
├── utils/                  # General utilities
└── docs/                   # This documentation
```

See [Project Structure](../development/project-structure.md) for the complete file tree.

---

## Key architectural decisions

### Why SQLite (not Realm, WatermelonDB, AsyncStorage)?

SQLite is the most battle-tested embedded database available. Drizzle ORM gives us type-safe queries and schema migrations. AsyncStorage is a key-value store — it doesn't scale to relational financial data. WatermelonDB and Realm are both viable but add more complexity than the project needs.

### Why Zustand (not Redux)?

Redux adds significant boilerplate. Zustand is ~1kb and provides the same capabilities for Comma's use case (two small global stores). React Query handles the more complex server-state problem (cache invalidation, background refresh).

### Why Expo Router (not React Navigation)?

File-based routing keeps the navigation structure readable at a glance. The folder structure matches the URL structure. Deep links map directly to files. Expo Router is built on React Navigation under the hood, so all the same primitives are available.

### Why a native GPS module (not expo-location alone)?

`expo-location` works well for foreground location. For background tracking that survives screen-off and OS-level memory pressure, a dedicated foreground service (Android) or background task (iOS) is required. Comma's native `comma-tracker` module handles this reliably.

### Why no backend?

Privacy, simplicity, and cost. A backend means user accounts, authentication, servers to maintain, data to protect, and a subscription to justify the running cost. Comma's target user is a gig worker who doesn't want another app subscription. Local-first + optional Drive backup solves the real problem (data loss on phone change) without these tradeoffs.
