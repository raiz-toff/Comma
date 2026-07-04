/**
 * COMMA IndexedDB layer (Dexie). Single source of truth: export `db`.
 * Database: COMMAVault · Dexie schema v1 (+ v2 hook pattern for future IDB upgrades).
 */

import Dexie from '../libs/dexie.min.js';
import { BadgeRegistry } from '../registry/badges/index.js';
import { PlatformRegistry } from '../registry/platforms/index.js';
import { newId } from './id.js';
import {
  mobileGoalKeys,
  mobileVehicleKeys,
  mobilePlatformKeys,
  mobileShiftKeys,
} from '../services/sync/interopShape.js';

/** Logical data schema version (appState.schema_version). Non-destructive migrations only. */
export const CURRENT_LOGICAL_SCHEMA_VERSION = 5;

const DB_NAME = 'COMMAVault';

/** IndexedDB object store definitions — plan v3 F4 (Dexie v3+). */
const STORES_V3 = {
  users: 'id',
  platforms: '&id, active',
  shifts: '++id, date, platformId, vehicleId, provinceId, deletedAt',
  expenses: '++id, date, category, platformId, provinceId, deletedAt',
  vehicles: '++id, active',
  vehicleMaintenanceLogs: '++id, vehicleId, date',
  vehicleOdometerLog: '++id, vehicleId, date',
  fuelPrices: '++id, vehicleId, date',
  goals: '++id, scope, active',
  goalHistory: '++id, goalId, periodStart',
  badges: '&id',
  xpLog: '++id, createdAt',
  challenges: '&id, active',
  notifications: '&id, read, dismissed, createdAt',
  backupLog: '++id, createdAt',
  appState: '&key, updatedAt',
};

