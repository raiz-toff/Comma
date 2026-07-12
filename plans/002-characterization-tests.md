# Plan 002: Characterization tests for merge rules, crypto envelope, and tax presets

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat fffd401..HEAD -- src/services/sync/mergeRules.ts src/services/cryptoEnvelope.ts src/services/cryptoHelper.ts web/src/services/sync/mergeRules.js web/src/modules/backup/encryption.js package.json`
> This plan was written against commit `fffd401` **plus uncommitted working-tree
> changes** (`src/services/cryptoEnvelope.ts` is a new uncommitted file). If the
> "Current state" excerpts below don't match the live code, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (tests only — no production code changes)
- **Depends on**: plans/001-fix-verification-baseline.md
- **Category**: tests
- **Planned at**: commit `fffd401` (+ uncommitted changes), 2026-07-12

## Why this matters

The three most dangerous surfaces in this app have zero automated coverage:
(1) LWW merge decisions that can silently drop a money edit, (2) the backup
encryption envelope — lose round-trip compatibility and every user backup
becomes unreadable, and (3) tax-withholding presets. Worse, the sync/crypto
logic exists **twice** (mobile TypeScript + web JavaScript, required to stay
byte-compatible) with nothing detecting drift. A decided rewrite of the sync
engine is coming (see `app/docs/sync-simplification-2026-07-12.md`); its §1
explicitly keeps `decideMerge` and the crypto envelope **verbatim**, so these
tests survive the rewrite and are the safety net for it.

## Current state

All target modules are pure / native-free (verified):

- `src/services/sync/mergeRules.ts` — pure functions, no imports. Exports
  `FINANCIAL_TABLES` (Set of `"expenses","taxHistory","shifts","shiftPlatforms"`),
  `decideMerge(opts)` and `shouldAuditOverwrite(opts)`:
  ```ts
  export function decideMerge(opts: { localExists: boolean; localUpdatedAt: number; incomingUpdatedAt: number; }): MergeDecision {
    if (!opts.localExists) return "insert";
    if (opts.incomingUpdatedAt > opts.localUpdatedAt) return "overwrite";
    return "skip";
  }
  ```
  Strict `>`: ties keep local. `shouldAuditOverwrite` is true only for
  `decision === "overwrite" && FINANCIAL_TABLES.has(tableName) && localUpdatedAt > 0`.
- `web/src/services/sync/mergeRules.js` — the hand-maintained JS mirror of the
  same functions (plain ESM, importable by a Node test runner).
- `src/services/cryptoEnvelope.ts` — pure, zero imports. Exports `PLAIN_ENC`
  (`"none"`), `buildPlainEnvelope(plaintext)` → `{"v":2,"enc":"none","content":...}`,
  `readPlainEnvelope(json)` → content string or `null` (never throws),
  `PassphraseError` (has `.code === "PASSPHRASE_REQUIRED"`), `isPassphraseError(e)`.
- `src/services/cryptoHelper.ts` — the web-crypto implementation
  (`globalThis.crypto.subtle`, PBKDF2-SHA256 210k iterations, AES-256-GCM,
  16-byte salt, 12-byte IV, hex fields, GCM tag split into `tag`). Node ≥ 18
  provides `globalThis.crypto`, so this runs under a Node test runner.
  `decryptBackup(envelopeJson, passphrase)`: returns plain-envelope content
  first; if the file is encrypted and `passphrase` is falsy → throws
  `PassphraseError`; wrong password → GCM failure also mapped to `PassphraseError`.
- `web/src/modules/backup/encryption.js` — the PWA's byte-compatible mirror of
  the same envelope (same PBKDF2/AES-GCM parameters, same JSON shape).
- `src/registry/countries/tax/index.ts` + `src/registry/countries/index.ts` —
  pure preset tables: `getWithholdingPresetPct(...)`, `getCountryDef(...)`,
  `resolveProvinceDef(...)`, with a `?? CA` fallback. No native imports
  anywhere under the tax registry.
- `src/services/cryptoHelper.native.ts` uses `react-native-quick-crypto` and
  canNOT run under Node — it is exercised only indirectly (its format must
  match the two web-crypto copies; the fixture test below pins the format).
- No test runner is installed. Root `package.json` has no `test` script.
  `eslint.config.js` already has a files-glob for `**/*.test.*` (testing-library
  plugin), so the naming convention `*.test.ts` is expected.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install dev dep | `npm install --save-dev vitest` | exit 0 |
| Run tests | `npm test` (added in Step 1) | all tests pass |
| Typecheck | `npm run typecheck` | exit 0 |

## Scope

**In scope**:
- `package.json` (add `vitest` devDependency + `"test": "vitest run"` script)
- `vitest.config.ts` (create)
- `tests/unit/mergeRules.test.ts` (create)
- `tests/unit/cryptoEnvelope.test.ts` (create)
- `tests/unit/cryptoRoundTrip.test.ts` (create)
- `tests/unit/taxPresets.test.ts` (create)
- `tests/fixtures/` (create — pinned envelope fixtures)

**Out of scope** (do NOT touch):
- ANY production source file. If a test reveals a bug, the test documents the
  CURRENT behavior with a comment `// BUG? see plans/README.md` and you report
  it — characterization tests pin what IS, they don't fix.
- `src/services/cryptoHelper.native.ts` — native-only, can't run in Node.
- jest / jest-expo — deliberately not introduced here (component/DB tests are a
  future plan).

## Git workflow

- Branch from the current working state; conventional commit, e.g.
  `test: characterization suite for merge rules, crypto envelope, tax presets`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Install vitest and wire the script

`npm install --save-dev vitest`, then add to root `package.json` scripts:
`"test": "vitest run"`. Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["tests/unit/**/*.test.ts"] },
});
```

**Verify**: `npx vitest run` → "no test files found" exits (or 0 tests); no
config errors.

### Step 2: `tests/unit/mergeRules.test.ts` — pin LWW semantics on BOTH implementations

Import BOTH `src/services/sync/mergeRules.ts` and
`web/src/services/sync/mergeRules.js` (vitest handles both; for the `.js` ESM
import use a relative path). Run the SAME table of cases against each and also
assert the two implementations agree case-by-case:

- `localExists: false` → `"insert"` (regardless of timestamps).
- incoming newer (`incomingUpdatedAt 100 > localUpdatedAt 50`) → `"overwrite"`.
- local newer → `"skip"`.
- **exact tie (100 vs 100) → `"skip"`** — this is the load-bearing strict-`>`;
  comment it.
- `shouldAuditOverwrite`: true only for overwrite + financial table
  (`"expenses"`, `"shifts"`, `"taxHistory"`, `"shiftPlatforms"`) + `localUpdatedAt > 0`;
  false for `"merchants"` (non-financial), false for decision `"skip"`, false
  for `localUpdatedAt === 0`.
- `FINANCIAL_TABLES` (TS) and the web mirror contain the identical member set.

**Verify**: `npm test` → all pass.

### Step 3: `tests/unit/cryptoEnvelope.test.ts` — pin the plain-envelope grammar

Against `src/services/cryptoEnvelope.ts`:

- `readPlainEnvelope(buildPlainEnvelope("hello"))` → `"hello"` (round-trip,
  including a payload containing unicode + quotes).
- `buildPlainEnvelope` output parses as exactly `{v: 2, enc: "none", content}`.
- `readPlainEnvelope` returns `null` for: non-JSON garbage, `"{}"`, a v2
  ENCRYPTED envelope JSON (has `salt/iv/tag`, no `enc`), and
  `{"enc":"none","content":42}` (content not a string). It must never throw.
- `isPassphraseError(new PassphraseError("x"))` → true;
  `isPassphraseError(new Error("x"))` → false; `isPassphraseError(null)` → false.

**Verify**: `npm test` → all pass.

### Step 4: `tests/unit/cryptoRoundTrip.test.ts` — pin the encrypted envelope across both web-crypto copies

Import `encryptBackup`/`decryptBackup` from BOTH `src/services/cryptoHelper.ts`
and `web/src/modules/backup/encryption.js`:

- Round-trip within each impl: `decryptBackup(await encryptBackup(payload, "pw"), "pw")` → payload.
- **Cross-impl both directions**: encrypt with the TS helper, decrypt with the
  web JS helper, and vice versa → payload. (This is the drift alarm for the
  hand-mirrored copies.)
- `encryptBackup(payload, "")` → output is a PLAIN envelope
  (`JSON.parse(out).enc === "none"`), and decrypts with any/no password.
- Encrypted envelope + empty password → rejects with an error where
  `isPassphraseError(e)` is true.
- Encrypted envelope + WRONG password → rejects with `isPassphraseError(e)` true.
- Envelope JSON shape is pinned: keys `v:2, kdf:"PBKDF2", hash:"SHA-256",
  iter, salt, iv, content, tag`, all of salt/iv/content/tag hex strings, iv 24
  hex chars (12 bytes), salt 32 hex chars (16 bytes), tag 32 hex chars.
- **Fixture**: commit `tests/fixtures/envelope-v2.json` — generate ONCE in the
  test setup if absent (encrypt a fixed payload with a fixed password), then
  assert both impls decrypt the committed fixture forever after. This pins
  today's format against future accidental changes; the native impl must keep
  decrypting this same fixture on-device (note it in the fixture's README line).
- PBKDF2 at 210k iterations is slow — keep payloads tiny and the number of
  encrypt calls minimal (share ciphertexts between assertions via
  `beforeAll`). If the suite exceeds ~60s, reduce encrypt calls, not coverage.

**Verify**: `npm test` → all pass.

### Step 5: `tests/unit/taxPresets.test.ts` — pin withholding presets

Read `src/registry/countries/tax/index.ts` first to learn the exact API and
the preset table contents, then pin:

- `getWithholdingPresetPct` returns the documented value for at least: one CA
  province, one US state (if present in the table), and the country-level
  defaults.
- The fallback path (unknown country/region) resolves to the CA default
  (the `?? CA` fallback) — pin the actual current value.
- `getCountryDef` / `resolveProvinceDef` return defined objects for known
  codes and the documented fallback for unknown codes.

Assert against the values you READ in the table, not values you assume.

**Verify**: `npm test` → all pass; `npm run typecheck` → exit 0.

## Test plan

This plan IS the test plan. Expected final state: 4 new test files, ~40+
assertions, `npm test` green in well under 2 minutes.

## Done criteria

ALL must hold:

- [ ] `npm test` exits 0; suites for mergeRules, cryptoEnvelope, cryptoRoundTrip, taxPresets all present and passing
- [ ] Cross-impl encrypt/decrypt (TS↔web JS) tested in both directions
- [ ] A committed fixture `tests/fixtures/envelope-v2.json` is decrypted by both impls in the suite
- [ ] The tie-keeps-local case (equal timestamps → "skip") is asserted on both mergeRules impls
- [ ] `npm run typecheck` exits 0
- [ ] No production source file modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any excerpt in "Current state" doesn't match the live code.
- The TS and web-JS implementations genuinely DISAGREE on any test case
  (e.g. cross-impl decrypt fails, or a merge case differs) — that is a real
  cross-platform drift bug; report it with the failing case, do not "fix" either side.
- `web/src/modules/backup/encryption.js` or `web/.../mergeRules.js` cannot be
  imported by vitest (module-format issue) after one reasonable config attempt.
- Importing any target module pulls in `react-native`/`expo-*` (means the
  module isn't as pure as documented — report, don't mock).

## Maintenance notes

- These tests are the contract for the planned sync-engine rewrite
  (`app/docs/sync-simplification-2026-07-12.md` keeps `decideMerge` and the
  envelope verbatim) — they must stay green through it.
- Plan 004 (envelope mode integrity) will CHANGE `decryptBackup`'s error
  behavior for corrupt files; it will update the relevant assertions here —
  reviewers should expect exactly that diff and nothing else in these suites.
- Future: jest-expo for DB-touching modules (`applyChangeLog`, tax queries) —
  deliberately out of scope here.
