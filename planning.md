# Comma — React Native Migration Mega Plan

> **Agent instruction**: Read this file before any task. After each successful execution, append one line to `app/docs/system_log.md`. Never rewrite it — append only.

---

## Stack Reference

| Concern | Technology |
|---|---|
| Runtime | Expo SDK 56, EAS Cloud Builds |
| Routing | Expo Router (file-based) |
| Database | expo-sqlite + Drizzle ORM |
| State | Zustand (UI/session) + TanStack React Query (DB queries) |
| Styling | NativeWind v4 + React Native Reusables (RNR) |
| Theme | bg `#12110f` warm-slate, accent `#10b981` green, platform brand colors |

## AI Coding Rules (from `.cursorrules`)

- Strict TypeScript — no `any` types, ever
- All DB aggregations in Drizzle SQL (`sum`, `avg`, `count`, `groupBy`) — never pull full arrays and `.reduce()` / `.filter()` in JS
- Execute only the specific task requested — no placeholder stubs, no speculative features
- Append to `docs/system_log.md` on task completion (do not rewrite)

## File Naming Conventions

| Type | Pattern |
|---|---|
| Tab screen | `app/(tabs)/screenName.tsx` |
| Feature screen | `app/feature/index.tsx` |
| Modal | `app/feature/action.tsx` |
| Component | `src/components/feature/ComponentName.tsx` |
| Store | `store/useFeatureStore.ts` |
| Hook | `hooks/useFeatureName.ts` |
| Utility | `utils/featureName.ts` |
| Registry | `src/registry/registryName.ts` |
| DB queries | `src/database/queries/domain.ts` |

## Migration Status Snapshot

| Screen | Status |
|---|---|
| Onboarding | ✅ Done |
| Dashboard | 🔨 Half-done — bento layout built, Drizzle stats not wired |
| Vehicles | 🔨 Half-done — exists in Onboarding only, no standalone screen |
| Add Shift | 🔨 Half-done — stopwatch built in memory, no manual entry form |
| Settings | 🔨 Half-done — reset actions on Dashboard, no dedicated screen |
| Shifts | 🔲 Not started |
| Analytics | 🔲 Not started |
| Expenses | 🔲 Not started |
| Tax | 🔲 Not started |
| Schedule | 🔲 Not started |
| Goals | 🔲 Not started |
| Reports | 🔲 Not started |
| About | 🔲 Not started |
| Print | 🔲 → replaced by native Share/PDF export pipeline |

---

## Phase 0 — Schema Expansion
**Complete before any screen work. All phases depend on this.**

### Task 0.1 — Extend `shifts` table
**File**: `app/src/database/schema.ts`

Add to the existing `shifts` table:
```typescript
deadMileage:      real('dead_mileage').default(0).notNull(),
// GPS-tracked commute/waiting miles (not on a delivery)

activeMileage:    real('active_mileage').default(0).notNull(),
// GPS-tracked delivery miles — replaces trackedMileage going forward
// Keep trackedMileage column for backward compat, add comment marking it deprecated

durationSeconds:  integer('duration_seconds').default(0).notNull(),
// Total elapsed shift time in seconds

pausedSeconds:    integer('paused_seconds').default(0).notNull(),
// Total paused time — net active time = durationSeconds - pausedSeconds
```

### Task 0.2 — Extend `vehicles` table
**File**: `app/src/database/schema.ts`

Add to the existing `vehicles` table:
```typescript
make:          text('make'),
model:         text('model'),
year:          integer('year'),
fuelType:      text('fuel_type'),   // 'gas' | 'electric' | 'hybrid' | 'other'
licensePlate:  text('license_plate'),
```

### Task 0.3 — Add `maintenanceLogs` table
**File**: `app/src/database/schema.ts`

```typescript
export const maintenanceLogs = sqliteTable('maintenance_logs', {
  id:         text('id').primaryKey(),
  vehicleId:  text('vehicle_id').notNull().references(() => vehicles.id),
  type:       text('type').notNull(), // 'oil_change'|'tire'|'brake'|'fuel'|'wash'|'other'
  cost:       real('cost').notNull(),
  odometer:   real('odometer'),       // reading at time of service
  date:       integer('date', { mode: 'timestamp' }).notNull(),
  notes:      text('notes'),
});
```

### Task 0.4 — Add `goals` table
**File**: `app/src/database/schema.ts`

