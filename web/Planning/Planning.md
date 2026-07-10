# COMMA React Native Migration Planning

In this folder I am planning for the fundamental of COMMA for a react native app. Since it is a web app, I am planning to migrate it to a react native app, so that it can be run natively on mobile devices, and also on desktop devices through React Native for Desktop. The app will target Android, iOS, and Windows.

The goal of this document is to map out the current app's foundation and design a new foundational architecture for the React Native app.

---

## 1. App Overview
Comma (formerly Macadam) is a local-first, offline-capable gig driver earnings application. It is designed for gig economy workers (Uber Eats, DoorDash, Instacart, etc.) to track their shifts, expenses, and goals. It acts as a financial dashboard and performance tracker, solving the problem of gig workers having fragmented earnings data across multiple apps and needing a unified view of their real net income, taxes, and efficiency. It is entirely self-contained and runs purely on the user's device.

## 2. Core Features
- **Shift Tracking**: Users can log shifts manually, use a live active-shift timer, duplicate past shifts, create reusable shift templates, and bulk-import shifts via CSV.
- **Expense Tracking**: Allows logging one-off or recurring expenses with categories to calculate true net income.
- **Goal Setting**: Users can set and track weekly or monthly earnings targets.
- **Dashboard & Analytics**: A highly customizable "Bento Box" style dashboard where users can pin widgets (e.g., net income, rolling trends, streaks).
- **Gamification**: Includes an XP system, leveling, streaks, and unlockable badges to motivate drivers.
- **Platform Management**: Supports multiple delivery platforms with custom terminologies and theme colors.
- **Offline-First Storage**: All data is stored locally using IndexedDB (via Dexie.js), ensuring complete privacy and offline functionality.
- **Data Export & Reports**: Users can generate financial summaries, export data, and view a printable report.

## 3. Screens and Pages
- **Dashboard (`#/dashboard`)**: The primary landing view. Displays the user's customized grid of bento widgets, a date-range filter, and a monthly financial breakdown table.
- **Shifts (`#/shifts`)**: A list view of all past shifts with tools to start a timer, manage templates, or import CSVs. Each shift card shows metrics and action buttons (edit, duplicate, delete).
- **Add Shift (`#/shifts/new`)**: A modal/overlay form to manually input shift data (platform, times, earnings, distance).
- **Analytics (`#/analytics`)**: An exploration page that lists all available analytical modules (Deep Insights, Performance Modules, Summary Stats). Users can hover over these to add them to their Dashboard.
- **Expenses (`#/expenses`)**: A view to list and manage business expenses.
- **Tax (`#/tax`)**: A page for tax estimates and withholdings tracking.
- **Vehicles (`#/vehicles`)**: Management of vehicle profiles, odometer logs, and maintenance records.
- **Schedule (`#/schedule`)**: A calendar/planning interface.
- **Goals (`#/goals`)**: A tracker for financial targets.
- **Reports (`#/reports`)**: Detailed financial summaries.
- **Settings (`#/settings`)**: App configuration (theme, locale, platforms, data management).
- **Onboarding (`#/onboarding`)**: The initial setup flow capturing user profile, location, and primary platform.
- **About (`#/about`)**: App information.
- **Print (`#/print`)**: Formatted view for printing reports.

## 4. Navigation and User Flows
- **Custom Hash Router**: Navigation is handled by a custom offline-safe hash router (`src/core/router.js`).
- **Onboarding Guard**: The router intercepts every navigation event. If `store.get('user')?.onboardingComplete` is false, the user is locked into the `#/onboarding` view with a full-bleed layout (app chrome hidden).
- **Global Chrome**: The main app shell (`src/core/shell.js`) includes a top header, sidebar (desktop), and bottom tab bar (mobile).
- **Quick Actions (FAB)**: A global Floating Action Button (FAB) or speed dial provides quick access to starting a shift, adding expenses, or setting goals.
- **Active Timer**: If a shift timer is running, a persistent "Timer Bar" is visible at the top of the main content area, allowing the user to end the shift from anywhere.

