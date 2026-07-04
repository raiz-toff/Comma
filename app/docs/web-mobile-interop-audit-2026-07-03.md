# Web ↔ Mobile Interop Audit — 2026-07-03

**Question audited:** are the mobile app (`commaApp`, React Native + Drizzle/SQLite) and the web PWA
(`web/`, nested repo, Dexie/IndexedDB) actually ready to sync with each other through the shared
Google Drive `appDataFolder`?

---

## ✅ FIX STATUS — applied 2026-07-03, same session (read this first)

All blocker/critical/high findings below were FIXED in code the same day. Design principle:
**mobile's schema is canonical; web rows carry BOTH key sets** (its own UI keys + the
mobile-canonical mirrors), and web's pull path normalizes/merges instead of blind-putting.

| # | Finding | Fix |
|---|---------|-----|
| 0 | OAuth project mismatch | Web now uses mobile's web client (`438513486290-hvsm…`) — `web/src/modules/backup/drive-auth.js`. **User console steps still required** (see below). |
| 1 | shifts `platformId` vs NOT NULL `platform` | Web writes both keys (`normalizeShiftInput`, p13 generator); web apply derives `platformId` from incoming `platform`. |
| 2 | Goals: different models | Web goal rows now also carry `label/targetValue/unit/period/isActive` (mapped: earnings↔currency, hours↔hours, distance↔mileage; other kinds pass through verbatim — both apps render unknown kinds gracefully, verified). Web apply derives `type/scope/target/active` from mobile rows. |
| 3 | Vehicles `nickname`/`active` vs `name`/`isActive` | Web writes both key sets (normalize + onboarding); apply derives web keys from mobile rows. |
| 4 | Merchant UNIQUE(name) wedge | BOTH apps' apply now identity-matches an id-unknown merchant by `normalizedName` (fallback exact name) and merges into the existing row, keeping the local id. Web's `upsertMerchant` also revives tombstoned merchants on reuse. |
| 5 | No poison-log quarantine | BOTH apps: per-log try/catch in `syncNow`, failure counts in sync KV (`sync_failed_logs`), pull skips a log after 3 failed applies; `failedLogs` added to `SyncResult`. Reset clears quarantine. |
| 6 | ISO-string timestamps break web | `web/src/services/sync/interopShape.js` `normalizeIncoming(...)`: coerces `startTime`/`endTime` → epoch-ms and `expenses`/`maintenanceLogs` `date` → local `YYYY-MM-DD` on apply. |
| 7 | Full-row `put()` wipes web-only fields | Web apply now MERGES incoming over the surviving local row and re-derives `date`/`platformId`/`nickname`/`active`/goal keys; mobile tombstones also derive web's `deletedAt`. Verified by 73/73 pure-logic tests (merge preserves `customFields`/`receiptData`/etc.). |
| 8 | shiftPlatforms hard-delete leak | Mobile `saveShiftWithPlatforms` now UPSERTS its deterministic `sp_{shiftId}_{i}` rows and SOFT-DELETES every other still-alive row for the shift (web uuid rows included) — removals now sync as tombstones. `deleteShiftPlatforms` (hard) removed. |
| 9 | Platforms misaligned / activation never propagates | Web platform writes mirror `label/isActive/sortPriority` (+`textColor`/`country` at seed) and STAMP `syncUpdatedAt` (they were unstamped — never pushed at all); apply derives `name/active/priority`. |
| — | Extras fixed along the way | Web read paths now filter `syncDeletedAt` tombstones on goals/vehicles/search (were unfiltered → mobile deletes stayed visible); web "Reset platform data" hard-deletes → tombstones (and its goals query used a non-indexed `where` that threw); Dexie logical migration **4→5** backfills mobile keys onto pre-fix rows, re-run after vault restores (`backfillMobileShapeKeys`). |
| — | First sync never carried HISTORICAL data | Rows from before the sync columns existed sit at `syncUpdatedAt = 0` and push only collects rows `> cursor` (0) — so pre-sync history NEVER pushed from either app. Fixed: mobile migration `drizzle/0021_first_sync_backfill.sql` + web's `backfillMobileShapeKeys` stamp 0/undefined → **1** (older than any real edit, can't win LWW) and rewind `sync_last_pushed_at` to 0, so each device's next push carries its full history once. |
| — | Web landing offered vault-restore, not sync-join | Landing button replaced with **"Already using Comma on your phone? Sync it here"** → `handleJoinSync()` (onboarding.js): connect Drive → same sync password → first full sync → adopts synced platform choices → marks onboarding complete. Detects wrong password (all pulled logs fail → undo + `resetLogFailures()` so a typo can't quarantine good logs) and the phone-hasn't-pushed-yet case. Whole-vault restore still available in Settings → Backup. |
| — | Fresh-device seeds could beat real data in LWW | Web's seed rows (platform catalog, default/scaffold goals) were stamped `Date.now()` — a brand-new browser joining sync would have OVERWRITTEN the phone's platform activation state. Seeds now stamp **0** (never push, can't win a merge; they start syncing when the user actually edits them), and both compaction snapshots exclude `syncUpdatedAt = 0` rows so per-device scaffolding can't leak via snapshots either. |
| — | Backup FILE story (added on request, 2026-07-03) | Two mechanisms now exist everywhere: Cloud Sync + a local backup file. **Web**: Settings → Data gained "Import backup file" (`backup/vault-import.js`) accepting current vault JSON, encrypted `.comdb` (password-prompted), AND **legacy pre-interop exports** (`schemaVersion ≤ 3`): cents→dollars for shift money + expense amounts (goals were already dollars — verified against goalHistory decimals), `HH:mm`+`durationMinutes` → epoch-ms via the normalizers, numeric ids re-minted with `shifts.vehicleId`/`expenses.shiftId`/`goalHistory.goalId` remapped, platforms/user merged; ends with the mobile-shape backfill + cursor rewind so imports flow to the phone. "Download backup file" already existed. **Mobile**: new `src/services/backupFile.ts` + a "Backup file" card on the Cloud Sync screen — "Download" (share sheet, `comma-backup-YYYYMMDD.json`, plain JSON like web's) and "Restore" (document picker → transactional replace via the extracted `applyBackupPayload` → sync identity RESET: fresh device id, cursors cleared, sync paused with an explicit "Turn sync on" prompt so the cloud can't silently overwrite a deliberate restore; auto-enable suppressed). Mobile file restore rejects web-format files with a pointer to import them on web. |

**Verification run:** mobile `npx tsc --noEmit` — zero errors in any touched file (the only errors
are the pre-existing gamification `Challenge` baseline in `store/useSettingsStore.ts`, untouched).
Web `node build.js --prod` — clean. 73/73 pure-logic tests on `interopShape.js` (scratchpad,
`interop-test.mjs`) covering timestamp coercion, merge-preservation, goal round-trips, derives.

**Still on the USER (cannot be done from this box):**
1. Google console: add the PWA's deployed origin(s) + `http://localhost:*` dev origin to the
   Authorized JavaScript Origins of web client `438513486290-hvsm…`; Drive API enabled + OAuth
   test user on project `438513486290` (mobile setup notes already cover these).
2. Existing web users' old backups live in the OLD project's appDataFolder — export a local
   `.json` vault backup before switching builds, then restore/re-push.
3. Run the live two-device test matrix (bottom of this doc + the poison cases in §"Recommended
   fix order" step 7).

**Known accepted gaps (unchanged, by design):** distance-unit semantics (web km vs mobile
raw-user-unit; profile prefs unsynced), `deliveryCount` blank on web for mobile-authored shifts,
web can't EDIT mobile-only goal kinds (`shifts` unit / `yearly` period — renders fine, edit is
rejected by web's validator), tax-model differences, `.comdb` payloads remain app-specific.

**Verdict: NOT ready.** The sync *protocol* layer (crypto, file formats, merge rules, cursors,
compaction) is genuinely aligned — verbatim ports, verified byte-level. But **(a) the two apps
point at different Google Cloud projects, so today they can't even see each other's files**, and
**(b) the record *shapes* are misaligned enough that, once they can see each other, several very
common actions permanently wedge sync or silently corrupt rows.** The claim in
`web-interop-mobile-followups.md` that mobile's 10 tables are "in the exact shape web now mirrors"
is true for some tables (shiftPlatforms, maintenanceLogs, taxHistory, vehicleTaxProfiles, most of
expenses/shifts money fields) but **false for goals, vehicles, platforms, and `shifts.platform`**.

Method: full read of both sync engines side-by-side (every file in
`src/services/sync/` ↔ `web/src/services/sync/`), both schemas, both Drive/auth/crypto layers,
plus verification against the *installed* `drizzle-orm` source for unknown-key behavior.
`npx tsc --noEmit` on mobile: no errors outside the pre-existing gamification baseline in
`store/useSettingsStore.ts`.

---

## Severity summary

| # | Severity | Gap | Effect |
|---|----------|-----|--------|
| 0 | 🚫 BLOCKER | Different Google Cloud projects (web `100816104558-…` vs mobile `438513486290-…`) | Apps write to two separate `appDataFolder`s — sync can never converge; fails silently |
| 1 | 🔴 CRITICAL | Web shift has `platformId`, mobile column `platform` is NOT NULL | Any web-created shift crashes mobile's apply → **sync permanently wedged** |
| 2 | 🔴 CRITICAL | Goals: entirely different field models | Any web-created goal crashes mobile's apply; mobile goals unusable on web |
| 3 | 🔴 CRITICAL | Vehicles: web `nickname`/`active` vs mobile `name` (NOT NULL)/`isActive` | Web-created vehicle crashes mobile; mobile vehicles nameless/inactive on web |
| 4 | 🔴 CRITICAL | `merchants.name` UNIQUE on **both** sides | Same merchant name created on 2 devices → constraint error on pull → wedge (both directions) |
| 5 | 🔴 HIGH | No poison-log quarantine | Any one bad row blocks that log **and all newer logs forever** (applied-set never advances) |
| 6 | 🟠 HIGH | Mobile pushes timestamp columns as ISO strings; web expects epoch-ms / `YYYY-MM-DD` | Mobile-authored shifts get NaN durations, broken sorts/grouping on web |
| 7 | 🟠 HIGH | Web apply uses full-row `put()` | Mobile edit winning LWW wipes all web-only fields — incl. `date` → row **vanishes from web's date-indexed views**; `receiptData` (receipt images) lost |
| 8 | 🟠 HIGH | shiftPlatforms replace: mobile hard-deletes, web soft-deletes | Mobile edits leak stale/duplicate platform-breakdown rows to web → double-counted earnings per platform |
| 9 | 🟠 MEDIUM | Platforms: web `name/active/priority/deactivatedAt` vs mobile `label/isActive/textColor/country/sortPriority…` | Activation state never propagates; a platform id unknown to mobile → poison insert |
| 10 | 🟡 MEDIUM | Distance units: web canonically km; mobile stores raw user-unit values; unit prefs (settings) not synced | Same number can mean km on web, miles on mobile |
| 11 | 🟡 MEDIUM | `deliveryCount`/`onlineMinutes`/`provinceId`/`isDeductible`/`hstPaid` model differences | Metrics differ across apps; no crashes |
| 12 | 🔵 LOW | `.comdb` whole-vault backups: same envelope, different payloads & filename families | Mutually non-restorable — acceptable (each ignores the other's), but never point one app's restore at the other's file |
| 13 | 🔵 LOW | Web stores backup password in plain `localStorage`; mobile uses SecureStore | Security posture note |

---

## What IS verified compatible ✅ (don't re-audit these)

- **Crypto envelope — byte-compatible.** Both produce/accept
  `{v:2, kdf:'PBKDF2', hash:'SHA-256', iter:210000, salt, iv, content, tag}` (hex), AES-256-GCM,
  16-byte salt, 12-byte IV, 16-byte tag split out. Mobile native
  (`src/services/cryptoHelper.native.ts`, react-native-quick-crypto) ↔ mobile web
  (`cryptoHelper.ts`) ↔ web PWA (`web/src/modules/backup/encryption.js`) all match. Same password
  → mutual decryption. Web's legacy `COMMA_VAULT`/`comma-key.json` scheme is fully replaced.
- **Change-log format identical.** `comma-cl-{deviceId}-{epochMs}.cmlog` /
  `comma-snap-{deviceId}-{epochMs}.cmsnap`; payload `{v:1, deviceId, createdAt, sinceCursor, rows}`;
  last-dash filename parsing; forward-compat guard on `v`. (`changeLog.ts` ↔ `changeLog.js` are
  verbatim ports.)
- **Merge rules identical.** Strict-`>` LWW on `syncUpdatedAt` (ties keep local);
  `FINANCIAL_TABLES = {expenses, taxHistory, shifts, shiftPlatforms}`; audit only when
  `localUpdatedAt > 0`; superseded row logged before overwrite (mobile `sync_overwrite_log` table /
  web `comma_sync_overwrite_log` localStorage, capped 500).
- **Cursor semantics identical.** Applied-SET of filenames (not a scalar watermark), own filename
  recorded on push, `lastPushedAt` advances to max pushed `syncUpdatedAt`, pull skips
  applied + authored-by-me, applies oldest→newest, records per-log after commit.
- **Compaction identical.** Threshold 30 delta logs; snapshot (`sinceCursor:0`, full state)
  uploaded FIRST; deletes only deltas in own applied-set + own older snapshots.
- **Device IDs identical.** `dev_` + 16 chars of the same 62-char dash-free alphabet on both sides;
  sync KV keys byte-identical (`comma_sync_device_id`, `comma_sync_applied_logs`, …).
- **Tombstones respected on reads, both sides.** Mobile filters `notDeleted(syncDeletedAt)`
  everywhere; web reads filter `r.syncDeletedAt == null` (web sets `deletedAt` too, but doesn't
  rely on it for sync-visibility).
- **Drive REST usage compatible.** Both: `spaces=appDataFolder` list, multipart upload with
  `parents:['appDataFolder']`, `?alt=media` download, DELETE tolerant of 404, scope
  `https://www.googleapis.com/auth/drive.appdata` only.
- **Money units match.** Real dollars (not cents) for grossRevenue/tipsRevenue/bonusAmount/amount
  on both sides; `bonusAmount` is a real top-level synced column on both (migration
  `drizzle/0020_shift_bonus_amount.sql` ↔ Dexie v7).
- **Unknown keys don't crash mobile.** Verified against installed
  `node_modules/drizzle-orm/sqlite-core/dialect.js`: both `buildInsertQuery` (line 346) and
  `buildUpdateSet` (line 65) iterate the **table's own columns**, so web-only keys are silently
  ignored. (They're dropped, though — see Gap 7.)
- **Triggers/schedules compatible.** Web: pull on tab-visible, push-if-due on hide, manual button,
  default `daily` schedule. Mobile: pull on foreground, push-if-due on background, manual, default
  `daily`. Same `schedule.js` logic both sides.
- **Sync runs serialized on both sides** (promise queue), no cross-device write races beyond LWW.

---

## 🚫 Gap 0 — The apps are on different Google Cloud projects (BLOCKER)

- Mobile: `src/config/google.ts` — web client `438513486290-hvsmc82435unb6t9gvmgddngk0p92g1m`,
  Android client `438513486290-7vh8ed7qnpradulqabtnaklajfk29c5k`, project **438513486290**.
- Web PWA: `web/src/modules/backup/drive-auth.js:11` —
  `100816104558-cig5m6sa8b455ru0iemvihl1c1bv84kq.apps.googleusercontent.com`, project
  **100816104558**, still tagged `// TODO: Replace with real Client ID`.

Drive's `appDataFolder` is **scoped per Google Cloud project**. Clients of one project cannot see
another project's app-data files, even for the same Google account. So as shipped: each app
happily pushes/pulls against its **own private folder**, reports success, and never sees the
other's data. No error will ever surface. Every other finding in this report is unreachable until
this is fixed.

**Fix:** point the web PWA at a Web-application OAuth client in project **438513486290** (the
existing `438513486290-hvsm…` client is already type "Web"; add the PWA's deployed origin(s) and
localhost to its Authorized JavaScript Origins) and keep scope `drive.appdata`. Console prereqs on
that project still apply: Drive API enabled, user added as OAuth test user.
**Migration caveat:** any existing web-user backups/sync files live in the OLD project's
appDataFolder and become unreachable after the switch — have web users export a local `.json`
vault backup first (Settings → Data) and re-push after switching.

---

## 🔴 Poison rows — web-authored rows that CRASH mobile's apply

Mobile applies each pulled log in **one transaction** (`applyChangeLog.ts:91`); a constraint
failure rolls the whole log back, the filename never enters the applied-set, and `syncNow` re-pulls
and re-fails on it **every sync, forever** (Gap 5). SQLite FKs are OFF by default (no
`PRAGMA foreign_keys` anywhere in mobile), so missing parents don't crash — the crash vectors are
**NOT NULL (no default) and UNIQUE** columns:

### 1. Shifts — `platform` vs `platformId`
- Mobile: `shifts.platform` **text NOT NULL, no default** (`schema.ts:50`).
- Web shift rows carry `platformId` and **no `platform` key** (`web/src/modules/shifts/shifts.js:367-401`).
- → Drizzle inserts `null` for `platform` → NOT NULL violation → **every log containing a
  web-created shift permanently poisons mobile sync.**
- Reverse direction: mobile shifts have no `platformId`, so on web they render with no platform
  (grouping/filter breakage), and `deliveryCount` is absent (web shows blank/0 deliveries).
- Note: web *edits* to an existing mobile shift do NOT crash (drizzle `update.set` ignores unknown
  keys and untouched columns keep their values) — only web-*created* shifts crash.

### 2. Goals — two different products
- Mobile: `label`, `targetValue`, `unit`, `period` all **NOT NULL, no default** (`schema.ts:108-117`).
- Web goal rows: `{id, type, scope, platformId, target, active, createdAt}` (`web/src/modules/goals/goals.js:457-467`).
- Zero overlap in required fields → web-created goal = **poison**; mobile goals arriving on web
  have none of `type/scope/target` and are invisible/broken in web's goal UI.

### 3. Vehicles — `name` vs `nickname`
- Mobile: `vehicles.name` **text NOT NULL, no default** (`schema.ts:23`); `isActive`.
- Web vehicle rows: `nickname`, `active` (+ ~14 web-only cost-model fields) (`web/src/modules/vehicles/vehicles.js:64-102`).
- Web-created vehicle → `name = null` → **poison**. Mobile vehicles on web: no `nickname` (blank
  label), no `active` → excluded by web's `active === true` filters (vehicle pickers, support
  stats) — effectively invisible.

### 4. Merchants — UNIQUE(name) on both sides
- Mobile: `merchants.name` `.unique()` (`schema.ts:169`); web store: `'id, &name, …'` (unique
  `&name`, `web/src/core/db.js`).
- Both apps auto-upsert merchants from expense entry with **locally-minted ids** (mobile
  `m_{Date.now()}…`, web `mer_{uuid}`). The same merchant name on two devices is the *normal
  case* ("Shell", "Costco"). On pull, the incoming row has a different id but the same name →
  UNIQUE violation → transaction abort → **wedge, in both directions.**
- Fix shape: on apply, match incoming merchants by `normalizedName` and merge into the existing
  row id (or drop the unique index and dedupe at read time). This needs code on **both** sides.

### 5. Platforms — misaligned + conditional poison
- Mobile: `label`, `color`, `textColor`, `country` NOT NULL (`schema.ts:134-146`); `isActive`,
  `hourlyRate`/`mileageRate` (text), `sortPriority`.
- Web platform rows: `name`, `color`, `active`, `priority`, `addedAt`, `deactivatedAt`
  (`web/src/modules/platforms/platforms.js:451-458`).
- Both use lowercase registry slugs as ids, so most rows collide on id and take the (safe) update
  path — but **`active`/`isActive` are different keys, so turning a platform on/off never
  propagates**, and any platform id that exists on web but not mobile (e.g. the customizable
  `other` flow, or catalog drift between the two apps' registries) → insert → `textColor`/`country`
  null → **poison**. Verify the two seed catalogs use identical slugs.

---

## 🔴 Gap 5 — No poison-log quarantine (amplifier)

Both `syncNow` implementations apply pulled logs sequentially and only `addAppliedLog(filename)`
after a successful commit. A log that always throws is re-downloaded, re-decrypted, re-fails —
and because the loop breaks, **every log after it is also never applied**. One bad row from
Gaps 1–4 = that device's pull pipeline is dead until manual intervention (there is no UI to skip
a file). Recommend: catch per-log apply errors, quarantine the filename (separate KV list) after
N consecutive failures, surface it in the sync UI, continue with newer logs — on both apps.

---

## 🟠 Gap 6 — Timestamp wire-format mismatch (mobile → web corruption)

Mobile's six Drizzle `{mode:'timestamp'}` columns surface as JS `Date`s and JSON-serialize to
**ISO strings** in pushed logs (this is by design — mobile's own pull revives them via
`reviveTimestamps`, `syncedTables.ts:56-77`):

| Table.field (wire) | Mobile pushes | Web stores/expects | Impact on web |
|---|---|---|---|
| `shifts.startTime/endTime` | ISO string | **epoch-ms number** ("Fix 1" — enforced across ~15 web files) | `endTime - startTime` → NaN durations; numeric sorts break; mobile shifts misrender |
| `expenses.date` | ISO string | `YYYY-MM-DD` string | exact-match grouping fails; range filters half-work by string accident; UTC-vs-local day drift |
| `maintenanceLogs.date` | ISO string | `YYYY-MM-DD` string | same class |
| `vehicles.createdAt`, `goals.createdAt` | ISO string | ISO string | ✅ compatible (coincidentally) |
| `taxHistory.changedAt` | ISO string | (dormant on web — no readers) | benign today |

Web's `applyChangeLog.js` does `table.put(incoming)` with **no normalization** — its header
comment even asserts incoming rows are "already in the right shape", which is only true for
web-authored rows. The reverse direction is fine: web pushes epoch-ms / `YYYY-MM-DD`, and mobile's
`reviveTimestamps` (`new Date(value)`) handles numbers and strings alike.

**Fix (one-sided, web):** add a `normalizeIncomingRow(table, row)` step in web's apply that
coerces `startTime`/`endTime` to epoch-ms (`new Date(v).getTime()` when string) and
`expenses.date`/`maintenanceLogs.date` to `YYYY-MM-DD` — plus re-derives web's own `date`
convenience field for shifts (see Gap 7). Alternatively canonicalize mobile's push to emit
epoch-ms — mobile's own revive already accepts numbers — but the web-side normalize is still
needed for date-string fields, so do it on web.

---

## 🟠 Gap 7 — Web's full-row `put()` wipes web-only fields on every lost LWW

Mobile rows only ever contain mobile's columns. When a mobile edit wins LWW over a web-authored
row, web's `applyChangeLog.js:122` does `table.put(incoming)` — **replacing** the stored object.
The web row loses: `date`, `platformId`, `provinceId`, `deliveryCount`, `onlineMinutes`,
`activeMinutes`, `weather`, `mood`, `isMultiApp`, `multiAppPlatformIds`, `customFields` (incl.
`peakPay`), `createdAt`, `updatedAt`, `deletedAt` — and on expenses additionally `customCategory`,
`receiptData` (**the receipt image itself**), `hstPaid`, `confirmedPaid`, `source`,
`recurringNextDate`.

Two consequences beyond plain data loss:
- **The row disappears from web's views**: Dexie indexes skip records missing the indexed key, so
  a shift/expense without `date` no longer appears in `where('date')`-driven lists — the row
  exists but looks deleted.
- Round-tripping doesn't restore anything (mobile never had those fields).

**Fix (web):** on `insert`, keep `put(incoming)`; on `overwrite`, merge instead —
`table.update(id, incoming)` or `put({...localRow, ...incoming})` — and re-derive
`date` (from the normalized `startTime`) and `platformId` (from incoming `platform`) when the
incoming row is mobile-shaped. Mobile needs no change here (drizzle `update.set` already preserves
columns absent from the incoming row).

---

## 🟠 Gap 8 — shiftPlatforms replace semantics leak duplicates to web

- Web replaces a shift's breakdown by **soft-deleting** old rows (tombstones,
  `web/src/modules/shifts/shifts.js:178-204`) and adding fresh `sp_{uuid}` rows → peers converge. ✅
- Mobile replaces by **hard delete + reinsert** with deterministic ids `sp_{shiftId}_{i}`
  (`src/database/queries/shifts.ts:296-299`; the followups doc's "it's a replace, not a delete"
  rationale predates having a second device).

Cross-device failure: edit a web-authored shift on mobile → mobile hard-deletes web's `sp_{uuid}`
rows locally (**no tombstones pushed**) and pushes its `sp_{shiftId}_{i}` rows → web still has its
own `sp_{uuid}` rows alive **plus** gains mobile's rows → **double-counted per-platform earnings
on web** (and the audit set includes `shiftPlatforms` — money). Shrinking the platform count on
mobile also strands the highest-index row on peers.

**Fix (mobile):** switch the saveShift replace to soft-delete + stamped reinsert (mirror web's
`syncShiftPlatformRows`), so tombstones propagate. Cheap: the helpers (`softDeletePatch`) already
exist in `syncedWrites.ts`.

---

## 🟡 Semantic divergences (no crash; numbers/UX drift)

- **Distance units.** Web stores mileage canonically in **km** (`activeMileage`/`deadMileage`,
  documented in `db.js`); mobile stores whatever the user entered, interpreted via the device's
  unsynced unit preference. A km-web + miles-mobile pairing silently misreads every synced value.
  Decide one canonical storage unit (km) + convert at the UI layer on mobile, or sync the
  unit preference (see next point).
- **Profile/settings don't sync — by design on both sides** (three-bucket model). But currency,
  region, distance unit, and active-platform choices materially change how synced *record* values
  are interpreted/displayed. The design doc's "per-key profile sync" (bucket b) is still
  unimplemented on both apps — worth prioritizing at least `distanceUnit` + `currency`.
- **Tax models.** Web: per-record `provinceId`, `hstPaid`, `confirmedPaid`; dormant
  `taxHistory`/`vehicleTaxProfiles` (schema exists, nothing writes). Mobile: global region +
  `taxHistory` records, `isDeductible` boolean web lacks. Tax reports will disagree across apps
  for the same data.
- **`deliveryCount`** exists only on web's shift row (mobile derives trips from
  `shiftPlatforms.tripsCount`). Mobile-authored shifts show no delivery count on web.
- **Web-only detail fields** (`weather`, `mood`, `onlineMinutes`, `activeMinutes`, `customFields`)
  simply don't exist on mobile — accepted, but combined with Gap 7 they're not just "absent on
  mobile", they're *destroyed on web* after a mobile edit.

---

## 🔵 Lower priority notes

- **`.comdb` whole-vault backups are incompatible across apps** — same encryption envelope but
  different plaintext payloads (mobile: `{version:2, app:'comma', createdAt, tables}` incl.
  `settings`; web: `{exportedAt, schemaVersion, tables, integrity:{sha256,rowCounts}}`) and
  different filename families (`comma-backup-*.comdb` vs `comma-vault*.comdb`). Each app's restore
  list only matches its own prefix, so they ignore each other — fine, just never try to
  cross-restore. Mobile's backup UI is dormant anyway (`backupToDrive` unreachable from
  `app/settings/backup.tsx`).
- **Web keeps the sync password in plain `localStorage`** (`comma_backup_password`,
  `backupPassword.js`) vs mobile's SecureStore. Anyone with the profile dir can read it. Consider
  at least documenting this; browsers offer no great alternative, but it's worth a conscious call.
- **Web silent re-auth**: GIS token client with in-memory tokens; `ensureAccessToken` does a
  silent `requestAccessToken({prompt:''})` — may fail in browsers blocking third-party
  cookies/popups without a user gesture; auto-sync then silently no-ops. Watch during live testing.
- Mobile `googleDrive.ts` duplicates `TIMESTAMP_FIELDS`/`reviveTimestamps` from `syncedTables.ts`
  — fold to one copy so Gap 6 fixes can't half-land.
- Typecheck/build: mobile `npx tsc --noEmit` clean. Web is plain JS (esbuild bundle, no
  typecheck); build result noted separately in the session summary.

---

## Recommended fix order

1. **Gap 0 — unify the Google Cloud project** (console work + one constant in
   `web/src/modules/backup/drive-auth.js`). Nothing is testable end-to-end before this.
2. **Schema alignment for the four broken tables** — treat mobile's shape as canonical (it's the
   stricter store):
   - web shifts: write `platform` (slug) alongside/instead of `platformId`;
   - web goals: adopt `label/targetValue/unit/period/isActive` (migrate existing rows);
   - web vehicles: `nickname→name`, `active→isActive` (keep web-only cost fields as extras);
   - platforms: align `label/isActive` keys + verify both seed catalogs share slugs.
3. **Web apply hardening (Gaps 6+7 together, one file):** normalize incoming timestamp/date
   fields + merge-don't-replace on overwrite + re-derive `date`/`platformId`.
4. **Merchant dedupe-by-normalizedName on apply, both sides (Gap 4).**
5. **Mobile shiftPlatforms soft-delete (Gap 8).**
6. **Poison-log quarantine on both sides (Gap 5)** — makes any residual mismatch survivable
   instead of fatal.
7. Then run the live two-device matrix from `web-interop-mobile-followups.md`, **plus** these
   poison cases: web-created shift/goal/vehicle → mobile; same-name merchant both sides;
   platform toggle both directions; mobile edit of a web shift (check web keeps `date`,
   `receiptData`, breakdown not double-counted); >30 logs compaction with both device kinds.
8. Longer-term: per-key profile sync for `distanceUnit`/`currency`; unify tax semantics.
