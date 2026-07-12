# Plan 003: Escape DB-fed HTML sinks in the PWA and add security headers

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat fffd401..HEAD -- web/src/modules/notifications/notifications-ui.js web/src/views/reports-view.js web/vercel.json`
> This plan was written against commit `fffd401` plus uncommitted working-tree
> changes. If the "Current state" excerpts don't match the live code, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW (escaping) / MED (CSP — mitigated by starting in Report-Only)
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `fffd401` (+ uncommitted changes), 2026-07-12

## Why this matters

The PWA renders database strings into `innerHTML` without escaping. The
database is populated by **restored backups and cloud sync** — files pulled
from Google Drive — so a tampered or crafted backup file is untrusted input
that flows straight into HTML. A notification row whose `title`/`message`
contains markup executes script in the PWA origin, which can read the backup
password and any tokens in `localStorage` and exfiltrate all earnings data.
There is also no Content-Security-Policy or any hardening header on the
deployment, so nothing backstops an injection. Fixing the two known sinks and
adding headers is small, mechanical, and independent of every other plan.

## Current state

- `web/src/modules/notifications/notifications-ui.js:227-244` — the confirmed
  sink. Inside the notification-card render loop:
  ```js
  card.innerHTML = `
    ...
    <h4 style="...">
      ${item.title}
      ...
    </h4>
    <span style="...">${dateStr}</span>
    ...
    <p style="...">
      ${item.message}
    </p>
    ...`;
  ```
  `item` comes from the `notifications` Dexie table, which restore writes
  wholesale (`web/src/modules/backup/vault-serializer.js` `bulkPut`s every
  table from the backup file). This module has NO escape helper.
- `web/src/views/reports-view.js:64-66` — an SVG "year in review" template
  interpolates `${yir.title}` and `${yir.generatedAt}` into markup without
  escaping. This file HAS its own `escapeHtml` at `reports-view.js` — check
  around line 45 of `web/src/views/shifts-view.js` for the sibling pattern;
  reports-view may or may not define one (search the file first).
- The repo convention for escaping: several modules define a small local
  helper, e.g. `web/src/modules/shifts/shift-form.js:22`:
  ```js
  function escapeHtml(v) { ... }
  ```
  and `web/src/ui/components.js:35`, `web/src/core/shell.js:62`. Match this
  convention: a local `escapeHtml` per module (there is no shared util module
  for it — do NOT create one in this plan; consolidation is a separate cleanup).
- `web/vercel.json` — the complete current content:
  ```json
  {
    "buildCommand": "npm run build",
    "outputDirectory": "dist"
  }
  ```
  No `headers` block. `web/public/index.html` loads external resources from:
  `https://fonts.googleapis.com` (stylesheet), `https://fonts.gstatic.com`
  (font files). Google Drive auth uses the Google Identity Services script and
  OAuth popups (`https://accounts.google.com`), and Drive API calls go to
  `https://www.googleapis.com` / `https://oauth2.googleapis.com` (verify by
  grepping `web/src/modules/backup/drive-auth.js` for URLs in Step 3). The app
  uses inline `style="..."` attributes pervasively, and `theme-init.js` is an
  external same-origin script.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Web build | `cd web && npm run build` | exit 0, "build complete (prod)" |
| Local preview | `cd web && npm run preview` | serves `dist/` on :3000 |
| Sink sweep | `grep -rn "innerHTML" web/src --include=*.js \| wc -l` | count for the report |

## Scope

**In scope**:
- `web/src/modules/notifications/notifications-ui.js`
- `web/src/views/reports-view.js`
- `web/vercel.json`

**Out of scope** (do NOT touch):
- The other `innerHTML` sites across `web/src` — Step 4 INVENTORIES them for
  the report; fixing all of them is follow-up work, not this plan.
- Consolidating the five duplicate `escapeHtml` helpers into one module.
- `web/public/index.html` — no meta-tag CSP; headers belong in `vercel.json`.
- Anything under root `src/` (the mobile app has no HTML sinks).

## Git workflow

- Branch from the current working state; conventional commit, e.g.
  `fix(web): escape DB-fed HTML sinks; add CSP + hardening headers`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Escape the notifications sink

