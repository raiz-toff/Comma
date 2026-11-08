# AGENTS.md — rules for anyone (human or AI) changing Comma

Read this before you touch the code. It is the contract for this repository.

Comma is a privacy-first earnings tracker for gig drivers. It is an
**Android app** and nothing else: there is no web app, no backend, and no account. A driver's
data lives on their own phone, and the only thing that ever leaves it is an encrypted file
they chose to put in their own Google Drive.

Three rules matter more than the rest. If you read nothing else, read these:

1. **Old vaults must keep opening.** Drivers' Drive files were written by older versions.
2. **The version number lives in one place, and a script proves it.**
3. **Ship nothing user-visible without a changelog entry.**

---

## 1. One app, one vault — keep old files readable

The app syncs to a vault in the driver's own Google Drive (`src/services/sync/`). Two phones
on the same account can run **different app versions**, and a vault written years ago must
still open. Nothing enforces this at compile time; it fails at the user's data.

| If you touch… | Be careful because |
|---|---|
| `src/services/cryptoEnvelope.ts` | Every vault on Drive was encrypted with it. A change that can't read the old envelope locks drivers out of their own data. It still handles envelopes written before the `enc` field existed — preserve that kind of care. |
| `src/database/schema.ts`, `src/database/syncedTables.ts` | This is the set of tables that crosses the wire. An older phone that doesn't know a new table or column silently drops it. Never remove a synced table or column; leave unused ones in place. |
| `src/services/sync/changeLog.ts`, `applyChangeLog.ts`, `mergeRules.ts` | The change-log format and merge rules *are* the wire protocol. Every app version on the account must agree on what a record, a tombstone, and a conflict mean. |
| `src/registry/countries/**` | These decide tax and mileage numbers a driver acts on. A wrong number doesn't crash — it quietly shows the wrong money. Every figure needs a source and a year. |

- **A schema change is never "just" a one-file change.** It needs a Drizzle migration
  (`npm run db:generate`) and a thought about phones still on the previous version.
- **Never make a format change that only reads forward.**

The design notes are in [`app/docs/sync-design.md`](./app/docs/sync-design.md). Read them
before changing sync. They are not optional background.

---

## 2. The version number

`app.json` → `expo.version` is the **single source of truth.** Every other place that states
a version follows it:

| File | Field | Note |
|---|---|---|
| `app.json` | `expo.version` | **the truth** |
| `package.json` | `version` | |
| `CHANGELOG.md` | newest `## [x.y.z]` heading | |
| `android/app/build.gradle` | `versionName` + `versionCode` | git-ignored, exists only on a build machine |

Never edit these by hand — they drift the moment you do. Use the script:

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
reads `Constants.expoConfig.version` at runtime. Never hardcode a version string into a screen.

---

## 3. The changelog

**Every user-visible change gets a `CHANGELOG.md` entry, in the same commit that makes the
change.** Not later, not at release time when you've forgotten what you did. It becomes the
release notes.

```markdown
## [1.4.0] — 2026-07-20 (versionCode 8)

### Added
- **Short bold claim**: then a plain sentence saying what a driver can now do.

### Changed
### Fixed
```

Follow the [Keep a Changelog](https://keepachangelog.com) sections (`Added` / `Changed` /
`Fixed` / `Removed`). Delete sections you don't use.

Write for a driver, not for a reviewer. Say what changed and why it matters to someone
earning money with this app — not "refactored `useSyncState` hook". If a change has no
effect a user could perceive, it does not belong in the changelog at all.

---

## 4. Documentation and legal pages

- `docs/development/` holds developer notes: setup, releasing, adding a country. If you
  change how one of those things works, update the page in the same commit.
- `app/docs/` holds internal design notes and audits. Leave them as the historical record
  they are. Don't rewrite an old audit to match new code — write a new note.
- **`legal/privacy.html` and `legal/delete-data.html` are load-bearing.** They are served at
  `/privacy` and `/delete-data` from the `legal/` folder, and the Play Store listing links
  to those URLs. Do not move or rename them. If the app starts storing or sending something
  new, the privacy page changes in the same commit.

---

## 5. Code rules

**Platform**
- Android only. Don't add `Platform.OS === "web"` branches or `localStorage` fallbacks;
  the old ones are leftovers from a removed browser build.
- Build features, not switches. There is no feature-flag system — a feature is either in the
  app or deleted.

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

Every image made for Comma — ads, store assets, OG images — follows the design system in
[`marketing/design-prompts.md`](./marketing/design-prompts.md). The **Brand Block** and hard
rules in that file are the contract; this is the short version:

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
  banners, OG images) is authored as HTML in `marketing/final/src/` and rendered with
  headless Chromium — image models mangle text. AI generation is for illustration only,
  and **never for fake app UI**: use real screenshots or leave a blank frame.
- **Web pages follow the reader's theme.** The legal pages use **both** palettes from
  `src/theme/colors.ts`: LIGHT (`#FCFCFD` / `#E5E5EB` / `#0E0E11` / `#53535A`) and DARK
  (`#0A0A0C` / `#26262C` / `#F6F6F7` / `#9B9BA4`). **Accents do not carry across themes**:
  the dark-canvas hues (`#22c55e`, …) fail contrast on white, so each needs its 600/700
  twin (`#15803D`, …) — see `legal/style.css`.

---

## Before you say you're done

```
[ ] npx tsc --noEmit                        passes
[ ] node scripts/version.mjs check          all version sites agree
[ ] Touched sync, schema, crypto, or a country? — old vaults and older app versions handled (§1)
[ ] User-visible change? — CHANGELOG.md entry written, in this commit (§3)
[ ] Stores or sends new data? — legal/privacy.html updated (§4)
[ ] Shipping to users? — node scripts/version.mjs bump <x.y.z>, then docs/development/releasing.md
```

Say plainly what you did and what you did not verify. A change reported as working when it
was never run is the one thing this project cannot tolerate — the users are drivers, and the
data is their income.