```typescript
export const goals = sqliteTable('goals', {
  id:          text('id').primaryKey(),
  label:       text('label').notNull(),
  targetValue: real('target_value').notNull(),
  unit:        text('unit').notNull(),    // 'currency'|'hours'|'shifts'|'mileage'
  period:      text('period').notNull(),  // 'daily'|'weekly'|'monthly'|'yearly'
  isActive:    integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  createdAt:   integer('created_at', { mode: 'timestamp' }).notNull(),
});
```

> **Note**: Onboarding wizard currently writes goals to Zustand only. After adding this table, update `OnboardingWizard.tsx` to also persist goals to this table on wizard completion.

### Task 0.5 — Extend `expenses` table
**File**: `app/src/database/schema.ts`

Add to the existing `expenses` table:
```typescript
vehicleId:   text('vehicle_id').references(() => vehicles.id), // optional
notes:       text('notes'),
receiptUri:  text('receipt_uri'),  // local file URI for photo receipts
```

### Task 0.6 — Generate and apply Drizzle migration
After all schema edits:
```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```
Verify with `npx drizzle-kit studio` before proceeding to Phase 1.

### Task 0.7 — Create query files (typed shells only)
Create the following files with typed exports — no stubs, no empty functions. Only the `import db` line and the exported function signatures with proper return types:

- `src/database/queries/shifts.ts`
- `src/database/queries/expenses.ts`
- `src/database/queries/vehicles.ts`
- `src/database/queries/goals.ts`
- `src/database/queries/analytics.ts`
- `src/database/queries/tax.ts`

Each file imports the Drizzle `db` client and the relevant schema tables. Functions are implemented in later phases, one per task.

---

## Phase 1 — Navigation Architecture
**Build the tab shell before writing any screen content.**

### Task 1.1 — Primary tab layout
**File**: `app/(tabs)/_layout.tsx`

Six tabs:

| Tab | Tabler icon | Route |
|---|---|---|
| Dashboard | `ti-home` | `index` |
| Shifts | `ti-clock-play` | `shifts` |
| Analytics | `ti-chart-bar` | `analytics` |
| Expenses | `ti-receipt` | `expenses` |
| Tax | `ti-calculator` | `tax` |
| More | `ti-dots` | `more` |

- Tab bar bg: `#12110f`, active tint: `#10b981`
- Use Expo Router `<Tabs>` with NativeWind className styling
- Apply iOS safe-area bottom inset and Android padding compensation
- "More" tab → a simple list screen linking to: Goals, Reports, Schedule, Vehicles, Settings, About

### Task 1.2 — Nested stack layouts
Create `_layout.tsx` files for nested stacks:

- `app/(tabs)/shifts/_layout.tsx` — stack: list → detail → add/edit
- `app/(tabs)/expenses/_layout.tsx` — stack: list → add/edit
- `app/(tabs)/vehicles/_layout.tsx` — stack: list → vehicle detail → maintenance add
- `app/settings/_layout.tsx` — modal stack, opened from More
- Verify `app/onboarding/_layout.tsx` is excluded from tab layout (it should be a root-level stack)

### Task 1.3 — Modal and deep link wiring
- Add Shift modal route: `app/shift/add.tsx` — modal presentation style. Triggered from Dashboard FAB and Shifts tab header button.
- Background location permission gate: a non-blocking banner/card on Dashboard if `Location.BackgroundPermissionStatus` is not granted. Tapping it calls `Location.requestBackgroundPermissionsAsync()`. Not a modal — inline in Dashboard layout.

---

## Phase 2 — Shared Component Library
**Build these before screens. Screens are composed from these atoms.**

### Task 2.1 — BentoCard
**File**: `src/components/ui/BentoCard.tsx`

Props:
```typescript
interface BentoCardProps {
  size: '1x1' | '2x1' | '1x2' | '2x2';
  title?: string;
  children: React.ReactNode;
  onPress?: () => void;
  accentColor?: string;
}
```

- 2-column NativeWind flex grid with wrap
- Size maps: `1x1` → `w-1/2`, `2x1` → `w-full`, `1x2` → `w-1/2 h-auto min-h-[160px]`, `2x2` → `w-full`
- Border: `border border-slate-800`, bg: `bg-[#1a1916]`, radius: `rounded-2xl`, padding: `p-4`
- No gradients

