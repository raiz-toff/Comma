# 007 — Web PWA layout system: one set of numbers, mobile → desktop

**Goal.** The web app's features stay exactly as they are. What changes is the frame around
them: every screen adopts one shared set of dimensions, so the app reads as one designed
product instead of 22 screens that each invented their own layout. Simple money app, not a
NOC dashboard.

**Evidence this is needed** (audit of `web/src`, 2026-07-13):

- 26 distinct `@media` breakpoints across `src/css/` (target: 2)
- 6+ different page widths: calendar 1400px, analytics 1200px, settings 960px,
  notifications 800px, shifts/expenses `--app-content-width` (720px), setup 560px
- 407 inline `style="` attributes in `src/views/*.js` (dashboard.js: 120)
- 4 views embed `<style>` blocks in JS (dashboard, goals, reports, print)
- Hardcoded hexes in views that aren't in tokens.css: `#3b82f6 #6366f1 #a855f7 #8b5cf6
  #0ea5e9 #06b6d4 #14b8a6` and light-theme literals like `#e5e2da`
- 22 `@keyframes`; dashboard has per-card staggered entrance delays, noise-texture
  overlays, and pulse dots on static numbers
- Settings appears twice in the shell (header gear + sidebar item); the FAB renders on
  desktop where a toolbar button belongs

**Hard boundaries.** UI only. Do not touch `web/src/modules/backup/`, `web/src/registry/`,
sync, crypto, or anything in the §1 parity table of AGENTS.md. No new dependencies, no
framework — vanilla stays (user decision, see memory `shared-core-extraction`). Feature
behaviour is preserved screen-for-screen; only structure, spacing, and styling move.

