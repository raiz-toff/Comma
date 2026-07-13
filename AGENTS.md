# AGENTS.md — rules for anyone (human or AI) changing Comma

Read this before you touch the code. It is the contract for this repository.

Comma is a privacy-first earnings tracker for gig workers. There is no backend and no
account. A driver's data lives on their own device, and the only thing that ever leaves it
is a file they chose to put in their own Google Drive.

Three rules matter more than the rest. If you read nothing else, read these:

1. **Comma is two apps that share one vault.** Changing one without the other corrupts data.
2. **The version number lives in one place, and a script proves it.**
3. **Ship nothing without a changelog entry — it is what the website publishes.**

---

## 1. Two apps, one vault — the parity contract

This is the rule that breaks real users' data when it is broken.

| | Phone app | Web app (PWA) |
|---|---|---|
| Code | `app/`, `src/`, `components/` | `web/src/` |
| Language | TypeScript + React Native (Expo) | Plain JavaScript, no framework |
| Storage | SQLite via Drizzle | IndexedDB |
| Sync | `src/services/sync/` | `web/src/modules/backup/` |

They are **separate implementations that read and write each other's files.** A driver logs a
shift on their phone, and the same vault opens in their browser. Nothing enforces agreement
between the two at compile time: the phone app's TypeScript knows nothing about the web
app's JavaScript. A change on one side that the other doesn't understand does not fail to
build — it fails at the user's data, which is the worst possible place to find out.

**So: before you edit anything below, open its twin and decide, out loud, whether the twin
also has to change.**

| If you touch… | You must consider… | Because |
|---|---|---|
| `src/services/cryptoEnvelope.ts` | `web/src/modules/backup/cryptoEnvelope.js` | The two must stay **byte-compatible**. A file written by either app is read by the other. Change the envelope on one side and the other can no longer decrypt the vault. |
| `src/database/schema.ts`, `src/database/syncedTables.ts` | `web/src/modules/backup/vault-serializer.js` | This is the set of tables that cross the wire. A table or column one side doesn't know about is data the other silently drops. |
| `src/services/sync/changeLog.ts`, `applyChangeLog.ts`, `mergeRules.ts` | `web/src/modules/backup/backup-engine.js`, `restore-engine.js` | The change-log format and merge rules *are* the wire protocol. Both sides must agree on what a record, a tombstone, and a conflict mean. |
| `src/registry/countries/**` | `web/src/registry/countries/**` | These decide tax and mileage numbers a driver acts on. Drift here doesn't crash — it quietly shows the wrong money. |

Two things follow from this:

- **A schema or protocol change is never "just" a one-file change.** Add a column on the
  phone and the web serializer needs it too, or that column vanishes on the next sync.
- **Old files must keep opening.** Vaults written by older versions are still out there.
  Read `web/src/modules/backup/cryptoEnvelope.js` — it still handles envelopes written
  before the `enc` field existed. Preserve that kind of care; never make a format change
  that only reads forward.

Check parity before you commit:

```bash
node scripts/check-country-parity.mjs   # catches registry drift; exits non-zero on mismatch
```

That script exists because the phone app once shipped Nepal and the web app didn't — so the
web app served **Canadian tax rules to Nepali drivers** instead of erroring. That is the
class of bug this section exists to prevent. There is no equivalent automated check for the
sync protocol yet, which is exactly why it needs your attention by hand.

The design notes are in [`app/docs/sync-design.md`](./app/docs/sync-design.md) and
[`app/docs/web-mobile-interop-audit-2026-07-03.md`](./app/docs/web-mobile-interop-audit-2026-07-03.md).
Read them before changing sync. They are not optional background.

---

## 2. The version number

`app.json` → `expo.version` is the **single source of truth.** Every other place that states
a version follows it:

