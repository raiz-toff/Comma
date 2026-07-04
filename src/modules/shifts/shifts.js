/**
 * F11 — Shift Logging Core
 * Dexie-backed shift CRUD + templates + conflict checks + live timer persistence.
 *
 * Notes:
 * - All user data stored in IndexedDB (Dexie). Templates/timer state use `appState` (Dexie) + localStorage mirror.
 * - Migrations are non-destructive (we only add new `appState` keys as needed).
 */

import { db, setAppState, getAppState, softDelete, restoreDeleted, purgeOldDeleted } from '../../core/db.js';
import { bus, SHIFT_DELETED, SHIFT_SAVED, SHIFT_TIMER_START, SHIFT_TIMER_STOP } from '../../core/events.js';
import { store } from '../../core/store.js';
import { acquireWakeLock, releaseWakeLock } from '../pwa/pwa.js';
import { extractShiftPlatformSpecific } from '../platforms/platform-specific.js';
import { saveExpense, updateExpense, deleteExpense } from '../expenses/expenses.js';
import { GPSTracker } from '../../core/gps-tracker.js';
import { newId } from '../../core/id.js';

const LS_TIMER_KEY = 'comma_active_shift_timer';
const APP_STATE_TIMER_KEY = 'active_shift_start';
const APP_STATE_TEMPLATES_KEY = 'shift_templates';

function nowIso() {
  return new Date().toISOString();
}

function clampNum(v, { min = -Infinity, max = Infinity } = {}) {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, n));
}

function normStr(v) {
  if (typeof v !== 'string') return '';
  return v.trim();
}

function resolveProvinceId(input) {
  const raw = typeof input.provinceId === 'string' ? input.provinceId.trim().toUpperCase() : '';
  if (raw) return raw;
  const user = /** @type {{ provinceId?: string } | null} */ (store.get('user'));
  if (user?.provinceId) return String(user.provinceId).toUpperCase();
  return 'ON';
}

/**
 * User-entered currency → a plain non-negative dollar number, or null if absent/invalid.
 * (Schema-alignment pass, interop plan Workstream 1: shift money fields are real dollars now,
 * matching mobile's `grossRevenue`/`tipsRevenue` — no more cents storage.)
 */