/**
 * IndexedDB object store definitions — Dexie v5 (schema-alignment pass, interop plan Workstream 1).
 *
 * Web's local schema is rewritten to be field-for-field identical to mobile's Drizzle schema
 * (`commaApp/src/database/schema.ts`) for the 10 tables mobile syncs, so a later workstream can
 * port mobile's push/pull/merge sync engine against this shape with zero translation layer.
 * See `commaApp/src/database/schema.ts` for the authoritative field list/types this mirrors.
 *
 * Sync columns (mirrors mobile's `syncColumns` spread exactly, just as plain numbers —
 * no Drizzle machinery needed on web):
 *   - syncUpdatedAt: number (epoch ms) — last LOCAL mutation, default 0. The LWW clock a future
 *     sync engine will diff against. Populated defensively by this workstream (bumped on every
 *     create/update of a synced row) even though nothing reads it yet.
 *   - syncDeletedAt: number (epoch ms) | null — tombstone timestamp, mirrors mobile's soft-delete.
 *     NOT wired into web's existing `deletedAt`/`softDelete()` convention in this pass (that stays
 *     as-is for current app behavior) — syncDeletedAt is bumped in parallel wherever a synced row
 *     is soft-deleted so the column is meaningful once sync lands.
 *
 * These two columns are added to all 10 synced tables: vehicles, platforms, merchants, goals,
 * taxHistory, shifts, maintenanceLogs (vehicleMaintenanceLogs), expenses, shiftPlatforms,
 * vehicleTaxProfiles. `locationPoints` is intentionally EXCLUDED (mobile keeps it unsynced too —
 * local-only GPS scratch data for route storage, see schema.ts comment on `syncColumns`).
 *
 * Field-shape notes (deltas from STORES_V3 / prior web shape — see call-site modules for the
 * normalize/read logic that actually produces these shapes):
 *
 * shifts: money fields are now real dollars (not cents) — `grossRevenue`/`tipsRevenue` replace
 *   `grossEarnings`/`tips`/`bonusEarnings` (as of Dexie v7, mobile also has a real top-level
 *   `bonusAmount` column — real/float dollars, default 0 — so web's `bonusAmount` mirrors it
 *   directly rather than folding into `customFields`; see shifts.js).
 *   `durationSeconds`/`pausedSeconds` replace `durationMinutes`. `activeMileage`/`deadMileage`
 *   replace `distanceKm`/`deadMilesKm`. New: `startOdometer`, `endOdometer`, `distanceSource`,
 *   `reconciliationStatus`, `routePath`, `vehicleId` (already existed), plus `syncUpdatedAt`/
 *   `syncDeletedAt`. `platformId` (mobile: `platform`) is KEPT as the single/primary-platform
 *   field for backward-compat + display (mobile also keeps a single required `platform` text
 *   field on shifts); real multi-platform breakdowns live in the new `shiftPlatforms` table.
 *   `deliveryCount` is likewise kept as a backward-compat display aggregate (mobile has no
 *   shift-level trip count either — only `shiftPlatforms.tripsCount` per platform).
 *   Web-only fields with no mobile equivalent (`date`, `startTime`/`endTime` as HH:mm strings,
 *   `onlineMinutes`/`activeMinutes`, `weather`, `mood`, `isMultiApp`, `multiAppPlatformIds`,
 *   `customFields`) are DELIBERATELY left in place — mobile's `startTime`/`endTime` are full
 *   timestamps (a materially different concept from web's date+HH:mm split), and restructuring
 *   that was out of scope for this pass (not called out in the plan's field-rename list, and
 *   touches far more of the app than shifts.js/shift-form.js). Flagged for a follow-up decision.
 *
 * expenses: adds `merchant`/`merchantNormalized`/`receiptUri` and renames web's `businessPct` to
 *   mobile's `deductiblePct` (0–100; actual deductible = amount * deductiblePct / 100 — same
 *   semantics web already had under the old name). `amount`/`hstPaid` are now real dollars (not
 *   cents), matching mobile's `amount: real`. `receiptData` (base64 data URL, web's actual local
 *   storage mechanism — mobile uses a real filesystem URI which web has no equivalent for) is
 *   KEPT alongside the new `receiptUri` (populated with the same data URL for schema parity).
 *
 * vehicles: adds `fuelType`, `licensePlate`, `currentOdometer` (mobile also has `make`/`model`/
 *   `year`, which web already had). Web's `nickname`/`active` field names are left as-is (mobile:
 *   `name`/`isActive`) — the plan only asked to ADD the missing fields, not rename existing ones.
 *
 * vehicleMaintenanceLogs (mobile: `maintenanceLogs`): `serviceType`→`type`, `odometerKm`→
 *   `odometer`, matching mobile exactly (small, contained rename — vehicles.js is its only caller).
 *
 * platforms / goals: sync columns added only. Existing field shapes are NOT realigned to mobile's
 *   (mobile platforms: label/textColor/country/hourlyRate/mileageRate/sortPriority/logoEmoji;
 *   mobile goals: label/targetValue/unit/period vs web's type/scope/platformId/target) — the plan
 *   gave no concrete rename instructions for these two tables and restructuring them would ripple
 *   into the platform switcher, settings platform manager, and goal creation UI untouched by this
 *   pass. Flagged as an open follow-up, not done here.
 *
 * New tables (mobile shape verbatim, see schema.ts):
 *   shiftPlatforms: shiftId, platform, platformOnlineSeconds, platformActiveSeconds, grossRevenue,
 *     tipsRevenue, tripsCount, + sync columns.
 *   vehicleTaxProfiles: vehicleId, taxYear, country, deductionMethod, standardRatePrimary,
 *     standardRateSecondary, rateThreshold, beginningYearOdometer, endingYearOdometer, + sync.
 *   merchants: name (unique), normalizedName, + sync columns.
 *   taxHistory: oldRegion, oldRate, newRegion, newRate, changedAt, + sync columns.
 *   locationPoints (UNSYNCED, local-only): sessionId, shiftId, latitude, longitude, altitude,
 *     accuracy, speed, timestamp, source, isFiltered. Populated by a later workstream (route
 *     storage); the table exists now so that workstream has schema to write against.
 *
 * Primary keys: web keeps its own native id convention (Dexie `++id` auto-increment / natural
 * string ids for catalog tables) rather than switching to mobile's globally-unique text uuids.
 * The plan's field-rename instructions never called out primary-key type, and reconciling id
 * *values* across two independently-numbered devices is fundamentally a sync-protocol concern
 * (Workstream 3 will need some id-generation/mapping story regardless of what web's local PK
 * looks like today) — not a local schema-shape concern. Flagged as an open question for
 * Workstream 3 to resolve, not decided here.
 */