### Task 2.2 — Platform registry and PlatformBadge
**File**: `src/registry/platforms.ts`

```typescript
export const PLATFORMS = {
  uber_eats:   { label: 'Uber Eats',       color: '#06C167', textColor: '#000' },
  doordash:    { label: 'DoorDash',         color: '#FF3008', textColor: '#fff' },
  skip:        { label: 'SkipTheDishes',    color: '#FF6600', textColor: '#fff' },
  instacart:   { label: 'Instacart',        color: '#43B02A', textColor: '#fff' },
  lyft:        { label: 'Lyft',             color: '#FF00BF', textColor: '#fff' },
  amazon:      { label: 'Amazon Flex',      color: '#FF9900', textColor: '#000' },
  other:       { label: 'Other',            color: '#6B7280', textColor: '#fff' },
} as const;

export type PlatformKey = keyof typeof PLATFORMS;
```

**File**: `src/components/ui/PlatformBadge.tsx`
- Props: `platform: PlatformKey`, `size?: 'sm' | 'md'`
- Small pill with brand background color and label text
- Used everywhere shifts display

### Task 2.3 — CurrencyText
**File**: `src/components/ui/CurrencyText.tsx`

Props: `amount: number`, `size?: 'sm'|'md'|'lg'|'xl'`, `showSign?: boolean`

- Reads currency locale from settings store (`currency` KV key — `'CAD'` or `'USD'`)
- Green tint when positive, slate-muted when zero, red when negative
- Uses `Intl.NumberFormat` for formatting

### Task 2.4 — StatCard
**File**: `src/components/ui/StatCard.tsx`

Props: `icon: string` (ti- name), `label: string`, `value: string | number`, `delta?: number` (% vs last period)

- Compact card: icon row, value row, label + optional delta badge
- Used in Analytics overviews and Dashboard widgets

### Task 2.5 — EmptyState
**File**: `src/components/ui/EmptyState.tsx`

Props: `icon: string`, `title: string`, `message: string`, `actionLabel?: string`, `onAction?: () => void`

- Centered layout, warm-slate muted colors
- Used across every list screen when no data exists

### Task 2.6 — SectionHeader
**File**: `src/components/ui/SectionHeader.tsx`

Props: `title: string`, `action?: { label: string; onPress: () => void }`

- Consistent heading treatment across all screens

### Task 2.7 — Expense category registry
**File**: `src/registry/expenseCategories.ts`

```typescript
export const EXPENSE_CATEGORIES = {
  fuel:        { label: 'Fuel',        icon: 'ti-gas-station'   },
  maintenance: { label: 'Maintenance', icon: 'ti-tool'           },
  phone:       { label: 'Phone/Data',  icon: 'ti-device-mobile'  },
  insurance:   { label: 'Insurance',   icon: 'ti-shield'         },
  supplies:    { label: 'Supplies',    icon: 'ti-shopping-bag'   },
  parking:     { label: 'Parking',     icon: 'ti-parking'        },
  other:       { label: 'Other',       icon: 'ti-dots'           },
} as const;

export type ExpenseCategoryKey = keyof typeof EXPENSE_CATEGORIES;
```

---

## Phase 3 — Complete Half-Done Screens

### Task 3.1 — Dashboard: wire Drizzle stats
**File**: `app/(tabs)/index.tsx`
**Query file**: `src/database/queries/analytics.ts`

Implement these SQL-aggregate functions first:

```typescript
// All aggregations happen in SQL — no JS array processing
getTodayStats()   // sum(gross_revenue), sum(tips_revenue), count(id), sum(active_mileage), sum(dead_mileage) WHERE startTime is today
getWeekStats()    // same aggregates for current ISO week
getActiveVehicle() // reads settings KV key 'active_vehicle_id', joins vehicles table
getGoalProgress(period: string) // joins goals table with aggregated shift data for current period
```

Wire to existing BentoCards:
- "Today" card → `getTodayStats()` — total earnings, shift count
- "This Week" card → `getWeekStats()` — weekly earnings, hours (durationSeconds / 3600)
- "Miles" card → today's active vs dead mileage, two labelled bars
- "Goal" card → progress ring toward current weekly income goal from `getGoalProgress('weekly')`
- Active Shift Hero Card — already built. Verify `endShift()` in `useActiveShift.ts` writes `durationSeconds`, `pausedSeconds`, `activeMileage`, `deadMileage` to the `shifts` table via `insertShift()` in queries/shifts.ts. If it doesn't, add that write.

