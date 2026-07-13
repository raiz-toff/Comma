# Navigation

The phone app uses Expo Router: the folder tree under `app/` maps directly to routes, wrapped in a custom shell that provides a left drawer, a hidden tab navigator, and a right-slide Reports panel.

<LayerStack accent="amber" layers={[{ name: "left drawer", note: "hand-built, swipe from the edge" }, { name: "tabs", note: "Expo Router tabs, bar hidden" }, { name: "reports panel", note: "right-slide overlay" }]} caption="File-based routes wrapped in a hand-built shell. Android back closes the Reports panel, then the drawer, then exits." />

---

## Route tree

```
app/
├── _layout.tsx                # Root layout — providers, global init, error handling
├── notifications.tsx          # Notification permission setup
│
├── (tabs)/                    # Main shell (drawer + tabs + Reports overlay)
│   ├── _layout.tsx            # Custom drawer, hidden Tabs, Reports panel
│   ├── index.tsx              # Dashboard — also the onboarding gate
│   ├── shifts/index.tsx       # Shifts list
│   ├── analytics.tsx          # Advanced analytics (flag-gated)
│   ├── expenses/index.tsx     # Expenses list
│   ├── tax/index.tsx          # Tax center (hidden from the tab bar; reached via drawer)
│   └── more.tsx               # More menu
│
├── setup/                     # Activation-checklist destinations
│   ├── platforms.tsx          # Choose platforms
│   ├── vehicle.tsx            # Add a real vehicle
│   └── goal.tsx               # Set an earnings goal
│
├── shift/add.tsx              # Create / log a shift
├── shifts/[id].tsx            # Shift detail / edit
├── expense/add.tsx            # Log an expense
├── expense/[id].tsx           # Expense detail / edit
├── vehicles/index.tsx         # Vehicle list
├── vehicles/[id].tsx          # Vehicle detail / edit
├── goals/index.tsx            # Goals + gamification (flag-gated)
├── tax/center.tsx             # Tax center detail
├── reports/index.tsx          # Reports panel content (rendered as an overlay)
├── schedule/index.tsx         # Weekly schedule (flag-gated)
│
├── settings/
│   ├── index.tsx              # Settings root
│   ├── backup.tsx             # Google Drive backup & sync
│   ├── profile.tsx            # Edit profile
│   └── import.tsx             # CSV import
│
├── about/index.tsx            # About (version, licenses, links)
└── docs/                      # Internal design notes (Markdown, not routes)
```

---

## Routes to files

| Route | File | Notes |
|---|---|---|
| `/` | `app/(tabs)/index.tsx` | Dashboard; renders the onboarding wizard until setup is complete |
| `/shifts` | `app/(tabs)/shifts/index.tsx` | Shifts list |
| `/shifts/[id]` | `app/shifts/[id].tsx` | Shift detail / edit |
| `/shift/add` | `app/shift/add.tsx` | Log or create a shift |
| `/analytics` | `app/(tabs)/analytics.tsx` | Gated on `analytics_advanced` |
| `/expenses` | `app/(tabs)/expenses/index.tsx` | Expenses list |
| `/expense/add`, `/expense/[id]` | `app/expense/…` | Create and edit an expense |
| `/tax` | `app/(tabs)/tax/index.tsx` | Gated on `tax_workspace`; hidden from the tab bar |
| `/tax/center` | `app/tax/center.tsx` | Tax center detail |
| `/goals` | `app/goals/index.tsx` | Gated on `goals` |
| `/vehicles`, `/vehicles/[id]` | `app/vehicles/…` | Vehicle list and detail |
| `/reports` | `app/reports/index.tsx` | Opened as a right-slide overlay, not a pushed screen |
| `/schedule` | `app/schedule/index.tsx` | Gated on `schedule` |
| `/settings`, `/settings/backup`, `/settings/profile`, `/settings/import` | `app/settings/…` | Settings screens |
| `/setup/platforms`, `/setup/vehicle`, `/setup/goal` | `app/setup/…` | Activation-checklist destinations |
| `/about` | `app/about/index.tsx` | About |
| `/notifications` | `app/notifications.tsx` | Notification permission setup |

---

## Root layout

`app/_layout.tsx` wraps the app in the React Query provider and the gesture root, sets up global error handling and notification listeners, and hydrates the Zustand stores from storage on launch.

---

## Onboarding gate

There is no separate onboarding route. The Dashboard (`app/(tabs)/index.tsx`) checks `isOnboardingCompleted` from the settings store, and while it is false it renders `<OnboardingWizard />` in place of the dashboard.

The wizard opens on a **welcome gate** with three choices — start fresh, try the demo, or restore existing data — then runs **two steps**: country and region, then the driver's last shift. It ends in an hourly-rate **reveal** computed from that shift. Everything the wizard no longer asks for is deferred to the dashboard's **activation checklist** (`components/ActivationChecklist.tsx`), whose items deep-link into `/setup/platforms`, `/setup/vehicle`, and `/setup/goal`. See [Onboarding](../features/shift-tracking.md) for the driver-facing flow.

---

## The shell: drawer, tabs, and Reports

`app/(tabs)/_layout.tsx` is a custom shell rather than a stock navigator.

- **Left drawer.** A hand-built `Animated` drawer, opened by the header's menu button or a left-edge swipe (a `PanResponder`). It is the primary navigation. Its items are built per render and respect feature flags.
- **Tabs.** An Expo Router `Tabs` navigator hosts the main screens (`index`, `shifts`, `analytics`, `expenses`, `tax`, `more`), but its bar is hidden (`tabBarStyle: { display: "none" }`) — navigation happens through the drawer and the More screen. The `tax` tab sets `href: null`, so it is reachable only from the drawer.
- **Reports panel.** A full-screen `Animated` overlay that slides in from the right, holding `ReportsScreen`. The drawer's Reports item opens it rather than navigating. The Android back button closes the Reports panel, then the drawer, before exiting.

### Drawer items

| Item | Route | Shown when |
|---|---|---|
| Dashboard | `/` | Always |
| Shifts | `/shifts` | Always |
| Analytics | `/analytics` | `analytics_advanced` enabled |
| Expenses | `/expenses` | Always |
| Goals | `/goals` | `goals` enabled |
| Tax | `/tax` | `tax_workspace` enabled and the country has self-assessment tax |
| Reports | `/reports` | Always (opens the overlay) |
| Schedule | `/schedule` | `schedule` enabled |
| Vehicles | `/vehicles` | Always |
| Settings | `/settings` | Always |
| About | `/about` | Always (drawer footer) |

---

## Feature-gated routes

Gated screens are resolved with `useFeatureEnabled(flag)`, which reads a user override first, then the country default. The gated flags are `analytics_advanced`, `goals`, `tax_workspace`, and `schedule`. A gated screen stays in the route tree even when hidden — it is simply not linked from the drawer, and can still be reached by its route.