## 5. Data Models and State
- **Database (IndexedDB via Dexie)**:
  - `users`: Profile data (id, displayName, locale, weeklyGoal, theme, onboardingComplete).
  - `platforms`: Platform configurations (id, name, active, priority).
  - `shifts`: Core earnings data (id, date, platformId, durationMinutes, grossEarnings, tips, distanceKm, etc.). Stored in integer cents.
  - `expenses`: Cost tracking (id, date, category, amount, etc.).
  - `appState`: Key-value store for transient/persisted app state (schema_version, active_shift_start, xp_total, demo_mode).
  - Other stores: `vehicles`, `goals`, `badges`, `notifications`.
- **Global State (`src/core/store.js`)**:
  - A custom reactive store holds working memory (`user`, `platforms`, `activeShiftTimer`, `currentWeekEarnings`, `theme`, `demoMode`).
  - Components subscribe to store changes to re-render or bind values to the DOM.

## 6. API and Backend Interactions
- **None**. The application is 100% offline-first and local. There are no API calls (`fetch` or `XMLHttpRequest`) to external backend services for core functionality.
- Data synchronization (if any) is handled purely through PWA background sync features or manual JSON/CSV imports/exports.

## 7. Authentication and Authorization
- **No Authentication**. There are no login, signup, or session handling flows. The user's "account" is simply the local profile stored in IndexedDB.
- There are no roles or permission levels.

## 8. Third Party Libraries and Services
- **Dexie.js (`dexie.min.js`)**: A wrapper for IndexedDB used for all local database interactions.
- **PapaParse (`papaparse.min.js`)**: Used to parse CSV files for the bulk shift import feature.
- **ESBuild**: Used in the build pipeline.
- *Note: The app is built with Vanilla JS, avoiding major frameworks like React or Vue.*

## 9. Business Logic
- **Financial Calculations**: Gross vs. Net logic, converting string currency inputs to integer cents to avoid floating-point errors, and formatting back to locale-specific currency strings.
- **Conflict Checking**: Logic in `shifts.js` (`checkConflict`) ensures a user cannot log overlapping shifts on the same day.
- **Time/Date Math**: Converting dates relative to the user's configured `weekStartDay`.
- **Gamification**: Centralized event bus emits `XP_EARNED` and checks for badge unlocks or streak updates upon shift saves.

## 10. Component and Module Structure
- `src/core/`: The foundational engines (Database schema, custom Pub/Sub Event Bus, Router, State Store, Shell layout).
- `src/modules/`: Domain-specific business logic and controllers (e.g., `analytics/`, `shifts/`, `onboarding/`, `pwa/`).
- `src/registry/`: Extensibility registries defining available platforms, dashboard widgets, badges, and metrics.
- `src/ui/`: Reusable, framework-agnostic UI components (Icons, Modals, Toasts, Confirm Dialogs, FAB).
- `src/views/`: Top-level page renderers (Dashboard, Shifts View, Analytics View, etc.).

## 11. Styling and Design Patterns
- **Vanilla CSS**: The app uses plain CSS with heavy reliance on CSS Custom Properties (`--var`) for theming and tokens.
- **Bento Grid**: The dashboard utilizes a modern "Bento Box" responsive CSS Grid layout, supporting dynamically sized widgets (`1x1`, `2x2`, `4x1`).
- **Theming**: Supports `light`, `dark`, and `auto` (system) themes.
- **Component Classes**: Follows a standard BEM-like naming convention for components, avoiding ad-hoc inline styles.

## 12. Known Incomplete or Broken Areas
- The codebase relies heavily on a `demoMode` toggle, which loads synthetic data to showcase the app. This suggests the app is currently optimized for demonstration or beta usage.
- UI DOM updates are tightly coupled with manual event listeners and `innerHTML` replacements, which occasionally necessitates custom error boundaries (e.g., `renderErrorBoundary` in router).