### Task 3.2 — Add Shift: manual entry form
**File**: `app/shift/add.tsx` (modal)

Fields:
- Platform — PlatformBadge selector grid (PlatformKey picker)
- Vehicle — select from vehicles table (dropdown)
- Date, Start Time, End Time — DateTimePicker (expo)
- Gross Revenue — numeric input
- Tips — numeric input
- Active Mileage — numeric, optional
- Dead Mileage — numeric, optional
- Notes — multiline text

On save:
- Call `insertShift(payload)` from `src/database/queries/shifts.ts`
- Invalidate TanStack Query keys `['shifts']` and `['analytics']`
- Show success toast and close modal

Edit mode (receives `shiftId` param):
- Pre-populate form from DB
- Calls `updateShift(id, payload)` instead
- Same invalidations

### Task 3.3 — Vehicles management screen
**File**: `app/(tabs)/vehicles/index.tsx`

FlatList of all vehicles from DB. Each row: name, make/model/year, active badge.
Empty state: EmptyState component with `ti-car` icon.

**Detail screen** — `app/(tabs)/vehicles/[id].tsx`:
1. Vehicle info form (editable, calls `updateVehicle(id, payload)`)
2. Summary stats: total shifts driven, total active mileage — from `src/database/queries/vehicles.ts → getVehicleStats(vehicleId)` using SQL `count` and `sum`
3. Maintenance log list — from `maintenanceLogs` WHERE `vehicleId`, ordered by date desc
4. "Add Maintenance Log" button → `app/(tabs)/vehicles/maintenance/add.tsx`

**Add/Edit vehicle** — `app/(tabs)/vehicles/add.tsx`:
Fields: name, make, model, year, fuelType (selector), licensePlate, isActive toggle
Calls `insertVehicle()` or `updateVehicle()`

### Task 3.4 — Settings screen
**File**: `app/settings/index.tsx` (modal stack)

Sections:

1. **Profile** — name, country, region from settings KV. Inline editable fields. Writes via `upsert` into `settings` table.

2. **Platforms** — active platforms from settings KV key `'active_platforms'` (JSON array of PlatformKey). PlatformBadge grid with checkbox overlay. Toggle writes back to KV.

3. **Locale** — currency selector (CAD / USD), distance unit (km / miles). Writes to settings KV.

4. **Data & Backup** — "Backup to Google Drive" button (Phase 12 service). "Restore from Drive" button. "Export CSV" button (Phase 9 utility). Shows `last_backup_at` from settings KV.

5. **Danger Zone** — "Reset App": wipe all DB rows + settings KV + Zustand, redirect to Onboarding. "Clear Demo Mode": remove demo flag from settings.

Each settings write: `upsert` to `settings` table. Invalidate relevant React Query keys on change.

---

## Phase 4 — Shifts Screen

### Task 4.1 — Shifts list
**File**: `app/(tabs)/shifts/index.tsx`

- FlatList with pagination — 20 rows per page via `limit/offset` in `getShiftsPaginated(page, filters)` in `queries/shifts.ts`
- ShiftCard component (`src/components/shifts/ShiftCard.tsx`): PlatformBadge, date, gross+tips via CurrencyText, mileage, duration
- Header: filter bar — date range picker, platform multi-select (PlatformKey[])
- Header right button: `+` → opens `app/shift/add.tsx` modal
- Empty state: EmptyState with `ti-clock` icon and "No shifts yet. Start one from the Dashboard."

### Task 4.2 — Shift detail
**File**: `app/(tabs)/shifts/[id].tsx`

- Full shift data from DB
- Linked expenses list (from `expenses` WHERE `shiftId`) — each as a small row with category icon and amount
- "Add Expense" button → opens expense add modal pre-linked to this shift
- Edit button → opens `app/shift/add.tsx` in edit mode with `shiftId` param
- Delete with confirmation alert → `deleteShift(id)` (cascade delete linked expenses in same Drizzle transaction), invalidate queries, navigate back

Mileage breakdown: active miles, dead miles, dead mile percentage — three labelled rows with bar

### Task 4.3 — CSV import wizard
**File**: `src/components/shifts/CSVImportWizard.tsx`

4-step flow:

