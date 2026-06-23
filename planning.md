# Comma App - Architecture and Planning

This document serves as the single source of truth for the project structure, accomplishments to date, and the immediate development roadmap.

---

## 1. Project Directory Structure

Here is the current layout of the codebase, separating the native runtime wrapper, Expo Router directory, and the core TypeScript application workspace:

```text
comma/app/
├── android/                   # Native Android project chassis (Gradle/NDK build output)
├── app/                       # Expo Router View & Routing Layer
│   ├── _layout.tsx           # Root entry layout (wraps Providers and PortalHost)
│   └── index.tsx             # Home Screen entry point (temporary starter view)
├── assets/                    # Static resources (images, fonts, adaptive icons)
├── docs/                      # Technical documentation and audit trail
│   └── system_log.md          # Chronological log of accomplishments and states
├── drizzle/                   # Drizzle ORM migrations
│   ├── meta/                  # Migration snapshots
│   └── 0000_concerned_...sql  # First migration containing shifts, expenses, vehicles schema
├── providers/                 # React Context Providers
│   └── QueryProvider.tsx      # TanStack React Query initialization
├── src/                       # Core TypeScript Application Workspace
│   ├── components/            # Shadcn Mobile UI Primitives (React Native Reusables)
│   │   └── ui/
│   │       ├── button.tsx     # Themeable CVA Pressable component
│   │       ├── card.tsx       # Layout container primitives (Card, CardContent, etc.)
│   │       └── text.tsx       # Typography component map
│   ├── database/              # SQLite & Drizzle Engine
│   │   ├── client.ts          # Database client, migrations trigger, and Expo Studio hook
│   │   └── schema.ts          # Type-safe Drizzle SQLite schema definitions
│   ├── lib/
│   │   └── utils.ts           # Styling helper utility (cn)
│   └── global.css             # Tailwind v3 directives and HSL color theme variables
├── hooks/                     # Custom hooks folder
├── store/                     # Zustand state management stores
├── utils/                     # Miscellaneous helpers (e.g. cn.ts)
├── app.json                   # Expo App Configuration (metadata, bundle identifiers, orientation)
├── babel.config.js            # Babel preset mapping for Worklets, Expo, and Reanimated
├── components.json            # Shadcn CLI mapping file for React Native Reusables
├── drizzle.config.ts          # Drizzle CLI configurations
├── eas.json                   # EAS Cloud native build profile mappings (Android Only)
├── metro.config.js            # Metro bundler config loaded with NativeWind CSS bridge and SQL resolver
├── package.json               # Package configurations and frozen dependency list
├── tailwind.config.js         # Tailwind CSS theme bindings to HSL CSS variables
└── tsconfig.json              # TypeScript path aliases (@/* mappings)
```

---

## 2. Accomplishments Audit (Tasks 1 - 4)

We have successfully established the foundational pillars of the project:

### 🗄️ Database & Schema Layer (Tasks 1 - 2)
*   **Drizzle SQLite Schema (`src/database/schema.ts`):** Formulated and frozen tables for `vehicles`, `shifts`, and `expenses` with proper relations and constraints.
*   **Migrations Engine (`src/database/client.ts`):** Established singleton SQLite connection (`comma.db`) triggering automatic local migration runs at runtime. Guarded against crash loops on the Web platform.
*   **Drizzle Studio CLI (`drizzle.config.ts`):** Enabled database inspection using the terminal tool.

### ⚙️ Compilation & Native Platform Layer (Task 3)
*   **Android NDK space-path resolution:** Solved local Windows build blockers by moving native builds to the cloud.
*   **EAS Build Pipeline (`eas.json`):** Set up Expo Application Services cloud builds, generated keystores, and created the first successful native development client APK (`Build ID: 60059ccb...`).
*   **Expo SDK 56 alignment:** Cleaned up `app.json` by removing deprecated parameters and validating all dependencies via `expo-doctor` (21/21 checks passing).

### 🎨 Visual & UI Engine Layer (Task 4)
*   **NativeWind v4 + Tailwind v3 Integration:** Established the styling engine, binding HSL variables in `src/global.css` to `tailwind.config.js`.
*   **Portal Host Setup (`app/_layout.tsx`):** Wrapped root routes in `<PortalHost />` from `@rn-primitives/portal` to support modal overlays.
*   **RNR Core Primitives:** Scaffolded RNR configuration (`components.json`) and added the standard primitives: `Button`, `Card`, and `Text`.

---

## 3. SQLite Database Schema Quick Reference

Our database schema is locked in with the following definitions:

### 1. `vehicles`
*   `id`: TEXT (Primary Key)
*   `name`: TEXT (Not Null)
*   `type`: TEXT (Not Null - e.g. "Sedan", "SUV", "Truck")
*   `isActive`: INTEGER (Boolean, Default: `true`)
*   `createdAt`: INTEGER (Timestamp, Not Null)

### 2. `shifts`
*   `id`: TEXT (Primary Key)
*   `vehicleId`: TEXT (References `vehicles.id`)
*   `platform`: TEXT (Not Null - e.g. "Uber", "Lyft", "DoorDash")
*   `startTime`: INTEGER (Timestamp, Not Null)
*   `endTime`: INTEGER (Timestamp, Not Null)
*   `grossRevenue`: REAL (Default: `0.0`)
*   `tipsRevenue`: REAL (Default: `0.0`)
*   `trackedMileage`: REAL (Default: `0.0`)
*   `notes`: TEXT (Nullable)

### 3. `expenses`
*   `id`: TEXT (Primary Key)
*   `shiftId`: TEXT (References `shifts.id` - Nullable if global expense)
*   `category`: TEXT (Not Null - e.g. "Gas", "Maintenance", "Insurance")
*   `amount`: REAL (Not Null)
*   `date`: INTEGER (Timestamp, Not Null)
*   `isDeductible`: INTEGER (Boolean, Default: `true`)

---

## 4. Next Phase: Visual Dashboard Implementation (Task 5)

Now that the visual foundation is configured, our next step is to build the Bento-style dashboard inside `app/index.tsx`. The roadmap includes:

1.  **State Management (`store/`):** Create a Zustand store (`store/useActiveShift.ts`) to manage active shift tracking (tracking state, duration timers, active platform, and mileage updates).
2.  **UI Component Layer (`src/components/`):**
    *   **Shift Quick-Logger Widget:** A visual widget to start/stop shifts, trigger stopwatch timers, and prompt for revenue inputs at completion.
    *   **Today's Earnings & Deductions Card:** A card displaying financial summaries, estimated tax write-offs (calculated dynamically from mileage: `$0.67` per mile), and net earnings.
3.  **Data Operations Hookup:** Wire SQLite queries via TanStack React Query to save completed shifts/expenses and fetch statistics.
