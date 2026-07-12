# Plan 006: Remove dead code (axios, test script, .next/) and fix the expo-web profile key mismatch

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat fffd401..HEAD -- package.json src/services/sync/profileBridge.ts test_analytics.ts .gitignore`
> Written against commit `fffd401` **plus uncommitted working-tree changes**.
> On any excerpt mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-fix-verification-baseline.md
- **Category**: tech-debt + bug
- **Planned at**: commit `fffd401` (+ uncommitted changes), 2026-07-12

## Why this matters

Four small, verified pieces of rot: (1) `axios` is declared as a dependency
but imported nowhere — it ships dead weight and invites a second HTTP
convention; (2) `test_analytics.ts` is a throwaway root-level script that
imports the real DB client and `process.exit`s — an accidental execution
hazard and noise; (3) `.next/` is a stale Next.js build-output directory that
is TRACKED in git (11 files) in a repo with no root `next` dependency; (4) a
one-line localStorage key mismatch silently breaks profile sync in both
directions on the Expo-web build target: the profile bridge reads/writes
`comma_profile_sync` while the sync engine (push/apply/compaction) uses the
`comma_${tableName}` convention = `comma_profile`, so profile edits never
upload and cloud profiles never apply on that target.

## Current state

- `package.json` — `"axios": "^1.13.2"` in dependencies. Verified zero
  imports: `grep -rn "axios" src app components hooks utils store providers modules --include=*.ts --include=*.tsx` → no matches. Drive/API calls use `fetch`.
- `test_analytics.ts` (repo root) — throwaway script importing
  `./src/database/client`, runs one query, logs, `process.exit(0)`. Verified
  referenced by nothing (grep across ts/tsx/js/json excluding node_modules).
- `.next/` (repo root) — stale build output; `git ls-files | grep "^.next/"`
  → 11 tracked files; `git check-ignore .next` → NOT ignored. Root
  `package.json` has no `next` dependency (the Nextra docs app lives separately
  in `docs-site/`).
- `src/services/sync/profileBridge.ts` — the key mismatch (two sites):
  - line ~90 in `readProfileRows()`:
    ```ts
    if (isWeb) {
      const raw = localStorage.getItem("comma_profile_sync");
      return raw ? JSON.parse(raw) : [];
    }
    ```
  - line ~131 in `exportLocalProfile()`:
    ```ts
    if (isWeb) localStorage.setItem("comma_profile_sync", JSON.stringify(rows));
    ```
  The engine's convention (what these MUST match): `src/services/sync/pushChanges.ts:58`
  reads `localStorage.getItem(`comma_${name}`)` where `name` is the synced
  table name (`profile` → `comma_profile`); `src/services/sync/applyChangeLog.ts`
  and `compaction.ts` use the same `comma_${name}` convention.
  NOTE: this `isWeb` branch is the Expo-web target of the MOBILE app
  (`Platform.OS === "web"`), not the standalone PWA in `web/` (which has its
  own separate profileBridge.js and is NOT affected).
- Commit style: conventional commits (e.g. `chore: ...`, `fix(sync): ...`).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Remove dep | `npm uninstall axios` | exit 0; package.json + lockfile updated |
| Typecheck | `npm run typecheck` | exit 0 |
| Tests (if Plan 002 landed) | `npm test` | all pass |
| Web build (sanity) | `cd web && npm run build` | exit 0 |

## Scope

**In scope**:
- `package.json` + `package-lock.json` (axios removal only)
- `test_analytics.ts` (delete)
- `.next/` (delete + gitignore entry)
- `.gitignore` (add `.next/`)
- `src/services/sync/profileBridge.ts` (the two key-string sites only)

**Out of scope** (do NOT touch):
- Stripping the `Platform.OS === "web"` / `isWeb` branches from
  `src/services/sync/*` entirely — whether to kill the Expo-web target is an
  OPEN PRODUCT DECISION (see plans/README.md "Decisions needed"); this plan
  only fixes the key so the code that exists is correct.
- `docs-site/` (its own Next-based build is separate and alive).
- Any other dependency, any other root-level file.

## Git workflow

- Branch from the current working state; suggested commits:
  `chore: remove unused axios dep, stale test script and .next build output`
  and `fix(sync): align expo-web profile storage key with engine convention`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Remove axios

Re-verify it's unused (exact command from Current state), then
`npm uninstall axios`.

**Verify**: `grep -c '"axios"' package.json` → 0; `npm run typecheck` → exit 0.

### Step 2: Delete `test_analytics.ts`

**Verify**: file absent; `npm run typecheck` → exit 0 (nothing referenced it).

### Step 3: Remove `.next/` and ignore it

`git rm -r --cached .next && rm -rf .next`, then add `.next/` to `.gitignore`.

**Verify**: `git ls-files | grep -c "^.next/"` → 0; `git check-ignore .next` →
prints `.next` (exit 0) after you `mkdir -p .next` to test, then `rmdir .next`.

### Step 4: Fix the profile key mismatch

In `src/services/sync/profileBridge.ts`, change BOTH occurrences of the string
`"comma_profile_sync"` to `"comma_profile"` (sites excerpted above). Nothing
else in the file.

**Verify**: `grep -c "comma_profile_sync" src/services/sync/profileBridge.ts`
→ 0; `grep -c '"comma_profile"' src/services/sync/profileBridge.ts` → 2;
`npm run typecheck` → exit 0.

### Step 5: Full gate

**Verify**: `npm run typecheck` → exit 0; `npm test` → pass (if the script
exists); `cd web && npm run build` → exit 0.

## Test plan

No new tests: Step 4 is a constant fix on a target with no test harness
(Expo-web), and Steps 1–3 are deletions. The greps in each step are the gates.

## Done criteria

ALL must hold:

- [ ] `axios` absent from `package.json` and `package-lock.json`
- [ ] `test_analytics.ts` deleted
- [ ] `.next/` untracked, deleted, and gitignored
- [ ] `profileBridge.ts` uses `comma_profile` at both former `comma_profile_sync` sites
- [ ] `npm run typecheck` exits 0; `cd web && npm run build` exits 0
- [ ] Only in-scope files modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The axios grep finds ANY import (including a dynamic `import("axios")` or a
  require) — do not uninstall; report where.
- `test_analytics.ts` has grown references since this plan was written.
- `profileBridge.ts` no longer contains exactly two `comma_profile_sync`
  occurrences.
- Anything under `.next/` looks hand-written rather than build output (spot-
  check 2–3 files before deleting; expected: generated JS/manifests).

## Maintenance notes

- Existing Expo-web users (if any) will have orphaned rows under the old
  `comma_profile_sync` localStorage key; they are simply re-exported under the
  correct key on the next sync. No migration is warranted for a dev-only target.
- The bigger question — deleting the Expo-web `isWeb` branches from all of
  `src/services/sync/` (a third, near-dead storage backend) — is logged as a
  decision item in `plans/README.md`. If the owner confirms the PWA fully
  supersedes Expo-web, that strip is a follow-up plan and also removes the
  code this plan just fixed (that's fine; correctness now is still worth one
  line).
- Reviewer: confirm `package-lock.json` diff contains only axios-related removals.
