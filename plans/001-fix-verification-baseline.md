# Plan 001: Establish a working verification baseline (typecheck, lint, scripts, CI)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat fffd401..HEAD -- package.json eslint.config.js store/useSettingsStore.ts .github/workflows/typecheck.yml`
> This plan was written against commit `fffd401` **plus uncommitted working-tree
> changes** — the "Current state" excerpts reflect the working tree, not the
> commit. If any in-scope file no longer matches the excerpts below, treat it
> as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `fffd401` (+ uncommitted changes), 2026-07-12

## Why this matters

This repo has **no working verification command of any kind**. `npx tsc --noEmit`
crashes with `RangeError: Maximum call stack size exceeded` (a Node stack-depth
limit hit by TypeScript's control-flow analyzer on this codebase — not a config
problem). The only CI workflow runs exactly that crashing command, so CI is
guaranteed red and validates nothing. There are no `test`, `lint`, or `typecheck`
scripts in `package.json`. Every other plan in this directory relies on the
commands this plan creates. When tsc is run with a raised stack it *completes*
and reveals 8 real, previously invisible type errors — fixing those is part of
this plan.

## Current state

- `package.json` (repo root) — scripts are only:
  ```json
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "web": "expo start --web",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  }
  ```
  No `test`, `lint`, `typecheck`. TypeScript `~6.0.3`, eslint + prettier are in
  devDependencies. There is **no test runner installed** (that's Plan 002, not
  this plan).
- Verified behavior of typecheck (2026-07-12):
  - `npx tsc --noEmit` → crashes: `RangeError: Maximum call stack size exceeded`
    inside `checkPropertyAccessExpression`/`getTypeAtFlowCall`.
  - `node --stack-size=8000 ./node_modules/typescript/lib/tsc.js --noEmit` →
    **completes**, exit 2, with exactly these 8 errors, all in
    `store/useSettingsStore.ts`:
    ```
    store/useSettingsStore.ts(1133,13): error TS7034: Variable 'demoShifts' implicitly has type 'any[]' ...
    store/useSettingsStore.ts(1134,13): error TS7034: Variable 'demoExpenses' implicitly has type 'any[]' ...
    store/useSettingsStore.ts(1199,35): error TS7006: Parameter 'tx' implicitly has an 'any' type.
    store/useSettingsStore.ts(1200,67): error TS7005: Variable 'demoShifts' implicitly has an 'any[]' type.
    store/useSettingsStore.ts(1201,71): error TS7005: Variable 'demoExpenses' implicitly has an 'any[]' type.
    store/useSettingsStore.ts(1257,11): error TS2739: Type '{...}' is missing the following properties from type 'Challenge': nextResetDate, weekStartedAt
    store/useSettingsStore.ts(1267,11): error TS2739: (same, metric: "deliveries")
    store/useSettingsStore.ts(1277,11): error TS2739: (same, metric: "streak")
    ```
- `eslint.config.js` — flat config; its only ignore entry is `ignores: ["dist/*"]`.
  It does NOT ignore `.next/` (a stale tracked build-output dir at repo root),
  `web/` (the vanilla-JS PWA with its own conventions), `docs-site/`, `android/`,
  `ios/`, or `modules/`. As a result `npx eslint .` walks build artifacts and
  did not finish within 6 minutes when tested. Current content:
  ```js
  module.exports = defineConfig([
    expoConfig,
    eslintPluginPrettierRecommended,
    {
      ignores: ["dist/*"],
    },
    {
      files: ["**/__tests__/**/*.[jt]s?(x)", "**/?(*.)+(spec|test).[jt]s?(x)"],
      ...testingLibrary.configs["flat/react"],
    },
  ]);
  ```
- `.github/workflows/typecheck.yml` — the ONLY workflow. Runs `npm ci` then
  `npx tsc --noEmit` on `node-version: 18` (i.e. the crashing command).
- Repo conventions: TypeScript strict (tsconfig extends `expo/tsconfig.base`,
  `strict: true`, path alias `@/*`). Commit style is conventional commits, e.g.
  `fix(ui): wire up design tokens and remediate app-wide DS violations`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck (the fixed form) | `node --stack-size=8000 ./node_modules/typescript/lib/tsc.js --noEmit` | exit 0 after Step 2 |
| Lint (after Step 3) | `npm run lint` | completes in < 2 min |
| Web build (unaffected, sanity) | `cd web && npm run build` | exit 0, "build complete (prod)" |

## Scope

**In scope** (the only files you should modify):
- `package.json` (root — scripts block only)
- `store/useSettingsStore.ts` (only the 8 errors listed above)
- `eslint.config.js`
- `.github/workflows/typecheck.yml`
- `AGENTS.md` (create)

**Out of scope** (do NOT touch):
- `web/package.json` — the PWA has its own build; leave it alone.
- Any lint *errors* eslint reveals once it runs — scoping and speeding up lint
  is this plan; fixing its findings is not. Do not "fix a few while you're there".
- `tsconfig.json` — the crash is not a config problem; do not change compiler
  options to make errors disappear.
- Everything else.

## Git workflow