| File | Field | Note |
|---|---|---|
| `app.json` | `expo.version` | **the truth** |
| `package.json` | `version` | |
| `web/src/modules/changelog/changelog.js` | `APP_VERSION` | drives the web "What's New" modal and the version in support reports |
| `CHANGELOG.md` | newest `## [x.y.z]` heading | |
| `android/app/build.gradle` | `versionName` + `versionCode` | git-ignored, exists only on a build machine |

Never edit these by hand — they drift the moment you do (they were last found at 1.3.1,
1.0.0, and 1.3.0 simultaneously). Use the script:

```bash
node scripts/version.mjs check        # do all the sites agree?  (CI runs this)
node scripts/version.mjs sync         # realign stragglers to app.json
node scripts/version.mjs bump 1.4.0   # cut a release: all sites + versionCode++ + CHANGELOG entry
```

`sync` and `bump` are different on purpose. `bump` increments `versionCode`, which Google
Play requires to increase on every upload; doing that while merely repairing drift would
desync you from the build already on the store.

**When to bump.** Not on every commit. Bump when you ship something a user could notice —
a release, a store upload, an OTA push. `x.y.Z` for fixes, `x.Y.0` for features, `X.0.0` for
a break. Routine refactors, tests, and docs edits don't move the number.

The in-app version display needs nothing from you: [`app/about/index.tsx`](./app/about/index.tsx)
reads `Constants.expoConfig.version` at runtime, and the web app reads `APP_VERSION`. Keep it
that way — never hardcode a version string into a screen.

---

## 3. The changelog *is* the website

`CHANGELOG.md` is not a courtesy file. `docs-site/scripts/sync-content.mjs` vendors it into
the docs site and it renders at **`/changelog`**, publicly, on every push to `main`. What you
write there is what the world reads.

So: **every user-visible change gets an entry, in the same commit that makes the change.**
Not later, not at release time when you've forgotten what you did.

```markdown
## [1.4.0] — 2026-07-20 (versionCode 8)

### Added
- **Short bold claim**: then a plain sentence saying what a driver can now do.

### Changed
### Fixed
```

Follow the [Keep a Changelog](https://keepachangelog.com) sections (`Added` / `Changed` /
`Fixed` / `Removed`) — the site colour-codes them by name, so an invented heading renders
grey and unstyled. Delete sections you don't use.

Write for a driver, not for a reviewer. Read the existing 1.3.0 entry: it says what changed
and why it matters to someone earning money with this app. It does not say "refactored
`useSyncState` hook". If a change has no effect a user could perceive, it does not belong in
the changelog at all.

Only `**bold**`, `` `code` ``, and `[links](url)` render — the site's parser handles nothing
else. No nested lists, no images. A release's *visual* lives outside this file: the
`/changelog` page renders a styled card above each version from this file's bold
claims — see §7.

---

## 4. Documentation

`docs/*.md` is the **source of truth** for the docs site. `sync-content.mjs` generates
`docs-site/content/docs/*.mdx` from it on every build.

- **Edit `docs/`. Never edit `docs-site/content/docs/`** — it is generated, and your changes
  will be overwritten on the next build.
- Adding a page means adding it to the `TREE` array in `docs-site/scripts/sync-content.mjs`,
  or it will not appear in the sidebar.
- No emoji. The sync script strips them; house style has none.
- `docs/privacy.md` and `docs/delete-data.md` are **load-bearing** — the Play Store listing
  and both apps link to those URLs. Do not move or rename them.

If you change behaviour a user relies on, the docs page describing it changes in the same
commit. A doc that describes an app that no longer exists is worse than no doc.

`app/docs/` is something different: internal design notes and audits, not published. Leave
them as the historical record they are. Don't rewrite an old audit to match new code — write
a new note.

### Every page opens with one small graphic

A wall of prose is a page nobody reads. So each docs page carries **exactly one** small
visual, right after the intro paragraph, before the first `---`. It is not decoration:
it shows the one idea that page exists to teach, and it must be **curated from that
page's own content** — its real numbers, its real field names, its real steps.