## 13. Anything Else Worth Noting
- **Migration Strategy**: 
  - **Database**: Dexie.js must be replaced with a robust React Native local database like **WatermelonDB** or **react-native-quick-sqlite**.
  - **State**: The custom pub/sub `store.js` and `events.js` should be replaced with **Zustand** or **Redux Toolkit**, which map perfectly to this reactive pattern.
  - **Routing**: The custom hash router must be swapped for **React Navigation** (`@react-navigation/native`), utilizing Stack Navigators and Bottom Tabs.
  - **Icons**: The current app uses inline SVG strings. These will need to be ported to `react-native-svg` components.
- **Currency Handling**: The app correctly stores all monetary values as integer cents. This pattern must be strictly maintained in the React Native port to ensure financial accuracy.

## 14. React Native Migration Blueprint

### A. Routing and Navigation Logic (React Navigation)
The current vanilla JS hash router (`src/core/router.js`) handles both screen transitions and an onboarding guard. In React Native, this will be handled by `@react-navigation/native` using a combination of Stack Navigators and a Bottom Tab Navigator.

**Root Navigator (`AppNavigator.tsx`)**:
- Uses conditional rendering to handle the onboarding guard.
- If `!onboardingComplete`: Renders `OnboardingStack` (Full screen, no tabs).
- If `onboardingComplete`: Renders `MainTabNavigator`.
- Contains global modals overlaying the app (e.g., `AddShiftModal`, `AddExpenseModal`).

**Main Tab Navigator (`MainTabNavigator.tsx`)**:
- **DashboardTab**: Renders `DashboardScreen`.
- **ShiftsTab**: Renders a nested `ShiftsStack` (list -> details).
- **AnalyticsTab**: Renders `AnalyticsScreen`.
- **GoalsTab**: Renders `GoalsScreen`.
- **MoreMenuTab**: Triggers a Bottom Sheet (replacing the drawer) with links to Expenses, Tax, Vehicles, Schedule, Reports, and Settings.

**Global Modals / Overlays**:
- Quick action FAB from the web app maps to a floating `SpeedDial` component at the bottom right of the tab navigator or a central `+` tab button.
- Screens like `#/shifts/new` or `?fab=expense` become `presentation: 'modal'` screens in the Root Stack.

### B. State Management (Zustand)
The reactive working memory (`src/core/store.js`) will be replaced by a Zustand store (`useAppStore.ts`).

