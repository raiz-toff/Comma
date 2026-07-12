# Architecture Overview

Comma is a local-first monorepo holding two apps that share one data model — a native Android/Expo app and a browser PWA — plus the documentation site that renders these pages.

---

## Design principles

1. **Local-first.** No network is required for any core feature. The database on the device is the single source of truth on each app.
2. **No backend, no account.** Comma runs no servers and has no user accounts. The only external service is the user's own Google Drive, and only if they opt in.
3. **Two apps, one model.** The phone app and the web app implement the same concepts (shifts, expenses, vehicles, tax) so a record synced from one is understood by the other.
4. **Pluggable registries.** Countries and platforms are data, not branching logic. Adding one is a registry file per app, registered in one place — there are no `if (country === 'CA')` switches scattered through the code.
5. **Native where it matters.** Reliable background GPS on Android needs a native foreground service, so that lives in a Kotlin module rather than JavaScript.

---

## The two apps

| | Phone app | Web app |
|---|---|---|
| Location in repo | `app/`, `components/`, `src/`, `store/`, `hooks/`, `modules/comma-tracker/` | `web/` |
| Framework | Expo + React Native, TypeScript | Vanilla JavaScript, no framework |
| UI | React Native, NativeWind | Hand-written HTML/CSS modules |
| Routing | Expo Router (file-based) | Hash router |
| Storage | SQLite via Drizzle ORM | IndexedDB via Dexie |
| State | Zustand + TanStack React Query | Module singletons |
| GPS | Native `comma-tracker` foreground service | `web/src/core/gps-tracker.js`, foreground/tab-open only |
| Offline shell | Native app | Service worker / PWA |

Both connect to the user's Google Drive for the same change-log-based cloud sync (`src/services/sync/` on the phone, `web/src/services/sync/` on the web).

---

## Phone app tech stack

| Layer | Technology |
|---|---|
| Framework | React Native (Expo SDK) |
| Language | TypeScript, strict mode |
| Routing | Expo Router (file-based) |
| Database | SQLite via `expo-sqlite` |
| ORM | Drizzle ORM |
| Global state | Zustand |
| Server-state cache | TanStack React Query |
| Styling | NativeWind (Tailwind) |
| Native GPS | `comma-tracker` (Kotlin foreground service) |
| Google auth | `@react-native-google-signin/google-signin` |

See [`package.json`](../../package.json) for exact versions.

---

## High-level data flow (phone app)

```
┌───────────────────────────────────────────────────────┐
│                Expo Router (file-based)               │
│   app/(tabs)/   app/shift/   app/settings/   etc.     │
└──────────────────────────┬────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   Zustand stores     React Query       Custom hooks
   (store/)          (DB cache layer)   (GPS, sync, wake lock)
          │                │
          └────────────────┘
                   │
          ┌────────▼────────┐
          │  Drizzle ORM    │  src/database/queries/, syncedWrites.ts
          └────────┬────────┘
                   │
          ┌────────▼────────┐
          │  SQLite (local) │  src/database/schema.ts
          └─────────────────┘

   ┌──────────────────┐        ┌──────────────────┐
   │ comma-tracker    │        │  Google Drive    │
   │ (native GPS)     │        │  appDataFolder   │
   └──────────────────┘        └──────────────────┘
       src/services/sync/  ←→  change-logs in the user's own Drive
```

### Reading data

A screen calls a React Query hook, which serves from cache and revalidates in the background. The `queryFn` is a Drizzle query in `src/database/queries/`; Drizzle generates SQL, `expo-sqlite` runs it, and the result updates the cache.

### Writing data

A mutation calls `syncedInsert` / `syncedUpdate` / `syncedDelete` (`src/database/syncedWrites.ts`), which stamp `syncUpdatedAt` and soft-delete via `syncDeletedAt` so a change can travel to other devices. On success it invalidates the relevant React Query keys and the UI refetches.

### GPS during a shift

Starting a shift starts the native `comma-tracker` service through `hooks/useGPSTracking.ts`. The native code writes raw points to the `tempNativePoints` table; on shift end, `store/useActiveShift.ts` reads them, filters jitter, splits active from dead distance, and writes the shift.

---

## Folder map

```
commaApp/
├── app/                         # Expo Router routes (phone app screens)
│   └── setup/                   # Activation-checklist setup screens
├── components/                  # Top-level phone components
│   └── ActivationChecklist.tsx  # Deferred-setup card on the dashboard
├── src/
│   ├── database/                # Drizzle schema, client, queries, synced writes
│   ├── services/
│   │   ├── sync/                # Change-log cloud-sync engine (Drive)
│   │   └── onboarding/          # Activation checklist + first-shift services
│   ├── registry/
│   │   ├── countries/           # Country tax rules, mileage, provinces (CA ships)
│   │   └── platforms/           # Built-in gig platforms by country
│   ├── components/              # Reusable React Native components
│   └── hooks/                   # App-specific hooks
├── store/                       # Zustand stores (useActiveShift, useSettingsStore)
├── hooks/                       # Cross-cutting hooks (GPS, sync, wake lock)
├── modules/comma-tracker/       # Native Kotlin GPS module
│
├── web/                         # The web PWA (vanilla JS, Dexie, hash router)
│   └── src/
│       ├── core/gps-tracker.js  # Web foreground GPS tracker
│       ├── services/sync/       # Web cloud-sync engine (mirrors src/services/sync)
│       ├── registry/countries/  # Web country registry (mirrors phone)
│       └── modules/             # Feature modules (onboarding, backup, tax, etc.)
│
├── docs/                        # These documentation pages (Markdown source)
└── docs-site/                   # Fumadocs (Next.js) site that renders docs/
```

See [Project Structure](../development/project-structure.md) for the full tree.

---

## Key decisions

### Why no backend?

Privacy, simplicity, and cost. A backend means accounts, authentication, servers to maintain, data to protect, and a subscription to justify the running cost. Comma's user is a gig worker who does not want another subscription. Local-first plus optional Drive sync solves the real problem — losing data on a phone change — without any of that.

### Why SQLite and Drizzle on the phone?

SQLite is the most battle-tested embedded database available, and Drizzle gives type-safe queries and migrations over it. Financial data is relational; a key-value store would not scale to it.

### Why vanilla JavaScript on the web?

The web app is deliberately dependency-light: no framework, a hand-written hash router, and Dexie over IndexedDB. It ships as a small, fast PWA that mirrors the phone app's model without pulling in a build-heavy stack.

### Why registries instead of switches?

A country or platform is defined once as data and read everywhere. Nothing branches on the country id, so adding a market cannot silently miss a code path. The registry refuses to serve a country it hasn't been given rules for. See [Contributing](../development/contributing.md).