- Step 1: File picker (expo-document-picker, accept `.csv`)
- Step 2: Column mapping — display CSV headers in a dropdown per required field (platform, startTime, endTime, grossRevenue, tips, mileage)
- Step 3: Preview — first 5 rows in a table with mapped values
- Step 4: Confirm → `insertManyShifts(rows[])` in a single Drizzle transaction. Report success count and any skipped rows.

PapaParse for CSV parsing. Error rows (missing required fields) are collected and shown as a summary after import.

---

## Phase 5 — Analytics Screen

### Task 5.1 — Analytics queries
**File**: `src/database/queries/analytics.ts`

All queries use Drizzle SQL aggregates — no JS array processing:

```typescript
getEarningsByPlatform(startDate: Date, endDate: Date)
// group by platform, sum(gross_revenue + tips_revenue), count(id)

getEarningsByDay(weeks: number)
// daily sums for rolling N weeks, bucketed by date(startTime)

getHourlyRate(startDate: Date, endDate: Date)
// sum(gross_revenue + tips_revenue) / (sum(duration_seconds) / 3600.0)

getBestDayOfWeek(startDate: Date, endDate: Date)
// avg earnings grouped by strftime('%w', startTime) — returns 0-6

getBestHourOfDay(startDate: Date, endDate: Date)
// avg earnings grouped by strftime('%H', startTime)

getMileageSplit(startDate: Date, endDate: Date)
// sum(active_mileage), sum(dead_mileage), ratio

getNetIncome(startDate: Date, endDate: Date)
// sum(gross_revenue + tips_revenue) minus sum of deductible expenses in same period
```

### Task 5.2 — Analytics UI
**File**: `app/(tabs)/analytics/index.tsx`

Scrollable screen:

1. **Period selector** — pill toggle: Week / Month / 3M / Year / All Time. Updates all sections reactively via shared `selectedPeriod` Zustand slice.

2. **Earnings overview** — StatCard row: total gross, net after expenses, hourly rate, total shifts

3. **Platform breakdown** — donut chart + ranked list. Each row: PlatformBadge, total earnings (CurrencyText), shift count, share %

4. **Daily trend** — bar chart (earnings per day for selected period)

5. **Best times** — day-of-week bar chart for avg earnings per day + hour-of-day bar for best working hours

6. **Mileage split** — active vs dead breakdown, dead mile ratio, estimated fuel cost (dead miles × avg fuel cost per km/mile from settings)

7. **Insights** — auto-generated text cards from query results: "Your best day is Tuesday", "34% of your miles are dead miles", etc.

Chart library: choose **one** — `react-native-gifted-charts` or `victory-native`. Use it consistently across Analytics, Dashboard, and Goals. Do not mix chart libraries.

---

## Phase 6 — Expenses Screen

### Task 6.1 — Expenses list
**File**: `app/(tabs)/expenses/index.tsx`

- SectionList grouped by month
- Query: `getExpensesByMonth(year)` from `queries/expenses.ts` — `group by strftime('%Y-%m', date)`, ordered desc
- Each row: category icon (from EXPENSE_CATEGORIES registry), label, amount, deductible badge
- Summary header: total deductible YTD, total non-deductible YTD — from `getExpenseYTDSummary()`
- Filter bar: category multi-select, deductible toggle
- Header right: `+` → opens `app/expense/add.tsx` modal

### Task 6.2 — Add/Edit expense form
**File**: `app/expense/add.tsx` (modal)

Fields:
- Category — EXPENSE_CATEGORIES selector grid with icons
- Amount — numeric input
- Date — DatePicker
- Is deductible — toggle (defaults true)
- Link to shift — optional searchable picker (search recent shifts by date/platform)
- Link to vehicle — optional selector
- Notes — text input
- Receipt photo — expo-image-picker, store URI in `receiptUri` field

On save: `insertExpense(payload)`, invalidate `['expenses']` and `['analytics']`. Show toast. Close modal.

---

## Phase 7 — Tax Screen

### Task 7.1 — Tax calculation engine
**File**: `utils/taxCalculations.ts`

Pure functions, fully typed, no `any`, no side effects.

**Canada (CRA)**:
```typescript
calculateCPP(netIncome: number): { employeePortion: number; employerPortion: number; total: number }
// Self-employed pay both portions. Use current CRA CPP rate and Year's Maximum Pensionable Earnings.

calculateHSTOwing(grossRevenue: number, province: string): number
// Province-specific HST/GST rates. Returns estimated HST collected on revenue.

calculateCRAMileageDeduction(km: number): number
// CRA simplified logbook rate × km

calculateQuarterlyInstallments(annualTaxEstimate: number): { Q1: Date; Q2: Date; Q3: Date; Q4: Date; amount: number }
```