**State Shape Blueprint**:
\`\`\`typescript
interface AppState {
  user: User | null;
  platforms: Platform[];
  activePlatformId: string | 'all';
  activeShiftTimer: { startTime: string; platformId: string } | null;
  currentWeekEarnings: number;
  theme: 'light' | 'dark' | 'auto';
  isOnline: boolean;
  demoMode: boolean;
  
  // Actions
  setUser: (user: User) => void;
  setPlatformFilter: (id: string) => void;
  startShiftTimer: (platformId: string) => void;
  stopShiftTimer: () => void;
  syncFromDatabase: () => Promise<void>;
}
\`\`\`

### C. Offline Database (WatermelonDB)
The Dexie.js database (`src/core/db.js`) will translate directly to WatermelonDB for high-performance offline data.

**Models Blueprint**:
- \`User\`: Observable user profile and settings.
- \`Shift\`: Observable earnings and shift times.
- \`Expense\`: Observable costs.
- \`Goal\`: Observable financial targets.

WatermelonDB handles "soft deletes" out of the box (like the current web app does with \`deletedAt\`), making the transition of the purge/restore features seamless.

### D. Component Translation Blueprint
- **Bento Dashboard**: Implemented via a \`FlatList\` or \`ScrollView\` with \`react-native-reanimated\` for layout transitions when adding/removing widgets.
- **Modals and Toasts**: Replace custom DOM modals with \`@gorhom/bottom-sheet\` and a Toast library like \`react-native-toast-message\`.
- **Active Shift Timer Bar**: A persistent component rendered outside the \`MainTabNavigator\` but inside the \`RootStack\` so it stays visible while navigating tabs.
- **Event Bus (\`src/core/events.js\`)**: Most event-based rerenders are solved by React's state reactivity. For detached background tasks (e.g., XP unlocks or PWA sync), use \`DeviceEventEmitter\` or a simple \`mitt\` instance.

## 15. Source Code & Key Logic Dumps

To assist with the React Native translation without guesswork, here is the exact file tree of the core web app and the critical logic from the core files.

### A. Core File Structure
```text
src/
├── core
│   ├── db.js
│   ├── events.js
│   ├── router.js
│   ├── shell.js
│   ├── store.js
│   └── vault-gate.js
├── css
│   ├── animations.css
│   ├── components.css
│   ├── layout.css
│   ├── reset.css
│   ├── themes.css
│   ├── tokens.css
│   ├── views
│   │   ├── analytics.css
│   │   ├── calendar.css
│   │   ├── dashboard.css
│   │   ├── onboarding.css
│   │   ├── reports.css
│   │   ├── search.css
│   │   ├── settings.css
│   │   ├── shifts.css
│   │   ├── tax.css
│   │   └── vehicles.css
│   └── widgets_theme.css
├── libs
│   ├── chart.min.js
│   ├── confetti.min.js
│   ├── dayjs.duration.min.js
│   ├── dayjs.min.js
│   ├── dayjs.relativeTime.min.js
│   ├── dexie.min.js
│   ├── fuse.min.js
│   ├── html2canvas.min.js
│   ├── papaparse.min.js
│   ├── qrcode.min.js
│   └── sortable.min.js
├── main.js
├── modules
│   ├── analytics
│   ├── demo
│   ├── expenses
│   ├── goals
│   ├── notifications
│   ├── onboarding
│   ├── p13
│   ├── platforms
│   ├── pwa
│   ├── reports
│   ├── schedule
│   ├── search
│   ├── settings
│   ├── shifts
│   ├── tax
│   ├── vehicles
│   └── zones
├── registry
│   ├── badges
│   ├── countries
│   ├── expense-categories
│   ├── goal-types
│   ├── index.js
│   ├── market
│   ├── metrics
│   ├── notifications
│   ├── platforms
│   ├── provinces
│   ├── reports
│   ├── shift-fields
│   ├── tax
│   ├── types.js
│   └── widgets
├── ui
│   ├── charts.js
│   ├── components.js
│   ├── icons.js
│   └── nav-icons.js
├── utils
│   ├── calculations.js
│   ├── date-range-presets.js
│   ├── formatters.js
│   ├── locale.js
│   └── strings.js
└── views
    ├── about-view.js
    ├── analytics-view.js
    ├── dashboard.js
    ├── expenses-view.js
    ├── goals-view.js
    ├── onboarding-view.js
    ├── print-view.js
    ├── reports-view.js
    ├── schedule-view.js
    ├── settings-view.js
    ├── shifts-view.js
    ├── tax-view.js
    ├── vehicles-view.js
    └── view-utils.js
```

### B. `src/core/db.js` (Database Schema)
The Dexie schema definition that must be mapped to WatermelonDB:
```javascript
export const CURRENT_LOGICAL_SCHEMA_VERSION = 3;
const DB_NAME = 'COMMAVault';

