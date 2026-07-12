# Plan 004: Stop misclassifying corrupt files as "needs password", and surface silent plaintext downgrades

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat fffd401..HEAD -- src/services/cryptoHelper.native.ts src/services/cryptoHelper.ts web/src/modules/backup/encryption.js src/services/cryptoEnvelope.ts web/src/modules/backup/cryptoEnvelope.js src/services/sync/pullChanges.ts web/src/services/sync/pullChanges.js`
> Written against commit `fffd401` **plus uncommitted working-tree changes**
> (the envelope files are new/modified uncommitted work). On any excerpt
> mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (touches backup decryption on three platforms — the tests from
  Plan 002 are the guardrail)
- **Depends on**: plans/002-characterization-tests.md
- **Category**: bug + security
- **Planned at**: commit `fffd401` (+ uncommitted changes), 2026-07-12

## Why this matters

Sync supports two envelope modes (a decided product design, see
`app/docs/sync-ux-simplification.md`): plain (`enc:"none"`, the no-password
default) and E2E-encrypted (password-derived key). Two implementation flaws:

1. **Corrupt files masquerade as "needs password" (bug).** `decryptBackup`
   throws `PassphraseError` for ANY body that isn't a plain envelope when no
   password is configured — including corrupt/truncated garbage. For the
   majority no-password user, a corrupt Drive file is therefore never
   quarantined (pull deliberately never quarantines `PassphraseError`s), gets
   re-downloaded every sync forever, and the UI perpetually asks for an
   "encryption password" the user never set. The quarantine safety valve is
   defeated exactly where it's needed.
2. **Silent plaintext downgrade (security).** A device in E2E mode still
   accepts and applies `enc:"none"` files with no signal to the user. Mode
   coexistence is deliberate (documented in `src/services/cryptoEnvelope.ts`'s
   header — plain and encrypted files legitimately coexist during a mode
   switch), so plain files must still be READ — but accepting them silently
   means anyone able to write to the Drive folder can strip encryption without
   the user ever knowing. The fix is to count and surface, not to reject.

## Current state

Three byte-compatible copies of `decryptBackup` exist and must stay in lockstep:

- `src/services/cryptoHelper.native.ts:69-88` (native, react-native-quick-crypto)
- `src/services/cryptoHelper.ts` (expo-web, WebCrypto — same structure)
- `web/src/modules/backup/encryption.js:118-135` (PWA, WebCrypto — same structure)

All three share this exact flawed sequence (native copy shown; the other two
are line-for-line the same logic):

```ts
export async function decryptBackup(envelopeJson: string, passphrase: string): Promise<string> {
  // A plain (unencrypted) envelope reads back with no password at all.
  const plain = readPlainEnvelope(envelopeJson);
  if (plain != null) return plain;

  // From here the file IS encrypted. Missing password → PassphraseError (prompt), never a
  // generic failure (which the caller would quarantine, hiding a good backup forever).
  if (!passphrase) {
    throw new PassphraseError("This backup is encrypted. Enter your encryption password to continue.");
  }

  let env: BackupEnvelope;
  try {
    env = JSON.parse(envelopeJson) as BackupEnvelope;
  } catch {
    throw new Error("This file isn't a valid Comma backup.");
  }
  if (!env || env.v !== 2 || !env.salt || !env.iv || !env.content || !env.tag) {
    throw new Error("Unrecognized backup format.");
  }
  ...
```

The flaw: the `if (!passphrase) throw PassphraseError` runs BEFORE the JSON
parse + shape validation, so garbage reaches the PassphraseError branch
whenever no password is set. (Note: envelopes written before the plain format
existed carry no `enc` field but DO have `salt/iv/tag` — they are valid
encrypted envelopes and must keep decrypting.)

- Envelope helpers: `src/services/cryptoEnvelope.ts` (TS) and
  `web/src/modules/backup/cryptoEnvelope.js` (JS mirror) — `readPlainEnvelope`
  returns content string or null, `PassphraseError` has
  `code === "PASSPHRASE_REQUIRED"`.
- Pull-side handling (identical on both platforms):
  `src/services/sync/pullChanges.ts:108-124` and
  `web/src/services/sync/pullChanges.js:72-88` — per-file try/catch; a
  `PassphraseError` sets `needsPassphrase = true` and skips quarantine; any
  other error pushes the filename to `failed` (which `syncNow` routes into the
  quarantine counter, `recordLogFailure`).
- Both `pullChanges` implementations return `{ logs, needsPassphrase, failed }`,
  consumed by `src/services/sync/syncNow.ts` / `web/src/services/sync/syncNow.js`.
- Plan 002's suites (`tests/unit/cryptoEnvelope.test.ts`,
  `tests/unit/cryptoRoundTrip.test.ts`) pin today's behavior — this plan
  updates the corrupt-input assertions as part of the change.
- The stored password is read via `getBackupPassword()`-style helpers:
  mobile `src/services/backupPassword.ts` (SecureStore), web
  `web/src/services/sync/backupPassword.js` (localStorage). "The stored
  password IS the mode": non-empty stored password === E2E mode.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Tests | `npm test` | all pass |
| Typecheck | `npm run typecheck` | exit 0 |
| Web build | `cd web && npm run build` | exit 0 |

## Scope

**In scope**:
- `src/services/cryptoHelper.native.ts`
- `src/services/cryptoHelper.ts`
- `web/src/modules/backup/encryption.js`
- `src/services/sync/pullChanges.ts`
- `web/src/services/sync/pullChanges.js`
- `src/services/sync/syncNow.ts`, `web/src/services/sync/syncNow.js`
  (only: thread the new `plainFiles` counter through the result)
- `tests/unit/cryptoEnvelope.test.ts`, `tests/unit/cryptoRoundTrip.test.ts`
  (update corrupt-input assertions; add downgrade-counter tests if feasible)

**Out of scope** (do NOT touch):
- The envelope FORMAT itself (`cryptoEnvelope.ts` / `cryptoEnvelope.js`) — no
  wire-format change of any kind; old files must keep decrypting bit-for-bit.
- Rejecting plain envelopes in E2E mode — coexistence is by design; this plan
  surfaces, never blocks.
- UI screens (`app/settings/backup.tsx`, `web/src/modules/backup/backup-ui.js`)
  — wiring the counter into visible UI copy is a follow-up; this plan stops at
  the sync result object (log a `console.warn` where the counter is nonzero).
- `applyChangeLog`, merge logic, quarantine thresholds.

## Git workflow

- Branch from the current working state; conventional commit, e.g.
  `fix(sync): classify corrupt envelopes correctly; count plaintext files pulled in E2E mode`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Reorder `decryptBackup` in all three copies — validate before PassphraseError

In each of `cryptoHelper.native.ts`, `cryptoHelper.ts`, `encryption.js`, change
`decryptBackup` to:

1. `readPlainEnvelope` → return content (unchanged).
2. Parse `envelopeJson` as JSON; on failure → generic
   `Error("This file isn't a valid Comma backup.")`.
3. Validate the encrypted shape (`v === 2 && salt && iv && content && tag`);
   on failure → generic `Error("Unrecognized backup format.")`.
4. ONLY THEN: `if (!passphrase) throw new PassphraseError(...)`.
5. Derive key + decrypt (unchanged, including wrong-password → PassphraseError).

Keep the three copies line-for-line equivalent (same messages), as they are today.

**Verify**: `npm test` → the Plan 002 corrupt-input assertions now FAIL
(expected — they pinned the old behavior). Update them in this step:
garbage/`"{}"` input with empty password now rejects with a NON-Passphrase
`Error` (`isPassphraseError(e) === false`); a valid encrypted envelope with
empty password still rejects with `isPassphraseError(e) === true`; a legacy
envelope fixture WITHOUT `enc` but WITH salt/iv/tag still decrypts. Then
`npm test` → all pass; `npm run typecheck` → exit 0; `cd web && npm run build`
→ exit 0.

### Step 2: Count plain-envelope files pulled while a password is configured

In both `pullChanges.ts` and `pullChanges.js`: the decode loop already has the
`passphrase` parameter. Detect a plain file cheaply: after a successful
`decodeChangeLog`, call `readPlainEnvelope(envelope)` (import from the
platform's cryptoEnvelope module) — non-null means the file was plain. When
`passphrase` is non-empty (E2E mode) and the file was plain, increment a new
counter. Extend the return value to `{ logs, needsPassphrase, failed, plainFiles }`
(`plainFiles` = that counter; 0 when no password configured).

**Verify**: `npm run typecheck` → exit 0; `cd web && npm run build` → exit 0.

### Step 3: Thread the counter to the sync result and warn

In `syncNow.ts` and `syncNow.js`: capture `pulled.plainFiles`, include it in
the returned `SyncResult` (add the field to the result typedef/type), and when
`> 0` emit `console.warn("[sync] N unencrypted file(s) were applied while E2E encryption is on")`.
Do not change any control flow.

**Verify**: `npm run typecheck` → exit 0; `cd web && npm run build` → exit 0;
`grep -n "plainFiles" src/services/sync/syncNow.ts web/src/services/sync/syncNow.js src/services/sync/pullChanges.ts web/src/services/sync/pullChanges.js` → present in all four.

### Step 4: Full gate

**Verify**: `npm test` → all pass. `npm run typecheck` → exit 0.
`cd web && npm run build` → exit 0.

## Test plan

- Updated in `tests/unit/cryptoRoundTrip.test.ts` (both web-crypto impls):
  - corrupt JSON + empty password → generic Error, `isPassphraseError` false
  - `"{}"` (parses, wrong shape) + empty password → generic Error
  - valid encrypted envelope + empty password → PassphraseError (unchanged)
  - valid encrypted envelope + wrong password → PassphraseError (unchanged)
  - legacy no-`enc`-field encrypted fixture still decrypts (add the fixture if
    Plan 002 didn't)
- The `plainFiles` counter is exercised at the pullChanges level only if the
  module can be imported without native deps; otherwise document it as
  manually-verified via the Step 3 grep + a code-read, and note that in the report.

## Done criteria

ALL must hold:

- [ ] In all three `decryptBackup` copies, JSON-parse + shape-validation precede the empty-password check
- [ ] Garbage input with no password no longer raises `PassphraseError` (test-asserted)
- [ ] Encrypted-envelope-without-password and wrong-password still raise `PassphraseError` (test-asserted)
- [ ] Legacy envelope (no `enc` field, has salt/iv/tag) still decrypts (test-asserted)
- [ ] `pullChanges` (both platforms) returns `plainFiles`; `syncNow` (both) exposes it and warns when nonzero
- [ ] `npm test`, `npm run typecheck`, `cd web && npm run build` all exit 0
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 002's suites are not present/green before you start (dependency not met).
- The three `decryptBackup` copies are NOT currently line-for-line equivalent
  in logic (they've drifted — reconcile is a different task).
- You find yourself wanting to change the envelope JSON format, the PBKDF2
  parameters, or `readPlainEnvelope`'s grammar.
- The cross-impl round-trip tests fail after your change in ONE impl only
  (you've introduced drift — fix to lockstep or stop).

## Maintenance notes

- The decided sync-engine rewrite (`app/docs/sync-simplification-2026-07-12.md`)
  keeps the envelope layer verbatim — this fix carries over.
- Follow-up (deliberately deferred): show `plainFiles > 0` in the Backup
  settings UI on both platforms ("N unencrypted files were synced — re-push to
  encrypt them"), and the existing mode-switch full-re-push already converges
  the folder to one mode over time.
- Reviewer should scrutinize: that the reordering did not change ANY behavior
  for valid encrypted envelopes (the fixture + round-trip tests are the proof),
  and that the three copies remain identical in logic.
