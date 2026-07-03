# Mobile follow-ups from the web interop project

Context: the `comma` web PWA (sibling repo, `/home/coder/Production/comma`) was just rewritten to
interoperate with this app — schema aligned field-for-field to `src/database/schema.ts`, the same
sync protocol (push/pull/merge/compaction against the shared Drive `appDataFolder`) ported over,
and the two apps' dashboards/analytics widgets reconciled. **Mobile itself was not modified**
except for the additive changes listed under "Already done on mobile" below — this doc is the
punch-list of what's left, now that mobile has a real sync peer.

## Resolved

### `bonus` now has a real home on both apps ✅
Was the one data-loss risk this doc originally led with — web's bonus amount had nowhere to sync
to, since mobile's `shifts` table had no matching column. Fixed on both sides:
- **Mobile**: `bonusAmount` (real, dollars, default 0) added to `shifts` in `src/database/schema.ts`
  via a real `drizzle-kit`-generated migration (`drizzle/0020_shift_bonus_amount.sql`), wired through
  every earnings total across the app — shift entry/edit, detail/list views, Home + Analytics
  dashboards, reports, tax, gamification/badge XP — same first-class treatment as tips.
- **Web**: migrated off the interim `shift.customFields.bonusAmount` workaround onto a matching
  top-level `bonusAmount` field, across ~20 files (shifts core logic, badges, reports, metrics,
  sync docs).

Both apps now push/pull `bonusAmount` as an ordinary synced column — no translation layer, no data
loss, matching the "field-for-field identical, zero-translation sync" principle the rest of this
project is built on.

### `outOfPocket` widget added to mobile's Analytics tab ✅
Reused the already-correct `getFinancialMonthlyBreakdown` query (no new data-fetching logic needed)
and built `OutOfPocketWidget.tsx` matching the existing stats-widget visual convention. Wired into
`WIDGET_META`/`analytics.tsx` the same way the other stats-category widgets are. Along the way, a
pre-existing, unrelated bug surfaced: `getFinancialOverviewForRange` claims to return `outOfPocket`
in its empty-state placeholder but never actually computes it in the real return path — not fixed
(a different function was used instead), just worth a look if that specific function's output is
ever consumed expecting a real `outOfPocket` value.

## Verify before trusting sync in production

None of the following are code changes — they're checks that couldn't be run in the sandbox this
work was built in (no live Google OAuth credentials available).

### Live two-device sync round trip
Run both apps against the same real Google account / Drive `appDataFolder` and confirm:
- Create a shift on mobile → web pulls it correctly (field shapes, multi-platform breakdown if
  used, route/odometer data if present, bonus amount included).
- Create/edit a shift on web → mobile pulls it correctly.
- Delete on one device → the tombstone propagates and the other device removes it.
- Two conflicting edits to the same row → last-write-wins resolves the way you expect, and the
  financial-overwrite audit log actually fires for `shifts`/`expenses`/`taxHistory`/`shiftPlatforms`.
- Push >30 pending change-logs on one device → compaction triggers and old logs get cleaned up
  without data loss.

### Row ID format compatibility
Web's synced-table primary keys are now client-generated UUID v4 strings (`src/core/id.js`,
`crypto.randomUUID()`-based). Confirm this doesn't collide with whatever generation scheme
`commaApp`'s own insert code actually uses for `shifts.id`/`expenses.id`/etc. (wasn't directly
re-verified against mobile's query layer during this build — different ID *formats* between the
two apps is fine for uniqueness, just worth a quick read to be sure nothing downstream assumes a
specific ID shape/length).

### Fresh `tsc --noEmit` + full build pass
Each mobile change in this project (widget porting, bonus field, outOfPocket widget) was
typechecked in isolation right after landing, each showing zero *new* errors against its own
baseline. Worth one more full `npx tsc --noEmit` + build pass now that everything's sitting
together in the repo's current state, just to be safe.

## Already done on mobile (no action needed)

- **`streak` widget** wired into the analytics picker — `StreakWidget.tsx` already existed but
  wasn't reachable from `WIDGET_META`; now it is (category `perf`).
- **12 new widget components + 2 new query functions**, bringing mobile's Analytics tab to parity
  with web's: `ScatterWidget`, `WeekCompareWidget`, `HoursCompareWidget`, `StabilityScoreWidget`,
  `RecentShiftsWidget`, `ScheduleWidget`, `EffectiveRateWidget`, `DeliveriesWidget`,
  `PerDeliveryWidget`, `TipsTotalWidget`, `MonthOrdersWidget`, `MonthHourlyWidget` (plus the
  already-existing `RollingTrendWidget`, now wired in too). Added `getEarningsVsHoursScatter` and
  `getIncomeStabilityScore` to `src/database/queries/analytics.ts`.
- **`outOfPocket` widget** — see "Resolved" above.
- **`bonusAmount` field** — see "Resolved" above.

## Nice-to-have parity (optional, low priority)

### `ScheduleWidget.tsx` is currently a static empty state
It was built to mirror web's schedule *widget*, which itself only reads a thin browser-local
sketch feature with no real backing table — so the mobile widget was left as a "no upcoming
shifts" placeholder rather than inventing new plumbing. But mobile already has its own real,
separate scheduling feature (`app/schedule/index.tsx`) that this widget never got pointed at.
Worth revisiting — wire `ScheduleWidget` to mobile's actual schedule data instead of leaving it a
permanent stub.

### Notification system unification — explicitly deferred, not started
Mobile's `notify.ts` stays purely reactive (event-acknowledgment only — backup/restore/export/
import results). Web had a 25-rule proactive detector engine (cross-platform-arbitrage alerts,
idle-day warnings, HST threshold nudges, etc.) that got **disabled and left dormant** on the web
side rather than backported here — porting 25 rule files across mobile's SQLite/Drizzle query
layer was judged too large to fold into this pass. Building one unified notification system for
both apps is real, scoped future work, not started at all yet. Web's `notifications` table and all
25 rule files are preserved as reference material for whenever this gets picked up.

## Confirmed not needed — don't waste time re-checking these

- **No schema/table changes beyond `bonusAmount`.** Mobile already has all 10 tables web was built
  to match (`vehicles, platforms, merchants, goals, taxHistory, shifts, maintenanceLogs, expenses,
  shiftPlatforms, vehicleTaxProfiles`), in the exact shape web now mirrors.
- **No sync-engine changes on mobile.** Mobile's push/pull/merge/compaction protocol
  (`src/services/sync/*`) is the reference web was ported *against* — it doesn't need to change to
  accommodate a second client.
- **No tax-data changes on mobile.** Mobile's per-state/province tax data was already more
  complete than web's (web backfilled real values FROM mobile, not the reverse).
- **Mobile's sync schedule stays daily-auto.** Web's sync triggers were redesigned to drop
  per-data-change pushes (now: open/close checks + manual "Sync now" only) — mobile never had that
  per-change behavior to begin with, so its existing daily-auto-push default was confirmed fine
  as-is, no change needed.
- **State/province tax granularity, web's deeper widget count, web's notification rule count** —
  all explicitly decided to stay web-side enhancements for now, not something mobile needs to
  catch up on as part of this work.
