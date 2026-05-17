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

/** User-entered currency → integer cents (plan v3). */
function dollarsToCents(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function centsFromInput(input, keys) {
  for (const k of keys) {
    if (input[k] != null && input[k] !== '') {
      const n = Number(input[k]);
      if (Number.isFinite(n) && n >= 0) return Math.round(n);
    }
  }
  return null;
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
 * @property {number} [id]
 * @property {string} date YYYY-MM-DD
 * @property {string} platformId
 * @property {string} provinceId
 * @property {string|null} startTime HH:mm
 * @property {string|null} endTime HH:mm
 * @property {number|null} durationMinutes
 * @property {number|null} grossEarnings cents
 * @property {number|null} tips cents
 * @property {number|null} bonusEarnings cents
 * @property {number|null} deliveryCount
 * @property {number|null} distanceKm
 * @property {number|null} deadMilesKm
 * @property {number|null} onlineMinutes
 * @property {number|null} activeMinutes
 * @property {number|null} vehicleId
 * @property {string|null} weather
 * @property {string|null} mood
 * @property {string} notes
 * @property {boolean} isMultiApp
 * @property {string[]} multiAppPlatformIds
 * @property {Record<string, unknown>} customFields
 * @property {string|null} deletedAt
 * @property {string} createdAt
 * @property {string} updatedAt
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

  const startTime = isHm(input.startTime) ? String(input.startTime) : null;
  const endTime = isHm(input.endTime) ? String(input.endTime) : null;

  let durationMinutes = clampNum(input.durationMinutes, { min: 0 });
  if (durationMinutes == null && date && startTime && endTime) {
    durationMinutes = minutesBetween(date, startTime, endTime);
  }

  const grossEarnings = centsFromInput(input, ['grossEarnings']) ?? dollarsToCents(input.gross);
  const tips = centsFromInput(input, ['tips']) ?? dollarsToCents(input.tips);
  const bonusEarnings = centsFromInput(input, ['bonusEarnings']) ?? dollarsToCents(input.bonus);

  const deliveryCount = clampNum(input.deliveryCount ?? input.orders, { min: 0 });
  const distanceKm = clampNum(input.distanceKm, { min: 0 });
  const dm = clampNum(input.deadMilesKm, { min: 0 });
  const deadMilesKm = dm == null ? 0 : dm;
  const onlineMinutes = clampNum(input.onlineMinutes, { min: 0 });
  const activeMinutes = clampNum(input.activeMinutes, { min: 0 });
  const vehicleId = input.vehicleId == null ? null : clampNum(input.vehicleId, { min: 0 });

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

  const t = nowIso();
  return {
    date,
    platformId,
    provinceId,
    startTime,
    endTime,
    durationMinutes,
    grossEarnings,
    tips,
    bonusEarnings,
    deliveryCount,
    distanceKm,
    deadMilesKm,
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
  };
}

/**
 * Validate start/end time ordering when both present.
 * Allows end == start (0 minutes) for quick entries.
 * @param {string} date
 * @param {string|null} startTime
 * @param {string|null} endTime
 */
function validateTimeWindow(date, startTime, endTime) {
  if (!startTime || !endTime) return;
  const mins = minutesBetween(date, startTime, endTime);
  if (mins == null) return;
  if (mins < 0) throw new Error('shift:time:invalid');
}

/**
 * @param {number} id
 * @returns {Promise<ShiftRow | undefined>}
 */
export async function getShift(id) {
  return db.shifts.get(id);
}

/**
 * Feature 54 — check overlaps on same day for non-deleted shifts.
 * @param {string} date YYYY-MM-DD
 * @param {string|null} startTime HH:mm
 * @param {string|null} endTime HH:mm
 * @param {{ excludeId?: number, platformId?: string }} [opts]
 */
export async function checkConflict(date, startTime, endTime, opts = {}) {
  if (!isYmd(date) || !isHm(startTime) || !isHm(endTime)) return null;
  const excludeId = typeof opts.excludeId === 'number' ? opts.excludeId : null;
  const platformId = typeof opts.platformId === 'string' ? opts.platformId.trim().toLowerCase() : null;

  const shifts = await db.shifts.where('date').equals(date).toArray();
  const targetStart = new Date(`${date}T${startTime}:00`).getTime();
  let targetEnd = new Date(`${date}T${endTime}:00`).getTime();
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
    if (!isHm(s.startTime) || !isHm(s.endTime)) continue;
    const sStart = new Date(`${date}T${s.startTime}:00`).getTime();
    let sEnd = new Date(`${date}T${s.endTime}:00`).getTime();
    if (sEnd < sStart) {
      sEnd += 24 * 60 * 60 * 1000;
    }
    if (!Number.isFinite(sStart) || !Number.isFinite(sEnd)) continue;

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
    const mins = minutesBetween(date, s.startTime, s.endTime);
    if (mins != null && mins > 0) total += mins;
  }
  return { totalMinutes: total };
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
    .filter((e) => e.deletedAt == null && Number(e.shiftId) === Number(shiftId) && e.category === 'out_of_pocket')
    .first();

  const amtRaw = Number(outOfPocketExpense);
  if (Number.isFinite(amtRaw) && amtRaw > 0) {
    const amountCents = Math.round(amtRaw * 100);
    if (existing) {
      await updateExpense(existing.id, {
        amount: amountCents,
        date,
        platformId,
        businessPct: 0,
      });
    } else {
      await saveExpense({
        category: 'out_of_pocket',
        amount: amountCents,
        date,
        platformId,
        businessPct: 0,
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
  validateTimeWindow(row.date, row.startTime, row.endTime);
  const conflict = await checkConflict(row.date, row.startTime, row.endTime, { platformId: row.platformId });
  if (conflict) throw new Error('shift:conflict');

  const id = await db.shifts.add(row);
  if (shiftData.outOfPocketExpense != null) {
    await syncShiftOutOfPocketExpense(id, shiftData.outOfPocketExpense, row.date, row.platformId);
  }
  bus.emit(SHIFT_SAVED, { id });
  return id;
}

/**
 * Patch update shift.
 * Emits SHIFT_SAVED with `{ id }`.
 * @param {number} id
 * @param {Record<string, unknown>} patch
 */
export async function updateShift(id, patch) {
  const prev = await db.shifts.get(id);
  if (!prev) throw new Error('shift:not_found');

  const next = {
    ...prev,
    ...patch,
    updatedAt: nowIso(),
  };

  // Normalize critical fields if present.
  if (patch.date != null) {
    if (!isYmd(next.date)) throw new Error('shift:date:invalid');
  }
  if (patch.platformId != null) {
    if (!normStr(next.platformId)) throw new Error('shift:platform:required');
  }
  if (patch.startTime != null) next.startTime = isHm(next.startTime) ? next.startTime : null;
  if (patch.endTime != null) next.endTime = isHm(next.endTime) ? next.endTime : null;
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

  validateTimeWindow(next.date, next.startTime, next.endTime);
  const conflict = await checkConflict(next.date, next.startTime, next.endTime, { excludeId: id, platformId: next.platformId });
  if (conflict) throw new Error('shift:conflict');

  await db.shifts.put(next);
  if (patch.outOfPocketExpense !== undefined) {
    await syncShiftOutOfPocketExpense(id, patch.outOfPocketExpense, next.date, next.platformId);
  }
  bus.emit(SHIFT_SAVED, { id });
}

/**
 * Soft delete (Feature 48). Emits SHIFT_DELETED with `{ id }`.
 * @param {number} id
 */
export async function deleteShift(id) {
  await softDelete('shifts', id);
  const oop = await db.expenses
    .filter((e) => e.deletedAt == null && Number(e.shiftId) === Number(id) && e.category === 'out_of_pocket')
    .toArray();
  for (const e of oop) {
    await deleteExpense(e.id);
  }
  bus.emit(SHIFT_DELETED, { id });
}

/**
 * Restore from trash (Feature 49). Emits SHIFT_SAVED with `{ id }`.
 * @param {number} id
 */
export async function restoreShift(id) {
  await restoreDeleted('shifts', id);
  const oop = await db.expenses
    .filter((e) => e.deletedAt != null && Number(e.shiftId) === Number(id) && e.category === 'out_of_pocket')
    .toArray();
  for (const e of oop) {
    await restoreDeleted('expenses', e.id);
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
 * Duplicate shift (Feature 50) — returns a new shift object (no id) for prefill.
 * @param {number} id
 */
export async function duplicateShift(id) {
  const s = await db.shifts.get(id);
  if (!s) throw new Error('shift:not_found');
  const { id: _id, createdAt: _c, updatedAt: _u, deletedAt: _d, ...rest } = s;
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
 * Writes `{ startTime, platformId }` to `appState` and localStorage.
 * @param {string} platformId
 */
export async function startShiftTimer(platformId) {
  const pid = normStr(platformId);
  if (!pid) throw new Error('shift:platform:required');
  const payload = { startTime: nowIso(), platformId: pid };
  await setAppState(APP_STATE_TIMER_KEY, payload);
  try {
    localStorage.setItem(LS_TIMER_KEY, JSON.stringify(payload));
  } catch {
    /* private mode */
  }
  bus.emit(SHIFT_TIMER_START, payload);

  /* Feature 248 — Wake Lock managed by P12 PWA module (re-acquires on visibility). */
  void acquireWakeLock().catch(() => {});
}

/**
 * Stop timer, clear persisted state, and return prefill payload for shift form.
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function stopShiftTimer() {
  /** @type {{ startTime?: unknown, platformId?: unknown } | null} */
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

  const startIso = state && typeof state.startTime === 'string' ? state.startTime : null;
  const platformId = state && typeof state.platformId === 'string' ? state.platformId : null;
  if (!startIso) return null;

  const start = new Date(startIso);
  const end = new Date();
  const durMin = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  const date = ymdFromDate(start);
  const startHm = start.toTimeString().slice(0, 5);
  const endHm = end.toTimeString().slice(0, 5);

  return {
    platformId,
    date,
    startTime: startHm,
    endTime: endHm,
    activeMinutes: durMin,
    onlineMinutes: durMin,
  };
}

/**
 * On app-open: restore timer from localStorage into appState if missing.
 * (F11 requires localStorage restore; store reads from appState.)
 */
export async function restoreShiftTimerFromLocalStorage() {
  const current = await getAppState(APP_STATE_TIMER_KEY);
  if (current) return;
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
  await setAppState(APP_STATE_TIMER_KEY, { startTime: o.startTime, platformId: o.platformId });
}