In `web/src/modules/notifications/notifications-ui.js`: add a local helper
matching the repo convention (copy the body from
`web/src/modules/shifts/shift-form.js:22`'s `escapeHtml`), then in the card
template wrap the two DB-fed interpolations: `${escapeHtml(item.title)}` and
`${escapeHtml(item.message)}`. `dateStr` is derived from `new Date(...)
.toLocaleDateString` — leave it. Do not restructure the template.

**Verify**: `cd web && npm run build` → exit 0. Then
`grep -n 'escapeHtml(item.title)\|escapeHtml(item.message)' web/src/modules/notifications/notifications-ui.js`
→ both lines found.

### Step 2: Escape the reports SVG sink

In `web/src/views/reports-view.js`, escape `${yir.title}` and
`${yir.generatedAt}` in the SVG template (same local-helper convention; reuse
the file's existing helper if it already defines one — search `escapeHtml` in
the file first). XML/SVG needs the same 5 entities (`& < > " '`).

**Verify**: `cd web && npm run build` → exit 0;
`grep -cn 'escapeHtml(yir' web/src/views/reports-view.js` → ≥ 2.

### Step 3: Add security headers in `web/vercel.json` (CSP in Report-Only first)

Before writing the policy, collect the real external origins:
`grep -rEn "https://[a-z0-9.-]+" web/src/modules/backup/drive-auth.js web/public/index.html | grep -oE "https://[a-z0-9.-]+" | sort -u`
Adjust the `connect-src`/`script-src` lists below to exactly that set (the
list below is the expected result — trust the grep over the plan if they differ,
and note the difference in your report).

Replace `web/vercel.json` with:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy-Report-Only",
          "value": "default-src 'self'; script-src 'self' https://accounts.google.com; connect-src 'self' https://www.googleapis.com https://oauth2.googleapis.com https://accounts.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; frame-src https://accounts.google.com; object-src 'none'; base-uri 'self'"
        },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "X-Frame-Options", "value": "DENY" }
      ]
    }
  ]
}
```

Notes: `'unsafe-inline'` in `style-src` is required by the app's pervasive
inline `style=""` attributes — do not remove it. The CSP is deliberately
**Report-Only**: it cannot break auth/fonts while the allowlist is validated
in production. Flipping to enforcing (`Content-Security-Policy`) is a
follow-up once devtools show no violations during a real Drive connect+sync.

**Verify**: `node -e "JSON.parse(require('fs').readFileSync('web/vercel.json','utf8'))"` → exit 0;
`cd web && npm run build` → exit 0.

### Step 4: Inventory the remaining unescaped DB-fed sinks (report only)

Run `grep -rn "innerHTML\|insertAdjacentHTML" web/src --include=*.js` and, for
each hit, note in your final report whether the interpolated values are
(a) static/i18n strings — fine, (b) DB/user-fed and already escaped — fine, or
(c) DB/user-fed and UNESCAPED — list these as follow-up candidates. Do not fix
them in this plan.

**Verify**: the categorized list appears in your final report.

## Test plan

No JS unit tests for DOM rendering exist (and this plan adds none — the sink
fix is grep-verifiable). Manual gate: `cd web && npm run preview`, open
http://localhost:3000, open the notifications panel and reports view — both
render normally (titles/messages display as text).

## Done criteria

ALL must hold:

- [ ] `cd web && npm run build` exits 0
- [ ] `item.title` / `item.message` / `yir.title` / `yir.generatedAt` interpolations are wrapped in `escapeHtml(...)`
- [ ] `web/vercel.json` parses as JSON and contains the four headers, with CSP as Report-Only
- [ ] Sink inventory (Step 4) present in the final report
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The notifications template at `notifications-ui.js:227` doesn't match the
  excerpt (file drifted).
- The Step 3 origin-grep reveals external origins this plan's CSP doesn't
  cover AND you cannot tell which directive they belong to.
- The preview smoke check shows the notifications panel or reports view
  rendering escaped entities (e.g. `&amp;`) where formatting used to be —
  that means some `title`/`message` legitimately carries HTML and the fix
  needs a product decision.

## Maintenance notes

- After a production deploy, watch devtools console for CSP Report-Only
  violations during: app load, Google Drive connect, sync, font rendering.
  When clean, rename the header key to `Content-Security-Policy` (one-line
  follow-up).
- The five duplicated local `escapeHtml` helpers should eventually merge into
  one exported util; new code should import rather than re-define.
- Related unplanned finding: restored backups are `bulkPut` into Dexie with no
  schema validation (see plans/README.md "SEC-03") — escaping at render is the
  first line, validation at import is the deferred second.