const STORES_V3 = {
  users: 'id',
  platforms: '&id, active',
  shifts: '++id, date, platformId, vehicleId, provinceId, deletedAt',
  expenses: '++id, date, category, platformId, provinceId, deletedAt',
  vehicles: '++id, active',
  vehicleMaintenanceLogs: '++id, vehicleId, date',
  vehicleOdometerLog: '++id, vehicleId, date',
  fuelPrices: '++id, vehicleId, date',
  goals: '++id, scope, active',
  goalHistory: '++id, goalId, periodStart',
  badges: '&id',
  xpLog: '++id, createdAt',
  challenges: '&id, active',
  notifications: '&id, read, createdAt',
  backupLog: '++id, createdAt',
  appState: '&key, updatedAt',
};
```

### C. `src/core/store.js` (State Manager)
The keys tracked in the reactive state, which should become the Zustand store schema:
```javascript
const STATE_KEYS = [
  'user',
  'countryDef',
  'provinceDef',
  'marketContext',
  'activePlatformId',
  'platforms',
  'activeShiftTimer',
  'currentWeekEarnings',
  'currentWeekGoal',
  'streakDays',
  'xpTotal',
  'xpLevel',
  'theme',
  'isOnline',
  'pendingBadgeUnlock',
  'lastRoute',
  'demoMode',
];

// Events the store currently listens to for re-hydration:
bus.on(SHIFT_SAVED, () => schedule(() => store.refresh('currentWeekEarnings')));
bus.on(SHIFT_DELETED, () => schedule(() => store.refresh('currentWeekEarnings')));
bus.on(GOAL_UPDATED, () => schedule(async () => { await store.refresh('currentWeekGoal'); }));
bus.on(PLATFORM_CHANGED, () => schedule(() => store.refresh('platforms')));
bus.on(SHIFT_TIMER_START, () => schedule(() => store.refresh('activeShiftTimer')));
bus.on(SHIFT_TIMER_STOP, () => schedule(() => store.refresh('activeShiftTimer')));
bus.on(XP_EARNED, () => schedule(async () => { await store.refresh('xpTotal'); await store.refresh('xpLevel'); }));
```

### D. `src/core/router.js` (Routing Logic)
The routing configuration that will dictate the React Navigation setup:
```javascript
const table = [
  { hash: '#/shifts/new', name: 'shifts', render: renderShifts },
  { hash: '#/analytics/week', name: 'analytics', render: renderAnalytics },
  { hash: '#/settings/about', name: 'settings', render: renderSettings },
  { hash: '#/dashboard', name: 'dashboard', render: renderDashboard },
  { hash: '#/shifts', name: 'shifts', render: renderShifts },
  { hash: '#/analytics', name: 'analytics', render: renderAnalytics },
  { hash: '#/expenses', name: 'expenses', render: renderExpenses },
  { hash: '#/tax', name: 'tax', render: renderTax },
  { hash: '#/vehicles', name: 'vehicles', render: renderVehicles },
  { hash: '#/schedule', name: 'schedule', render: renderSchedule },
  { hash: '#/goals', name: 'goals', render: renderGoals },
  { hash: '#/reports', name: 'reports', render: renderReports },
  { hash: '#/settings', name: 'settings', render: renderSettings },
  { hash: '#/onboarding', name: 'onboarding', render: renderOnboarding },
  { hash: '#/about', name: 'about', render: renderAbout },
  { hash: '#/print', name: 'print', render: renderPrint },
];

// The Onboarding Gatekeeper logic:
if (!user?.onboardingComplete) {
  if (hash !== '#/onboarding') {
    updateOnboardingFocusClass(true); // Full screen mode
    window.location.hash = '#/onboarding';
    return;
  }
} else if (hash === '#/onboarding') {
  updateOnboardingFocusClass(false);
  window.location.hash = '#/dashboard';
  return;
}
```

### E. `src/utils/calculations.js` (Shift Math)
Core calculation utilities that power the analytics logic:
```javascript
export function calcHourlyRate(gross, durationMinutes) {
  const m = num(durationMinutes);
  if (m <= 0) return 0;
  return (num(gross) / m) * 60;
}

export function calcNetHourlyRate(gross, expenses, durationMinutes) {
  const m = num(durationMinutes);
  if (m <= 0) return 0;
  return ((num(gross) - num(expenses)) / m) * 60;
}

export function calcEarningsPerKm(gross, distanceKm) {
  const d = num(distanceKm);
  if (d <= 0) return 0;
  return num(gross) / d;
}

