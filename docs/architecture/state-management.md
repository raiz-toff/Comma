# State Management

The phone app uses two complementary systems: **Zustand** for synchronous global state, and **TanStack React Query** for asynchronous, database-backed state with caching.

---

## The split

| Concern | Tool |
|---|---|
| The running shift (timer, live distance, pause) | Zustand (`useActiveShift`) |
| Profile, preferences, gamification, feature flags | Zustand (`useSettingsStore`) |
| Shift history, expenses, analytics, reports | React Query |
| Vehicles, goals, platforms, tax profiles | React Query |

Rule of thumb: if it comes from a database query, it belongs in React Query; if it is small, global, and synchronous, it belongs in Zustand.

---

## `useActiveShift`

[`store/useActiveShift.ts`](../../store/useActiveShift.ts) — the currently running shift. Every state change is persisted to the `settings` key-value table under `active_shift_state` (via an upsert) and, on Android, pushes an update to the home-screen widget, so a shift survives an app restart.

**State:**

```ts
{
  isActive: boolean
  platform: GigPlatform | null   // comma-joined ids for multi-platform shifts
  vehicleId: string | null
  startTime: number | null       // epoch ms
  elapsedSeconds: number         // ticked each second while running
  activeMileage: number
  deadMileage: number
  targetTime: number | null      // epoch ms of the shift target, if set
  isPaused: boolean
  isAutoPaused: boolean          // paused by the auto-pause heuristic vs by hand
  pausedSeconds: number
  isFirstOrderReceived: boolean  // false = dead-distance mode, true = active
  sessionId: string | null       // links locationPoints to this session
}
```

**Actions:**

| Action | Purpose |
|---|---|
| `startShift(platform, vehicleId, targetTime)` | Clears native scratch points, initializes state, persists |
| `endShift()` | Stops native tracking, reads `tempNativePoints`, filters jitter, splits active/dead distance, simplifies the route, writes the shift and its platform rows; returns a `CompletedShiftPayload` or null |
| `incrementTimer()` | Adds a second to `elapsedSeconds`, or to `pausedSeconds` while paused |
| `updateMileage(activeMiles, deadMiles)` | Adds to the running totals |
| `pauseShift()` / `resumeShift()` | Toggle pause by hand |
| `setAutoPaused(paused)` | Toggle the auto-pause state |
| `markFirstOrderReceived()` | Switch classification from dead to active distance |
| `reset()` | Clear state and the persisted snapshot |
| `hydrateShift(partial)` | Merge a partial state in (rehydration and live GPS updates) |

The live distance shown during a shift is fed by `hooks/useGPSTracking.ts`, which polls the native service and calls `hydrateShift({ activeMileage })`. The authoritative active/dead split is computed from raw points in `endShift()`.

---

## `useSettingsStore`

[`store/useSettingsStore.ts`](../../store/useSettingsStore.ts) — profile, preferences, and gamification. It persists to the `settings` table on native (keys `onboarding_completed`, `profile`, `app_config`, `preferred_vehicle_id`, `demo_mode`, `shift_templates`) and to `localStorage` on web. Gamification state is persisted separately by `GamificationService`.

**State (selected fields):**

```ts
{
  isOnboardingCompleted: boolean
  profile: DriverProfile
  activeVehicle: VehicleDraft | null
  isLoading: boolean
  isDemoMode: boolean
  activePlatformFilter: string          // "all" or a platform id
  preferredVehicleId: string | null
  isHeaderVisible: boolean              // scroll-driven header state
  dbPlatforms: DBPlatform[]             // activated platforms from the DB

  // Derived from the country registry, re-synced on every profile load/update
  countryDef: CountryDef | null
  provinceDef: ProvinceDef | null
  marketContext: MarketContext | null

  // Gamification
  xpTotal, xpLevel: number
  streakDays, streakFrozenCount, bestStreak: number
  unlockedBadgeIds: string[]
  challenges: Challenge[]
  notifications: NotificationItem[]
  personalRecords: PersonalRecords
  lastEvaluationMonth: string | null

  // Feature flag overrides (developer / persona)
  featureOverrides: Partial<Record<FeatureKey, boolean>>
}
```

