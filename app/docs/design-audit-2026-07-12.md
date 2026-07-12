# Comma — UI/UX Design Audit (2026-07-12)

Deep audit of the React Native app's UI against the Comma Design System
(`src/global.css` + `tailwind.config.js` + `src/components/ui/*`).
Scope: all 24 screens in `app/`, 4 root components, 19 shared components,
33 dashboard/home widgets (~21,000 lines of UI code).

---

## Executive summary

The design system itself is well-designed (dark-first cool-neutral ramp,
semantic tokens, CVA-based UI kit, semantic type ramp) — **but the app almost
never uses it**. Roughly **1,860 hardcoded hex colors**, zero `<Text variant>`
usage in screens, 2 files (of ~50) using the DS `Button`, and 18
shadow/elevation sites despite the "surface + hairline border, never shadow"
rule.

### Root cause (the most important finding)

**The design tokens don't work at runtime.** `tailwind.config.js` sets
`darkMode: "class"`, and every surface/content/line token is defined only
inside the `.dark { … }` block of `src/global.css` — but nothing ever
activates the dark class (no `colorScheme.set()`, no root wiring). So
`bg-surface-02`, `text-content-secondary`, etc. resolve to *nothing* on
native. This is why every screen re-hardcodes `#0F0F12`-style hex values, why
five screens grew their own private `DS = {…}` constant objects (each with
drifted, wrong values), and why the token system was bypassed app-wide.

**Fix:** make the dark values the `:root` default (the app is dark-first by
design — store default is `"dark"`), add `<alpha-value>` support so opacity
modifiers (`bg-primary/90`) actually work, and export a JS mirror of the
tokens (`src/theme/colors.ts`) for StyleSheet/SVG/chart code.

---

## Critical findings (broken UX / crash-class)

| # | Where | Issue |
|---|-------|-------|
| C1 | `src/global.css` + root | DS tokens never resolve (dark class never applied) — root cause above. |
| C2 | `app/(tabs)/tax/index.tsx:78-82` | Rules-of-Hooks violation: `return null` sits between hooks — crashes when the tax feature flag flips. |
| C3 | `src/components/ui/PlatformBadge.tsx:17-28` | Rules-of-Hooks violation: `useSettingsStore` called after a conditional early return — crash risk when `platform` prop switches between `"a,b"` and `"a"`. |
| C4 | ~20+ inputs in `settings/index`, `settings/backup`, `vehicles/index`, `vehicles/[id]` | **Invisible placeholders**: `placeholderTextColor` set to `#2E2E36` — a *border* color — on near-black inputs. Users can't see what a field is for. |
| C5 | `expense/[id]`, `schedule/index`, `tax/center` | `#2E2E36` (line color) used as *text* color for notes/labels/disclaimers — unreadable, far below WCAG. |
| C6 | `app/expense/add.tsx` | Main form has no `KeyboardAvoidingView` and no `keyboardShouldPersistTaps` — keyboard covers inputs; merchant-suggestion taps are dropped. |
| C7 | `app/_layout.tsx` | No `StatusBar` config, no dark navigation theme (`contentStyle`) → white flash between dark screens; error/loading fallbacks are light-mode (`bg-red-50`, `bg-white`). |

## High-severity themes

1. **Parallel invented palettes.** Instead of the 4 canonical
   surface/line tokens, screens use `#16161A`, `#1C1C21`, `#121216` (invented
   neutrals), warm browns (`#0c0b09`, `#131211`, `#1a1916`, `#1f1e1c`,
   `#3a3835` in profile/backup/expense-detail), and Tailwind slate/zinc
   (`ShiftCard` is 100% slate). `#1C1C21` is routinely used as a *border*
   where `line-subtle #1E1E23` belongs.
2. **Wrong semantic colors.** Destructive rendered as rose `#fb7185` /
   `#f87171` / `rgba(239,68,68)` instead of `#FF5247` (settings, backup,
   vehicles, expenses, dashboard slider). Warning rendered as `#f59e0b` /
   `#d97706` / `#f97316` instead of `#F5A623`. Non-token green `#10b981`
   is the default "accent/success" in ~6 shared components (date/time pickers,
   ErrorBoundary, onboarding switches). `FeedbackDialog`'s "info" variant is
   green instead of `info` blue.
3. **Typography system bypassed 100%.** Not one screen uses `<Text variant>`;
   everything is inline `fontSize`/`fontWeight` (including off-ramp `900`
   weights, sub-legible 7.5–9.5 px labels in schedule/widgets, and monospace
   `Courier New` hacks where the `tabular` prop exists). Money is almost never
   tabular (`CurrencyText` bypassed even where imported).
