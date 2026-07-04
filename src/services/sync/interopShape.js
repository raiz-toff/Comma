/**
 * COMMA — Mobile-shape interop layer (sync).
 *
 * Implements the schema-alignment fixes from the 2026-07-03 web↔mobile interop audit
 * (`commaApp/app/docs/web-mobile-interop-audit-2026-07-03.md`). Mobile's SQLite schema is the
 * CANONICAL record shape; web rows carry BOTH key sets:
 *   - web keys (`platformId`, `nickname`, `active`, goal `type`/`scope`/`target`, `date`, …)
 *     keep driving web's own UI, unchanged;
 *   - mobile-canonical keys (`platform`, `name`, `isActive`, goal
 *     `label`/`targetValue`/`unit`/`period`, platform `label`/`textColor`/`country`/
 *     `sortPriority`) ride along so a web-authored row can never violate mobile's NOT NULL
 *     columns (the audit's "poison row" findings 1–3/9) and so edits round-trip.
 *
 * Two directions, both owned here:
 *   - `mobile*Keys(...)` — WRITE time: compute the mobile-canonical keys for a web row.
 *   - `normalizeIncoming(table, incoming, localRow)` — APPLY (pull) time:
 *       1. merge the incoming row OVER the surviving local row, so an incoming mobile row
 *          (which has no web-only keys) never wipes `date`/`customFields`/`receiptData`/…
 *          (audit Gap 7 — the old full-row `put()` did);
 *       2. coerce mobile's wire formats — Drizzle timestamp columns arrive as ISO strings,
 *          web stores epoch-ms `startTime`/`endTime` and `YYYY-MM-DD` `date`s (audit Gap 6);
 *       3. re-derive the web convenience fields (`date`, `platformId`, `nickname`, `active`,
 *          goal `type`/`scope`/`target`, platform `name`/`priority`) from the
 *          mobile-canonical values, so a mobile edit updates what web's UI actually reads.
 *
 * Goal kind mapping is passthrough-tolerant by design: the clean pairs convert
 * (earnings↔currency, hours↔hours, distance↔mileage), everything else carries its own key
 * verbatim (`net_profit`, `tips`, `deliveries`, mobile's `shifts`, mobile's `yearly` period).
 * Both apps render unknown kinds degraded-but-safe (progress 0, blank icon) — verified in the
 * audit — which beats showing a wrong-but-plausible number.
 *
 * Deliberately dependency-free so it stays unit-testable with plain `node`.
 */

/**
 * Legacy web expense-category slugs → canonical cross-app ids (2026-07-04 unification).
 * Keep in step with `registry/expense-categories/index.js` LEGACY_CATEGORY_ALIASES —
 * duplicated here (it's two entries, frozen forever) so this module stays dependency-free.
 */
const LEGACY_CATEGORY_ALIASES = { car_wash: 'wash', registration: 'licensing' };

/** @param {unknown} id @returns {string} canonical form of a possibly-legacy category id */
function canonicalCategoryId(id) {
  const s = String(id || '');
  return LEGACY_CATEGORY_ALIASES[s] || s;
}

/** Web goal `type` → mobile goal `unit` (unmapped types pass through verbatim). */
export const WEB_GOAL_TYPE_TO_MOBILE_UNIT = {
  earnings: 'currency',
  hours: 'hours',
  distance: 'mileage',
};

/** Mobile goal `unit` → web goal `type` (unmapped units pass through verbatim). */
export const MOBILE_UNIT_TO_WEB_GOAL_TYPE = {
  currency: 'earnings',
  hours: 'hours',
  mileage: 'distance',
};

/**
 * Coerce a timestamp-ish value to epoch-ms. Mobile pushes Drizzle `{mode:'timestamp'}`
 * columns as ISO strings (Date → JSON); web-authored rows already carry numbers.
 * Unparseable values are returned untouched rather than invented.
 * @param {unknown} v
 * @returns {unknown} epoch-ms number when coercible
 */
