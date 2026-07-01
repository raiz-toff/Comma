# State Management

Comma uses two complementary state systems: **Zustand** for synchronous global UI state, and **TanStack React Query** for async database-backed state with caching.

---

## The split

| Concern | Tool | Why |
|---|---|---|
| Active shift (running timer, live mileage) | Zustand | Real-time, needs to persist across app restarts, drives UI reactively |
| User profile, preferences, gamification | Zustand | Global, synchronous, rarely changes |
| Shift history, expenses, analytics | React Query | Async DB reads with caching, background refresh, stale-while-revalidate |
| Vehicles, goals, platforms | React Query | Same — read-heavy, cache-able |

---

## Zustand stores

### `useActiveShift` — [`store/useActiveShift.ts`](../../store/useActiveShift.ts)

Tracks the currently running shift. Persists to SQLite (`settings` KV table, key `active_shift_state`) so the shift survives app restarts.

**State shape:**
```ts
{
  isActive: boolean
  platform: string
  vehicleId: string
  startTime: number           // epoch ms
  elapsedSeconds: number      // updated every second by a timer
  activeMileage: number       // km/miles in active-delivery mode
  deadMileage: number         // km/miles in commute mode
  targetTime: number | null   // target duration in minutes (optional)
  isPaused: boolean
  isFirstOrderReceived: boolean  // false = dead-mile mode, true = active
  sessionId: string           // links GPS locationPoints to this session
}
```

**Key actions:**
- `startShift(platform, vehicleId, targetTime?)` — initializes state, writes to SQLite
- `endShift()` — clears active state, triggers final GPS route calculation
- `pauseShift()` / `resumeShift()` — toggle timer pause, GPS continues
- `updateMileage(active, dead)` — called by GPS tracking hook
- `incrementTimer()` — called every second by a `setInterval` in the hook

**Hydration:** On app launch, `_layout.tsx` calls `loadSettings()` which reads `active_shift_state` from SQLite. If a shift was in progress when the app closed, it resumes (potentially showing a reconciliation screen).

**Android widget sync:** After every state change, Comma calls the Android widget update API to reflect current shift status on the home screen widget.

---

### `useSettingsStore` — [`store/useSettingsStore.ts`](../../store/useSettingsStore.ts)

The main settings and profile store. Persists the entire state to SQLite (`settings` KV table, key `profile` and others).

**State includes:**
```ts
{
  // Onboarding
  isOnboardingCompleted: boolean

  // Profile
  profile: {
    name: string
    country: 'US' | 'CA' | 'UK' | 'NP'
    province: string
    currency: string
    distanceUnit: 'miles' | 'km'
    weekStartDay: number
    timeFormat: '12h' | '24h'
    activePlatforms: string[]
  }

  // UI state
  activePlatformFilter: string | null   // current platform filter
  isHeaderVisible: boolean              // scrolled header state
  isDemoMode: boolean

  // Derived from profile (loaded at startup)
  countryDef: CountryDefinition
  provinceDef: ProvinceDefinition
  marketContext: MarketContext
  dbPlatforms: Platform[]              // active platforms from DB

  // Gamification
  xpTotal: number
  xpLevel: number
  streakDays: number
  streakFrozenDays: number[]
  unlockedBadgeIds: string[]
  challenges: Challenge[]
  personalRecords: PersonalRecords

  // Notifications (in-app)
  notifications: AppNotification[]

  // Feature overrides (dev/testing)
  featureOverrides: Record<string, boolean>
}
```

**Key actions:**
- `loadSettings()` — reads profile and gamification state from SQLite on startup
- `updateProfile(partial)` — partial profile update, persists to DB
- `resetSettings()` — wipes all settings (part of Reset App flow)
- `evaluateGamification(context)` — checks for new badge unlocks, XP awards, streak updates
- `addNotification(n)` / `dismissNotification(id)` — in-app notification queue
- `setActivePlatformFilter(id)` — updates platform filter header (not persisted — resets on restart)

---

## TanStack React Query

React Query manages all async data — anything that requires a database read.

### Setup

```tsx
// providers/QueryProvider.tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,      // data is fresh for 30 seconds
      gcTime: 5 * 60_000,     // keep unused cache for 5 minutes
    }
  }
})
```

### Query key conventions

| Domain | Key pattern | Example |
|---|---|---|
| Shifts | `['shifts', scope]` | `['shifts', 'recent']`, `['shifts', 'list', { platform }]` |
| Shift detail | `['shifts', id]` | `['shifts', 'abc-123']` |
| Analytics | `['analytics', period]` | `['analytics', 'today']`, `['analytics', 'weekly']` |
| Expenses | `['expenses', scope]` | `['expenses', 'list']` |
| Vehicles | `['vehicles']` | |
| Goals | `['goals']` | |
| Platforms | `['platforms']` | |

### Invalidation pattern

After a mutation succeeds, invalidate the relevant query keys:

```ts
const mutation = useMutation({
  mutationFn: (data) => syncedInsert(db, expenses, data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['expenses'] })
    queryClient.invalidateQueries({ queryKey: ['analytics'] })
  }
})
```

React Query will refetch in the background; components using those queries re-render automatically.

### Stale-while-revalidate

Comma uses the default stale-while-revalidate behavior: data is served from cache immediately (even if stale) while a background refetch runs. This keeps the UI snappy — screens open instantly from cache, then update if the data changed.

---

## Interaction between Zustand and React Query

The two systems rarely interact directly, but there are two coordination points:

1. **Shift end:** `endShift()` (Zustand) writes the final shift record to SQLite, then calls `queryClient.invalidateQueries(['shifts'])` to refresh the list.

2. **Platform filter:** `activePlatformFilter` lives in Zustand (fast, synchronous, drives header UI). Analytics queries read the filter from the store and include it as a query key parameter, so React Query correctly caches per-filter views.

---

## What NOT to put in Zustand

Zustand stores are for state that needs to be **globally accessible and synchronous**. Do not add to Zustand:

- Fetched data (shift lists, expense totals) — use React Query
- Local component state (modal open/closed, text input value) — use `useState`
- Derived values that can be computed from DB data — put them in React Query `select` transforms

Keeping Zustand stores small makes them predictable and prevents unnecessary global re-renders.
