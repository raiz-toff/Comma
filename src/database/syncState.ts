/**
 * Sync state KV keys + reset helpers (cloud-sync P1 — see app/docs/sync-design.md §2, §4a).
 *
 * These are DEVICE-LOCAL settings (the "device-local" bucket in §1a) — they describe
 * THIS install's sync state and are never synced to other devices:
 *   - sync_device_id    : random id, generated once per install, RE-MINTED on Reset.
 *   - sync_enabled      : '1' when the user has Cloud Sync turned on (free; no paywall).
 *   - sync_applied_logs : JSON array (a SET) of change-log filenames already applied.
 *                         NOT a scalar watermark — see the §2 box for why.
 *   - sync_last_pushed_at : epoch-ms high-water mark of my own changes already pushed.
 *
 * P1 only needs the keys + the Reset behavior; the push/pull engine that consumes
 * them arrives in P2/P3.
 */

import { customAlphabet } from "nanoid/non-secure";
import { Platform } from "react-native";
import { eq } from "drizzle-orm";
import { db } from "./client";
import { settings } from "./schema";
import { coerceSchedule, type SyncSchedule } from "../services/sync/schedule";

const isWeb = Platform.OS === "web";

/**
 * Device-id generator over a DASH-FREE alphanumeric alphabet. This is deliberate:
 * change-log filenames are `comma-cl-{deviceId}-{epochMs}.cmlog` and are parsed by
 * splitting on the LAST dash. nanoid's DEFAULT alphabet contains '-', which would make
 * a device's own id un-round-trippable through the filename and break the "not authored
 * by me" pull filter. A dash-free id keeps build → parse → compare exact. 16 chars over
 * 62 symbols ≈ 95 bits — ample to avoid cross-device collisions.
 */
const genDeviceId = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  16
);

export const SYNC_KEYS = {
  deviceId: "sync_device_id",
  enabled: "sync_enabled",
  appliedLogs: "sync_applied_logs",
  lastPushedAt: "sync_last_pushed_at", // CURSOR: max syncUpdatedAt already pushed
  schedule: "sync_schedule", // auto-push cadence: 'manual' | 'daily' | 'weekly'
  lastPushRunAt: "sync_last_push_run_at", // WALL-CLOCK ms of the last push run (schedule timer)
  failedLogs: "sync_failed_logs", // JSON object {filename: consecutive apply-failure count}
  applyVersion: "sync_apply_version", // APPLY_LOGIC_VERSION last seen — quarantine resets on change
  forgottenLogs: "sync_forgotten_logs", // JSON array — filenames abandoned via "Forgot password?"
} as const;

/** A log that fails to apply this many times is QUARANTINED: pull stops re-downloading it. */
export const LOG_QUARANTINE_THRESHOLD = 3;

/** A fresh per-install device id. Dash-free by construction (see genDeviceId) so it
 *  round-trips cleanly through change-log filenames. The `dev_` prefix (underscore, not
 *  dash) makes it greppable in logs/filenames without affecting the dash-split parse. */
export function newDeviceId(): string {
  return `dev_${genDeviceId()}`;
}

/**
 * The post-reset sync state values. Pure — no I/O — so the same object is applied to
 * whichever storage backend (settings table or localStorage) the caller uses. Sync is
 * turned OFF and all cursors are cleared; the caller supplies the freshly re-minted id.
 */
export function postResetSyncState(freshDeviceId: string): Record<string, string> {
  return {
    [SYNC_KEYS.enabled]: "0", // sync OFF — a true clean slate that won't auto-refill
    [SYNC_KEYS.deviceId]: freshDeviceId, // re-minted so old cloud logs read as "not mine"
    [SYNC_KEYS.appliedLogs]: "[]", // forget which change-logs were applied
    [SYNC_KEYS.lastPushedAt]: "0", // reset push cursor
    [SYNC_KEYS.lastPushRunAt]: "0", // reset the schedule timer
    [SYNC_KEYS.failedLogs]: "{}", // forget quarantine history
  };
}

/**
 * Mint the new device id for a Reset. Kept as its own call so the store can compute it
 * once and pass it to both the wipe and the post-reset writers (web + native paths).
 */
export function resetSyncStateForReset(): string {
  return newDeviceId();
}

/** Apply the post-reset sync KV on web (localStorage). Call AFTER localStorage.clear(). */
export function applyPostResetSyncStateWeb(freshDeviceId: string): void {
  if (!isWeb) return;
  const state = postResetSyncState(freshDeviceId);
  for (const [key, value] of Object.entries(state)) {
    localStorage.setItem(`comma_${key}`, value);
  }
}

/** Apply the post-reset sync KV on native (settings table). Call AFTER deleting settings. */
export async function applyPostResetSyncStateNative(freshDeviceId: string): Promise<void> {
  if (isWeb) return;
  const state = postResetSyncState(freshDeviceId);
  for (const [key, value] of Object.entries(state)) {
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } });
  }
}