4. **UI kit ignored / reimplemented.** `ui/button` used by 2 files; screens
   hand-roll `TouchableOpacity` CTAs with no pressed feedback. `StatCard`,
   `SectionHeader`, `EmptyState`, `AppBottomSheet` are imported-but-unused in
   several screens; 0 of 16 dashboard widgets build on `BentoCard`/`StatCard`;
   raw RN `Modal`s duplicate `AppBottomSheet`/`FeedbackDialog`. A dead
   duplicate (`components/congratulationsSheet.tsx`, light-theme starter
   boilerplate) competes with the live `CelebrationSheet`.
5. **Shadows where the DS forbids them.** Drawer container, dashboard swipe
   knob, GlobalTopHeader (4 styles), onboarding reveal glows,
   `expense/add` `shadow-lg`/`shadow-2xl`.
6. **Accessibility gaps are universal.** Icon-only buttons (back, ✕, gear,
   trash, bell, hamburger) lack `accessibilityLabel`; every custom
   tab/toggle/chip/pill lacks `accessibilityRole`/`accessibilityState`;
   many targets are sub-44 pt (36 px gear/steppers, 28 px close, 24–28 px
   segmented tabs); charts/progress bars expose nothing to screen readers.
7. **Chart color chaos across widgets.** The same metric changes color from
   widget to widget: avg-earnings is indigo in BestDay but amber in BestHour;
   gross trend is green (RollingTrend), off-palette violet `#8b5cf6`
   (Scatter), or tier-colored (StabilityScore); `#0ea5e9` means "taxes" in one
   widget and "per-delivery earnings" in another; the Elite/Pro/Active tier
   vocabulary uses contradictory color scales (Elite = rose in Month widgets,
   green in OutOfPocket); two colors have no token at all (`#8b5cf6`,
   `#818cf8`). Only IncomeBreakdown matches the KPI palette.
8. **Missing states & list perf.** Empty states are ad-hoc italic text or 📭
   emoji instead of `EmptyState`; no loading skeletons; shift/expense/
   notification lists render via `ScrollView + map` instead of
   `FlatList`/`SectionList`; ZeroDays renders one `View` per day (365 nodes).

## Medium — consistency

- **Off-scale radii everywhere**: 4/6/7/10/11/13/14/18 px and `rounded-2xl`
  (28, modal scale) on ordinary cards; DS scale is 8/12/16/20/28.
- **Off-scale spacing**: `padding: 15`, `rowPad: 13`, `p-3.5`, `gap: 18`.
- Modal/dialog radius drift (20 where DS modals are 28).
- Number formatting drift: 0-dp vs 2-dp currency, `"3d"` vs "3 Days",
  unrounded percentages (`33.33333%`), ad-hoc `color + "20"` alpha concat.
- Header scaffolding copy-pasted per tab with different paddings (76 vs
  `insets.top + 64`); manual scroll-to-hide handlers duplicated.
- Platform brand colors leaking outside selector pills (schedule timeline/
  calendar dots; GlobalTopHeader collapsed pill border).
- JS-thread layout animations (`useNativeDriver: false`, PanResponder) in
  GlobalTopHeader while Reanimated 3 is available and used well elsewhere.
- 62 `Alert.alert` call sites where the designed `FeedbackDialog` exists
  (kept as follow-up; native alerts are functional).

## Per-file severity map