**USA (IRS)**:
```typescript
calculateSelfEmploymentTax(netIncome: number): number
// 15.3% on 92.35% of net self-employment income

calculateScheduleC(grossIncome: number, totalExpenses: number): number
// Net profit = gross - expenses

calculateIRSMileageDeduction(miles: number): number
// IRS standard mileage rate × miles
```

Rates are defined as named constants at the top of the file with the tax year clearly commented. When rates change, only the constants need updating.

### Task 7.2 — Tax UI
**File**: `app/(tabs)/tax/index.tsx`

Sections:
1. **Region** — detected country/province from settings KV. "Edit" → Settings screen.
2. **Income summary** — gross revenue, total deductible expenses, net self-employment income (from analytics queries for current tax year)
3. **Estimated tax** — broken into labeled rows: CPP contribution, estimated income tax bracket, HST/GST (Canada) or SE tax (USA)
4. **Mileage deduction** — total mileage → deduction value at standard rate
5. **Quarterly dates** — static reminder cards for CRA/IRS installment due dates
6. **Disclaimer card** — "These are estimates only. Consult a licensed tax professional for your actual filing."

---

## Phase 8 — Goals Screen

### Task 8.1 — Goals queries
**File**: `src/database/queries/goals.ts`

```typescript
getGoalsWithProgress(): Promise<Array<Goal & { currentValue: number; progressPct: number }>>
// For each active goal, JOIN with aggregated shift/expense data for the current period:
// - unit='currency': sum(gross_revenue + tips_revenue) for current period
// - unit='hours':    sum(duration_seconds) / 3600 for current period
// - unit='shifts':   count(id) for current period
// - unit='mileage':  sum(active_mileage) for current period
// All aggregation in SQL. Return progressPct = currentValue / targetValue * 100.
```

### Task 8.2 — Goals UI
**File**: `app/goals/index.tsx` (accessible from More tab)

- List of active goals, each as a progress card: label, circular progress ring, current / target values with units, period badge
- "Add Goal" button → inline form: label, target value, unit selector, period selector
- Swipe to delete goal with confirmation
- Verify Onboarding wizard writes its collected goals to the `goals` table on completion — add that write if missing

---

## Phase 9 — Reports Screen

### Task 9.1 — Report generation utilities
**File**: `utils/reportGenerator.ts`

```typescript
generateShiftsCSV(startDate: Date, endDate: Date): Promise<string>
// Query shifts + linked expenses for period. PapaParse serialize to CSV string.
// Columns: date, platform, grossRevenue, tips, activeMileage, deadMileage, durationSeconds, notes

generateExpensesCSV(startDate: Date, endDate: Date): Promise<string>
// Query expenses for period. PapaParse serialize.
// Columns: date, category, amount, isDeductible, notes, linkedShiftId

generatePDFSummary(startDate: Date, endDate: Date): Promise<string>
// Build an HTML string with earnings summary table, mileage breakdown, expense totals.
// Pass to expo-print to produce a PDF file URI.
// Style: clean, minimal, Comma branding (green accent), print-safe fonts.
```

### Task 9.2 — Reports UI
**File**: `app/reports/index.tsx`

- Period selector: presets — This Month, Last Month, This Quarter, This Year, Custom range
- Summary preview card: total gross, net income, total expenses, total mileage for selected period
- Export row buttons:
  - "Export Shifts CSV" → generateShiftsCSV → React Native Share sheet
  - "Export Expenses CSV" → generateExpensesCSV → Share sheet
  - "Export PDF Summary" → generatePDFSummary → Share sheet (or save to device via expo-file-system)

---

## Phase 10 — Schedule Screen

### Task 10.1 — Schedule UI
**File**: `app/schedule/index.tsx`

- Monthly calendar grid — `react-native-calendars` (already a common Expo-compatible lib)
- Each day with recorded shifts: colored dot per platform (PlatformKey brand color)
- Tap a day → day detail view (inline expand or navigate): list of shifts for that day, total earnings
- "Plan Shift" button: creates a shift template (platform + vehicle pre-fill) stored in settings KV as a JSON array under key `'shift_templates'`. Optionally schedule an expo-notifications local reminder.
- No new DB table needed — templates live in settings KV.