const STORES_V4 = {
  users: 'id',
  platforms: '&id, active, syncUpdatedAt',
  shifts: '++id, date, platformId, vehicleId, provinceId, deletedAt, syncUpdatedAt, syncDeletedAt',
  expenses: '++id, date, category, platformId, provinceId, deletedAt, syncUpdatedAt, syncDeletedAt',
  vehicles: '++id, active, syncUpdatedAt',
  vehicleMaintenanceLogs: '++id, vehicleId, date, syncUpdatedAt',
  vehicleOdometerLog: '++id, vehicleId, date',
  fuelPrices: '++id, vehicleId, date',
  goals: '++id, scope, active, syncUpdatedAt',
  goalHistory: '++id, goalId, periodStart',
  badges: '&id',
  xpLog: '++id, createdAt',
  challenges: '&id, active',
  notifications: '&id, read, dismissed, createdAt',
  backupLog: '++id, createdAt',
  appState: '&key, updatedAt',
  taxHistory: '++id, changedAt, syncUpdatedAt, syncDeletedAt',
  shiftPlatforms: '++id, shiftId, platform, syncUpdatedAt, syncDeletedAt',
  vehicleTaxProfiles: '++id, vehicleId, taxYear, syncUpdatedAt, syncDeletedAt',
  merchants: '++id, &name, normalizedName, syncUpdatedAt, syncDeletedAt',
  locationPoints: '++id, sessionId, shiftId, timestamp',
};

/**
 * IndexedDB object store definitions — Dexie v6 (interop plan Workstream 3 prerequisite fixes,
 * applied BEFORE the sync engine itself as flagged by the schema-alignment pass):
 *
 * Fix 1 — shift date/time representation: `shifts.startTime`/`shifts.endTime` are no longer
 *   HH:mm-of-day strings paired with a separate `date` string — they are now real epoch-ms
 *   timestamps (mobile parity: `commaApp/src/database/schema.ts` has them as
 *   `integer({mode:'timestamp'})`, i.e. a genuine instant, not a time-of-day). A synced `shifts`
 *   row is otherwise meaningless to mobile (it has no `date`/HH:mm concept at all). `date`
 *   (YYYY-MM-DD) is KEPT as a derived, auto-maintained convenience column — every write path
 *   that sets `startTime` also (re)derives `date` from it — so the large surface of existing
 *   code that queries/sorts/displays by `date` (store.js's weekly-earnings query, goals.js,
 *   notifications, tax.js, search.js, reports.js, the schedule module, widgets, etc.) keeps
 *   working unchanged; `date` is simply not sent anywhere mobile would choke on it (mobile's
 *   Drizzle insert is column-driven — see applyChangeLog.js finding — so an extra `date` key on
 *   a pushed row is silently ignored there, exactly like `customFields`).
 *
 * Fix 2 — primary keys: the 10 synced tables switch from Dexie auto-increment (`++id`, a
 *   per-browser-instance counter) to a client-generated STRING id (`id`, see `core/id.js`).
 *   Auto-increment is dangerous under multi-device sync: two independent browser instances could
 *   each mint `shift.id: 1` for a genuinely different shift, and the Drive merge engine (keyed by
 *   `id`) would treat them as the same row, silently clobbering one. `platforms` already used a
 *   client-set string id (catalog ids like `'uber'`) and is unaffected — its schema string is
 *   unchanged. `locationPoints` (unsynced local GPS scratch) is also unaffected.
 *
 * No `.upgrade()` data transform is written for this version bump — same "no real users yet, so
 * the shape simply changes and old local dev data is left inert" policy the v5 bump documented.
 */
const STORES_V5 = {
  ...STORES_V4,
  shifts: 'id, date, platformId, vehicleId, provinceId, deletedAt, syncUpdatedAt, syncDeletedAt',
  expenses: 'id, date, category, platformId, provinceId, deletedAt, syncUpdatedAt, syncDeletedAt',
  vehicles: 'id, active, syncUpdatedAt',
  vehicleMaintenanceLogs: 'id, vehicleId, date, syncUpdatedAt',
  goals: 'id, scope, active, syncUpdatedAt',
  taxHistory: 'id, changedAt, syncUpdatedAt, syncDeletedAt',
  shiftPlatforms: 'id, shiftId, platform, syncUpdatedAt, syncDeletedAt',
  vehicleTaxProfiles: 'id, vehicleId, taxYear, syncUpdatedAt, syncDeletedAt',
  merchants: 'id, &name, normalizedName, syncUpdatedAt, syncDeletedAt',
};

const STORES_V1 = {
  users: 'id',
  platforms: '&id, active',
  shifts: '++id, date, platformId, vehicleId, zoneTag, deletedAt',
  expenses: '++id, date, category, platformId, deletedAt',
  vehicles: '++id, active',
  vehicleMaintenanceLogs: '++id, vehicleId, date',
  fuelPrices: '++id, vehicleId, date',
  goals: '++id, scope, active',
  goalHistory: '++id, goalId, periodStart',
  badges: '&id',
  xpLog: '++id, createdAt',
  challenges: '&id, active',
  notifications: '&id, read, createdAt',
  backupLog: '++id, createdAt',
  appState: '&key, updatedAt',
};