| File | Verdict |
|------|---------|
| `app/(tabs)/index.tsx` (2003) | Worst offender: 192 hex, ad-hoc modals/empty states, wrong warning/destructive colors, shadow knob |
| `app/schedule/index.tsx` (1966) | Mis-mapped local DS (muted = border color → unreadable), brand leak, 7.5–9.5 px text |
| `app/settings/index.tsx` (1838) | Local DS wrong values, invisible placeholders, ~200 raw text sites, hand-rolled buttons/tabs |
| `app/reports/index.tsx` (1312) | Full palette hardcoded, manual stat tiles, `#f87171` negative money |
| `app/tax/center.tsx` (1257) | 2 unreadable text styles, money never tabular, palette hardcoded |
| `app/(tabs)/shifts/index.tsx` (1188) | ScrollView+map list, raw Modal picker, full hex StyleSheet |
| `app/shifts/[id].tsx` (1159) | Button/StatCard/SectionHeader imported-unused, zinc/rose classes, hand-drawn trash icon, no KAV |
| `app/shift/add.tsx` (1121) | Button imported-unused, `bg-[#hex]` classes, `focus:border-white`, rose errors (KAV ✓) |
| `app/expense/add.tsx` (1120) | No KAV (Critical), shadow classes, zinc/rose, legacy text sizes |
| `app/(tabs)/tax/index.tsx` (1109) | Hooks violation (Critical), hand-built sheet/dialog, 36 px steppers |
| `app/vehicles/[id].tsx` (1028) | Invisible placeholders (Critical), rose danger, CurrencyText unused, no KAV |
| `app/goals/index.tsx` (815) | Off-palette pink/purple, 3 custom modals, 100% inline styles |
| `components/OnboardingSteps.tsx` (1549) | `#10b981` switches, shadow glows, unlabeled selection controls, 50-state ScrollView |
| `src/components/GlobalTopHeader.tsx` (810) | 4 shadow violations, JS-thread animations, unlabeled Menu/Bell, own accent computation |
| `app/(tabs)/expenses/index.tsx` (829) | Tailwind-default green/red tints, ScrollView+map, raw money text |
| `app/settings/backup.tsx` (860) | Warm dialog surface, rose danger, invisible placeholders, PasswordPrompt no KAV |
| Dashboard widgets ×16 | No primitives, no variants, no tabular, ~90 hex, cross-widget color conflicts |
| `app/(tabs)/analytics.tsx`, `more.tsx`, `notifications.tsx`, `vehicles/index.tsx`, `about/index.tsx`, `settings/profile.tsx`, `settings/import.tsx`, pickers, `FeedbackDialog`, `ShiftCard`, `CSVImportWizard`, `ActiveShiftWidget` | Same patterns at smaller scale (see sections above) |
| Token-clean ✓ | `ui/card`, `ui/text`, `ui/button`, `EmptyState`, `SectionHeader`, `StatCard`, `BentoCard`, `CurrencyText`, `AppBottomSheet`, `CelebrationSheet` (minor nits only) |

---

## Remediation plan (executed in this pass)

1. **Foundations** — make dark tokens the `:root` default; add
   `<alpha-value>` to token colors; create `src/theme/colors.ts` (JS mirror
   of every token + shared KPI/tier chart palette + alpha helper); fix root
   layout (StatusBar light, dark nav `contentStyle`, dark fallbacks).
2. **Crash-class + contrast criticals** — both hook violations; all
   invisible placeholders; all `#2E2E36`-as-text; `expense/add` keyboard
   handling.
3. **Shared kit** — tokenize pickers/dialog/header/ShiftCard/onboarding;
   `#10b981` → primary green; dialog info → blue; remove all
   shadows; delete dead `congratulationsSheet.tsx`.
4. **Screens** — replace invented palettes and local `DS` objects with
   canonical tokens (className token classes now that they resolve; JS
   constants where StyleSheet/SVG needs them); semantic
   destructive/warning/success corrections; radius/spacing snapping; DS
   `Button`/`EmptyState`/`StatCard` adoption at flagged sites; a11y
   labels/roles/states on flagged controls; `FlatList`/`SectionList` for
   flagged lists; `KeyboardAvoidingView` on flagged forms; tabular money.
5. **Widgets** — shared chart-metric palette (gross = teal `kpi-gross`,
   rate = amber, expenses = cyan, tax = sky, net = blue, hours = indigo,
   unified tier scale), `Text` variants, tabular numbers, consistent 2-dp
   currency, SegmentedWidget touch/a11y fixes.

Deferred (follow-ups, not in this pass): migrating 62 `Alert.alert` sites to
`FeedbackDialog`; consolidating the copy-pasted screen headers into one
scaffold component; GlobalTopHeader PanResponder → Reanimated gesture
migration; loading skeletons; widget adoption of `StatCard`/`BentoCard`;
RegionStep/vehicle-list `FlatList` conversion; light-theme wiring
(`.light:root` palette is preserved in `global.css`).

## Results (remediation executed 2026-07-12)

All items in steps 1–5 above were applied across ~70 UI files. Verified:
`tsc --noEmit` clean (only the 8 pre-existing `store/useSettingsStore.ts`
errors remain); hardcoded hex occurrences in UI files dropped from ~1,860 to
~70 — the remainder being sanctioned data (user-selectable accent palettes,
platform brand colors, WebView-embedded map CSS) and local contrast helpers.
Zero foreign Tailwind palette classes (zinc/slate/rose/emerald/gray) remain;
zero `shadow*`/`elevation` styles remain (including the UI-kit button);
all `placeholderTextColor` sites resolve to `content-muted`.

Also fixed beyond the audit: `cn()`/tailwind-merge misclassified the custom
type-ramp classes (`text-heading-l` vs `text-content-*` were treated as the
same group, silently dropping the size) — `src/lib/utils.ts` now registers
the semantic font sizes with `extendTailwindMerge`.