**Ionic comes out** (user decision 2026-07-13: "rather than ionic i really like vanilla
css"). Current usage: 131 `ion-*` elements across views — 54 `ion-button`,
17 `ion-skeleton-text`, 23 segment parts, 7 `ion-progress-bar`, 13 item-sliding parts
(swipe actions), plus badge/toggle/spinner/fab. Each phase replaces the `ion-*` elements
on the screens it touches with plain HTML styled by tokens; behaviour is kept:

- button/badge/label/segment/skeleton/progress/spinner/toggle → pure HTML+CSS, trivial
- `ion-item-sliding` (swipe-to-delete on mobile lists) → small vanilla pointer-events
  handler, or visible row actions — decide on the first list screen (Phase 3)
- `ion-fab` → mobile-only plain button (desktop FAB dies anyway)

Phase 6 deletes `css/ionic.css`, `css/ionic-theme.css`, `core/ionic.js` and the vendored
`@ionic/core` — the app ends the plan with zero UI dependencies.

---

## Part 0 — Aesthetic direction: "Vanilla-clean"

Reference the user gave: [vanillaframework.io](https://vanillaframework.io/) — "so smooth
while being so clean." What actually produces that feel, translated to Comma's brand
(dark tokens, DM faces, emerald):

1. **Flat.** Surfaces sit next to each other, not on top of each other. No decorative
   shadows — `--shadow-*` reserved for true overlays (menus, dialogs, sheets).
2. **Hairlines over boxes.** Prefer a 1px `--color-border` rule between sections to
   wrapping everything in a rounded card. Cards are for things that ARE cards (a shift
   row group, the live-shift panel), not a default wrapper.
3. **Air is the ornament.** Generous, rhythmic whitespace (the Part-1 rhythm) instead of
   dividers, gradients, glows, or noise textures.
4. **Quiet motion.** Transitions are 120–200ms opacity/transform only (`--transition-fast/
   base`), on interaction — never ambient. Nothing pulses at rest except the live-shift
   dot, nothing staggers in.
5. **One accent.** Emerald for the primary action and positive money. A screen with three
   green things has two too many.
6. **Restraint in radii.** Vanilla FW is square; Comma keeps its friendlier `--radius-md/
   lg/pill` set, but radii never exceed the token set, and pills are reserved for
   chips/switchers/primary CTA.
7. **Type does the hierarchy.** Serif page title, sans everything else, mono strictly for
   money/time digits (register decision from the direction-2 mock: plain sentences, no
   jargon, no percentages a driver didn't ask for).

---

## Part 1 — The constitution (new tokens; the only numbers allowed)

Add to `src/css/tokens.css`:

```css
/* Layout constitution — every screen uses these; no view defines its own. */
--bp-desktop: 768px;        /* sidebar appears */
--bp-wide:    1120px;       /* dashboard aside appears */

--rail-w:        240px;     /* desktop sidebar */
--content:       720px;     /* DEFAULT page width: lists, forms, overview main column */
--content-wide:  960px;     /* wide pages: tables, charts, calendar, reports */
--aside-w:       340px;     /* dashboard right column, >=1120px only */

--header-h:      56px;      /* mobile */
--header-h-lg:   64px;      /* desktop */
--bottomnav-h:   56px;      /* + safe-area-inset-bottom */

--page-pad:      16px;      /* mobile */
--page-pad-lg:   32px;      /* desktop */

--control-h:     44px;      /* mobile touch target */
--control-h-lg:  40px;      /* desktop */
```

(`--app-content-width` already exists at 720px — `--content` replaces it; alias during
migration, delete at the end.)

**Breakpoints: exactly two.** `<768` = phone (bottom nav). `>=768` = desktop (sidebar).
`>=1120` = wide desktop (dashboard gains its aside; everything else just breathes).
Every other `@media` width in the codebase gets migrated to one of these two or deleted.
Exception: `prefers-color-scheme` / `prefers-reduced-motion` / print queries stay.

**Vertical rhythm.** Between sections: `--space-8` (32). Between cards in a section:
`--space-4` (16). Card padding: `--space-5` (20). Page top padding: `--space-6` (24)
mobile, `--space-8` (32) desktop. Nothing else.

**Radii.** Cards/sheets `--radius-lg` (16). Inputs/buttons `--radius-md` (10).
Chips/switchers/primary CTA `--radius-pill`. Nothing else.

**Type roles: four.** Page title = serif `--text-2xl`. Section heading = sans 600
`--text-base+1` (16px). Body = sans `--text-base`. Caption = sans `--text-sm` muted.
Mono is for money and time digits ONLY — never labels, never headings.

**Colour.** Tokens only; the cleanup deletes every literal hex from `src/views/`.
Platform brand colours appear only as identity marks (avatar chips / row accents).
Emerald = the one accent. Amber = live/running shift only. Red = destructive/negative only.
The stray non-brand hexes (`#3b82f6 #6366f1 #a855f7 #8b5cf6 #0ea5e9 #06b6d4 #14b8a6`)
map to existing tokens or die.

---

## Part 2 — The two layouts

### Mobile (<768) — mostly already right; standardize, don't redesign

```
┌──────────────────────────┐
│ header (56)              │  title + settings gear. No clock clutter.
├──────────────────────────┤
│                          │
│  content, full width     │  pad 16; one column; every view.
│                          │
├──────────────────────────┤
│ bottom nav (56+safe)     │  Home · Shifts · Earnings · Goals · More
└──────────────────────────┘
      (+ FAB, mobile only)
```

### Desktop (>=768) — the actual redesign

```
┌──────────┬───────────────────────────────────────────────┐
│ rail 240 │ toolbar (64): period picker · platform switcher│
│          │  · vehicle switcher · [spacer] · Start shift   │
│ comma,   ├───────────────────────────────────────────────┤
│          │                                               │
│ Home     │        content column                         │
│ Shifts   │        720px default / 960px wide,            │
│ Schedule │        centered, pad 32                       │
│ ──────   │                                               │
│ Expenses │   (dashboard only, >=1120: + aside 340        │
│ My car   │    → live shift card, recent shifts)          │
│ ──────   │                                               │
│ Earnings │                                               │
│ Goals    │                                               │
│ ──────   │                                               │
│ Taxes    │                                               │
│ Reports  │                                               │
│          │                                               │
│ ▪ saved  │                                               │
│ Settings │                                               │
└──────────┴───────────────────────────────────────────────┘
```

Shell rules:

- Sidebar: grouped with hairline separators (no group captions needed — the gaps do it).
  Settings lives at the rail bottom with the sync status; the header gear is removed.
- The platform + vehicle switchers (the good parts — keep) move into the toolbar on
  desktop, styled as pills with platform-colour dots / car icon.
- FAB: `display:none` at >=768. Its actions become the toolbar's "Start shift" +
  per-view add buttons in each list's header row.
- Only `.app-main` scrolls (already done at 1024 — move to 768).
- The shell is the ONLY place that knows about breakpoints, rails, and asides. Views
  never position themselves; they pick a width class and fill it.

### Page templates — every one of the 20 views maps to exactly one

| Template | Width | Structure | Views |
|---|---|---|---|
| **Overview** | 720 (+aside ≥1120) | greeting sentence → money hero → "where it went" bar → "this week" row | dashboard |
| **List** | 720 | header row (title + count + add button) → filter chips → rows | shifts, expenses, vehicles, goals, notifications |
| **Form** | 720 | sectioned cards, one column; paired fields 2-col inside card | settings, setup-*, onboarding, import, support, about |
| **Document** | 960 | toolbar → table/chart blocks | analytics, reports, tax, schedule/calendar, print |

Dashboard content follows the approved "direction 2" mock (simple register): plain-English
hero ("You kept … $X"), single money-split bar (kept / gas / car), seven day-boxes for the
week, live-shift card in the aside. The 7-KPI bento grid is deleted.

---

## Part 3 — The removal list

1. Dashboard: bento grid, noise overlays, pulse dots on static numbers, staggered
   entrance delays, inline sparkline path-string hacks, the 120 inline styles, the
   embedded `<style>` block. (`dashboard.js` 1,267 → target ≤ 500 lines.)
2. Shell: duplicate Settings entry; FAB on desktop; header clock on mobile widths.
3. Per-view page widths: `calendar.css:6` (1400), `analytics.css:3,9` (1200),
   `notifications.css:8` (800), `settings.css:4` (960→`--content-wide` only if it uses the
   Document template, else 720), `setup.css:9` (560→720).
4. All 24 non-standard breakpoints.
5. All literal hexes in `src/views/`.
6. Inline `style="` in views: 407 → ~0 (allow genuinely dynamic values — computed bar
   widths/heights — via CSS custom properties, e.g. `style="--w:63%"`).
7. `<style>` blocks in goals/reports/print/dashboard views → their css files.
8. Keyframes: keep view-fade, sheet-slide, live-shift pulse, skeleton shimmer;
   delete the rest (~18).
9. `ion-*` elements screen-by-screen (see Ionic section above); Phase 6 removes the
   vendored @ionic/core css/js entirely.
10. Decorative shadows on non-overlay elements (Part 0 rule 1).

---

## Part 4 — Execution order (each phase leaves the app shippable)

Branch: `feat/web-layout` off main.

- **Phase 1 — tokens + shell.** Add constitution tokens; rewrite `layout.css` to the two
  breakpoints; regroup sidebar; move switchers to toolbar; dedupe Settings; hide FAB on
  desktop. Touches `tokens.css`, `layout.css`, `core/shell.js` only. Everything still
  renders (views keep their own widths one more phase).
- **Phase 2 — dashboard.** Rebuild per the Overview template + direction-2 mock, real
  data via existing `buildWidgetDataContext`. Delete bento css. This is the screen the
  user judges — stop here for a look before continuing.
- **Phase 3 — lists.** shifts, expenses, vehicles, goals, notifications → List template;
  page widths standardized; inline styles out.
- **Phase 4 — wide views.** analytics, reports, tax, calendar/schedule → Document (960);
  kill 1400/1200 containers.
- **Phase 5 — forms.** settings, setup-*, onboarding, import, support, about → Form.
- **Phase 6 — sweep + proof.** Delete dead css, the `--app-content-width` alias, and the
  Ionic layer (`css/ionic.css`, `css/ionic-theme.css`, `core/ionic.js`, vendored
  @ionic/core); then prove the constitution with greps that must all pass:
  - `grep -rhoE "(min|max)-width: *[0-9]+px" src/css | sort -u` → only 768/1120 (+print)
  - `grep -rE '#[0-9a-fA-F]{6}' src/views` → 0
  - `grep -c 'style="' src/views/*.js` → only `--var` custom-property carriers
  - `grep -c '<style>' src/views/*.js` → 0
  - `grep -rc '<ion-' src/` → 0

Per phase: `npm run build` in `web/`, user opens it and judges (per working agreement:
user confirmation is the test). No automated visual check exists — say so in reports.

**When it ships:** CHANGELOG.md entry (user-visible redesign), version bump per AGENTS
§2, docs screenshots later if any docs page shows the old UI.

**Lesson honoured** (memory: `till-receipt-identity`): Phase 2 pauses for visual sign-off
on the live app before the pattern rolls to the other 19 screens.