const SOFT_DELETE_TABLES = new Set(['shifts', 'expenses']);

function nowIso() {
  return new Date().toISOString();
}

export const DEFAULT_USER = {
  id: 1,
  displayName: '',
  avatarType: 'initials',
  avatarData: null,
  countryId: 'CA',
  provinceId: 'ON',
  platforms: [],
  primaryPlatform: null,
  locale: {
    country: 'CA',
    currency: 'CAD',
    currencySymbol: '$',
    distanceUnit: 'km',
    dateFormat: 'YYYY-MM-DD',
    weekStartDay: 1,
    timeFormat: '12h',
  },
  vehicleDefaults: {},
  /** Stored as integer cents (plan v3). */
  weeklyGoal: 0,
  monthlyGoal: 0,
  annualGoal: 0,
  taxWithholdingPct: 29,
  hstRegistered: false,
  workSchedule: 'sidehustle',
  notificationPrefs: {},
  theme: 'auto',
  accentColor: null,
  fontSize: 'medium',
  layoutDensity: 'comfortable',
  dashboardWidgets: null,

  /** @type {'tabs'|'dropdown'} */
  platformSwitcherMode: 'tabs',
  onboardingComplete: false,
  onboardingStep: 0,
  createdAt: null,
  updatedAt: null,
};

/** Keys documented in plan F4 appState table (values JSON-serialized). */
export const APP_STATE_KEY_DEFAULTS = {
  schema_version: null,
  last_backup: null,
  active_shift_start: null,
  onboarding_session: null,
  dismissed_banners: null,
  streak_last_day: null,
  streak_count: null,
  streak_frozen_count: null,
  xp_total: null,
  xp_level: null,
  personal_records: null,
  demo_mode: null,
  install_prompt_shown: null,
};

/** Dexie seed rows for `platforms` — derived from catalog (`docs/Registry_arch.md`, Category A). */
const DEFAULT_PLATFORMS = PlatformRegistry.getAll().map((def, idx) => ({
  id: def.id,
  name: def.name,
  color: def.color,
  terminology: { ...(def.terminology || {}) },
  weeklyGoal: 0,
  monthlyGoal: 0,
  taxRatePct: 0,
  notes: '',
  priority: def.id === 'other' ? 99 : idx + 1,
  active: false,
  addedAt: null,
  deactivatedAt: null,
  platformSpecific: {},
}));

/**
 * @param {Record<string, unknown>} shift
 * @param {string} provinceId
 */
function migrateShiftRowV3(shift, provinceId) {
  const s = { ...shift };
  delete s.zoneTag;
  if (s.provinceId == null || s.provinceId === '') s.provinceId = provinceId;
  if (s.deadMilesKm == null) s.deadMilesKm = 0;
  if (s.durationMinutes == null && s.date && s.startTime && s.endTime) {
    try {
      const start = new Date(`${s.date}T${s.startTime}:00`);
      const end = new Date(`${s.date}T${s.endTime}:00`);
      const ms = end.getTime() - start.getTime();
      if (Number.isFinite(ms) && ms >= 0) s.durationMinutes = Math.round(ms / 60000);
    } catch {
      /* ignore */
    }
  }
  const toCents = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n * 100);
  };
  if (s.grossEarnings == null && s.gross != null) {
    const c = toCents(s.gross);
    if (c != null) s.grossEarnings = c;
  }
  if (s.bonusEarnings == null && s.bonus != null) {
    const c = toCents(s.bonus);
    if (c != null) s.bonusEarnings = c;
  }
  if (s.tips != null) {
    const t = Number(s.tips);
    if (Number.isFinite(t) && t >= 0 && t < 50000) s.tips = Math.round(t * 100);
    else s.tips = Math.round(t);
  }
  if (s.deliveryCount == null && s.orders != null) s.deliveryCount = Math.max(0, Math.floor(Number(s.orders)) || 0);
  if (s.customFields == null || typeof s.customFields !== 'object') {
    const cf = {};
    if (s.peakPay != null) cf.peakPay = s.peakPay;
    if (s.platformSpecific && typeof s.platformSpecific === 'object')
      Object.assign(cf, /** @type {object} */ (s.platformSpecific));
    if (Object.keys(cf).length) s.customFields = cf;
  }
  delete s.gross;
  delete s.bonus;
  delete s.orders;
  delete s.peakPay;
  return s;
}

