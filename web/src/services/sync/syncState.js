/**
 * Sync state KV keys + reset helpers (interop plan Workstream 3).
 *
 * Ports mobile's `commaApp/src/database/syncState.ts` web branch (mobile's own web build already
 * stores this exact KV in `localStorage` under `comma_<key>` — this file matches that convention
 * byte-for-byte so the keys/shapes never need translating).
 *
 * These are DEVICE-LOCAL settings — they describe THIS browser's sync state and are never synced
 * to other devices:
 *   - sync_device_id    : random id, generated once per browser/profile, RE-MINTED on vault reset.
 *   - sync_enabled      : '1' when the user has Cloud Sync turned on.
 *   - sync_applied_logs : JSON array (a SET) of change-log filenames already applied.
 *                         NOT a scalar watermark — out-of-order uploads and partial failures
 *                         self-heal because it's a membership set, not a single cursor.
 *   - sync_last_pushed_at : epoch-ms high-water mark of my own changes already pushed.
 */

import { newDashFreeId } from '../../core/id.js';
import { coerceSchedule } from './schedule.js';
import { getAppState } from '../../core/db.js';

export const SYNC_KEYS = {
  deviceId: 'sync_device_id',
  enabled: 'sync_enabled',
  appliedLogs: 'sync_applied_logs',
  lastPushedAt: 'sync_last_pushed_at', // CURSOR: max syncUpdatedAt already pushed
  schedule: 'sync_schedule', // auto-push cadence: 'manual' | 'daily' | 'weekly'
  lastPushRunAt: 'sync_last_push_run_at', // WALL-CLOCK ms of the last push run (schedule timer)
  failedLogs: 'sync_failed_logs', // JSON object {filename: consecutive apply-failure count}
  forgottenLogs: 'sync_forgotten_logs', // JSON array — filenames abandoned via "Forgot password?"
};

/** A log that fails to apply this many times is QUARANTINED: pull stops re-downloading it. */
export const LOG_QUARANTINE_THRESHOLD = 3;

/**
 * A fresh per-browser device id. Dash-free by construction (see `newDashFreeId`) so it
 * round-trips cleanly through change-log filenames (`comma-cl-{deviceId}-{epochMs}.cmlog`,
 * parsed by splitting on the LAST dash — see `changeLog.js`). The `dev_` prefix (underscore, not
 * dash) makes it greppable in logs/filenames without affecting the dash-split parse.
 * @returns {string}
 */
export function newDeviceId() {
  return `dev_${newDashFreeId(16)}`;
}

/**
 * The post-reset sync state values. Pure — no I/O. Sync is turned OFF and all cursors are
 * cleared; the caller supplies the freshly re-minted id.
 * @param {string} freshDeviceId
 * @returns {Record<string, string>}
 */
export function postResetSyncState(freshDeviceId) {
  return {
    [SYNC_KEYS.enabled]: '0', // sync OFF — a true clean slate that won't auto-refill
    [SYNC_KEYS.deviceId]: freshDeviceId, // re-minted so old cloud logs read as "not mine"
    [SYNC_KEYS.appliedLogs]: '[]', // forget which change-logs were applied
    [SYNC_KEYS.lastPushedAt]: '0', // reset push cursor
    [SYNC_KEYS.lastPushRunAt]: '0', // reset the schedule timer
    [SYNC_KEYS.failedLogs]: '{}', // forget quarantine history
  };
}

/**
 * Apply the post-reset sync KV (call AFTER wiping local data, e.g. from the vault-reset flow).
 * @param {string} freshDeviceId
 */
export function applyPostResetSyncState(freshDeviceId) {
  const state = postResetSyncState(freshDeviceId);
  for (const [key, value] of Object.entries(state)) {
    localStorage.setItem(`comma_${key}`, value);
  }
}

// ─── Cursor read/write (consumed by the push/pull engine) ─────────────────────

/** @param {string} key @returns {string | null} */
function readSyncKey(key) {
  try {
    return localStorage.getItem(`comma_${key}`);
  } catch {
    return null;
  }
}