The kit lives in `docs-site/components/doc-visuals.tsx` and is registered globally, so a
page in `docs/` uses it as plain JSX with **no import line**:

```jsx
<StatRow items={[{ value: "$36.04", label: "real hourly" }]} caption="…" />
```

| Component | Use it when the page is about… |
|---|---|
| `StatRow` | numbers a driver reads — earnings, rates, totals |
| `RouteSplit` | active vs dead distance |
| `MoneySplit` | one amount divided up — tax, write-offs, take-home |
| `StepFlow` | a procedure with 3 steps |
| `VaultFlow` | where data lives and what talks to what |
| `ShiftStrip` | time — a shift, a session, a sequence |
| `LayerStack` | code layers, modules, a stack |
| `PlatformGrid` | the delivery apps a driver runs |

The rules that keep this from turning into wallpaper:

- **One per page. At the top. Never two.** If a page has no single idea worth drawing,
  it gets nothing — a reference table of field names is already a visual.
- **Never the same component on adjacent pages** in the sidebar. Sameness reads as a
  template; variety is the whole point. Pick a different accent, too.
- **Curate, don't stamp.** Feed it the page's real content. A `MoneySplit` on the tax page
  uses that page's actual percentages. Inventing numbers to fill a component is worse
  than leaving the page bare.
- **Never paste raw HTML or a `<div>` soup into a doc.** Only these components. If a page
  needs a shape the kit can't make, add a component to the kit (theme-aware, palette-only,
  per §7) rather than hand-rolling markup in the markdown.
- Everything is HTML/CSS and theme-aware — see §7. Never a screenshot of a diagram.

---

## 5. Code rules

**TypeScript**
- No `any`. Ever. Not in a cast, not in a generic.
- `npx tsc --noEmit` passes before you commit. CI enforces it.

**Database**
- All aggregation — sums, averages, counts, date filtering — happens **inside SQLite** via
  Drizzle. Never pull an array of rows into JS to `.reduce()` or `.filter()` it. A driver
  with three years of shifts will feel the difference.
- Schema changes need a Drizzle migration (`npm run db:generate`), and see §1 before you
  touch a synced table.

**React Native**
- `expo-image`, never React Native's `<Image>`.
- Long lists are virtualized. No `.map()` over an unbounded array into JSX.
- Heavy work goes off the UI thread — PBKDF2 already did; follow that precedent.

**Design system**
- Use the design tokens. Dark tokens are the runtime default.
- **Never invent a hex value, a shadow, or a spacing number.** If a token doesn't exist for
  what you need, that is a design decision to raise, not to improvise. The audit that
  cleaned this up is in [`app/docs/design-audit-2026-07-12.md`](./app/docs/design-audit-2026-07-12.md).

**General**
- No `console.log` in a commit.
- Build only what was asked. No speculative helpers, no stub screens, no "you'll want this
  later" abstractions for features nobody has requested.
- Match the surrounding code. Read the file before you change it.

---

## 6. Things that will bite you

- **Never re-enable `EXPO_UNSTABLE_TREE_SHAKING` / `EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH`.**
  They strip NativeWind's runtime styles, so most text renders near-invisible — **in release
  builds only.** Debug builds look perfect. Version 1.3.0 shipped broken this way. `build.sh`
  carries the same warning; believe it.
- **A release build is not a debug build.** Install the actual artifact on a real device and
  open it before you publish. See the checklist in [`docs/development/releasing.md`](./docs/development/releasing.md).
- **`android/` is git-ignored** (Expo-managed). `versionCode` lives only on the build
  machine, so check the last release before bumping: `gh release view --json tagName`.
- **The release keystore cannot be recreated.** Losing `~/comma-release.keystore` means no
  existing sideload user can ever update again.
- **Nothing secret goes in the repo.** `secrets/` and `*.keystore` are git-ignored. Keep it
  that way.

---

## 7. Brand & generated imagery