`DriverProfile` holds `displayName`, `country`, `taxRegion`, `avatarType`/`avatarData`, `selectedPlatforms`, `workSchedulePreset`, `weeklyGoal`/`monthlyGoal`/`annualGoal`, `taxWithholdingPct`, `hstRegistered`, `distanceUnit`, `theme`, an optional `operationalModelId`, and a `locale` block (currency, date format, week-start day, time format). The `country` field is typed for `CA`, `US`, `UK`, and `NP`, but only `CA` is a registered, selectable country — the default profile is Canada.

**Actions:** `loadSettings`, `completeOnboarding`, `resetSettings`, `loadSampleData`, `clearSampleData`, `setActivePlatformFilter`, `setPreferredVehicle`, `setHeaderVisible`, `updateProfile`, `applyTaxPreset`, `updateFeatureOverride`, `evaluateGamification`, `addNotification`, `dismissNotification`, `markAllNotificationsRead`, `clearAllNotifications`.

Notes on a few:

- `updateProfile(patch)` re-derives `countryDef` / `provinceDef` / `marketContext`, and when the country changes it also resets units, currency, region, the withholding preset, and filters `selectedPlatforms` to those valid in the new country.
- `resetSettings()` hard-wipes the local database and re-mints the sync device id (it does not touch the cloud copy). See [Cloud Sync](../backup-and-sync/cloud-sync.md).
- `evaluateGamification()` returns the badge ids newly unlocked in that pass, for the celebration sheet. Reads and writes to the shared gamification blob are serialized behind a lock so concurrent notification writes can't clobber awarded XP.

---

## TanStack React Query

React Query manages everything that requires a database read. The client is set up in [`providers/QueryProvider.tsx`](../../providers/QueryProvider.tsx):

```ts
new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => console.error("[QueryError]", query.queryKey, error),
  }),
  defaultOptions: {
    queries: {
      retry: 1,                    // queries hit local SQLite; extra retries just delay failures
      refetchOnWindowFocus: false,
      staleTime: 30_000,           // fresh for 30 seconds
    },
  },
})
```

Because queries read local SQLite rather than the network, retries are cut to one and focus refetching is off. A single `QueryCache.onError` is the one place errors surface.

### Query keys

Keys are string arrays. Analytics keys append the active platform filter and the date range so React Query caches a distinct view per filter and window.

| Domain | Example keys |
|---|---|
| Shifts | `["shifts"]`, `["shift", shiftId]`, `["shift-expenses", shiftId]` |
| Expenses | `["expenses"]`, `["expense", id]`, `["expenses", "by-month", year]` |
| Analytics | `["analytics", "today", activePlatformFilter]`, `["analytics", "week-stats", "this", start, end, activePlatformFilter]` |
| Goals | `["goals"]`, `["goals", "progress"]`, `["goals", "best-shift"]` |
| Vehicles / tax | `["vehicles"]`, `["taxProfiles", id]`, `["maintenance", id]` |
| Reports | `["reports", "bars", periodMode, start, end]` |
| Backup | `["backup", "status"]` |

### Invalidation

After a mutation succeeds, invalidate the affected keys and React Query refetches in the background:

```ts
const mutation = useMutation({
  mutationFn: (data) => syncedInsert(db, expenses, data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["expenses"] })
    queryClient.invalidateQueries({ queryKey: ["analytics"] })
  },
})
```

Invalidating a prefix such as `["analytics"]` refreshes every analytics view at once. `loadSampleData` and `clearSampleData` call `invalidateQueries()` with no key to refresh the whole dashboard when demo data is swapped in or out.

---

## Where the two systems meet

- **Ending a shift.** `endShift()` (Zustand) writes the final shift record, and the caller invalidates `["shifts"]` and `["analytics"]` so the lists refresh.
- **The platform filter.** `activePlatformFilter` lives in Zustand because it drives header UI synchronously. Analytics queries fold it into their query keys, so React Query caches a correct per-filter view.

---

## What not to put in Zustand

- Fetched data (shift lists, totals) — use React Query.
- Local component state (a modal's open flag, an input's value) — use `useState`.
- Values derivable from DB data — compute them in a React Query `select`.

Keeping the two stores small keeps them predictable and avoids needless global re-renders.
