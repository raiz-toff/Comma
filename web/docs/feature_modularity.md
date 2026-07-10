# COMMA — Feature Modularity Architecture
### How modular is adding a new feature? Honest assessment + the fix.

> **Note:** This document represents the original design intent for extending features. While the registries were implemented, some schemas (like widgets or metrics) may have evolved in the final codebase. Treat code snippets as illustrative rather than exact.

---

## HONEST ASSESSMENT FIRST

Not all features are equal. There are four distinct categories of "new feature"
and each has a different modularity story.

```
┌─────────────────────────────────────────────────────────────────┐
│  CATEGORY A — Already fully modular (zero engine changes)        │
│  Examples: new platform, new country, new platform-custom field  │
│  How: Registry pattern from REGISTRY_ARCHITECTURE.md            │
├─────────────────────────────────────────────────────────────────┤
│  CATEGORY B — Needs a registry (the gap this doc fixes)         │
│  Examples: new dashboard widget, new notification type,          │
│            new badge, new analytics metric, new report section   │
│  How: The 5 registries defined below                            │
├─────────────────────────────────────────────────────────────────┤
│  CATEGORY C — Needs engine changes but contained to one module  │
│  Examples: new shift field (global), new expense category,       │
│            new goal type, new vehicle field                      │
│  How: Controlled extension points in each module                │
├─────────────────────────────────────────────────────────────────┤
│  CATEGORY D — Genuinely structural (DB schema + engine)          │
│  Examples: a whole new data entity (not a field, a new table),  │
│            a new core concept the app has never modeled          │
│  How: Accepted cost. Dexie migrations + new module. Unavoidable. │
└─────────────────────────────────────────────────────────────────┘
```

The goal of this document is to move everything possible from B/C → A,
and to define clear extension points for C so at least they're one-file changes.

---

## THE FIVE FEATURE REGISTRIES

Build these alongside the Platform + Country registries.
Same pattern, same folder, same philosophy.

```
src/registry/
  platforms/        ← done
  countries/        ← done
  widgets/          ← NEW — dashboard widget registry
  notifications/    ← NEW — notification type registry
  badges/           ← NEW — badge/achievement registry
  metrics/          ← NEW — analytics metric registry
  reports/          ← NEW — report section registry
```

**Market resolution** (country + province merge, platform allow-lists, shared withholding presets, store `marketContext`) is documented in [`market_resolution.md`](market_resolution.md). Use it when adding markets or wiring tax and onboarding.

---

## REGISTRY 1 — WIDGET REGISTRY
### Adding a new dashboard widget = 1 file + 1 import line

Every dashboard widget is a self-contained module. The dashboard engine
renders whatever is in the registry. It never knows about specific widgets.

### Widget Definition Schema

```js
// TEMPLATE: src/registry/widgets/_TEMPLATE.widget.js

export default {

  // ═══════════════════════════
  // REQUIRED
  // ═══════════════════════════

  id: 'REQUIRED_UNIQUE_ID',        // e.g. 'goal-ring', 'streak-counter'
  label: 'REQUIRED_DISPLAY_LABEL', // shown in widget customizer
  defaultSize: '1x1',              // '1x1' | '2x1' | '1x2' | '2x2' (bento grid)
  defaultVisible: true,            // shown by default or hidden until user enables

  // The render function. Receives data context, returns HTML string.
  // Called by dashboard engine on every refresh.
  render: async (ctx) => {
    // ctx.user       — user settings
    // ctx.store      — reactive store state  
    // ctx.shifts     — recent shifts (pre-fetched)
    // ctx.goals      — active goals
    // ctx.platform   — active platform filter
    return `<div class="widget-card">...</div>`
  },

  // Called after render() inserts HTML into DOM.
  // Wire up chart.js instances, event listeners, etc.
  afterRender: (containerEl, ctx) => {},

  // Cleanup: called before widget is destroyed or re-rendered.
  // Destroy chart instances, remove listeners.
  destroy: (containerEl) => {},


  // ═══════════════════════════
  // OPTIONAL
  // ═══════════════════════════

  minSize: '1x1',                  // smallest the user can resize this widget to
  maxSize: '2x2',                  // largest

  // Which data this widget needs pre-fetched before render().
  // Engine batches DB calls for all visible widgets in one pass.
  dataNeeds: [],
  // dataNeeds: ['recentShifts', 'activeGoals', 'weeklyTotal', 'streakDays']
  // Possible values (pre-defined queries the engine knows how to run):
  // 'recentShifts'     — last 10 shifts
  // 'activeGoals'      — all active goals
  // 'weeklyTotal'      — gross + net for current week
  // 'monthlyTotal'     — gross + net for current month
  // 'ytdTotal'         — gross + net year to date
  // 'streakDays'       — current streak count
  // 'xpData'           — current XP + level
  // 'platformTotals'   — per-platform breakdown
  // 'expenseRatio'     — expense ratio for current period
  // 'taxSetAside'      — virtual tax jar total

  // If true, widget auto-refreshes when a SHIFT_SAVED event fires.
  refreshOn: ['SHIFT_SAVED', 'EXPENSE_SAVED', 'GOAL_UPDATED', 'PLATFORM_CHANGED'],

  // If this widget is only relevant for certain conditions, return false to hide it.
  // Engine checks this before rendering.
  shouldShow: (ctx) => true,
  // shouldShow: (ctx) => ctx.store.activeShiftTimer !== null,  // only during active shift
  // shouldShow: (ctx) => ctx.user.hstRegistered === true,      // only for HST users

  // Category for the widget customizer UI — for grouping
  category: 'earnings',            // 'earnings' | 'goals' | 'expenses' | 'tax' | 'wellbeing' | 'misc'

}
```

