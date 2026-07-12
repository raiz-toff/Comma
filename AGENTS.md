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
else. No nested lists, no images.

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

## Before you say you're done

```
[ ] npx tsc --noEmit                        passes
[ ] node scripts/version.mjs check          all version sites agree
[ ] node scripts/check-country-parity.mjs   phone and web registries agree
[ ] Touched sync, schema, crypto, or a country? — the twin in the other app is handled (§1)
[ ] User-visible change? — CHANGELOG.md entry written, in this commit (§3)
[ ] Behaviour a doc describes? — that docs/ page updated (§4)
[ ] Shipping to users? — node scripts/version.mjs bump <x.y.z>, then docs/development/releasing.md
```

Say plainly what you did and what you did not verify. A change reported as working when it
was never run is the one thing this project cannot tolerate — the users are drivers, and the
data is their income.
