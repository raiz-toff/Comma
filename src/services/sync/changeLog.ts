/**
 * Change-log file format + (de)serialization (cloud-sync P2 — see sync-design.md §3).
 *
 * One file per push, stored in Drive's `appDataFolder`:
 *   filename:  comma-cl-{deviceId}-{epochMs}.cmlog
 *   content:   encryptBackup(JSON.stringify(ChangeLog), passphrase)
 *
 * The encryption reuses the existing password-derived `encryptBackup`/`decryptBackup`
 * (already cross-device), so a log written by phone A decrypts on phone B with the same
 * backup password — no device key involved.
 */

import { encryptBackup, decryptBackup } from "../cryptoHelper";

/** Schema version of the change-log envelope. Bump on any breaking shape change. */
export const CHANGELOG_VERSION = 1 as const;

export interface ChangeLog {
  v: typeof CHANGELOG_VERSION;
  deviceId: string;
  createdAt: number; // epoch ms
  /** the lastPushedAt cursor this delta covers (rows with syncUpdatedAt > sinceCursor) */
  sinceCursor: number;
  /** tableName -> changed rows (INCLUDING soft-deleted tombstones) */
  rows: Record<string, Record<string, unknown>[]>;
}

// Two kinds of sync file live in the appDataFolder:
//   - DELTA change-logs:  comma-cl-{deviceId}-{epochMs}.cmlog   (one push's changes)
//   - SNAPSHOT (P5):      comma-snap-{deviceId}-{epochMs}.cmsnap (full state, for compaction)
// Both encode a ChangeLog payload (a snapshot is just a ChangeLog containing ALL rows),
// so pull/merge treat them identically; only compaction distinguishes them by extension.
const LOG_PREFIX = "comma-cl-";
const LOG_SUFFIX = ".cmlog";
const SNAP_PREFIX = "comma-snap-";
const SNAP_SUFFIX = ".cmsnap";

export type SyncFileKind = "log" | "snapshot";

/** Build a delta change-log filename: `comma-cl-{deviceId}-{epochMs}.cmlog`. */
export function buildChangeLogFilename(deviceId: string, createdAt: number): string {
  return `${LOG_PREFIX}${deviceId}-${createdAt}${LOG_SUFFIX}`;
}

/** Build a snapshot filename: `comma-snap-{deviceId}-{epochMs}.cmsnap` (P5 compaction). */
export function buildSnapshotFilename(deviceId: string, createdAt: number): string {
  return `${SNAP_PREFIX}${deviceId}-${createdAt}${SNAP_SUFFIX}`;
}

export interface ParsedSyncName {
  kind: SyncFileKind;
  deviceId: string;
  createdAt: number;
}

// deviceId is dash-free by construction (syncState genDeviceId) and createdAt is numeric,
// so the single dash between them is the only dash in the core — we split on the LAST dash.
function parseCore(core: string): { deviceId: string; createdAt: number } | null {
  const lastDash = core.lastIndexOf("-");
  if (lastDash <= 0) return null;
  const deviceId = core.slice(0, lastDash);
  const ts = Number(core.slice(lastDash + 1));
  if (!Number.isFinite(ts)) return null;
  return { deviceId, createdAt: ts };
}

/**
 * Parse any sync filename (delta log OR snapshot) into its kind + deviceId + timestamp.
 * Returns null for anything else (`.comdb` backups, manifests, junk) so a mixed
 * appDataFolder listing can be filtered by name alone (the manifest-less shortcut).
 */
export function parseSyncFilename(filename: string): ParsedSyncName | null {
  if (filename.startsWith(LOG_PREFIX) && filename.endsWith(LOG_SUFFIX)) {
    const c = parseCore(filename.slice(LOG_PREFIX.length, -LOG_SUFFIX.length));
    return c ? { kind: "log", ...c } : null;
  }
  if (filename.startsWith(SNAP_PREFIX) && filename.endsWith(SNAP_SUFFIX)) {
    const c = parseCore(filename.slice(SNAP_PREFIX.length, -SNAP_SUFFIX.length));
    return c ? { kind: "snapshot", ...c } : null;
  }
  return null;
}

export interface ParsedChangeLogName {
  deviceId: string;
  createdAt: number;
}

/** Back-compat: parse a DELTA `.cmlog` filename only (null for snapshots/other). */
export function parseChangeLogFilename(filename: string): ParsedChangeLogName | null {
  const parsed = parseSyncFilename(filename);
  return parsed && parsed.kind === "log"
    ? { deviceId: parsed.deviceId, createdAt: parsed.createdAt }
    : null;
}

/** Serialize + encrypt a ChangeLog into the `.cmlog` file body. */
export async function encodeChangeLog(log: ChangeLog, passphrase: string): Promise<string> {
  return encryptBackup(JSON.stringify(log), passphrase);
}

/** Decrypt + parse a `.cmlog` file body back into a ChangeLog. Throws on wrong password
 *  (via decryptBackup) or malformed/incompatible content. */
export async function decodeChangeLog(envelope: string, passphrase: string): Promise<ChangeLog> {
  const json = await decryptBackup(envelope, passphrase);
  let log: ChangeLog;
  try {
    log = JSON.parse(json) as ChangeLog;
  } catch {
    throw new Error("Change-log contents are corrupted.");
  }
  if (!log || typeof log !== "object" || !log.rows || typeof log.rows !== "object") {
    throw new Error("Invalid change-log structure.");
  }
  // Forward-compat guard: refuse to apply a log from a newer schema than we understand,
  // rather than silently mis-merging it (see sync-design.md §6.4).
  if (log.v > CHANGELOG_VERSION) {
    throw new Error(
      `This change-log was written by a newer app version (v${log.v}). Please update.`
    );
  }
  return log;
}