### Widget Registry Index

```js
// src/registry/widgets/index.js

import goalRing          from './goal-ring.widget.js'
import streakCounter     from './streak-counter.widget.js'
import weeklyEarnings    from './weekly-earnings.widget.js'
import ytdGross          from './ytd-gross.widget.js'
import ytdNet            from './ytd-net.widget.js'
import earningsVsLast    from './earnings-vs-last.widget.js'
import expenseRatio      from './expense-ratio.widget.js'
import hourlyRate        from './hourly-rate.widget.js'
import taxOwing          from './tax-owing.widget.js'
import taxCountdown      from './tax-countdown.widget.js'
import earningsThermo    from './earnings-thermometer.widget.js'
import velocityWidget    from './earnings-velocity.widget.js'
import lastShiftCard     from './last-shift.widget.js'
import activityFeed      from './activity-feed.widget.js'
import heatmap52week     from './heatmap-52week.widget.js'
import topShifts         from './top-shifts.widget.js'
import whatIfCalc        from './what-if-calc.widget.js'
// import myNewWidget    from './my-new-widget.widget.js'  ← ONE LINE to add

const WIDGETS = [
  goalRing, streakCounter, weeklyEarnings, ytdGross, ytdNet,
  earningsVsLast, expenseRatio, hourlyRate, taxOwing, taxCountdown,
  earningsThermo, velocityWidget, lastShiftCard, activityFeed,
  heatmap52week, topShifts, whatIfCalc
]

export const WidgetRegistry = {
  getAll:           ()         => WIDGETS,
  getById:          (id)       => WIDGETS.find(w => w.id === id),
  getByCategory:    (cat)      => WIDGETS.filter(w => w.category === cat),
  getVisible:       (userPrefs, ctx) => WIDGETS.filter(w => {
                                    const isEnabled = userPrefs.includes(w.id) || w.defaultVisible
                                    return isEnabled && w.shouldShow(ctx)
                                  }),
  validate:         (def)      => validateWidgetDefinition(def),
}
```

### Dashboard Engine (how it uses the registry)

```js
// src/views/dashboard.js — engine never knows about specific widgets

import { WidgetRegistry } from '../registry/widgets/index.js'

async function renderDashboard(user, store) {
  const ctx = await buildDataContext(user, store)      // fetch all needed data in one pass

  const visibleWidgets = WidgetRegistry.getVisible(user.dashboardWidgets, ctx)
  const bentoGrid = document.getElementById('bento-grid')

  bentoGrid.innerHTML = ''

  for (const widget of visibleWidgets) {
    const cell = createBentoCell(widget.id, widget.defaultSize)
    cell.innerHTML = await widget.render(ctx)
    bentoGrid.appendChild(cell)
    widget.afterRender(cell, ctx)
  }
}

// buildDataContext: batch all DB reads for all visible widgets in one pass
// (avoids N+1 queries where each widget hits IndexedDB separately)
async function buildDataContext(user, store) {
  const neededData = new Set(
    WidgetRegistry.getVisible(user.dashboardWidgets, { user, store })
      .flatMap(w => w.dataNeeds)
  )
  return fetchDataBundle(neededData, user)   // one optimized DB query pass
}
```

**Adding a new widget: 1 file + 1 import line. Dashboard engine unchanged.**

---

## REGISTRY 2 — NOTIFICATION REGISTRY
### Adding a new notification type = 1 file + 1 import line

Currently all notification logic lives in one giant `checkAllNotifications()` function.
This becomes unmanageable. Instead, each notification type is a self-contained definition.