export function toEpochMs(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v) {
    const t = new Date(v).getTime();
    if (Number.isFinite(t)) return t;
  }
  return v;
}

/**
 * Coerce a date-ish value (epoch-ms number or ISO string) to a LOCAL `YYYY-MM-DD` string —
 * web's storage/index format for `shifts.date`, `expenses.date`, `maintenanceLogs.date`.
 * Local (not UTC) so the day matches what the user saw on the authoring device when both
 * devices share a timezone. Returns null when not coercible (caller keeps the old value).
 * @param {unknown} v
 * @returns {string | null}
 */
export function toYmdLocal(v) {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const t =
    typeof v === 'number' && Number.isFinite(v)
      ? v
      : typeof v === 'string' && v
        ? new Date(v).getTime()
        : NaN;
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

const GOAL_TYPE_LABELS = {
  earnings: 'earnings',
  deliveries: 'deliveries',
  hours: 'hours',
  distance: 'distance',
  net_profit: 'net profit',
  tips: 'tips',
};

/**
 * Human label for a goal — mobile's `goals.label` is NOT NULL and shown as the goal's title.
 * @param {unknown} type @param {unknown} scope @returns {string}
 */
export function goalLabelFor(type, scope) {
  const t = GOAL_TYPE_LABELS[String(type)] || String(type || 'earnings').replace(/_/g, ' ');
  const s = String(scope || 'weekly');
  return `${s.charAt(0).toUpperCase()}${s.slice(1)} ${t}`;
}

/**
 * Mobile-canonical keys for a web goal row. Spread these into every goal write.
 * @param {{ type?: unknown, scope?: unknown, target?: unknown, active?: unknown }} g
 */
export function mobileGoalKeys(g) {
  return {
    label: goalLabelFor(g.type, g.scope),
    targetValue: Math.max(0, Number(g.target) || 0),
    unit: WEB_GOAL_TYPE_TO_MOBILE_UNIT[String(g.type)] || String(g.type || 'earnings'),
    period: String(g.scope || 'weekly'),
    isActive: g.active !== false,
  };
}

/**
 * Mobile-canonical keys for a web vehicle row. Mobile's `vehicles.name` is NOT NULL.
 * @param {{ nickname?: unknown, active?: unknown }} v
 */
export function mobileVehicleKeys(v) {
  return {
    name: String(v.nickname || '').trim() || 'Vehicle',
    isActive: v.active !== false,
  };
}

/**
 * Mobile-canonical keys for a web platform row. Needs the FULL row (not a patch) — pass
 * `{...row, ...patch}` when mirroring an update. Mobile's `label`/`color`/`textColor`/
 * `country` are all NOT NULL; `country` groups mobile's per-country platform lists, so we
 * take the row's own value, then the caller-supplied user country, then 'CA'.
 * @param {Record<string, unknown>} row
 * @param {{ country?: string }} [opts]
 */
export function mobilePlatformKeys(row, opts = {}) {
  return {
    label: String(row.name || row.label || row.id || 'Platform'),
    textColor:
      typeof row.textColor === 'string' && row.textColor ? row.textColor : '#FFFFFF',
    country: String(row.country || opts.country || 'CA'),
    isActive: row.active === true,
    sortPriority: Number(row.priority ?? row.sortPriority) || 1,
  };
}

/**
 * Mobile-canonical key for a web shift row: mobile's `shifts.platform` (NOT NULL slug).
 * Web's `platformId` already holds the same registry slug (verified: web's catalog is a
 * subset of mobile's, identical ids); 'other' is both catalogs' escape hatch.
 * @param {{ platformId?: unknown, platform?: unknown }} s
 */
export function mobileShiftKeys(s) {
  return { platform: String(s.platform || s.platformId || 'other') };
}

/** @param {unknown} v @returns {boolean} mobile boolean-ish (true/false/1/0) → JS boolean */
function truthyFlag(v) {
  return v !== false && v !== 0;
}

/**
 * Keep web's local `deletedAt` (ISO) soft-delete marker in step with the cross-device
 * `syncDeletedAt` tombstone on shifts/expenses. Mobile rows only carry `syncDeletedAt`;
 * a few web readers (search) still check `deletedAt`.
 * @param {Record<string, unknown>} merged @param {Record<string, unknown>} incoming
 */
function deriveDeletedAt(merged, incoming) {
  if (incoming.deletedAt !== undefined) return; // web-authored row — already consistent
  if (incoming.syncDeletedAt != null) {
    const t = Number(incoming.syncDeletedAt);
    merged.deletedAt = new Date(Number.isFinite(t) && t > 0 ? t : Date.now()).toISOString();
  }
}

/**
 * Prepare one incoming change-log row for `table.put()`: merge over the local row, coerce
 * mobile wire formats, re-derive web convenience fields. See module doc for the three steps.
 * Never throws on odd shapes — sync must degrade, not wedge.
 *
 * @param {string} tableName sync wire name ('shifts', 'expenses', 'maintenanceLogs', …)
 * @param {Record<string, unknown>} incoming row from the pulled change-log
 * @param {Record<string, unknown> | undefined} localRow surviving local row (LWW loser) if any
 * @returns {Record<string, unknown>} the row to store
 */
export function normalizeIncoming(tableName, incoming, localRow) {
  const merged = localRow ? { ...localRow, ...incoming } : { ...incoming };

  switch (tableName) {
    case 'shifts': {
      merged.startTime = toEpochMs(merged.startTime);
      merged.endTime = toEpochMs(merged.endTime);
      if (incoming.platform != null && incoming.platformId == null) {
        merged.platformId = String(incoming.platform);
      }
      const ymd = toYmdLocal(merged.startTime);
      if (ymd) merged.date = ymd;
      deriveDeletedAt(merged, incoming);
      break;
    }
    case 'expenses': {
      const ymd = toYmdLocal(merged.date);
      if (ymd) merged.date = ymd;
      // Old change-logs/snapshots in Drive can carry pre-unification web slugs forever.
      if (merged.category != null) merged.category = canonicalCategoryId(merged.category);
      deriveDeletedAt(merged, incoming);
      break;
    }
    case 'maintenanceLogs': {
      const ymd = toYmdLocal(merged.date);
      if (ymd) merged.date = ymd;
      break;
    }
    case 'vehicles': {
      if (incoming.name != null && incoming.nickname == null) {
        merged.nickname = String(incoming.name);
      }
      if (incoming.isActive !== undefined && incoming.active === undefined) {
        merged.active = truthyFlag(incoming.isActive);
      }
      break;
    }
    case 'goals': {
      if (incoming.targetValue != null && incoming.target == null) {
        merged.target = Math.max(0, Number(incoming.targetValue) || 0);
      }
      if (incoming.unit != null && incoming.type == null) {
        merged.type = MOBILE_UNIT_TO_WEB_GOAL_TYPE[String(incoming.unit)] || String(incoming.unit);
      }
      if (incoming.period != null && incoming.scope == null) {
        merged.scope = String(incoming.period);
      }
      if (incoming.isActive !== undefined && incoming.active === undefined) {
        merged.active = truthyFlag(incoming.isActive);
      }
      break;
    }
    case 'platforms': {
      if (incoming.label != null && incoming.name == null) {
        merged.name = String(incoming.label);
      }
      if (incoming.isActive !== undefined && incoming.active === undefined) {
        merged.active = truthyFlag(incoming.isActive);
      }
      if (incoming.sortPriority != null && incoming.priority == null) {
        merged.priority = Number(incoming.sortPriority) || 1;
      }
      break;
    }
    default:
      break;
  }

  return merged;
}