class COMMADatabase extends Dexie {
  constructor() {
    super(DB_NAME);
    this.version(1).stores(STORES_V1);
    this.version(2)
      .stores(STORES_V1)
      .upgrade((tx) => {
        void tx;
      });
    this.version(3)
      .stores(STORES_V3)
      .upgrade(async (tx) => {
        const usersTbl = tx.table('users');
        /** @type {{ provinceId?: string; countryId?: string; locale?: { country?: string } } | undefined} */
        const user = await usersTbl.get(1);
        const locCountry =
          typeof user?.locale?.country === 'string' ? String(user.locale.country).toUpperCase() : '';
        const countryId =
          typeof user?.countryId === 'string' && user.countryId
            ? String(user.countryId).toUpperCase()
            : locCountry || 'CA';
        const provinceId =
          typeof user?.provinceId === 'string' && user.provinceId
            ? user.provinceId
            : countryId === 'CA'
              ? 'ON'
              : '';

        const shiftsTbl = tx.table('shifts');
        await shiftsTbl.toCollection().modify((raw) => {
          const row = /** @type {Record<string, unknown>} */ (raw);
          const next = migrateShiftRowV3(row, provinceId);
          for (const k of Object.keys(next)) {
            row[k] = next[k];
          }
          for (const k of Object.keys(row)) {
            if (!(k in next)) delete row[k];
          }
        });

        const expTbl = tx.table('expenses');
        await expTbl.toCollection().modify((e) => {
          const row = /** @type {Record<string, unknown>} */ (e);
          if (row.provinceId == null || row.provinceId === '') row.provinceId = provinceId;
          if (row.hstPaid == null && row.hstItcAmount != null) row.hstPaid = row.hstItcAmount;
          if (row.confirmedPaid == null) row.confirmedPaid = !row.isRecurring;
        });
      });
    this.version(4)
      .stores({
        ...STORES_V3,
        notifications: '&id, read, dismissed, createdAt',
      })
      .upgrade((tx) => {
        void tx;
      });
    /**
     * v5 — schema-alignment pass (interop plan Workstream 1): web's shift/expense/vehicle field
     * shapes change incompatibly (cents→dollars, minutes→seconds, combined→split mileage, etc. —
     * see STORES_V4 doc above) and several tables are brand new. There are no real users of this
     * PWA yet, so per the plan this is a straight schema-shape bump with NO data-migrating
     * `.upgrade()` transform — old local dev data in anyone's browser is simply left in its old
     * shape (effectively inert under the new field names) rather than migrated.
     */
    this.version(5).stores(STORES_V4);
    /**
     * v6 — sync prerequisite fixes (interop plan Workstream 3, Fix 1 + Fix 2 — see STORES_V5
     * doc above). Straight shape bump, no data-migrating `.upgrade()`, same policy as v5.
     */
    this.version(6).stores(STORES_V5);
    /**
     * v7 — mobile's shifts table gains a real top-level `bonusAmount` column (real/float dollars,
     * default 0), replacing the "mobile has no bonus field" premise the v5 doc + shifts.js/
     * shift-form.js were written against. Web now matches: a plain, non-indexed data field, so no
     * index-string change is needed on the `shifts` store entry itself — this bump exists purely to
     * record the shape change in the version history, same documentation convention as v5/v6. No
     * data-migrating `.upgrade()`, same "no real users yet" policy as v5/v6 — `bonusAmount` simply
     * reads back `undefined` (treated as 0 by call sites) on old local dev rows until re-saved.
     */
    this.version(7).stores(STORES_V5);
    /**
     * v8 — SYNCED user profile (design doc "bucket b", 2026-07-04): per-key KV mirroring the
     * `users` row's user-meaningful fields (name, country, units, goals, theme, onboarding
     * flag…), one row per key with the standard sync columns, so the existing record engine
     * gives per-key LWW and the cloud copy becomes a TOTAL user snapshot — a fresh device
     * that connects needs no setup. Bridged around each sync in services/sync/profileBridge.js.
     */
    this.version(8).stores({ profile: 'key, syncUpdatedAt' });

    // Another tab on an OLDER build is holding COMMAVault open at a lower version, blocking this
    // tab's upgrade — `db.open()` would hang until that tab closes. Log it so the stall is
    // diagnosable; the user-facing recovery for the persistent case is recreateDatabase().
    this.on('blocked', () => {
      console.warn('[comma db] upgrade blocked by another open tab on an older version');
    });
  }
}

export const db = new COMMADatabase();

/**
 * Dexie error names that mean "the on-disk IndexedDB can't be reconciled with the schema this
 * build declares" — almost always a returning user whose browser holds a NEWER `COMMAVault`
 * (e.g. schema v8) while a stale service worker just handed them OLDER JS (declaring v7). IDB
 * refuses to open a higher-versioned DB with lower-versioned code, so `db.open()` throws one of
 * these. The v5→v8 bumps are deliberately non-migrating (see the version() comments), so a
 * corrupt/partial upgrade lands here too. These are the cases the old boot handled only by making
 * the user manually "reset site cache"; recreateDatabase() does that reset automatically.
 */