### Notification Definition Schema

```js
// TEMPLATE: src/registry/notifications/_TEMPLATE.notification.js

export default {

  // ═══════════════════════════
  // REQUIRED
  // ═══════════════════════════

  id: 'REQUIRED_UNIQUE_ID',        // e.g. 'weekly-goal-hit', 'tax-deadline'
  type: 'toast',                   // 'toast' | 'card' | 'celebration'
                                   // toast = small bottom pop
                                   // card  = full COMMANotify card
                                   // celebration = full-screen (badge unlock, goal hit)

  // The condition function. Receives app context, returns true if should fire.
  // Called on every app-open. Must be fast — no heavy DB queries here.
  condition: async (ctx) => {
    // ctx.user, ctx.store, ctx.db (Dexie instance)
    // ctx.lastFired — when this notification last fired (from DB)
    return false  // return true to trigger the notification
  },

  // The message to show. Can be a string or a function returning string.
  message: (ctx) => 'Your message here',

  // How often can this fire at maximum? Prevents notification spam.
  cooldown: '7d',                  // '1d' | '7d' | '30d' | 'once' | 'always'
                                   // 'once' = fires once ever, never again
                                   // 'always' = fires every time condition is true


  // ═══════════════════════════
  // OPTIONAL
  // ═══════════════════════════

  title: null,                     // for card/celebration types
  icon: null,                      // emoji or icon key from icons.js
  priority: 5,                     // 1 (highest) to 10 (lowest). Higher priority fires first.

  // Action button on the notification
  action: null,
  // action: {
  //   label: 'View Tax Dashboard',
  //   route: '#/tax',
  // },

  // Can the user toggle this off in settings?
  userToggleable: true,
  settingsLabel: null,             // label in notification settings panel

  // Which data this notification needs from DB
  // (engine pre-fetches these before calling condition())
  dataNeeds: [],

  // Does this only apply to certain countries?
  onlyForCountries: [],            // [] = all countries. ['CA', 'US'] = Canada + US only

  // Does this only apply if user has specific platform?
  onlyForPlatforms: [],            // [] = all platforms

  // For celebration type: confetti config
  celebration: null,
  // celebration: {
  //   confetti: true,
  //   sound: false,
  //   duration: 3000,
  // }

}
```

### Real Examples

```js
// src/registry/notifications/weekly-goal-hit.notification.js
export default {
  id: 'weekly-goal-hit',
  type: 'celebration',
  cooldown: '7d',
  title: (ctx) => `Goal hit! 🎉`,
  message: (ctx) => `You hit your ${ctx.store.formatCurrency(ctx.store.currentWeekGoal)} goal this week.`,
  icon: '🏆',
  priority: 1,
  userToggleable: true,
  settingsLabel: 'Weekly goal completion',
  celebration: { confetti: true, duration: 3000 },
  dataNeeds: ['weeklyTotal', 'activeGoals'],
  condition: async (ctx) => {
    const { weeklyTotal, activeGoals } = ctx.data
    const weeklyGoal = activeGoals.find(g => g.scope === 'weekly' && g.type === 'earnings')
    if (!weeklyGoal) return false
    const alreadyNotified = await ctx.db.appState.get('notified-weekly-goal-' + getCurrentWeekKey())
    return weeklyTotal >= weeklyGoal.target && !alreadyNotified
  },
}

// src/registry/notifications/tax-deadline.notification.js
export default {
  id: 'tax-deadline',
  type: 'card',
  cooldown: 'always',
  title: (ctx) => `Tax installment due in ${ctx.data.nextDeadline.daysUntil} days`,
  message: (ctx) => `Your ${ctx.data.nextDeadline.label} ${ctx.data.country.taxModules.quarterlyInstallments.authority} installment is coming up.`,
  icon: '📅',
  priority: 2,
  action: { label: 'View Tax Dashboard', route: '#/tax' },
  dataNeeds: ['nextTaxDeadline'],
  onlyForCountries: [],   // all countries — condition() handles it
  condition: async (ctx) => {
    const country = ctx.country
    if (!country.taxModules.quarterlyInstallments) return false
    const deadline = ctx.data.nextDeadline
    return deadline && deadline.daysUntil <= country.taxModules.quarterlyInstallments.reminderDaysBefore
  },
}
```

### Notification Registry Index