/** @param {string} key @param {string} value */
function writeSyncKey(key, value) {
  try {
    localStorage.setItem(`comma_${key}`, value);
  } catch {
    /* private mode / quota */
  }
}

/**
 * This browser's sync id. Generated + persisted on first read if missing. Re-minted on Reset
 * (see `applyPostResetSyncState`).
 * @returns {string}
 */
export function getDeviceId() {
  const existing = readSyncKey(SYNC_KEYS.deviceId);
  if (existing) return existing;
  const fresh = newDeviceId();
  writeSyncKey(SYNC_KEYS.deviceId, fresh);
  return fresh;
}

/** @returns {boolean} */
export function isSyncEnabled() {
  return readSyncKey(SYNC_KEYS.enabled) === '1';
}

/**
 * Whether Demo Mode is active. Reads straight from the `appState` IndexedDB table (not the
 * reactive `store.demoMode` mirror), so low-level callers like the sync engine can gate on it
 * without depending on the store having hydrated yet. Sync must never run in demo mode — the
 * seeded sample data would overwrite the user's real cloud copy. Mirrors mobile's
 * `src/database/syncState.ts` `isDemoModeActive()`.
 * @returns {Promise<boolean>}
 */
export async function isDemoModeActive() {
  return (await getAppState('demo_mode')) === true;
}

/** @param {boolean} enabled */
export function setSyncEnabled(enabled) {
  writeSyncKey(SYNC_KEYS.enabled, enabled ? '1' : '0');
}