const RECOVERABLE_OPEN_ERRORS = new Set([
  'VersionError', // installed DB version > requested, or a version-transaction conflict
  'UpgradeError', // a .upgrade() transform threw
  'InvalidStateError', // DB blocked/corrupt
  'DatabaseClosedError', // closed mid-open (typically after a failed upgrade)
  'NotFoundError', // object store/index missing vs. the requested schema
]);

/**
 * Nuke the local `COMMAVault` IndexedDB and reopen it clean at the current schema. This is the
 * programmatic equivalent of the manual "reset site cache" workaround — it discards the local
 * cache that couldn't be opened so the app can boot. Data loss is limited to unsynced local
 * changes: the Drive sync/backup layer re-hydrates everything else on the next pull, and this
 * only runs when the DB was UNOPENABLE anyway (the alternative was a dead page).
 */
async function recreateDatabase() {
  try {
    db.close();
  } catch {
    /* already closed */
  }
  await Dexie.delete(DB_NAME);
  await db.open();
}

/**
 * logicalMigrations[n] runs when upgrading appState `schema_version` from n → n+1.
 * Keep length ≥ CURRENT_LOGICAL_SCHEMA_VERSION; add async steps when bumping version.
 * @type {((() => void) | (() => Promise<void>))[]}
 */
const logicalMigrations = [
  async () => {
    // 0 → 1: placeholder (no destructive transforms).
  },
  async () => {
    const u = await db.users.get(1);
    if (!u || typeof u !== 'object') return;
    const prev = /** @type {Record<string, unknown>} */ (u);
    const loc = /** @type {Record<string, unknown>} */ (prev.locale || {});
    const countryFromLocale = typeof loc.country === 'string' ? String(loc.country).toUpperCase() : '';
    const next = { ...prev };
    if (!next.countryId) next.countryId = countryFromLocale === 'US' ? 'US' : 'CA';
    if (!next.provinceId) next.provinceId = next.countryId === 'CA' ? 'ON' : '';
    delete next.homeBase;
    if (next.locale && typeof next.locale === 'object') {
      const L = /** @type {Record<string, unknown>} */ ({ .../** @type {object} */ (next.locale) });
      if (next.countryId === 'CA') {
        L.country = 'CA';
        L.currency = 'CAD';
        L.currencySymbol = '$';
      }
      next.locale = L;
    }
    next.updatedAt = new Date().toISOString();
    await db.users.put(/** @type {any} */ ({ ...next, id: 1 }));
  },
  async () => {
    // 2 → 3: Convert empty dashboardWidgets to null to distinguish "default" from "explicitly empty".
    const u = await db.users.get(1);
    if (!u || typeof u !== 'object') return;
    if (Array.isArray(u.dashboardWidgets) && u.dashboardWidgets.length === 0) {
      await db.users.update(1, { dashboardWidgets: null, updatedAt: new Date().toISOString() });
    }
  },
  async () => {
    // 3 → 4: placeholder — the shift/expense/vehicle field-shape change (interop plan Workstream 1)
    // is handled entirely by the Dexie v5 `.stores()` bump (STORES_V4) above, not by a logical
    // migration step (it's explicitly non-migrating; see the v5 comment on `this.version(5)`).
  },
  async () => {
    // 4 → 5: backfill the MOBILE-CANONICAL keys onto existing rows (2026-07-03 interop audit).
    await backfillMobileShapeKeys();
  },
];

/**
 * Backfill the mobile-canonical keys (see interopShape.js) onto rows that lack them. New
 * writes stamp these keys themselves; this covers rows that predate the interop fix, because
 * compaction snapshots push EVERY row as-is — an old row without `platform`/`name`/`label`/…
 * would still poison mobile's NOT NULL columns from a snapshot. Runs as logical migration
 * 4→5 AND after a vault restore (restored rows may come from a pre-fix backup while
 * appState.schema_version — which survives restores — already says 5).
 *
 * Also the FIRST-SYNC backfill: rows from before the sync columns existed sit at
 * `syncUpdatedAt` 0/undefined, and push only collects rows STRICTLY ABOVE the cursor — so
 * historical data never reached other devices. Stamp them to 1 (older than any real
 * epoch-ms edit, so it can never win an LWW merge) and rewind the push cursor so the next
 * push carries the full history once (peers skip duplicates by LWW). Mobile does the same
 * in drizzle migration `0021_first_sync_backfill`. Real edit timestamps are never touched.
 */