---

## Phase 11 — About Screen

### Task 11.1 — About UI
**File**: `app/about/index.tsx`

Sections:
- App version via `expo-constants` (`Constants.expoConfig.version`)
- Privacy statement: "100% local. No data ever leaves your device."
- Support link (mailto or web URL — define in a constants file)
- Open source acknowledgments (expo-modules list)
- "Export diagnostic log" button → reads `docs/system_log.md` content, shares as a plain text file via React Native Share

---

## Phase 12 — Native Features

### Task 12.1 — Background GPS tracking
**Files**:
- `hooks/useGPSTracking.ts`
- `utils/geoCalculations.ts`
- `src/registry/gpsConfig.ts`

**Libraries**: `expo-location`, `expo-task-manager`

**GPS config registry**:
```typescript
// src/registry/gpsConfig.ts
export const GPS_CONFIG = {
  accuracy:                  Location.Accuracy.Balanced,
  timeInterval:              10_000,   // ms between updates
  distanceInterval:          20,       // meters minimum movement to trigger update
  jitterThresholdMps:        42,       // m/s — discard coords implying >150 km/h (GPS jitter)
  deadSpeedThresholdKmh:     5,        // below this speed = dead miles
} as const;
```

**Geo calculation utilities** (`utils/geoCalculations.ts` — pure functions):
```typescript
haversineDistance(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number
// Returns distance in meters

classifyMiles(speedKmh: number): 'active' | 'dead'
// Returns 'dead' if below GPS_CONFIG.deadSpeedThresholdKmh

isGPSJitter(distanceM: number, elapsedMs: number): boolean
// Returns true if implied speed > GPS_CONFIG.jitterThresholdMps
```

**Architecture in `useGPSTracking.ts`**:
1. `startTracking()` — request background location permission → register `LOCATION_TASK` via `TaskManager.defineTask`
2. `LOCATION_TASK` fires in background → receives coordinates batch
3. For each pair of consecutive coords: compute haversine distance, check jitter, classify as active or dead
4. Accumulate into Zustand `useActiveShiftStore`: `activeMileage` and `deadMileage` counters
5. `stopTracking()` — unregister task, return final mileage totals to caller for DB write

### Task 12.2 — Wake lock / background timer
**File**: `hooks/useWakeLock.ts`

- `expo-keep-awake`: call `activateKeepAwakeAsync()` on shift start, `deactivateKeepAwake()` on end
- Background timer: register a `SHIFT_TIMER_TASK` via expo-task-manager that writes elapsed seconds to settings KV key `'active_shift_elapsed'` every 30 seconds
- On app foreground: read persisted elapsed seconds, reconcile with Zustand timer state (take the max of Zustand value and persisted value to handle race conditions)

### Task 12.3 — Google Drive backup/restore
**Files**:
- `src/services/googleDrive.ts`
- `hooks/useGoogleDriveSync.ts`

**Auth**: `expo-auth-session` with Google OAuth2. Scope: `https://www.googleapis.com/auth/drive.appdata`

**Token management**:
- Store access token + refresh token + expiry in `expo-secure-store`
- Before every Drive API call: check expiry. If < 5 minutes remaining, call the token refresh endpoint silently.

**Backup flow**:
1. Export all DB tables as JSON via Drizzle `select *` on each table
2. Serialize to JSON string
3. Encrypt: AES-GCM 256-bit via `react-native-quick-crypto`
4. Encryption key: derived from device ID + user-set PIN, stored only in `expo-secure-store` (never in DB or Drive)
5. Upload to Drive `appDataFolder` as `comma-backup-{ISO timestamp}.comdb`
6. Write `last_backup_at` timestamp to settings KV

**Restore flow**:
1. List `.comdb` files in `appDataFolder`, sorted newest first
2. Present file list in Settings UI (filename + upload date)
3. User selects → download → decrypt → validate JSON structure against current schema version
4. Run inside a Drizzle transaction: wipe all table rows → bulk insert restored data
5. On success: invalidate all React Query keys, show success message

---

## Phase 13 — App Store Preparation

### Task 13.1 — Background location permission strings
**File**: `app.json`