```js
// src/registry/notifications/index.js

import dailySummary        from './daily-summary.notification.js'
import weeklyGoalHit       from './weekly-goal-hit.notification.js'
import weeklyGoalMiss      from './weekly-goal-miss.notification.js'
import midWeekBehind       from './midweek-behind.notification.js'
import personalBest        from './personal-best.notification.js'
import taxDeadline         from './tax-deadline.notification.js'
import maintenanceDue      from './maintenance-due.notification.js'
import insuranceExpiry     from './insurance-expiry.notification.js'
import streakAtRisk        from './streak-at-risk.notification.js'
import backupOverdue       from './backup-overdue.notification.js'
import lowHourlyRate       from './low-hourly-rate.notification.js'
import highExpenses        from './high-expenses.notification.js'
import milestoneProximity  from './milestone-proximity.notification.js'
import arbitrageAlert      from './arbitrage-alert.notification.js'
// import myNewAlert       from './my-new-alert.notification.js'  ← ONE LINE

const NOTIFICATIONS = [
  dailySummary, weeklyGoalHit, weeklyGoalMiss, midWeekBehind,
  personalBest, taxDeadline, maintenanceDue, insuranceExpiry,
  streakAtRisk, backupOverdue, lowHourlyRate, highExpenses,
  milestoneProximity, arbitrageAlert,
]

export const NotificationRegistry = {
  getAll:           ()         => NOTIFICATIONS,
  getEnabled:       (userPrefs, country, platforms) =>
                                  NOTIFICATIONS
                                    .filter(n => !userPrefs.disabled?.includes(n.id))
                                    .filter(n => !n.onlyForCountries.length || n.onlyForCountries.includes(country.id))
                                    .filter(n => !n.onlyForPlatforms.length || n.onlyForPlatforms.some(p => platforms.includes(p)))
                                    .sort((a, b) => a.priority - b.priority),
}
```

### Notification Engine

```js
// src/modules/notifications/notifications.js — engine, never changes

import { NotificationRegistry } from '../../registry/notifications/index.js'

export async function checkAllNotifications(user, store, db) {
  const country  = CountryRegistry.getById(user.country)
  const enabled  = NotificationRegistry.getEnabled(user.notificationPrefs, country, user.platforms)
  const ctx      = await buildNotificationContext(user, store, db, enabled)

  for (const notif of enabled) {
    const shouldFire = await notif.condition(ctx)
    if (!shouldFire) continue

    const lastFired = await db.appState.get(`notif-last-${notif.id}`)
    if (!cooldownExpired(lastFired, notif.cooldown)) continue

    await db.appState.put({ key: `notif-last-${notif.id}`, value: Date.now() })
    fireNotification(notif, ctx)
    if (notif.priority <= 2) break  // only one high-priority notification per app-open
  }
}
```

**Adding a new notification: 1 file + 1 import line. Engine unchanged.**

---

## REGISTRY 3 — BADGE REGISTRY
### Adding a new achievement = 1 file + 1 import line

### Badge Definition Schema

```js
// TEMPLATE: src/registry/badges/_TEMPLATE.badge.js

export default {

  // ═══════════════════════════
  // REQUIRED
  // ═══════════════════════════

  id: 'REQUIRED_UNIQUE_ID',        // e.g. 'first-shift', 'thousand-deliveries'
  name: 'REQUIRED',                // 'First Shift', '1,000 Deliveries'
  description: 'REQUIRED',        // shown in trophy case
  icon: '🏅',                      // emoji displayed on badge card

  // The condition to unlock this badge.
  // Receives aggregated stats — NOT raw DB. Stats are pre-computed.
  condition: (stats) => {
    // stats.totalShifts         — lifetime shift count
    // stats.totalDeliveries     — lifetime delivery count
    // stats.totalEarnings       — lifetime gross earnings
    // stats.totalHours          — lifetime hours worked
    // stats.bestHourlyRate      — all-time best hourly rate (single shift)
    // stats.bestShiftEarnings   — all-time best single shift gross
    // stats.bestWeekEarnings    — all-time best single week gross
    // stats.currentStreakDays   — current consecutive days streak
    // stats.longestStreakDays   — longest ever streak
    // stats.weeklyGoalHitCount  — how many weeks goal was hit
    // stats.badgesUnlocked[]    — already unlocked badge IDs
    // stats.totalExpensesLogged — total expense records
    // stats.zonesUsed[]         — unique zone tags used
    // stats.platformsUsed[]     — platforms with at least one shift
    return false
  },

  // ═══════════════════════════
  // OPTIONAL
  // ═══════════════════════════

  category: 'milestone',           // 'milestone' | 'streak' | 'earnings' | 'platform' | 'habit' | 'fun'
  rarity: 'common',                // 'common' | 'uncommon' | 'rare' | 'legendary'
  secret: false,                   // if true: shown as "???" until unlocked

  // Milestone proximity teaser (Feature 207)
  // If defined, fires a "you're X away!" notification when this close
  proximityAlert: null,
  // proximityAlert: {
  //   metric: 'totalDeliveries',
  //   target: 1000,
  //   alertWhenWithin: 10,          // fire alert when within 10 of target
  // },

  xpReward: 50,                    // XP awarded when this badge is unlocked

  // For platform-specific badges
  onlyForPlatforms: [],            // [] = any platform. ['doordash'] = DoorDash drivers only

}
```

