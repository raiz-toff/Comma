# Navigation

Comma uses **Expo Router** — a file-based routing system built on React Navigation. The folder structure under `app/` directly maps to URLs and screens.

---

## Route tree

```
app/
├── _layout.tsx              # Root layout — providers, onboarding gate, global init
│
├── (tabs)/                  # Main tab navigator
│   ├── _layout.tsx          # Tab bar configuration
│   ├── index.tsx            # Dashboard (tab: home)
│   ├── shifts.tsx           # Shifts list (tab: shifts)
│   ├── analytics.tsx        # Advanced analytics (tab: analytics, flag-gated)
│   ├── expenses.tsx         # Expenses list (tab: expenses)
│   └── tax.tsx              # Tax Center (tab: tax, flag-gated)
│
├── shift/
│   ├── add.tsx              # Create/log a shift (wizard)
│   └── [id].tsx             # Shift detail / edit
│
├── expense/
│   ├── add.tsx              # Log an expense
│   └── [id].tsx             # Expense detail / edit
│
├── vehicles/
│   ├── index.tsx            # Vehicle list
│   └── [id].tsx             # Vehicle detail / edit
│
├── goals/
│   └── index.tsx            # Goals + gamification
│
├── tax/
│   └── index.tsx            # Tax center (also accessible as tab)
│
├── reports/
│   └── index.tsx            # Reports panel (overlay, slides from right)
│
├── schedule/
│   └── index.tsx            # Weekly schedule view (flag-gated)
│
├── settings/
│   ├── index.tsx            # Settings root
│   ├── backup.tsx           # Google Drive backup & sync
│   ├── profile.tsx          # Edit profile
│   ├── platforms.tsx        # Manage platforms
│   ├── import.tsx           # CSV import
│   └── developer.tsx        # Feature flags (dev only)
│
├── about/
│   └── index.tsx            # About screen (version, licenses, links)
│
└── notifications.tsx        # Push notification permission setup
```

---

## Root layout

`app/_layout.tsx` is the root of the app. It:

1. Initializes Expo Router and the app theme.
2. Wraps everything in `QueryProvider` (React Query) and `GestureHandlerRootView`.
3. Checks `isOnboardingCompleted` from the settings store. If false, renders `OnboardingWizard` instead of the main navigation.
4. Sets up global error handlers and push notification listeners.
5. Calls `loadSettings()` to hydrate Zustand stores from SQLite.

---

## Tab navigator

The tab bar at the bottom of the screen shows 3–5 tabs depending on feature flags:

| Tab | Route | Flag required |
|---|---|---|
| Dashboard | `/` | Always |
| Shifts | `/shifts` | Always |
| Analytics | `/analytics` | `analytics_advanced` |
| Expenses | `/expenses` | Always |
| Tax | `/tax` | `tax_workspace` |

The tab navigator is configured in `app/(tabs)/_layout.tsx` using Expo Router's `Tabs` component. Active tab highlighting uses the primary platform color from the current filter.

---

## Drawer navigation

A custom side drawer slides in from the left edge of the screen. It is triggered by:

- Tapping the hamburger menu icon in the top header
- Swiping from the left edge (PanResponder gesture)

The drawer is implemented as a custom `Animated` component (not React Navigation's DrawerNavigator) for full visual control. It uses a `PanResponder` to handle the swipe gesture and `Animated.Value` for the slide animation.

Drawer items:
- Dashboard
- Shifts
- Analytics *(flag-gated)*
- Expenses
- Goals *(flag-gated)*
- Tax Center *(flag-gated)*
- Reports
- Schedule *(flag-gated)*
- Vehicles
- Settings
- About

---

## Reports panel

The Reports panel is a **full-screen overlay** that slides in from the right edge. It is opened by tapping "Reports" in the drawer. Implemented as an `Animated` view positioned off-screen right, animated to cover the full screen.

---

## Bottom action bar

The Dashboard has a floating bottom action bar with context-sensitive buttons:

| Shift state | Buttons shown |
|---|---|
| No active shift | `+ Expense` · `Start Shift` · `Log Past Shift` |
| Shift running | `+ Expense` · `Pause` · `End Shift` |
| Shift paused | `+ Expense` · `Resume` · `End Shift` |

---

## Global top header

`GlobalTopHeader` appears at the top of every tab screen. It contains:

- Hamburger menu icon (opens drawer)
- Platform filter badge (shows active platform, tap to change)
- Notification bell (shows unread count, tap to open notification list)

The header hides on scroll via an `Animated` value driven by the scroll position. `isHeaderVisible` in the settings store tracks this state so other components can respond.

---

## Deep links

Push notification taps deep-link into the app. The `useNotificationRouting` hook listens for notification taps and calls `router.push()` with the appropriate route based on the notification payload.

Example deep links:
- Shift completed → `/shifts/[id]`
- Badge unlocked → `/goals`
- Backup failed → `/settings/backup`

---

## Feature-gated screens

Feature flags control which screens appear in the tab bar and drawer. The `useFeatureEnabled(flagName)` hook returns `true/false` based on:

1. User-set override (from `Settings → Developer → Features`)
2. Country/region default (e.g. `tax_workspace` defaults to `true` for US/CA/UK, `false` for other regions)

Gated screens are still in the route tree — they're just not linked from navigation. You can navigate to them directly if you know the route.