export function calcTipRate(tips, gross) {
  const g = num(gross);
  if (g <= 0) return 0;
  return (num(tips) / g) * 100;
}
```

### F. `src/modules/shifts/shifts.js` (Shift Core Logic)
The conflict resolution and timer persistence mechanism:
```javascript
// Active Timer Persistence
export async function startShiftTimer(platformId) {
  const pid = normStr(platformId);
  const payload = { startTime: new Date().toISOString(), platformId: pid };
  await setAppState('active_shift_start', payload);
  localStorage.setItem('comma_active_shift_timer', JSON.stringify(payload));
  bus.emit(SHIFT_TIMER_START, payload);
  void acquireWakeLock().catch(() => {});
}

// Conflict Checking (Prevents overlapping shifts on the same day)
export async function checkConflict(date, startTime, endTime, opts = {}) {
  // ... gets all shifts for 'date'
  const targetStart = new Date(`\${date}T\${startTime}:00`).getTime();
  const targetEnd = new Date(`\${date}T\${endTime}:00`).getTime();
  for (const s of shifts) {
    if (s.deletedAt != null) continue;
    if (opts.excludeId != null && s.id === opts.excludeId) continue;
    const sStart = new Date(`\${date}T\${s.startTime}:00`).getTime();
    const sEnd = new Date(`\${date}T\${s.endTime}:00`).getTime();
    const overlap = targetStart < sEnd && targetEnd > sStart;
    if (overlap) return s;
  }
  return null;
}
```

## 16. Missing Modules & Domain Knowledge Deep Dive

To ensure absolute clarity on the missing elements of the application, here is the deep-dive analysis of the modules and registries requested:

### A. Registries & Master Data (`src/registry/`)
The app uses a "Registry" pattern to define static master data, rather than hardcoding it in the UI. You must port these registries to the React Native app.
- **Platforms (`src/registry/platforms/`)**: Defines the gig platforms (e.g., DoorDash, UberEats, SkipTheDishes). Each platform has an ID, brand color, specific terminology (e.g., "Dasher" vs "Courier"), and a custom SVG logo.
- **Widgets (`src/registry/widgets/`)**: Defines the available dashboard "Bento" widgets (e.g., earnings, week-compare, schedule). Each widget defines its own `render` and `destroy` lifecycle, and default sizing.
- **Badges (`src/registry/badges/`)**: Contains all gamification badges (e.g., `first_shift`, `marathon_shift`). Each badge has an ID, name, description, SVG icon, and a `condition` function (a boolean check run when evaluating if the badge should be unlocked).
- **Metrics (`src/registry/metrics/`)**: Used by the Analytics module. Each metric defines how it calculates its value (`calcPerShift` or `calcFromCtx`) and its formatting rule (e.g., currency, percent, duration).
- **Expense Categories (`src/registry/expense-categories/`)**: Predefined categories for out-of-pocket tracking (e.g., Fuel, Maintenance, Meals) with associated emojis and tax-deductible flags.

### B. Onboarding Flow (`src/modules/onboarding/steps.js`)
The onboarding process is a highly structured 11-step flow that gathers the minimum required data to personalize the app and instantiate the database.
1. **Landing/Welcome**: Feature summary.
2. **Country**: Selects the user's country (drives Currency and Distance Unit).
3. **Region**: Selects the Province/State based on the Country. (Crucial for Tax Withholding defaults).
4. **Platforms**: Filters available platforms based on the `MarketContext` (e.g., SkipTheDishes only shows in Canada).
5. **Profile**: Driver display name and Avatar (Emoji or Custom image).
6. **Vehicle**: Gas, Hybrid, EV type and Make/Model/Year.
7. **Schedule**: Working style (flexible, weekends, etc).
8. **Weekly Goal**: Sets the base monetary target.
9. **Long Term Goals**: Calculates monthly/annual extrapolations.
10. **Tax Withholding**: Applies region-specific default percentages (e.g., 28% for Ontario).
11. **HST (Canada Only)**: Asks if the driver is HST registered (affects GST/HST tracking in expenses).
12. **Completion**: Commits the Draft state to the Vault and transitions to Dashboard.

### C. Gamification & XP (`src/core/store.js` & Badges)
The gamification engine relies on a global event bus (`XP_EARNED`).
- When a user performs an action (like saving a shift or adding an expense), the event bus broadcasts the XP gain.
- The `store.js` listens to `XP_EARNED` and adds it to `xpTotal`. It computes the `xpLevel` (mathematical curve based on total XP) and checks the `BadgeRegistry` to see if any new `condition` functions return `true`.
- If a badge unlocks, it's flagged as a `pendingBadgeUnlock` in the store to trigger a UI celebration.

### D. Analytics Module (`src/modules/analytics/analytics.js`)
A heavy mathematical module that aggregates the local IndexedDB data. The native port must implement these views:
- **Rolling 30-Day Trend**: Uses a linear regression algorithm to chart the trendline over the last 30 days.
- **Best Day / Best Hour**: Aggregates shifts to find the most profitable calendar day of the week and hour of the day.
- **Dead Miles Summary**: Calculates the ratio of total driving vs. paid/active driving to compute efficiency.
- **Platform Comparison**: Ranks platforms against each other based on gross earnings.
- **Income Source Breakdown**: Splits total earnings into Base Fare, Tips, and Bonuses.
- **Weekly Projections**: Estimates the final week's earnings based on the run-rate of the current week.

### E. Tax Module (`src/modules/tax/tax.js`)
The tax module is **highly complex** and deeply integrated with region-specific laws. It is NOT a simple 1099 calculator.
- **Canadian Complexity**: It calculates estimated **CPP (Canada Pension Plan) contributions** on net income, and features a full **HST/GST tracker**. If a user is registered for HST, the app calculates collected HST on gross income, subtracts ITCs (Input Tax Credits) from business expenses, and outputs the "Remittable" amount.
- **US Complexity**: It mirrors the IRS Schedule C deduction categories and estimates Self-Employment (SE) tax.
- **Virtual Jar**: The app maintains a `TAX_VIRTUAL_JAR_KEY` in the local state. It compares the "Target Set Aside" (Gross Income * Withholding Rate) against what the user manually tracks in their "Virtual Jar".
- **Deadlines**: Tracks local installment deadlines (e.g., Q1-Q4 CRA deadlines) and alerts the user when they approach.
- **Migration Note**: The native build must implement these exact math models (specifically the `calcHSTRemittable` and `calcCPPContribution` functions in `calculations.js`).

### F. Market Context (`src/registry/market/resolve.js`)
The `marketContext` state key drives the entire app's localization.
- **CountryRegistry & ProvinceRegistry**: Defines what happens per region. For example, the `MarketContext` knows that if you select "Alberta", your currency is CAD, distance is KM, default tax rate is X%, and you have access to Canadian-only platforms.
- This feeds directly into the Onboarding process (Step 4) to ensure US users don't see Canadian platforms and vice-versa.

### G. P13 (`src/modules/p13/p13.js`)
"P13" stands for "Polish & Performance". It does NOT require a massive feature sprint, but it contains:
- **Did You Know? Tips**: Random tooltips shown to the user on app launch.
- **Well-being Nudges**: If a shift timer exceeds 120 minutes, it fires a Toast to remind the user to take a break. If a user logs >250km in one day, it fires a mileage health warning.
- **Zen Mode**: A toggle to hide financial numbers (removes stress).
- **Debug Tools**: Exposes `window.__comma.debug` to dump the database schema or generate synthetic mock data (this is the "Demo Mode" data engine).

### H. Zones (`src/modules/zones/`)
Currently an empty directory. No logic exists for Zones in the current web application. You can safely ignore this module in the immediate React Native port.