- Branch from the current working state (the repo has uncommitted in-progress
  work — do NOT stash, revert, or commit files outside this plan's scope).
- Commit message style: conventional commits, e.g.
  `fix(dx): working typecheck/lint scripts and green CI baseline`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add `typecheck` and `lint` scripts to root `package.json`

Add to the `scripts` block (keep existing entries unchanged):

```json
"typecheck": "node --stack-size=8000 ./node_modules/typescript/lib/tsc.js --noEmit",
"lint": "eslint . --cache"
```

**Verify**: `npm run typecheck` → runs to completion (no RangeError crash) and
exits 2 listing exactly the 8 `store/useSettingsStore.ts` errors above.

### Step 2: Fix the 8 type errors in `store/useSettingsStore.ts`

- Lines ~1133–1134: `demoShifts` / `demoExpenses` are declared without a type
  and assigned in some branches only. Give them explicit types matching what is
  pushed into them (open the surrounding function to see the row shapes — they
  are built for DB inserts; type them as the corresponding drizzle insert types
  or `Array<typeof shifts.$inferInsert>`-style types if the schema types are
  importable, otherwise as an explicit interface matching every property the
  code assigns).
- Line ~1199: annotate the `tx` transaction callback parameter. Match how other
  drizzle `db.transaction(async (tx) => ...)` callbacks in the repo type it —
  search `src/database/` for `transaction(async (tx` and copy that pattern; if
  none is explicitly typed, use the parameter type inferred by hovering/reading
  drizzle's `.transaction()` signature.
- Lines ~1257, 1267, 1277: three `Challenge` object literals are missing
  `nextResetDate` and `weekStartedAt`. Open the `Challenge` type definition
  (search the repo for `interface Challenge` / `type Challenge`), see how the
  other complete `Challenge` literals in this same file populate those two
  fields, and add them consistently (do not change the `Challenge` type itself).

Rules: fix ONLY these 8 errors, with real types — no `any`, no `@ts-ignore`,
no `as` casts unless an existing neighboring pattern already does exactly that.

**Verify**: `npm run typecheck` → exit 0, zero errors.

### Step 3: Scope eslint so `npm run lint` terminates quickly

In `eslint.config.js`, replace `ignores: ["dist/*"]` with:

```js
ignores: [
  "dist/**",
  ".next/**",
  "web/**",
  "docs-site/**",
  "android/**",
  "ios/**",
  "modules/**",
  ".expo/**",
],
```

(`web/` is a separate vanilla-JS app with its own conventions; `docs-site/` is
a separate Nextra app; the rest are native projects or build output.)

**Verify**: `npm run lint` → terminates in under ~2 minutes. A nonzero exit
with rule findings is ACCEPTABLE for this plan (record the count in your
report); an eslint *configuration* error is not.

### Step 4: Make CI run the working commands

Edit `.github/workflows/typecheck.yml`: replace the step
`- run: npx tsc --noEmit` with `- run: npm run typecheck`, and bump
`node-version: 18` to `node-version: 20`. Keep the rest of the workflow
unchanged.

**Verify**: `node -e "const y=require('fs').readFileSync('.github/workflows/typecheck.yml','utf8'); if(!y.includes('npm run typecheck')||y.includes('npx tsc')) process.exit(1)"` → exit 0.

### Step 5: Write `AGENTS.md` at the repo root

Create a concise (≤ 60 lines) `AGENTS.md` documenting, for future agents:

- Layout: root = Expo RN app (`app/` routes, `components/`, `src/services/`,
  `src/database/` drizzle + expo-sqlite, `store/` zustand); `web/` = separate
  vanilla-JS PWA sharing only the Drive backup/sync FILE FORMAT (code is
  duplicated by hand between `src/services/sync/*.ts` and
  `web/src/services/sync/*.js` — changes to sync logic must land on BOTH sides);
  `docs-site/` = docs.
- Verify commands: `npm run typecheck`, `npm run lint`, (`npm test` once Plan
  002 lands), `cd web && npm run build`.
- Invariants: the backup crypto envelope must stay byte-compatible across
  `src/services/cryptoHelper.native.ts`, `src/services/cryptoHelper.ts`, and
  `web/src/modules/backup/encryption.js`; sync merge is per-row LWW with
  strict-`>` (ties keep local, see `src/services/sync/mergeRules.ts`).
- Note that `npx tsc --noEmit` crashes by design of the flow graph — always use
  `npm run typecheck`.

**Verify**: file exists; `npm run typecheck` still exit 0.

## Test plan

No test runner exists yet (Plan 002 introduces one). Verification for this plan
is the command gates in each step.

## Done criteria

ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm run lint` terminates in < 2 min (findings allowed, config errors not)
- [ ] `.github/workflows/typecheck.yml` uses `npm run typecheck` on node 20
- [ ] `AGENTS.md` exists at repo root
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `node --stack-size=8000 ...` STILL crashes (the stack workaround no longer
  suffices) — report the new trace instead of raising the number blindly.
- `npm run typecheck` reveals errors beyond the 8 listed (the tree drifted).
  Fix only the listed 8; report the rest.
- Fixing an error seems to require changing the `Challenge` type, the drizzle
  schema, or any runtime behavior.
- eslint fails with a configuration/parse error after Step 3.

## Maintenance notes

- The `--stack-size=8000` workaround masks an underlying complexity smell:
  giant flow graphs from 1,900+-line screen files (see the findings index).
  If typecheck starts crashing again, the real fix is splitting those files.
- Reviewer should scrutinize: the types chosen for `demoShifts`/`demoExpenses`
  (must match what's actually inserted) and the values used for
  `nextResetDate`/`weekStartedAt` (must match the semantics of neighboring
  Challenge literals).
- Deferred: fixing lint findings; adding a `verify` umbrella script once
  Plan 002 adds `npm test`.
