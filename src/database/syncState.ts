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
} as const;

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