Every image made for Comma — ads, store assets, docs art, OG images, release cards —
follows the design system in [`marketing/design-prompts.md`](./marketing/design-prompts.md).
The **Brand Block** and hard rules in that file are the contract; this is the short version:

- **Two modes, never mixed in one asset.** PRODUCT MODE (default): near-black surfaces
  `#000000` / `#0A0A0C` / `#16161A`, hairlines `#2E2E36`, text `#F6F6F7` / `#9B9BA4`, one
  accent — emerald `#22c55e`. DM Serif Display for display lines, DM Sans for UI and body,
  DM Mono for money. MASCOT MODE (social/community): the beanie-and-cash mascot and the
  outlined "COMMA" wordmark, flat sticker style. If a color isn't in `src/theme/colors.ts`
  or the Brand Block, it isn't in the brand — no invented hexes, gradients, or glows.
- **Canonical assets** live in `marketing/press-kit/` (transparent wordmark, brand sheet,
  vendored DM fonts) and `assets/logo-mascot.png`. Reuse them; never redraw the wordmark
  or mascot by hand or by model.
- **Text-bearing assets are built, not generated.** Anything with words on it (cards,
  banners, diagrams, OG images) is authored as HTML in `marketing/final/src/` and rendered
  with headless Chromium — image models mangle text. AI generation is for illustration
  only, and **never for fake app UI**: use real screenshots or leave a blank frame.
- **Anything rendered *inside* a site is HTML/CSS, and follows the reader's theme.** Don't
  ship a PNG of something the browser can draw — it can't be selected, read by a screen
  reader, or re-themed, and it blurs on a retina screen. Style it with **both** palettes
  from `src/theme/colors.ts`: LIGHT surfaces (`#FCFCFD` / `#E5E5EB` / `#0E0E11` / `#53535A`)
  and DARK (`#0A0A0C` / `#26262C` / `#F6F6F7` / `#9B9BA4`). A hardcoded dark block on a
  light page is a bug. **Accents do not carry across themes**: the dark-canvas hues
  (`#22c55e`, `#14b8a6`, …) fail contrast on white, so each needs its 600/700 twin
  (`#15803D`, `#0F766E`, …) — the same split `colors.ts` already makes between DARK and
  LIGHT. Pattern to copy: put both hues on one CSS variable and flip it under `dark:`
  (see the release card in `docs-site/app/(home)/changelog/page.tsx`).
  PNG exports stay for what leaves the site — store listings, ads, print, OG images.
- **Release cards.** The `/changelog` page renders a card above each version natively in
  HTML/CSS (`docs-site/app/(home)/changelog/page.tsx`) — no image files. The anatomy is
  fixed (version pill, one serif headline, 2–3 ticks, faint oversized version numeral,
  dark PRODUCT-MODE surface); only the accent varies, rotating per release through the
  KPI palette so releases read as siblings, not copies. Headline and ticks auto-derive
  from the release's `**bold claims**` in `CHANGELOG.md`; when a release deserves better
  copy, add an entry to the `CURATED` map in that file. `CHANGELOG.md` itself stays
  text-only (§3).

---

## Before you say you're done

```
[ ] npx tsc --noEmit                        passes
[ ] node scripts/version.mjs check          all version sites agree
[ ] node scripts/check-country-parity.mjs   phone and web registries agree
[ ] Touched sync, schema, crypto, or a country? — the twin in the other app is handled (§1)
[ ] User-visible change? — CHANGELOG.md entry written, in this commit (§3)
[ ] Behaviour a doc describes? — that docs/ page updated (§4)
[ ] Shipping to users? — node scripts/version.mjs bump <x.y.z>, then docs/development/releasing.md
[ ] Cut a release? — /changelog card reads right (auto-derives from bold claims; override via CURATED, §7)
```

Say plainly what you did and what you did not verify. A change reported as working when it
was never run is the one thing this project cannot tolerate — the users are drivers, and the
data is their income.