function moneyToNumber(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function ymdFromDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isYmd(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function isHm(s) {
  return typeof s === 'string' && /^\d{2}:\d{2}$/.test(s);
}

function minutesBetween(ymd, startHm, endHm) {
  if (!isYmd(ymd) || !isHm(startHm) || !isHm(endHm)) return null;
  const start = new Date(`${ymd}T${startHm}:00`);
  let end = new Date(`${ymd}T${endHm}:00`);
  if (end.getTime() < start.getTime()) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  const ms = end.getTime() - start.getTime();
  if (!Number.isFinite(ms)) return null;
  const min = Math.round(ms / 60000);
  return min;
}

/**
 * Fix 1 (interop plan Workstream 3 prerequisite) — combine a YYYY-MM-DD date + HH:mm
 * time-of-day strings into real epoch-ms start/end timestamps, mirroring mobile's
 * `shifts.startTime`/`endTime` (`integer({mode:'timestamp'})`, NOT NULL — see schema.ts).
 * Applies the same overnight-rollover rule `minutesBetween`/`checkConflict` already used
 * (end-of-day < start-of-day ⇒ shift crossed midnight, add 24h to end). Missing/invalid HH:mm
 * inputs fall back to local midnight on `date` for the start, and `start + durationSecondsHint`
 * for the end, so mobile's NOT NULL constraint is always satisfiable even for a web "quick
 * entry" that only records a duration, not exact clock times.
 * @param {string} ymd
 * @param {string|null} startHm
 * @param {string|null} endHm
 * @param {number} [durationSecondsHint]
 * @returns {{ startMs: number, endMs: number }}
 */
function deriveShiftTimestamps(ymd, startHm, endHm, durationSecondsHint = 0) {
  const day = isYmd(ymd) ? ymd : ymdFromDate(new Date());
  const startMs = isHm(startHm) ? new Date(`${day}T${startHm}:00`).getTime() : new Date(`${day}T00:00:00`).getTime();
  let endMs;
  if (isHm(endHm)) {
    endMs = new Date(`${day}T${endHm}:00`).getTime();
    if (endMs < startMs) endMs += 24 * 60 * 60 * 1000;
  } else {
    endMs = startMs + Math.max(0, Math.round(Number(durationSecondsHint) || 0)) * 1000;
  }
  return { startMs, endMs };
}

/** HH:mm (local time-of-day) from an epoch-ms timestamp, or null if not a finite number. */
function hmFromMs(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return null;
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** YYYY-MM-DD (local calendar date) from an epoch-ms timestamp, or null if not a finite number. */
function ymdFromMs(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return null;
  return ymdFromDate(new Date(ms));
}

/**
 * Convert a stored shift row's epoch-ms `startTime`/`endTime` (Fix 1) back into the
 * date/HH:mm-string shape `shift-form.js` expects for its `initial` prefill — used wherever a
 * DB row (or a row-shaped payload) is handed to the form for editing/duplicating, so the form
 * itself needs zero changes for this schema shift. Non-shift fields pass through untouched.
 * @param {Record<string, unknown>} row
 * @returns {Record<string, unknown>}
 */
export function shiftRowToFormTimeFields(row) {
  if (!row || typeof row !== 'object') return row;
  const out = { ...row };
  if (typeof out.startTime === 'number') out.startTime = hmFromMs(out.startTime);
  if (typeof out.endTime === 'number') out.endTime = hmFromMs(out.endTime);
  return out;
}

/**
 * Normalize the `shiftPlatforms` breakdown passed from the shift form (interop plan Workstream 4
 * — multi-platform shift UI). Mirrors mobile's `shiftPlatforms` table shape field-for-field
 * (`platform`, `platformOnlineSeconds`, `platformActiveSeconds`, `grossRevenue`, `tipsRevenue`,
 * `tripsCount` — see `commaApp/src/database/schema.ts`). Rows without a platform are dropped.
 * @param {unknown} raw
 * @returns {Array<{ platform: string, grossRevenue: number, tipsRevenue: number, tripsCount: number, platformOnlineSeconds: number, platformActiveSeconds: number }>}
 */
function normalizeShiftPlatformRows(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r === 'object' && normStr(/** @type {any} */ (r).platform))
    .map((r) => {
      const row = /** @type {Record<string, unknown>} */ (r);
      return {
        platform: normStr(row.platform),
        grossRevenue: Math.max(0, moneyToNumber(row.grossRevenue) ?? 0),
        tipsRevenue: Math.max(0, moneyToNumber(row.tipsRevenue) ?? 0),
        tripsCount: Math.max(0, Math.round(Number(row.tripsCount) || 0)),
        platformOnlineSeconds: Math.max(0, Math.round(Number(row.platformOnlineSeconds) || 0)),
        platformActiveSeconds: Math.max(0, Math.round(Number(row.platformActiveSeconds) || 0)),
      };
    });
}

/**
 * Replace a shift's `shiftPlatforms` rows (delete-and-recreate — simplest correct approach for a
 * per-shift line-item breakdown; see interop plan Workstream 4). Existing rows are soft-deleted
 * (tombstoned via `syncDeletedAt`, matching every other synced table's convention) rather than
 * hard-deleted, so a future sync engine sees the change instead of silently losing it. No-op when
 * `platformRowsInput` is not an array (callers that don't touch the breakdown, e.g. programmatic
 * patches, leave existing shiftPlatforms rows untouched).
 * @param {number} shiftId
 * @param {unknown} platformRowsInput
 */
async function syncShiftPlatformRows(shiftId, platformRowsInput) {
  if (!Array.isArray(platformRowsInput)) return;
  const rows = normalizeShiftPlatformRows(platformRowsInput);
  const syncNow = Date.now();
  await db.transaction('rw', db.shiftPlatforms, async () => {
    const existing = await db.shiftPlatforms.where('shiftId').equals(shiftId).toArray();
    for (const ex of existing) {
      if (ex.syncDeletedAt == null) {
        await db.shiftPlatforms.update(ex.id, { syncDeletedAt: syncNow, syncUpdatedAt: syncNow });
      }
    }
    for (const row of rows) {
      await db.shiftPlatforms.add({
        id: newId('sp'),
        shiftId,
        platform: row.platform,
        platformOnlineSeconds: row.platformOnlineSeconds,
        platformActiveSeconds: row.platformActiveSeconds,
        grossRevenue: row.grossRevenue,
        tipsRevenue: row.tipsRevenue,
        tripsCount: row.tripsCount,
        syncUpdatedAt: syncNow,
        syncDeletedAt: null,
      });
    }
  });
}

function safeJsonParse(raw, fallback) {
  if (typeof raw !== 'string' || !raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * @typedef {Object} ShiftRow
 * @property {string} id client-generated string (Fix 2 — interop plan; see core/id.js)
 * @property {string} date YYYY-MM-DD — derived from `startTime`, kept as a web-only convenience
 *   column (mobile has no separate date field — see db.js STORES_V5 doc); not required for
 *   mobile interop, just left off what mobile understands (same as `customFields`)
 * @property {string} platformId mobile: `platform` — single/primary platform, kept for backward-compat display
 * @property {string} provinceId
 * @property {number} startTime epoch ms (Fix 1 — interop plan; mobile parity, NOT NULL there)
 * @property {number} endTime epoch ms
 * @property {number} durationSeconds mobile: total elapsed shift time in seconds
 * @property {number} pausedSeconds mobile: paused time; net active = durationSeconds - pausedSeconds
 * @property {number} grossRevenue dollars (mobile: real, not cents)
 * @property {number} tipsRevenue dollars
 * @property {number} bonusAmount dollars (mobile: real, default 0)
 * @property {number|null} deliveryCount backward-compat display aggregate (mobile has no shift-level trip count)
 * @property {number} activeMileage mobile: GPS-tracked delivery miles (web stores in km, see db.js doc)
 * @property {number} deadMileage mobile: commute/waiting miles not on a delivery
 * @property {number|null} startOdometer
 * @property {number|null} endOdometer
 * @property {string} distanceSource 'manual' | 'gps_only' | 'odometer_reconciled'
 * @property {string} reconciliationStatus 'tracking' | 'pending_reconciliation' | 'reconciled'
 * @property {string|null} routePath
 * @property {number|null} onlineMinutes web-only
 * @property {number|null} activeMinutes web-only
 * @property {number|null} vehicleId
 * @property {string|null} weather web-only
 * @property {string|null} mood web-only
 * @property {string} notes
 * @property {boolean} isMultiApp web-only
 * @property {string[]} multiAppPlatformIds web-only
 * @property {Record<string, unknown>} customFields web-only bag (peakPay, platform extras — mobile
 *   has no equivalent columns for these, so they stay off the top-level row)
 * @property {string|null} deletedAt
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {number} syncUpdatedAt epoch ms — mirrors mobile's LWW sync clock
 * @property {number|null} syncDeletedAt epoch ms tombstone — mirrors mobile's sync soft-delete
 */

/**
 * Normalize and validate incoming shift fields per F11 constraints.
 * @param {Record<string, unknown>} input
 * @returns {Omit<ShiftRow, 'id'>}
 */
export function normalizeShiftInput(input) {
  const dateRaw = typeof input.date === 'string' ? input.date : '';
  const today = new Date();
  const minDate = new Date();
  minDate.setFullYear(today.getFullYear() - 2);

  const date = isYmd(dateRaw) ? dateRaw : ymdFromDate(today);
  const dateObj = new Date(`${date}T00:00:00`);
  if (dateObj.getTime() < minDate.getTime()) {
    throw new Error('shift:date:too_old');
  }

  const platformId = normStr(input.platformId);
  if (!platformId) throw new Error('shift:platform:required');

  const provinceId = resolveProvinceId(input);

  // Fix 1 (interop plan): startTime/endTime are real epoch-ms timestamps in the stored row
  // (mobile parity — see deriveShiftTimestamps doc above). Two input shapes are accepted here:
  // HH:mm time-of-day strings (fresh input from shift-form.js / CSV column mapping, combined
  // with `date` below), or already-resolved epoch-ms numbers (idempotent re-normalization — e.g.
  // CSV import validates a row via normalizeShiftInput once during its dry-run pass and again
  // via saveShift() at commit time). Numbers pass straight through so re-normalizing never loses
  // the precise instant already computed on a prior pass.
  const startAlreadyMs = typeof input.startTime === 'number' && Number.isFinite(input.startTime);
  const endAlreadyMs = typeof input.endTime === 'number' && Number.isFinite(input.endTime);
  const startHm = !startAlreadyMs && isHm(input.startTime) ? String(input.startTime) : null;
  const endHm = !endAlreadyMs && isHm(input.endTime) ? String(input.endTime) : null;

  let durationMinutesLocal = clampNum(input.durationMinutes, { min: 0 });
  if (durationMinutesLocal == null && date && startHm && endHm) {
    durationMinutesLocal = minutesBetween(date, startHm, endHm);
  }
  const durationSeconds =
    input.durationSeconds != null
      ? Math.max(0, Math.round(Number(input.durationSeconds) || 0))
      : Math.max(0, Math.round((durationMinutesLocal || 0) * 60));
  const pausedSeconds = Math.max(0, Math.round(Number(input.pausedSeconds) || 0));

  let startTime;
  let endTime;
  if (startAlreadyMs) {
    startTime = input.startTime;
    endTime = endAlreadyMs ? input.endTime : startTime + durationSeconds * 1000;
  } else {
    const derived = deriveShiftTimestamps(date, startHm, endHm, durationSeconds);
    startTime = derived.startMs;
    endTime = derived.endMs;
  }

  // Multi-platform breakdown (interop plan Workstream 4): when the form supplies a
  // `shiftPlatforms` split, the shift's own aggregate grossRevenue/tipsRevenue/deliveryCount are
  // the SUM across every platform row rather than a directly-entered number — this keeps every
  // existing reader of these top-level fields (dashboard, analytics, reports) correct without
  // having to learn about `shiftPlatforms`. For a single-platform shift the array has exactly one
  // row, so the sum equals that row's own values — identical to pre-multi-platform behavior.
  const platformRows = normalizeShiftPlatformRows(input.shiftPlatforms);
  const grossRevenue = platformRows.length
    ? Math.max(0, platformRows.reduce((sum, r) => sum + r.grossRevenue, 0))
    : Math.max(0, moneyToNumber(input.grossRevenue ?? input.gross) ?? 0);
  const tipsRevenue = platformRows.length
    ? Math.max(0, platformRows.reduce((sum, r) => sum + r.tipsRevenue, 0))
    : Math.max(0, moneyToNumber(input.tipsRevenue ?? input.tips) ?? 0);
  const bonusAmount = Math.max(0, moneyToNumber(input.bonusAmount ?? input.bonusEarnings ?? input.bonus) ?? 0);

  const deliveryCount = platformRows.length
    ? platformRows.reduce((sum, r) => sum + r.tripsCount, 0)
    : clampNum(input.deliveryCount ?? input.orders, { min: 0 });
  const activeMileage = clampNum(input.activeMileage ?? input.distanceKm, { min: 0 }) ?? 0;
  const dm = clampNum(input.deadMileage ?? input.deadMilesKm, { min: 0 });
  const deadMileage = dm == null ? 0 : dm;
  const onlineMinutes = clampNum(input.onlineMinutes, { min: 0 });
  const activeMinutes = clampNum(input.activeMinutes, { min: 0 });
  // vehicles.id is a client-generated string (Fix 2 — interop plan) — no numeric coercion.
  const vehicleId = input.vehicleId == null || input.vehicleId === '' ? null : String(input.vehicleId);
  const startOdometer = input.startOdometer == null || input.startOdometer === '' ? null : clampNum(input.startOdometer, { min: 0 });
  const endOdometer = input.endOdometer == null || input.endOdometer === '' ? null : clampNum(input.endOdometer, { min: 0 });
  const distanceSource = typeof input.distanceSource === 'string' && input.distanceSource ? input.distanceSource : 'manual';
  const reconciliationStatus =
    typeof input.reconciliationStatus === 'string' && input.reconciliationStatus
      ? input.reconciliationStatus
      : 'reconciled';
  const routePath = typeof input.routePath === 'string' ? input.routePath : null;

  const weatherRaw = normStr(input.weather);
  const weather = weatherRaw ? weatherRaw : null;
  const moodRaw = normStr(input.mood);
  const mood = moodRaw ? moodRaw : null;
  const notes = typeof input.notes === 'string' ? input.notes : '';
  const platformExtra = extractShiftPlatformSpecific(input);
  /** @type {Record<string, unknown>} */
  const customFields = {
    ...(typeof input.customFields === 'object' && input.customFields ? input.customFields : {}),
    ...platformExtra.platformSpecific,
  };
  if (platformExtra.peakPay != null) customFields.peakPay = platformExtra.peakPay;
  // Mobile's shifts table has a real top-level `bonusAmount` column (interop plan Workstream 1,
  // Dexie v7) — web mirrors it directly instead of folding into customFields (see `bonusAmount`
  // above, same treatment as grossRevenue/tipsRevenue).
  delete customFields.bonusAmount;

  const t = nowIso();
  const syncNow = Date.now();
  // Fix 2 (interop plan) — client-generated string primary key. Preserve an incoming string id
  // (idempotent re-normalization, e.g. CSV import's dry-run pass then saveShift() at commit)
  // rather than minting a second, different one.
  const id = typeof input.id === 'string' && input.id ? input.id : newId('shift');
  return {
    id,
    date,
    platformId,
    // Mobile-canonical mirror (2026-07-03 interop audit): mobile's `shifts.platform` is a
    // NOT NULL registry slug — same slugs as web's platformId (web's catalog is a subset of
    // mobile's). Without this key, every web-created shift crashed mobile's sync apply.
    platform: String(platformId || 'other'),
    provinceId,
    startTime,
    endTime,
    durationSeconds,
    pausedSeconds,
    grossRevenue,
    tipsRevenue,
    bonusAmount,
    deliveryCount,
    activeMileage,
    deadMileage,
    startOdometer,
    endOdometer,
    distanceSource,
    reconciliationStatus,
    routePath,
    onlineMinutes,
    activeMinutes,
    vehicleId,
    weather,
    mood,
    notes,
    isMultiApp: platformExtra.isMultiApp,
    multiAppPlatformIds: platformExtra.multiAppPlatformIds,
    customFields,
    deletedAt: null,
    createdAt: t,
    updatedAt: t,
    syncUpdatedAt: syncNow,
    syncDeletedAt: null,
  };
}

/**
 * Validate start/end epoch-ms ordering (Fix 1 — startTime/endTime are timestamps now).
 * Allows end == start (0 duration) for quick entries.
 * @param {number|null} startTime epoch ms
 * @param {number|null} endTime epoch ms
 */
function validateTimeWindow(startTime, endTime) {
  if (typeof startTime !== 'number' || typeof endTime !== 'number') return;
  if (endTime < startTime) throw new Error('shift:time:invalid');
}

/**
 * @param {string} id
 * @returns {Promise<ShiftRow | undefined>}
 */
export async function getShift(id) {
  return db.shifts.get(id);
}

/**
 * Feature 54 — check overlaps on same day for non-deleted shifts.
 * @param {string} date YYYY-MM-DD (still used to scope the same-day candidate query — `date` is
 *   kept as a derived, indexed convenience column, see db.js STORES_V5 doc)
 * @param {number|null} startTime epoch ms (Fix 1)
 * @param {number|null} endTime epoch ms
 * @param {{ excludeId?: string, platformId?: string }} [opts]
 */
export async function checkConflict(date, startTime, endTime, opts = {}) {
  if (!isYmd(date) || typeof startTime !== 'number' || typeof endTime !== 'number') return null;
  const excludeId = typeof opts.excludeId === 'string' ? opts.excludeId : null;
  const platformId = typeof opts.platformId === 'string' ? opts.platformId.trim().toLowerCase() : null;

  const shifts = await db.shifts.where('date').equals(date).toArray();
  const targetStart = startTime;
  let targetEnd = endTime;
  if (targetEnd < targetStart) {
    targetEnd += 24 * 60 * 60 * 1000;
  }
  if (!Number.isFinite(targetStart) || !Number.isFinite(targetEnd)) return null;

  // Skip conflict validation if target shift has 1 minute or less of duration (placeholder/daily total)
  if (targetEnd - targetStart <= 60000) return null;

  for (const s of shifts) {
    if (s.deletedAt != null) continue;
    if (excludeId != null && s.id === excludeId) continue;
    if (platformId != null && s.platformId != null && s.platformId.toLowerCase() !== platformId) continue;
    if (typeof s.startTime !== 'number' || typeof s.endTime !== 'number') continue;
    let sStart = s.startTime;
    let sEnd = s.endTime;
    if (sEnd < sStart) {
      sEnd += 24 * 60 * 60 * 1000;
    }

    // Skip if the existing shift is a placeholder/daily total (1 min or less)
    if (sEnd - sStart <= 60000) continue;

    const overlap = targetStart < sEnd && targetEnd > sStart;
    if (overlap) return s;
  }
  return null;
}

/**
 * Feature 55 — total worked minutes for the day (from shifts with times).
 * @param {string} date YYYY-MM-DD
 * @returns {Promise<{ totalMinutes: number } | null>}
 */
export async function checkHoursWarning(date) {
  if (!isYmd(date)) return null;
  const shifts = await db.shifts.where('date').equals(date).toArray();
  let total = 0;
  for (const s of shifts) {
    if (s.deletedAt != null) continue;
    if (typeof s.startTime === 'number' && typeof s.endTime === 'number' && s.endTime > s.startTime) {
      total += (s.endTime - s.startTime) / 60000;
    }
  }
  return { totalMinutes: Math.round(total) };
}

/**
 * Save multiple shifts in a single transaction (Bulk Import).
 * @param {Array<import('./shifts.js').Shift>} shifts
 */
export async function saveShiftsBulk(shifts) {
  if (!shifts || shifts.length === 0) return;
  return db.transaction('rw', db.shifts, async () => {
    // bulkPut handles upserting by primary key (id or date+platformId if composite)
    await db.shifts.bulkPut(shifts);
  });
}

async function syncShiftOutOfPocketExpense(shiftId, outOfPocketExpense, date, platformId) {
  const existing = await db.expenses
    .filter((e) => e.deletedAt == null && e.shiftId === shiftId && e.category === 'out_of_pocket')
    .first();

  const amtRaw = Number(outOfPocketExpense);
  if (Number.isFinite(amtRaw) && amtRaw > 0) {
    if (existing) {
      await updateExpense(existing.id, {
        amount: amtRaw,
        date,
        platformId,
        deductiblePct: 0,
      });
    } else {
      await saveExpense({
        category: 'out_of_pocket',
        amount: amtRaw,
        date,
        platformId,
        deductiblePct: 0,
        notes: `Out-of-pocket ordering expense during shift`,
        shiftId,
      });
    }
  } else {
    if (existing) {
      await deleteExpense(existing.id);
    }
  }
}

/**
 * Insert shift (Feature 33–46 + save action).
 * Emits SHIFT_SAVED with `{ id }`.
 * @param {Record<string, unknown>} shiftData
 */
export async function saveShift(shiftData) {
  const row = normalizeShiftInput(shiftData);
  validateTimeWindow(row.startTime, row.endTime);
  const conflict = await checkConflict(row.date, row.startTime, row.endTime, { platformId: row.platformId });
  if (conflict) throw new Error('shift:conflict');

  const id = await db.shifts.add(row);
  if (shiftData.outOfPocketExpense != null) {
    await syncShiftOutOfPocketExpense(id, shiftData.outOfPocketExpense, row.date, row.platformId);
  }
  await syncShiftPlatformRows(id, shiftData.shiftPlatforms);
  bus.emit(SHIFT_SAVED, { id });
  return id;
}

/**
 * Patch update shift.
 * Emits SHIFT_SAVED with `{ id }`.
 * @param {string} id
 * @param {Record<string, unknown>} patch
 */
export async function updateShift(id, patch) {
  const prev = await db.shifts.get(id);
  if (!prev) throw new Error('shift:not_found');

  const nextPatch = { ...patch };
  if (nextPatch.gross !== undefined) {
    nextPatch.grossRevenue = Math.max(0, moneyToNumber(nextPatch.gross) ?? 0);
    delete nextPatch.gross;
  }
  if (nextPatch.tips !== undefined) {
    nextPatch.tipsRevenue = Math.max(0, moneyToNumber(nextPatch.tips) ?? 0);
    delete nextPatch.tips;
  }
  if (nextPatch.bonus !== undefined || nextPatch.bonusEarnings !== undefined || nextPatch.bonusAmount !== undefined) {
    // Mobile has a real top-level bonusAmount column (interop plan Workstream 1, Dexie v7) — mirror
    // it directly, same treatment as grossRevenue/tipsRevenue above.
    nextPatch.bonusAmount = Math.max(0, moneyToNumber(nextPatch.bonusAmount ?? nextPatch.bonusEarnings ?? nextPatch.bonus) ?? 0);
    delete nextPatch.bonus;
    delete nextPatch.bonusEarnings;
  }
  if (nextPatch.orders !== undefined || nextPatch.deliveryCount !== undefined) {
    nextPatch.deliveryCount = clampNum(nextPatch.deliveryCount ?? nextPatch.orders, { min: 0 });
    delete nextPatch.orders;
  }
  if (nextPatch.distanceKm !== undefined || nextPatch.activeMileage !== undefined) {
    nextPatch.activeMileage = clampNum(nextPatch.activeMileage ?? nextPatch.distanceKm, { min: 0 }) ?? 0;
    delete nextPatch.distanceKm;
  }
  if (nextPatch.deadMilesKm !== undefined || nextPatch.deadMileage !== undefined) {
    const dm = clampNum(nextPatch.deadMileage ?? nextPatch.deadMilesKm, { min: 0 });
    nextPatch.deadMileage = dm == null ? 0 : dm;
    delete nextPatch.deadMilesKm;
  }
  if (nextPatch.durationMinutes !== undefined || nextPatch.durationSeconds !== undefined) {
    nextPatch.durationSeconds =
      nextPatch.durationSeconds != null
        ? Math.max(0, Math.round(Number(nextPatch.durationSeconds) || 0))
        : Math.max(0, Math.round((Number(nextPatch.durationMinutes) || 0) * 60));
    delete nextPatch.durationMinutes;
  }
  // Multi-platform breakdown (interop plan Workstream 4): `shiftPlatforms` lives in its own Dexie
  // table (persisted below, after `db.shifts.put`), never on the shift row itself — when present,
  // it also re-derives the shift's aggregate grossRevenue/tipsRevenue/deliveryCount the same way
  // `normalizeShiftInput` does for new shifts (see there for why summing is safe for the
  // single-platform case). `patch.shiftPlatforms` (pre-strip) is kept around for the persistence
  // call at the bottom of this function.
  const shiftPlatformsPatch = nextPatch.shiftPlatforms;
  if (nextPatch.shiftPlatforms !== undefined) {
    const platformRows = normalizeShiftPlatformRows(nextPatch.shiftPlatforms);
    if (platformRows.length) {
      nextPatch.grossRevenue = Math.max(0, platformRows.reduce((sum, r) => sum + r.grossRevenue, 0));
      nextPatch.tipsRevenue = Math.max(0, platformRows.reduce((sum, r) => sum + r.tipsRevenue, 0));
      nextPatch.deliveryCount = platformRows.reduce((sum, r) => sum + r.tripsCount, 0);
    }
    delete nextPatch.shiftPlatforms;
  }

  const next = {
    ...prev,
    ...nextPatch,
    updatedAt: nowIso(),
    syncUpdatedAt: Date.now(),
  };

  // Normalize critical fields if present.
  if (patch.date != null) {
    if (!isYmd(next.date)) throw new Error('shift:date:invalid');
  }
  if (patch.platformId != null) {
    if (!normStr(next.platformId)) throw new Error('shift:platform:required');
  }
  // Fix 1 (interop plan) — startTime/endTime are epoch-ms timestamps in the stored row; `patch`
  // (from shift-form.js's getValue()) still supplies them as HH:mm time-of-day strings, combined
  // here with `next.date` (the same conversion normalizeShiftInput does for new shifts). A caller
  // that already passes a resolved epoch-ms number (e.g. a future sync-merge apply) passes straight
  // through unchanged.
  if (patch.startTime !== undefined || patch.endTime !== undefined) {
    const startAlreadyMs = typeof patch.startTime === 'number' && Number.isFinite(patch.startTime);
    const endAlreadyMs = typeof patch.endTime === 'number' && Number.isFinite(patch.endTime);
    const startHm = !startAlreadyMs && isHm(patch.startTime) ? String(patch.startTime) : null;
    const endHm = !endAlreadyMs && isHm(patch.endTime) ? String(patch.endTime) : null;
    if (startAlreadyMs || endAlreadyMs) {
      next.startTime = startAlreadyMs ? patch.startTime : typeof prev.startTime === 'number' ? prev.startTime : null;
      next.endTime = endAlreadyMs ? patch.endTime : typeof prev.endTime === 'number' ? prev.endTime : null;
    } else if (startHm || endHm) {
      const derived = deriveShiftTimestamps(next.date, startHm, endHm, next.durationSeconds);
      next.startTime = startHm ? derived.startMs : typeof prev.startTime === 'number' ? prev.startTime : null;
      next.endTime = endHm ? derived.endMs : typeof prev.endTime === 'number' ? prev.endTime : null;
    } else {
      // Explicit null/invalid clear.
      if (patch.startTime !== undefined) next.startTime = null;
      if (patch.endTime !== undefined) next.endTime = null;
    }
  }
  if (patch.date != null && typeof next.startTime === 'number') {
    // Date changed independently of time-of-day — re-anchor the stored timestamp onto the new
    // calendar date, keeping the same time-of-day, so `date` and `startTime` never disagree.
    const hm = hmFromMs(next.startTime);
    if (hm) {
      const durSec = typeof next.durationSeconds === 'number' ? next.durationSeconds : 0;
      const endHm = typeof next.endTime === 'number' ? hmFromMs(next.endTime) : null;
      const derived = deriveShiftTimestamps(next.date, hm, endHm, durSec);
      next.startTime = derived.startMs;
      next.endTime = derived.endMs;
    }
  }
  if (
    patch.platformId != null ||
    patch.platformSpecific != null ||
    patch.customFields != null ||
    patch.peakPay != null ||
    patch.multiAppPlatformIds != null ||
    patch.isMultiApp != null
  ) {
    const platformExtra = extractShiftPlatformSpecific(next);
    const baseCf =
      next.customFields && typeof next.customFields === 'object'
        ? /** @type {Record<string, unknown>} */ ({ .../** @type {object} */ (next.customFields) })
        : {};
    next.customFields = { ...baseCf, ...platformExtra.platformSpecific };
    if (platformExtra.peakPay != null) next.customFields.peakPay = platformExtra.peakPay;
    next.isMultiApp = platformExtra.isMultiApp;
    next.multiAppPlatformIds = platformExtra.multiAppPlatformIds;
    delete next.platformSpecific;
    delete next.peakPay;
  }
  if (patch.provinceId != null) next.provinceId = resolveProvinceId({ provinceId: patch.provinceId });
  if (patch.vehicleId !== undefined) {
    // vehicles.id is a client-generated string (Fix 2) — no numeric coercion.
    next.vehicleId = patch.vehicleId == null || patch.vehicleId === '' ? null : String(patch.vehicleId);
  }

  validateTimeWindow(next.startTime, next.endTime);
  const conflict = await checkConflict(next.date, next.startTime, next.endTime, { excludeId: id, platformId: next.platformId });
  if (conflict) throw new Error('shift:conflict');

  await db.shifts.put(next);
  if (patch.outOfPocketExpense !== undefined) {
    await syncShiftOutOfPocketExpense(id, patch.outOfPocketExpense, next.date, next.platformId);
  }
  if (shiftPlatformsPatch !== undefined) {
    await syncShiftPlatformRows(id, shiftPlatformsPatch);
  }
  bus.emit(SHIFT_SAVED, { id });
}

/**
 * Soft delete (Feature 48). Emits SHIFT_DELETED with `{ id }`.
 * @param {string} id
 */
export async function deleteShift(id) {
  await softDelete('shifts', id);
  const oop = await db.expenses
    .filter((e) => e.deletedAt == null && e.shiftId === id && e.category === 'out_of_pocket')
    .toArray();
  for (const e of oop) {
    await deleteExpense(e.id);
  }
  // Tombstone the shift's multi-platform breakdown rows alongside the shift itself (interop plan
  // Workstream 4) — `shiftPlatforms` has no `deletedAt`/softDelete() convention of its own (see
  // db.js), only the sync tombstone column, so this bumps it directly.
  const platformRows = await db.shiftPlatforms.where('shiftId').equals(id).toArray();
  const syncNow = Date.now();
  for (const r of platformRows) {
    if (r.syncDeletedAt == null) {
      await db.shiftPlatforms.update(r.id, { syncDeletedAt: syncNow, syncUpdatedAt: syncNow });
    }
  }
  bus.emit(SHIFT_DELETED, { id });
}

/**
 * Restore from trash (Feature 49). Emits SHIFT_SAVED with `{ id }`.
 * @param {string} id
 */
export async function restoreShift(id) {
  await restoreDeleted('shifts', id);
  const oop = await db.expenses
    .filter((e) => e.deletedAt != null && e.shiftId === id && e.category === 'out_of_pocket')
    .toArray();
  for (const e of oop) {
    await restoreDeleted('expenses', e.id);
  }
  const platformRows = await db.shiftPlatforms.where('shiftId').equals(id).toArray();
  const syncNow = Date.now();
  for (const r of platformRows) {
    if (r.syncDeletedAt != null) {
      await db.shiftPlatforms.update(r.id, { syncDeletedAt: null, syncUpdatedAt: syncNow });
    }
  }
  bus.emit(SHIFT_SAVED, { id });
}

/**
 * Permanently delete shifts older than 30 days in trash (Feature 49).
 */
export async function purgeShifts() {
  await purgeOldDeleted('shifts', 30);
}

/**
 * Duplicate shift (Feature 50) — returns a new shift-form-shaped object (no id) for prefill.
 * @param {string} id
 */
export async function duplicateShift(id) {
  const s = await db.shifts.get(id);
  if (!s) throw new Error('shift:not_found');
  const {
    id: _id,
    createdAt: _c,
    updatedAt: _u,
    deletedAt: _d,
    syncUpdatedAt: _su,
    syncDeletedAt: _sd,
    ...rest
  } = shiftRowToFormTimeFields(s);
  // Carry the multi-platform breakdown along so a duplicated shift reopens with the same
  // platform split pre-filled (interop plan Workstream 4), instead of collapsing to a single row
  // holding the original's aggregate total.
  const platformRows = await db.shiftPlatforms
    .where('shiftId')
    .equals(id)
    .filter((r) => r.syncDeletedAt == null)
    .toArray();
  if (platformRows.length) {
    rest.shiftPlatforms = platformRows.map((r) => ({
      platform: r.platform,
      grossRevenue: r.grossRevenue,
      tipsRevenue: r.tipsRevenue,
      tripsCount: r.tripsCount,
      platformOnlineSeconds: r.platformOnlineSeconds,
      platformActiveSeconds: r.platformActiveSeconds,
    }));
  }
  return { ...rest };
}

/**
 * Templates: stored in appState as array of `{ id, name, data, createdAt }`.
 * @typedef {{ id: string, name: string, data: Record<string, unknown>, createdAt: string }} ShiftTemplate
 */

function templateId() {
  return `tpl_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

/** @returns {Promise<ShiftTemplate[]>} */
export async function getTemplates() {
  const raw = await getAppState(APP_STATE_TEMPLATES_KEY);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t) => t && typeof t === 'object')
    .map((t) => /** @type {any} */ (t))
    .filter((t) => typeof t.id === 'string' && typeof t.name === 'string' && typeof t.data === 'object' && t.data);
}

/**
 * Save template (Feature 51).
 * @param {Record<string, unknown>} shiftData
 * @param {string} name
 */
export async function saveAsTemplate(shiftData, name) {
  const nm = normStr(name);
  if (!nm) throw new Error('template:name:required');
  const list = await getTemplates();
  const t = nowIso();
  const next = [
    { id: templateId(), name: nm, data: { ...shiftData }, createdAt: t },
    ...list,
  ].slice(0, 50);
  await setAppState(APP_STATE_TEMPLATES_KEY, next);
  return next[0].id;
}

/**
 * Apply template to form (Feature 51). Returns data payload.
 * @param {string} templateId
 */
export async function applyTemplate(templateId) {
  const list = await getTemplates();
  const tpl = list.find((t) => t.id === templateId);
  if (!tpl) throw new Error('template:not_found');
  return { ...tpl.data };
}

/**
 * Live shift timer (Feature 32).
 * Writes `{ startTime, initialStartTime, platformId, pausedAt, elapsedMs, targetTime, targetTimeNotified, vehicleId }` to `appState` and localStorage.
 * @param {string} platformId
 * @param {string|null} [targetTime]
 * @param {string|null} [vehicleId]
 */
export async function startShiftTimer(platformId, targetTime = null, vehicleId = null) {
  const pid = normStr(platformId);
  if (!pid) throw new Error('shift:platform:required');
  const t = nowIso();
  const payload = {
    startTime: t,
    initialStartTime: t,
    platformId: pid,
    pausedAt: null,
    elapsedMs: 0,
    targetTime: targetTime ? new Date(targetTime).toISOString() : null,
    targetTimeNotified: false,
    vehicleId: vehicleId ? String(vehicleId) : null,
  };
  await setAppState(APP_STATE_TIMER_KEY, payload);
  try {
    localStorage.setItem(LS_TIMER_KEY, JSON.stringify(payload));
  } catch {
    /* private mode */
  }
  bus.emit(SHIFT_TIMER_START, payload);

  /* Feature 248 — Wake Lock managed by P12 PWA module (re-acquires on visibility). */
  void acquireWakeLock().catch(() => {});

  /* Start real-time GPS coordinate tracking for distance calculation. */
  void GPSTracker.start().catch((err) => console.warn('[GPSTracker] Start failed', err));
}

/**
 * Pauses the active shift timer.
 */
export async function pauseShiftTimer() {
  const state = (await getAppState(APP_STATE_TIMER_KEY)) || null;
  if (!state || state.pausedAt) return;

  const ms = Date.now() - new Date(state.startTime).getTime();
  const payload = {
    ...state,
    pausedAt: nowIso(),
    elapsedMs: (state.elapsedMs || 0) + ms,
  };

  await setAppState(APP_STATE_TIMER_KEY, payload);
  try {
    localStorage.setItem(LS_TIMER_KEY, JSON.stringify(payload));
  } catch {}
  bus.emit(SHIFT_TIMER_START, payload);

  void releaseWakeLock().catch(() => {});

  /* Pause GPS tracking during breaks to preserve battery */
  GPSTracker.pause();
}

/**
 * Resumes the paused shift timer.
 */
export async function resumeShiftTimer() {
  const state = (await getAppState(APP_STATE_TIMER_KEY)) || null;
  if (!state || !state.pausedAt) return;

  const payload = {
    ...state,
    startTime: nowIso(),
    pausedAt: null,
  };

  await setAppState(APP_STATE_TIMER_KEY, payload);
  try {
    localStorage.setItem(LS_TIMER_KEY, JSON.stringify(payload));
  } catch {}
  bus.emit(SHIFT_TIMER_START, payload);

  void acquireWakeLock().catch(() => {});

  /* Resume GPS tracking after the break */
  void GPSTracker.resume().catch((err) => console.warn('[GPSTracker] Resume failed', err));
}

function getDistanceUnit() {
  const user = store.get('user');
  return user && user.locale && typeof user.locale.distanceUnit === 'string' ? user.locale.distanceUnit : 'km';
}

/**
 * Stop timer, clear persisted state, and return prefill payload for shift form.
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function stopShiftTimer() {
  /** @type {any} */
  const state = (await getAppState(APP_STATE_TIMER_KEY)) || null;
  await setAppState(APP_STATE_TIMER_KEY, null);
  try {
    localStorage.removeItem(LS_TIMER_KEY);
  } catch {
    /* ignore */
  }
  bus.emit(SHIFT_TIMER_STOP, null);

  /* Feature 248 — release the wake lock when the timer stops. */
  void releaseWakeLock().catch(() => {});

  /* Stop real-time GPS coordinate tracking and compute accumulated distance splits */
  const splits = GPSTracker.stop();
  const totalKm = splits.total;
  const deadKm = splits.dead;

  let distanceVal = null;
  let deadMilesVal = null;

  if (totalKm > 0.01) {
    const unit = getDistanceUnit();
    const factor = unit === 'mi' ? 1.60934 : 1.0;
    distanceVal = parseFloat((totalKm / factor).toFixed(2));
    if (deadKm > 0.01) {
      deadMilesVal = parseFloat((deadKm / factor).toFixed(2));
    }
  }

  if (!state || !state.startTime) return null;

  let totalMs = state.elapsedMs || 0;
  if (!state.pausedAt) {
    totalMs += Date.now() - new Date(state.startTime).getTime();
  }

  const durMin = Math.max(0, Math.round(totalMs / 60000));
  const start = new Date(state.initialStartTime || state.startTime);
  const end = new Date();
  const date = ymdFromDate(start);
  const startHm = start.toTimeString().slice(0, 5);
  const endHm = end.toTimeString().slice(0, 5);

  return {
    platformId: state.platformId,
    vehicleId: state.vehicleId ? String(state.vehicleId) : undefined,
    date,
    startTime: startHm,
    endTime: endHm,
    activeMinutes: durMin,
    onlineMinutes: durMin,
    durationSeconds: Math.max(0, Math.round(totalMs / 1000)),
    distanceKm: totalKm > 0.01 ? parseFloat(totalKm.toFixed(4)) : null,
    distance: distanceVal,
    deadMilesKm: deadKm > 0.01 ? parseFloat(deadKm.toFixed(4)) : null,
    deadMiles: deadMilesVal,
    // GPS-tracked shifts (mobile parity — see distanceSource on the shifts table).
    distanceSource: totalKm > 0.01 ? 'gps_only' : 'manual',
  };
}

/**
 * On app-open: restore timer from localStorage into appState if missing.
 * (F11 requires localStorage restore; store reads from appState.)
 */
export async function restoreShiftTimerFromLocalStorage() {
  const current = await getAppState(APP_STATE_TIMER_KEY);
  if (current) {
    if (!current.pausedAt && !GPSTracker.isActive()) {
      void GPSTracker.start().catch((err) => console.warn('[GPSTracker] Restart failed', err));
    }
    return;
  }
  let raw = null;
  try {
    raw = localStorage.getItem(LS_TIMER_KEY);
  } catch {
    raw = null;
  }
  const parsed = safeJsonParse(raw, null);
  if (!parsed || typeof parsed !== 'object') return;
  const o = /** @type {any} */ (parsed);
  if (typeof o.startTime !== 'string') return;
  if (typeof o.platformId !== 'string') return;
  await setAppState(APP_STATE_TIMER_KEY, o);

  if (!o.pausedAt && !GPSTracker.isActive()) {
    void GPSTracker.start().catch((err) => console.warn('[GPSTracker] Start failed', err));
  }
}