export async function backfillMobileShapeKeys() {
  const user = await db.users.get(1);
  const country = String(user?.countryId || 'CA');
  const syncedTables = [
    db.vehicles,
    db.platforms,
    db.merchants,
    db.goals,
    db.taxHistory,
    db.shifts,
    db.vehicleMaintenanceLogs,
    db.expenses,
    db.shiftPlatforms,
    db.vehicleTaxProfiles,
  ];
  await db.transaction('rw', [db.users, ...syncedTables], async () => {
    await db.shifts.toCollection().modify((s) => {
      if (s.platform == null) Object.assign(s, mobileShiftKeys(s));
    });
    await db.vehicles.toCollection().modify((v) => {
      if (v.name == null || v.isActive === undefined) Object.assign(v, mobileVehicleKeys(v));
    });
    await db.goals.toCollection().modify((g) => {
      if (g.label == null || g.targetValue == null || g.unit == null || g.period == null) {
        Object.assign(g, mobileGoalKeys(g));
      }
    });
    await db.platforms.toCollection().modify((p) => {
      if (p.label == null || p.textColor == null || p.country == null) {
        Object.assign(p, mobilePlatformKeys(p, { country }));
      }
    });
    for (const table of syncedTables) {
      await table.toCollection().modify((r) => {
        if (r.syncUpdatedAt == null || r.syncUpdatedAt === 0) r.syncUpdatedAt = 1;
        if (r.syncDeletedAt === undefined) r.syncDeletedAt = null;
      });
    }
  });
  // Rewind the push cursor (same key syncState.js manages — written directly so core/db
  // doesn't import from services/). Next push re-collects everything above cursor 0.
  try {
    localStorage.setItem('comma_sync_last_pushed_at', '0');
  } catch {
    /* private mode / quota */
  }
}

async function runLogicalMigrations() {
  let stored = await getAppState('schema_version');
  let from = stored == null ? 0 : Number(stored);
  if (Number.isNaN(from)) from = 0;
  while (from < CURRENT_LOGICAL_SCHEMA_VERSION) {
    const step = logicalMigrations[from];
    if (typeof step === 'function') await step();
    from += 1;
    await setAppState('schema_version', from);
  }
}

async function seedFirstRun() {
  const t = nowIso();
  const existing = await db.users.get(1);
  if (existing) return;

  await db.transaction('rw', db.tables.map((tbl) => tbl.name), async () => {
    await db.users.put({
      ...DEFAULT_USER,
      createdAt: t,
      updatedAt: t,
    });

    const platformRows = DEFAULT_PLATFORMS.map((p) => ({
      ...p,
      // Mobile-canonical keys (interop audit): label/textColor/country/isActive/sortPriority
      // must exist on every platform row so a synced insert can't hit mobile's NOT NULLs.
      ...mobilePlatformKeys(p, { country: DEFAULT_USER.countryId }),
      addedAt: p.addedAt ?? t,
      // Seed rows stamp 0, NOT Date.now(): scaffolding isn't user data. A fresh device joining
      // an existing sync must never beat the other device's REAL platform state in the LWW
      // merge (a Date.now() seed stamp would win and deactivate the user's platforms there).
      // 0-stamped rows don't push; they start syncing when the user actually touches them.
      syncUpdatedAt: 0,
      syncDeletedAt: null,
    }));
    await db.platforms.bulkPut(platformRows);

    const badgeRows = BadgeRegistry.getAll()
      .filter((b) => b.id !== 'placeholder')
      .map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        icon: b.icon,
        unlockedAt: null,
        notified: false,
      }));
    await db.badges.bulkPut(badgeRows);

    await putMissingAppStateDefaults(t);

    await db.goals.add({
      id: newId('goal'),
      type: 'earnings',
      scope: 'weekly',
      platformId: null,
      target: 0,
      active: false,
      createdAt: t,
      // Mobile-canonical keys (interop audit — mobile's label/targetValue/unit/period are NOT NULL).
      ...mobileGoalKeys({ type: 'earnings', scope: 'weekly', target: 0, active: false }),
      // Seed stamp 0 (see the platforms seed comment): per-device scaffolding must not sync
      // until the user actually sets a goal (onboarding/upsert stamp it then).
      syncUpdatedAt: 0,
      syncDeletedAt: null,
    });
  });
}