### Badge Registry Index

```js
// src/registry/badges/index.js

import firstShift          from './first-shift.badge.js'
import first100Day         from './first-100-day.badge.js'
import thousandDeliveries  from './thousand-deliveries.badge.js'
import oneMonthStreak      from './one-month-streak.badge.js'
import fourWeekGoalStreak  from './four-week-goal-streak.badge.js'
import firstThousandWeek   from './first-thousand-week.badge.js'
import tenThousandLifetime from './ten-thousand-lifetime.badge.js'
// import newBadge         from './new-badge.badge.js'  ← ONE LINE

const BADGES = [
  firstShift, first100Day, thousandDeliveries, oneMonthStreak,
  fourWeekGoalStreak, firstThousandWeek, tenThousandLifetime,
]

export const BadgeRegistry = {
  getAll:      ()         => BADGES,
  getById:     (id)       => BADGES.find(b => b.id === id),
  checkAll:    (stats)    => BADGES.filter(b => !stats.badgesUnlocked.includes(b.id) && b.condition(stats)),
  getUnlocked: (unlockedIds) => BADGES.filter(b => unlockedIds.includes(b.id)),
  getLocked:   (unlockedIds) => BADGES.filter(b => !unlockedIds.includes(b.id) && !b.secret),
}
```

### Badge Engine

```js
// src/modules/goals/goals.js — badge checking engine, never changes

import { BadgeRegistry } from '../../registry/badges/index.js'

export async function checkBadgesAfterShift(db) {
  const stats          = await computeBadgeStats(db)   // one aggregation pass
  const newlyUnlocked  = BadgeRegistry.checkAll(stats)  // pure functions, fast

  for (const badge of newlyUnlocked) {
    await db.badges.put({ id: badge.id, unlockedAt: Date.now(), notified: false })
    await awardXP(db, badge.xpReward)
    triggerBadgeAnimation(badge)   // confetti + slide-in card
  }
}
```

**Adding a new badge: 1 file + 1 import line. Engine unchanged.**

---

## REGISTRY 4 — ANALYTICS METRIC REGISTRY
### Adding a new analytics metric = 1 file + 1 import line

### Metric Definition Schema

```js
// TEMPLATE: src/registry/metrics/_TEMPLATE.metric.js

export default {

  // ═══════════════════════════
  // REQUIRED
  // ═══════════════════════════

  id: 'REQUIRED_UNIQUE_ID',        // e.g. 'net-hourly-rate', 'tip-rate'
  label: 'REQUIRED',               // 'Net Hourly Rate'
  shortLabel: 'REQUIRED',          // 'Net/hr' (for tight spaces like shift cards)
  format: 'currency_per_hour',     // how to display the value (see format types below)

  // Pure calculation function. Receives one shift object, returns a number.
  // For per-shift metrics. Return null if not applicable for this shift.
  calcPerShift: (shift, vehicleDef) => null,


  // ═══════════════════════════
  // OPTIONAL
  // ═══════════════════════════

  // Aggregate across a set of shifts
  calcAggregate: (shifts, vehicleDef) => null,

  // For metrics shown on shift cards
  showOnShiftCard: false,

  // For metrics shown in the analytics view
  showInAnalytics: true,
  analyticsSection: 'earnings',    // 'earnings' | 'efficiency' | 'expenses' | 'time'

  // Formatting type — drives the formatter function used for display
  // 'currency'           → $84.50
  // 'currency_per_hour'  → $22.50/hr
  // 'currency_per_km'    → $1.20/km
  // 'percent'            → 34.2%
  // 'number'             → 42
  // 'duration'           → 2h 30m
  // 'distance'           → 42.3 km

  // Should this metric show a trend indicator (up/down arrow)?
  showTrend: true,

  // For the personal records system — is this a metric tracked as a personal best?
  isPersonalRecord: false,
  personalRecordLabel: null,       // 'Best Hourly Rate Ever'
  personalRecordHigherIsBetter: true,

  // Warning threshold — show colored indicator if value crosses this
  warningThreshold: null,
  // warningThreshold: {
  //   below: 15,                  // warn if value drops below $15
  //   color: 'danger',            // 'warning' | 'danger'
  //   message: (value) => `Your rate of ${value}/hr is below the $15 threshold you set`,
  // }

  // Only meaningful for certain platforms
  onlyForPlatforms: [],

  // Only meaningful for certain vehicle types
  onlyForVehicleTypes: [],

}
```