// ─── Cursor read/write (consumed by the P2 push/pull engine) ─────────────────────
//
// The sync KV lives in the `settings` table (native) or `comma_<key>` localStorage
// (web). These helpers are the only place push/pull touch that storage, so the
// web/native branching stays in one spot.

/** Read a single sync KV value, or null if unset. */
async function readSyncKey(key: string): Promise<string | null> {
  if (isWeb) {
    return localStorage.getItem(`comma_${key}`);
  }
  const row = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return row[0]?.value ?? null;
}

/** Write a single sync KV value (upsert). */
async function writeSyncKey(key: string, value: string): Promise<void> {
  if (isWeb) {
    localStorage.setItem(`comma_${key}`, value);
    return;
  }
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

/**
 * This device's sync id. Generated + persisted on first read if missing (a fresh
 * install that never reset). Re-minted on Reset (see postResetSyncState).
 */
export async function getDeviceId(): Promise<string> {
  const existing = await readSyncKey(SYNC_KEYS.deviceId);
  if (existing) return existing;
  const fresh = newDeviceId();
  await writeSyncKey(SYNC_KEYS.deviceId, fresh);
  return fresh;
}

/** Whether the user has Cloud Sync turned on (free — no paywall). */
export async function isSyncEnabled(): Promise<boolean> {
  return (await readSyncKey(SYNC_KEYS.enabled)) === "1";
}

/**
 * Whether Demo Mode is active. Read straight from the same settings/localStorage bucket
 * the store persists it to (native: `demo_mode`, web: `comma_demo_mode`, both = "true"),
 * so non-React callers like the sync engine can gate on it without the store. Sync must
 * never run in demo mode — the seeded sample data would overwrite the user's real cloud
 * copy. See useSettingsStore's demo activation.
 */
export async function isDemoModeActive(): Promise<boolean> {
  return (await readSyncKey("demo_mode")) === "true";
}

/**
 * Turn Cloud Sync on/off. Auto-enabled once Drive is connected + a sync password is set
 * (the "connect then done" flow on the sync screen); turned off on disconnect.
 */
export async function setSyncEnabled(enabled: boolean): Promise<void> {
  await writeSyncKey(SYNC_KEYS.enabled, enabled ? "1" : "0");
}

/** epoch-ms high-water mark of my own changes already pushed (0 if never pushed). */
export async function getLastPushedAt(): Promise<number> {
  const raw = await readSyncKey(SYNC_KEYS.lastPushedAt);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

export async function setLastPushedAt(value: number): Promise<void> {
  await writeSyncKey(SYNC_KEYS.lastPushedAt, String(value));
}

/**
 * Wipe this device's cloud-tracking cursors for a fresh start against a rebuilt vault (the
 * "Forgot password → reset the cloud" flow). Rewinds the push cursor to 0 so the next push
 * re-uploads FULL local state, and forgets the applied/quarantine/forgotten sets (they named
 * files that no longer exist). Deliberately does NOT touch the device id (still ours) or the
 * sync-enabled flag (still on) — this keeps LOCAL data, only the cloud copy was rebuilt.
 */
export async function clearSyncTrackingForCloudReset(): Promise<void> {
  await writeSyncKey(SYNC_KEYS.appliedLogs, "[]");
  await writeSyncKey(SYNC_KEYS.lastPushedAt, "0");
  await writeSyncKey(SYNC_KEYS.failedLogs, "{}");
  await writeSyncKey(SYNC_KEYS.forgottenLogs, "[]");
}

/**
 * The set of change-log filenames already applied (or authored) by this device.
 * Stored as a JSON array; returned as a Set for O(1) membership tests during pull.
 * This is the cursor — NOT a scalar timestamp — so out-of-order uploads and partial
 * failures self-heal (see app/docs/sync-design.md §2).
 */
export async function getAppliedLogs(): Promise<Set<string>> {
  const raw = await readSyncKey(SYNC_KEYS.appliedLogs);
  if (!raw) return new Set();
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

/** Add a filename to the applied-logs set and persist. Idempotent. */
export async function addAppliedLog(filename: string): Promise<void> {
  const set = await getAppliedLogs();
  if (set.has(filename)) return;
  set.add(filename);
  await writeSyncKey(SYNC_KEYS.appliedLogs, JSON.stringify([...set]));
}

/** The user's auto-push cadence ('manual' | 'daily' | 'weekly'). */
export async function getSyncSchedule(): Promise<SyncSchedule> {
  return coerceSchedule(await readSyncKey(SYNC_KEYS.schedule));
}

export async function setSyncSchedule(schedule: SyncSchedule): Promise<void> {
  await writeSyncKey(SYNC_KEYS.schedule, schedule);
}

/** Wall-clock (epoch ms) of the last push RUN — the schedule timer. 0 if never pushed. */
export async function getLastPushRunAt(): Promise<number> {
  const raw = await readSyncKey(SYNC_KEYS.lastPushRunAt);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

export async function setLastPushRunAt(value: number): Promise<void> {
  await writeSyncKey(SYNC_KEYS.lastPushRunAt, String(value));
}

/**
 * Record the wall-clock of the last successful cloud save (ISO string) under the
 * `last_backup_at` key. Reused from the old backup feature so the Dashboard "your data
 * is safe" status keeps working now that Sync is the only cloud feature — a successful
 * push means the cloud copy is current.
 */
export async function setLastCloudSaveAt(iso: string): Promise<void> {
  await writeSyncKey("last_backup_at", iso);
}

// ─── Poison-log quarantine (2026-07-03 interop audit, Gap 5) ─────────────────────
//
// A change-log whose apply keeps throwing (e.g. a row shape this build can't store) must
// not wedge the pull pipeline forever: without this, the failing log is re-downloaded and
// re-failed on every sync, and every log queued behind it is never applied. Failures are
// counted per filename; at LOG_QUARANTINE_THRESHOLD the file is skipped by pull (it stays
// on Drive — a later app update can clear the counter and retry it).

/** filename → consecutive apply-failure count. */
export async function getLogFailureCounts(): Promise<Record<string, number>> {
  const raw = await readSyncKey(SYNC_KEYS.failedLogs);
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
  } catch {
    return {};
  }
}

/** Bump a log's failure count; returns the new count. */
export async function recordLogFailure(filename: string): Promise<number> {
  const counts = await getLogFailureCounts();
  counts[filename] = (Number(counts[filename]) || 0) + 1;
  await writeSyncKey(SYNC_KEYS.failedLogs, JSON.stringify(counts));
  return counts[filename];
}

/** Forget a log's failures (called after it finally applies cleanly). */
export async function clearLogFailure(filename: string): Promise<void> {
  const counts = await getLogFailureCounts();
  if (!(filename in counts)) return;
  delete counts[filename];
  await writeSyncKey(SYNC_KEYS.failedLogs, JSON.stringify(counts));
}

/**
 * Retry quarantined logs after the apply logic changes. Quarantine counts describe what a
 * PARTICULAR build's merge code failed to apply — the "a later app update can clear the
 * counter and retry" promise above. When APPLY_LOGIC_VERSION differs from the stored one,
 * forget all failure counts so previously-poisoned logs get a fresh chance under the
 * fixed code. Cheap no-op (one KV read) when the version matches.
 */
export async function resetQuarantineOnUpgrade(applyVersion: string): Promise<void> {
  const stored = await readSyncKey(SYNC_KEYS.applyVersion);
  if (stored === applyVersion) return;
  await writeSyncKey(SYNC_KEYS.failedLogs, "{}");
  await writeSyncKey(SYNC_KEYS.applyVersion, applyVersion);
}

/** Filenames pull should skip (failed ≥ LOG_QUARANTINE_THRESHOLD times). */
export async function getQuarantinedLogs(): Promise<Set<string>> {
  const counts = await getLogFailureCounts();
  const out = new Set<string>();
  for (const [name, count] of Object.entries(counts)) {
    if (Number(count) >= LOG_QUARANTINE_THRESHOLD) out.add(name);
  }
  return out;
}

// ─── Forgotten-password abandonment ("Forgot password?" on the sync screen) ─────────────
//
// Deliberately separate from the quarantine above. Quarantine is for a BUG — apply logic
// that keeps throwing — and is designed to self-heal (resetQuarantineOnUpgrade retries
// everything after a fix ships). A file abandoned here failed for a different reason
// entirely: the user explicitly said they no longer have the password that encrypted it.
// That's permanent by definition (there's no "fix" to retry), so this must NOT be cleared
// by an app update the way the quarantine counters are — doing so would silently resurrect
// the exact prompt the user already dismissed on purpose.

/** Filenames explicitly abandoned via "Forgot password?" — pull skips them forever. */
export async function getForgottenLogs(): Promise<Set<string>> {
  const raw = await readSyncKey(SYNC_KEYS.forgottenLogs);
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
 * local state (not before) — the wipe re-mints the device id and clears the applied/failed
 * KV via postResetSyncState, and forgottenLogs is deliberately excluded from that rewrite
 * so it isn't clobbered by a routine, unrelated Reset App later.
 */
export async function forgetLogsPermanently(filenames: string[]): Promise<void> {
  if (!filenames.length) return;
  const existing = await getForgottenLogs();
  filenames.forEach((f) => existing.add(f));
  await writeSyncKey(SYNC_KEYS.forgottenLogs, JSON.stringify([...existing]));
}