/** Insert missing appState rows from APP_STATE_KEY_DEFAULTS (non-destructive). */
async function putMissingAppStateDefaults(updatedAt) {
  for (const [key, defaultVal] of Object.entries(APP_STATE_KEY_DEFAULTS)) {
    if (key === 'schema_version') continue;
    const row = await db.appState.get(key);
    if (!row) {
      await db.appState.put({
        key,
        value: JSON.stringify(defaultVal),
        updatedAt,
      });
    }
  }
}

/**
 * Open database, run logical migrations, seed first-run catalog rows.
 * Call once at app startup (before router/store).
 *
 * Returns `{ recovered }` — `recovered: true` means the on-disk DB could not be opened (a
 * version/schema conflict from a stale service worker, or a corrupt/partial upgrade) and had to
 * be deleted and recreated. Startup succeeds either way; callers can surface a heads-up when
 * `recovered` is true. Only a genuinely unrecoverable failure (or a second failure right after a
 * fresh recreate) rejects.
 *
 * @returns {Promise<{ recovered: boolean }>}
 */
export async function initDatabase() {
  let recovered = false;
  try {
    await db.open();
  } catch (err) {
    const name = /** @type {{ name?: string }} */ (err)?.name || '';
    if (!RECOVERABLE_OPEN_ERRORS.has(name)) throw err;
    // Unopenable local DB (typically stale-SW version skew) — auto-reset instead of dead-ending
    // the user at "Could not open local database" and making them clear site data by hand.
    console.warn(`[comma db] open failed (${name}); recreating local database`, err);
    await recreateDatabase();
    recovered = true;
  }
  await runLogicalMigrations();
  await seedFirstRun();
  await putMissingAppStateDefaults(nowIso());

  // Purge residual 'orders' fields to ensure single source of truth (deliveryCount)
  try {
    await db.shifts.toCollection().modify((row) => {
      if (row.orders !== undefined) {
        if (row.deliveryCount == null && row.orders != null) {
          row.deliveryCount = Math.max(0, Math.floor(Number(row.orders)) || 0);
        }
        delete row.orders;
      }
    });
  } catch (err) {
    console.warn('[comma db] failed to prune residual orders fields:', err);
  }

  return { recovered };
}

export async function getUser() {
  return db.users.get(1);
}

export async function saveUser(patch) {
  const prev = (await db.users.get(1)) || { ...DEFAULT_USER };
  const t = nowIso();
  const next = {
    ...prev,
    ...patch,
    id: 1,
    updatedAt: t,
    createdAt: prev.createdAt || t,
  };
  await db.users.put(next);
  return next;
}

export async function getAppState(key) {
  const row = await db.appState.get(key);
  if (!row) return undefined;
  try {
    return JSON.parse(row.value);
  } catch {
    return row.value;
  }
}

export async function setAppState(key, value) {
  const t = nowIso();
  await db.appState.put({
    key,
    value: JSON.stringify(value === undefined ? null : value),
    updatedAt: t,
  });
}

export async function softDelete(table, id) {
  if (!SOFT_DELETE_TABLES.has(table)) {
    throw new Error(`softDelete: unsupported table "${table}"`);
  }
  const ts = nowIso();
  const syncTs = Date.now();
  // Both tables here (shifts, expenses) are synced tables (interop plan Workstream 1) — bump the
  // sync tombstone/clock in parallel with web's existing deletedAt/updatedAt convention so the
  // columns are meaningful once a sync engine reads them, without changing current read paths.
  await db[table].update(id, { deletedAt: ts, updatedAt: ts, syncDeletedAt: syncTs, syncUpdatedAt: syncTs });
}

export async function restoreDeleted(table, id) {
  if (!SOFT_DELETE_TABLES.has(table)) {
    throw new Error(`restoreDeleted: unsupported table "${table}"`);
  }
  const ts = nowIso();
  await db[table].update(id, { deletedAt: null, updatedAt: ts, syncDeletedAt: null, syncUpdatedAt: Date.now() });
}

export async function purgeOldDeleted(table, days = 30) {
  if (!SOFT_DELETE_TABLES.has(table)) {
    throw new Error(`purgeOldDeleted: unsupported table "${table}"`);
  }
  const cutoffMs = Date.now() - days * 86400000;
  await db[table]
    .filter((row) => {
      if (row.deletedAt == null) return false;
      const ts = new Date(row.deletedAt).getTime();
      return !Number.isNaN(ts) && ts < cutoffMs;
    })
    .delete();
}

export async function getActiveShifts() {
  return db.shifts.filter((s) => s.deletedAt == null).toArray();
}

export async function getActiveExpenses() {
  return db.expenses.filter((e) => e.deletedAt == null).toArray();
}