### Real Examples

```js
// src/registry/metrics/net-hourly-rate.metric.js
export default {
  id: 'net-hourly-rate',
  label: 'Net Hourly Rate',
  shortLabel: 'Net/hr',
  format: 'currency_per_hour',
  showOnShiftCard: true,
  isPersonalRecord: true,
  personalRecordLabel: 'Best Net Hourly Rate',
  showTrend: true,
  warningThreshold: { below: 15, color: 'warning', message: (v) => `Net rate is $${v}/hr` },
  calcPerShift: (shift, vehicle) => {
    if (!shift.durationMinutes) return null
    const fuelCost = calcFuelCost(vehicle, shift.distanceKm)
    const net = shift.grossEarnings - fuelCost
    return net / (shift.durationMinutes / 60)
  },
  calcAggregate: (shifts, vehicle) => {
    const totalNet = shifts.reduce((sum, s) => sum + (s.grossEarnings - calcFuelCost(vehicle, s.distanceKm)), 0)
    const totalHours = shifts.reduce((sum, s) => sum + (s.durationMinutes / 60), 0)
    return totalHours > 0 ? totalNet / totalHours : null
  },
}

// src/registry/metrics/earnings-per-km.metric.js
export default {
  id: 'earnings-per-km',
  label: 'Earnings per Kilometre',
  shortLabel: '$/km',
  format: 'currency_per_km',
  showOnShiftCard: false,
  showInAnalytics: true,
  analyticsSection: 'efficiency',
  calcPerShift: (shift) => {
    if (!shift.distanceKm || shift.distanceKm === 0) return null
    return shift.grossEarnings / shift.distanceKm
  },
}
```

### Metric Registry Index

```js
// src/registry/metrics/index.js

import grossHourlyRate    from './gross-hourly-rate.metric.js'
import netHourlyRate      from './net-hourly-rate.metric.js'
import earningsPerOrder   from './earnings-per-order.metric.js'
import tipRate            from './tip-rate.metric.js'
import bonusDependency    from './bonus-dependency.metric.js'
import utilizationRate    from './utilization-rate.metric.js'
import earningsPerKm      from './earnings-per-km.metric.js'
// import myNewMetric     from './my-new-metric.metric.js'  ← ONE LINE

const METRICS = [
  grossHourlyRate, netHourlyRate, earningsPerOrder,
  tipRate, bonusDependency, utilizationRate, earningsPerKm,
]

export const MetricRegistry = {
  getAll:            ()            => METRICS,
  getById:           (id)          => METRICS.find(m => m.id === id),
  getForShiftCard:   ()            => METRICS.filter(m => m.showOnShiftCard),
  getPersonalRecord: ()            => METRICS.filter(m => m.isPersonalRecord),
  calcShift:         (shift, veh)  => Object.fromEntries(
                                        METRICS.map(m => [m.id, m.calcPerShift(shift, veh)])
                                      ),
}
```

**Adding a new metric: 1 file + 1 import line. All shift cards, analytics views, and personal records update automatically.**

---

## REGISTRY 5 — REPORT SECTION REGISTRY
### Adding a new report section = 1 file + 1 import line

```js
// TEMPLATE: src/registry/reports/_TEMPLATE.report-section.js

export default {

  id: 'REQUIRED_UNIQUE_ID',        // e.g. 'earnings-summary', 'expense-breakdown'
  label: 'REQUIRED',               // shown in report template builder
  defaultIncluded: true,           // included in reports by default

  // Renders HTML for this section in a report
  renderHTML: async (data, options) => '',

  // Renders plain text version (for clipboard export)
  renderText: (data, options) => '',

  // Renders CSV rows for this section (if applicable)
  renderCSV: (data, options) => [],

  dataNeeds: [],                   // same pattern as widgets
  onlyForCountries: [],
  onlyForPlatforms: [],

}
```

---

## PART 2 — CATEGORY C: CONTROLLED EXTENSION POINTS

For features that genuinely need to touch the engine a little,
define clear extension points so it's always ONE place to add to.

### Global Shift Fields (new field on every shift)