/** epoch-ms high-water mark of my own changes already pushed (0 if never pushed). @returns {number} */
export function getLastPushedAt() {
  const raw = readSyncKey(SYNC_KEYS.lastPushedAt);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

/** @param {number} value */
export function setLastPushedAt(value) {
  writeSyncKey(SYNC_KEYS.lastPushedAt, String(value));
}

/**
 * Wipe this browser's cloud-tracking cursors for a fresh start against a rebuilt vault (the
 * "Forgot password → reset the cloud" flow). Rewinds the push cursor to 0 so the next push
 * re-uploads FULL local state, and forgets the applied/quarantine/forgotten sets (they named
 * files that no longer exist). Deliberately does NOT touch the device id or the sync-enabled
 * flag — this keeps LOCAL data, only the cloud copy was rebuilt.
 */
export function clearSyncTrackingForCloudReset() {
  writeSyncKey(SYNC_KEYS.appliedLogs, '[]');
  writeSyncKey(SYNC_KEYS.lastPushedAt, '0');
  writeSyncKey(SYNC_KEYS.failedLogs, '{}');
  writeSyncKey(SYNC_KEYS.forgottenLogs, '[]');
}

/**
 * The set of change-log filenames already applied (or authored) by this device. Stored as a
 * JSON array; returned as a Set for O(1) membership tests during pull.
 * @returns {Set<string>}
 */
export function getAppliedLogs() {
  const raw = readSyncKey(SYNC_KEYS.appliedLogs);
  if (!raw) return new Set();
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

/** Add a filename to the applied-logs set and persist. Idempotent. @param {string} filename */
export function addAppliedLog(filename) {
  const set = getAppliedLogs();
  if (set.has(filename)) return;
  set.add(filename);
  writeSyncKey(SYNC_KEYS.appliedLogs, JSON.stringify([...set]));
}

/** The user's auto-push cadence. @returns {import('./schedule.js').SyncSchedule} */
export function getSyncSchedule() {
  return coerceSchedule(readSyncKey(SYNC_KEYS.schedule));
}

/** @param {import('./schedule.js').SyncSchedule} schedule */
export function setSyncSchedule(schedule) {
  writeSyncKey(SYNC_KEYS.schedule, schedule);
}

/** Wall-clock (epoch ms) of the last push RUN — the schedule timer. 0 if never pushed. @returns {number} */
export function getLastPushRunAt() {
  const raw = readSyncKey(SYNC_KEYS.lastPushRunAt);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

/** @param {number} value */
export function setLastPushRunAt(value) {
  writeSyncKey(SYNC_KEYS.lastPushRunAt, String(value));
}

/**
 * Record the wall-clock of the last successful cloud save (ISO string) under `last_backup_at` —
 * reused so the Dashboard "your data is safe" status also reflects a successful sync push, not
 * only a manual `.comdb` backup.
 * @param {string} iso
 */
export function setLastCloudSaveAt(iso) {
  writeSyncKey('last_backup_at', iso);
}

// ─── Poison-log quarantine (interop-audit Gap 5) ─────────────────────────────────
//
// A change-log whose apply keeps throwing (e.g. a row shape this build can't store) must not
// wedge the pull pipeline forever: without this, the failing log is re-downloaded and re-failed
// on every sync, and every log queued behind it is never applied. Failures are counted per
// filename; at LOG_QUARANTINE_THRESHOLD the file is skipped by pull (it stays on Drive — a
// later app update can clear the counter and retry it).

/** @returns {Record<string, number>} filename → consecutive apply-failure count */
export function getLogFailureCounts() {
  const raw = readSyncKey(SYNC_KEYS.failedLogs);
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  } catch {
    return {};
  }
}

/** Bump a log's failure count. @param {string} filename @returns {number} the new count */
export function recordLogFailure(filename) {
  const counts = getLogFailureCounts();
  counts[filename] = (Number(counts[filename]) || 0) + 1;
  writeSyncKey(SYNC_KEYS.failedLogs, JSON.stringify(counts));
  return counts[filename];
}

/** Forget a log's failures (called after it finally applies cleanly). @param {string} filename */
export function clearLogFailure(filename) {
  const counts = getLogFailureCounts();
  if (!(filename in counts)) return;
  delete counts[filename];
  writeSyncKey(SYNC_KEYS.failedLogs, JSON.stringify(counts));
}

/** @returns {Set<string>} filenames pull should skip (failed ≥ LOG_QUARANTINE_THRESHOLD times) */
export function getQuarantinedLogs() {
  const counts = getLogFailureCounts();
  const out = new Set();
  for (const [name, count] of Object.entries(counts)) {
    if (Number(count) >= LOG_QUARANTINE_THRESHOLD) out.add(name);
  }
  return out;
}

/** Wipe ALL failure counts — e.g. after a wrong-password attempt failed every log (the logs
 *  are fine; the password was wrong) so good files don't end up quarantined. */
export function resetLogFailures() {
  writeSyncKey(SYNC_KEYS.failedLogs, '{}');
}

// ─── Forgotten-password abandonment ("Forgot password?" on the sync screen) ─────────────
//
// Deliberately separate from the quarantine above. Quarantine is for a BUG — apply logic
// that keeps throwing — and can be retried later. A file abandoned here failed for a
// different reason: the user explicitly said they no longer have the password that
// encrypted it. That's permanent, so unlike the quarantine counters this must NOT be
// cleared by `resetLogFailures` or a routine vault reset — doing so would silently
// resurrect the exact prompt the user already dismissed on purpose.

/** @returns {Set<string>} filenames explicitly abandoned via "Forgot password?" */
export function getForgottenLogs() {
  const raw = readSyncKey(SYNC_KEYS.forgottenLogs);
  if (!raw) return new Set();
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

/**
 * Permanently mark filenames as abandoned. Call AFTER a "Forgot password?" reset wipes
 * local state (not before) — forgottenLogs is deliberately excluded from
 * `postResetSyncState` so it isn't clobbered by a routine, unrelated vault reset later.
 * @param {string[]} filenames
 */
export function forgetLogsPermanently(filenames) {
  if (!filenames.length) return;
  const existing = getForgottenLogs();
  filenames.forEach((f) => existing.add(f));
  writeSyncKey(SYNC_KEYS.forgottenLogs, JSON.stringify([...existing]));
}