iOS — add to `ios.infoPlist`:
```json
"NSLocationWhenInUseUsageDescription": "Comma uses your location during active shifts to track delivery mileage.",
"NSLocationAlwaysAndWhenInUseUsageDescription": "Comma tracks GPS in the background during active delivery shifts to calculate active delivery miles vs dead miles (commuting and waiting). All location data stays 100% on your device and is never uploaded."
```

Android — add to `android.permissions`:
```json
["ACCESS_FINE_LOCATION", "ACCESS_BACKGROUND_LOCATION", "FOREGROUND_SERVICE", "RECEIVE_BOOT_COMPLETED"]
```

Add a `foregroundService` entry in `app.json` under `android` with a notification title/description explaining why it runs.

### Task 13.2 — EAS build profiles
**File**: `eas.json`

Verify three profiles exist:
- `development` — debug build, Expo Dev Client, internal distribution
- `preview` — release APK (Android) + simulator build (iOS) for internal QA testing
- `production` — AAB for Play Store, IPA for App Store via App Store Connect

### Task 13.3 — App Store metadata checklist
- App name: Comma
- Category: Finance
- Keywords: gig worker, delivery tracker, mileage log, earnings tracker, DoorDash, Uber Eats
- Privacy manifest (iOS): declare no data collection (local-only, no analytics SDKs)
- Age rating: 4+
- Privacy policy URL: required even for local-only apps — prepare a minimal one

### Task 13.4 — Pre-submission performance audit
- All FlatLists use `keyExtractor`, `getItemLayout`, `windowSize={5}`, `removeClippedSubviews`
- No synchronous DB calls on the main thread — all Drizzle calls are `async/await`
- All images use `expo-image` (not React Native's `<Image>`) for memory-efficient caching
- Run React Native's built-in Performance Monitor on Dashboard and Shifts list: target < 16ms renders

---

## Agent Prompt Templates

Paste these when executing tasks. Fill in `[TASK DESCRIPTION]`.

### General task
```
App: Comma — React Native gig-worker earnings tracker
Stack: Expo SDK 56, Expo Router, NativeWind v4, React Native Reusables (RNR), Drizzle ORM on expo-sqlite, Zustand, TanStack React Query

Rules:
- Strict TypeScript, no `any`
- DB aggregations in Drizzle SQL only — no JS .reduce() or .filter() on full arrays
- No placeholder stubs or speculative features — implement only what is asked
- File naming: screens → app/(tabs)/name.tsx, components → src/components/feature/Name.tsx, hooks → hooks/useName.ts, queries → src/database/queries/domain.ts
- Append one line to docs/system_log.md on completion (do not rewrite the file)

Task: [TASK DESCRIPTION]
```

### Schema change
```
App: Comma [stack as above]
Schema file: app/src/database/schema.ts

Current schema:
[paste current schema.ts contents]

Task: [schema change description]

After editing schema.ts, run:
  npx drizzle-kit generate
  npx drizzle-kit migrate

Do not touch any other files. Append to docs/system_log.md on success.
```

### Query implementation
```
App: Comma [stack as above]

Relevant schema:
[paste relevant table definitions]

Task: Implement [functionName] in src/database/queries/[domain].ts

Signature: [full TypeScript signature]
Returns: [return type]

Requirements:
- Drizzle ORM query builder only
- All aggregations (sum, count, avg, groupBy) must happen in SQL, not in JS
- Export the function
- No side effects

Append to docs/system_log.md on success.
```

### Screen implementation
```
App: Comma [stack as above]
Theme: bg #12110f, accent #10b981, NativeWind v4 classes, RNR components

Available shared components:
- BentoCard (src/components/ui/BentoCard.tsx)
- PlatformBadge (src/components/ui/PlatformBadge.tsx)
- CurrencyText (src/components/ui/CurrencyText.tsx)
- StatCard (src/components/ui/StatCard.tsx)
- EmptyState (src/components/ui/EmptyState.tsx)
- SectionHeader (src/components/ui/SectionHeader.tsx)

Available registries:
- PLATFORMS (src/registry/platforms.ts)
- EXPENSE_CATEGORIES (src/registry/expenseCategories.ts)

Task: Build [screen name] at [file path]
Queries to use: [list query functions from queries/ files]
UI spec: [describe layout]

Rules: no any, no stubs, use EmptyState for empty lists, use CurrencyText for all money values, use PlatformBadge for all platform displays.

Append to docs/system_log.md on success.
```