```js
// src/registry/shift-fields/index.js
// Add a new GLOBAL shift field (appears for ALL platforms, not one platform).
// Platform-specific fields go in the platform definition (already done).

const GLOBAL_SHIFT_FIELDS = [
  {
    key: 'grossEarnings',
    label: (t) => t('shifts.grossEarnings'),
    type: 'currency',
    required: true,
    section: 'earnings',           // 'earnings' | 'time' | 'details' | 'context'
    showInBasicMode: true,         // show in quick-add drawer
  },
  {
    key: 'tips',
    label: (t) => t('shifts.tips'),
    type: 'currency',
    required: false,
    section: 'earnings',
    showInBasicMode: false,
  },
  // ... all fields
  // ADD A NEW GLOBAL FIELD HERE — this is the only file to touch
]

export const ShiftFieldRegistry = {
  getAll:      ()        => GLOBAL_SHIFT_FIELDS,
  getBasic:    ()        => GLOBAL_SHIFT_FIELDS.filter(f => f.showInBasicMode),
  getSection:  (section) => GLOBAL_SHIFT_FIELDS.filter(f => f.section === section),
}
```

### Expense Categories (new expense type)

```js
// src/registry/expense-categories/index.js

const EXPENSE_CATEGORIES = [
  { key: 'fuel',         label: 'Fuel',          icon: '⛽', deductible: true, vehicleRelated: true },
  { key: 'oil_change',   label: 'Oil Change',     icon: '🔧', deductible: true, vehicleRelated: true },
  { key: 'insurance',    label: 'Insurance',      icon: '🛡️', deductible: true, vehicleRelated: true },
  { key: 'phone_plan',   label: 'Phone Plan',     icon: '📱', deductible: true, vehicleRelated: false },
  // ADD A NEW CATEGORY HERE — only file to touch
]

export const ExpenseCategoryRegistry = {
  getAll:         ()    => EXPENSE_CATEGORIES,
  getDeductible:  ()    => EXPENSE_CATEGORIES.filter(c => c.deductible),
  getVehicle:     ()    => EXPENSE_CATEGORIES.filter(c => c.vehicleRelated),
  getById:        (key) => EXPENSE_CATEGORIES.find(c => c.key === key),
}
```

### Goal Types (new goal dimension)

```js
// src/registry/goal-types/index.js

const GOAL_TYPES = [
  {
    key: 'earnings',
    label: 'Gross Earnings',
    unit: 'currency',
    getValue: (shifts) => shifts.reduce((s, sh) => s + sh.grossEarnings, 0),
  },
  {
    key: 'deliveries',
    label: 'Total Deliveries',
    unit: 'count',
    getValue: (shifts) => shifts.reduce((s, sh) => s + (sh.deliveryCount || 0), 0),
  },
  {
    key: 'hours',
    label: 'Hours Worked',
    unit: 'duration',
    getValue: (shifts) => shifts.reduce((s, sh) => s + sh.durationMinutes, 0) / 60,
  },
  // ADD A NEW GOAL TYPE HERE — only file to touch
]

export const GoalTypeRegistry = {
  getAll:    ()    => GOAL_TYPES,
  getById:   (key) => GOAL_TYPES.find(g => g.key === key),
}
```

---

## PART 3 — CATEGORY D: WHAT GENUINELY REQUIRES ENGINE CHANGES

Be honest about this. Some things can't be a one-liner:

| New Feature Type | What changes | Scope |
|---|---|---|
| New data entity (new table) | `db.js` schema + migration + new module file | Medium — contained to new module |
| New core concept (e.g. "clients" for couriers who have regular customers) | Schema + module + views + nav route | Large — plan as a Phase task |
| New onboarding step (not country-specific) | `src/modules/onboarding/steps.js` | Small — one function added |
| New chart type not in Chart.js | `src/ui/charts.js` | Small — one render function |
| New keyboard shortcut | `src/modules/settings/settings.js` shortcut map | Tiny — one entry in a map |

---

## PART 4 — "ADD A FEATURE" DECISION TREE

```
Is this a new DASHBOARD WIDGET?
  → Create widget definition file + 1 import line
  → Done ✓

Is this a new NOTIFICATION / ALERT?
  → Create notification definition file + 1 import line
  → Done ✓

Is this a new BADGE or ACHIEVEMENT?
  → Create badge definition file + 1 import line
  → Done ✓

Is this a new ANALYTICS METRIC?
  → Create metric definition file + 1 import line
  → Done ✓

Is this a new REPORT SECTION?
  → Create report section definition file + 1 import line
  → Done ✓

Is this a new PLATFORM-SPECIFIC SHIFT FIELD?
  → Add to that platform's customShiftFields[] in its .platform.js
  → Done ✓

Is this a new GLOBAL SHIFT FIELD?
  → Add one entry to ShiftFieldRegistry in shift-fields/index.js
  → Done ✓ (might need DB migration if storing new field)

Is this a new EXPENSE CATEGORY?
  → Add one entry to ExpenseCategoryRegistry in expense-categories/index.js
  → Done ✓

Is this a new GOAL TYPE?
  → Add one entry to GoalTypeRegistry in goal-types/index.js
  → Done ✓

Is this a new COUNTRY feature or TAX MODULE?
  → Add/edit taxModules in that country's .country.js
  → Done ✓

Is this a WHOLE NEW DATA ENTITY?
  → Add DB table (db.js migration) + new module + new view
  → Medium scope, planned as a task
```

---

## PART 5 — COMPLETE REGISTRY MAP

```
src/registry/
  ├── platforms/          ← per platform: terminology, fields, analytics
  │     ├── _TEMPLATE.platform.js
  │     ├── doordash.platform.js
  │     └── index.js → PlatformRegistry
  │
  ├── countries/          ← per country: currency, distance, tax modules
  │     ├── _TEMPLATE.country.js
  │     ├── CA.country.js
  │     └── index.js → CountryRegistry
  │
  ├── widgets/            ← per dashboard widget: render, data needs, conditions
  │     ├── _TEMPLATE.widget.js
  │     ├── goal-ring.widget.js
  │     └── index.js → WidgetRegistry
  │
  ├── notifications/      ← per alert type: condition, message, cooldown
  │     ├── _TEMPLATE.notification.js
  │     ├── weekly-goal-hit.notification.js
  │     └── index.js → NotificationRegistry
  │
  ├── badges/             ← per achievement: condition (pure stats fn), reward
  │     ├── _TEMPLATE.badge.js
  │     ├── first-shift.badge.js
  │     └── index.js → BadgeRegistry
  │
  ├── metrics/            ← per analytics metric: calc fn, format, record tracking
  │     ├── _TEMPLATE.metric.js
  │     ├── net-hourly-rate.metric.js
  │     └── index.js → MetricRegistry
  │
  ├── reports/            ← per report section: HTML/text/CSV render
  │     ├── _TEMPLATE.report-section.js
  │     ├── earnings-summary.report-section.js
  │     └── index.js → ReportRegistry
  │
  └── shift-fields/       ← global shift fields (platform-specific are in platforms/)
  │     └── index.js → ShiftFieldRegistry
  ├── expense-categories/
  │     └── index.js → ExpenseCategoryRegistry
  └── goal-types/
        └── index.js → GoalTypeRegistry
```

---

## PART 6 — RETROFIT FROM PHASE 2

Here's what to refactor. Same surgical approach as the platform/country retrofit.

| Current location | Move to | What changes in engine |
|---|---|---|
| Badge definitions in `goals.js` | `registry/badges/*.badge.js` | `checkBadgesAfterShift()` reads BadgeRegistry |
| Notification logic in `notifications.js` | `registry/notifications/*.notification.js` | `checkAllNotifications()` iterates NotificationRegistry |
| Widget rendering in `dashboard.js` | `registry/widgets/*.widget.js` | Dashboard loops WidgetRegistry.getVisible() |
| Metric calculations in `analytics.js` | `registry/metrics/*.metric.js` | Shift cards + analytics loop MetricRegistry |
| Expense category list in `expenses.js` | `registry/expense-categories/index.js` | Form reads ExpenseCategoryRegistry |
| Goal type list in `goals.js` | `registry/goal-types/index.js` | Goal form reads GoalTypeRegistry |
| Shift field list in `shift-form.js` | `registry/shift-fields/index.js` | Form loops ShiftFieldRegistry + platform.customShiftFields |

---

## SUMMARY

| Feature type | Add a new one | Engine changes |
|---|---|---|
| Platform | 1 file + 1 import | None |
| Country | 1 file + 1 import | None |
| Dashboard widget | 1 file + 1 import | None |
| Notification / alert | 1 file + 1 import | None |
| Badge / achievement | 1 file + 1 import | None |
| Analytics metric | 1 file + 1 import | None |
| Report section | 1 file + 1 import | None |
| Platform-specific shift field | Edit platform file | None |
| Tax module for a country | Edit country file | None |
| Global shift field | 1 entry in shift-fields/index.js | None (DB migration if storing new field) |
| Expense category | 1 entry in expense-categories/index.js | None |
| Goal type | 1 entry in goal-types/index.js | None |
| Brand new data entity | New module + DB migration | Contained to new module |

*COMMA Feature Modularity Architecture v1.0*
*The engine reads registries. Registries grow. The engine never changes.*