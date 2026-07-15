/**
 * Vault manifest — the one place that says what the account's backup password IS
 * (cloud-sync v2, plans/008 §2b).
 *
 * The whole "two devices, two different passwords, silent fork" class of bug comes from the
 * password being a per-device secret that nothing on Drive can arbitrate. The manifest fixes
 * that: a single small PLAIN-JSON file, `comma-vault.json`, in the appDataFolder, carrying a
 * password VERIFIER — `encryptBackup("comma-keycheck-v1", pw)`. A device proves it holds the
 * account password by decrypting the verifier back to that constant. No verifier match ⇒ no
 * push (enforced in syncNow), so a wrong password can never write a competing stream.
 *
 * The manifest holds NO user data — only the verifier (already brute-forceable via the GCM
 * tag on every real data file, so no new exposure), a vault id, and an `epoch` that bumps on
 * every password change. Any data file tagged with an epoch below the manifest's is dead and
 * may be deleted by any device WITHOUT the key (deletion needs no decryption) — that's what
 * makes stale-file cleanup and password rotation tractable.
 */

import { customAlphabet } from "nanoid/non-secure";
import { encryptBackup, decryptBackup } from "../cryptoHelper";
import { isPassphraseError } from "../cryptoEnvelope";
import {
  listAppDataFiles,
  downloadDriveText,
  createDriveFile,
  updateDriveFile,
} from "./driveIO";
import { deleteDriveFile } from "../googleDrive";

export const MANIFEST_NAME = "comma-vault.json";
export const MANIFEST_VERSION = 1;
/** The fixed plaintext the verifier envelope must decrypt back to. Never changes. */
const VERIFIER_PLAINTEXT = "comma-keycheck-v1";

const genId = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", 16);

export interface VaultManifest {
  v: number;
  vaultId: string;
  epoch: number;
  createdAt: number;
  updatedAt: number;
  writerDeviceId: string;
  /** encryptBackup(VERIFIER_PLAINTEXT, accountPassword) */
  verifier: string;
}

export interface ManifestRef {
  manifest: VaultManifest;
  fileId: string;
  createdTime?: string;
}

function isManifest(m: unknown): m is VaultManifest {
  if (!m || typeof m !== "object") return false;
  const x = m as Record<string, unknown>;
  return (
    typeof x.v === "number" &&
    typeof x.vaultId === "string" &&
    typeof x.epoch === "number" &&
    typeof x.verifier === "string"
  );
}

/**
 * Read the vault manifest from Drive.
 *
 * Returns `{ ref: null }` when no manifest exists (a fresh or legacy pre-manifest vault).
 * If a creation race left more than one manifest, the oldest `createdTime` is canonical and
 * the rest come back in `duplicates` for the caller/creator to clean up (see createManifest).
 * Throws on a manifest written by a NEWER app version — refusing is safer than mis-reading a
 * shape we don't understand (same stance as the change-log version guard).
 */
export async function readManifest(): Promise<{ ref: ManifestRef | null; duplicates: string[] }> {
  const files = await listAppDataFiles();
  const manifests = files.filter((f) => f.name === MANIFEST_NAME);
  if (manifests.length === 0) return { ref: null, duplicates: [] };

  // Oldest createdTime wins (deterministic across devices). Missing createdTime sorts last.
  manifests.sort((a, b) => (a.createdTime ?? "~").localeCompare(b.createdTime ?? "~"));
  const canonical = manifests[0];
  const duplicates = manifests.slice(1).map((f) => f.id);

  const raw = await downloadDriveText(canonical.id);
  let manifest: unknown;
  try {
    manifest = JSON.parse(raw);
  } catch {
    throw new Error("The vault manifest on Drive is corrupted.");
  }
  if (!isManifest(manifest)) {
    throw new Error("The vault manifest on Drive is not in a recognized format.");
  }
  if (manifest.v > MANIFEST_VERSION) {
    throw new Error("This backup was set up by a newer version of Comma. Please update the app.");
  }
  return { ref: { manifest, fileId: canonical.id, createdTime: canonical.createdTime }, duplicates };
}

/** True iff `pw` decrypts the manifest's verifier back to the fixed constant. Never throws. */
export async function verifyPassword(pw: string, manifest: VaultManifest): Promise<boolean> {
  if (!pw) return false;
  try {
    const plain = await decryptBackup(manifest.verifier, pw);
    return plain === VERIFIER_PLAINTEXT;
  } catch (e) {
    // Wrong password (GCM tag mismatch) and "no password on an encrypted envelope" both land
    // here as PassphraseError; anything else is a genuine failure. Either way: not verified.
    if (!isPassphraseError(e)) console.warn("[manifest] verify error:", e);
    return false;
  }
}

async function buildManifest(pw: string, deviceId: string, base?: VaultManifest): Promise<VaultManifest> {
  const now = Date.now();
  const verifier = await encryptBackup(VERIFIER_PLAINTEXT, pw);
  return {
    v: MANIFEST_VERSION,
    vaultId: base?.vaultId ?? genId(),
    epoch: base ? base.epoch + 1 : 1,
    createdAt: base?.createdAt ?? now,
    updatedAt: now,
    writerDeviceId: deviceId,
    verifier,
  };
}

/**
 * Create the vault manifest (epoch 1) with the verifier sealed under `pw`. Handles the
 * simultaneous-creation race: after writing, re-read; if another manifest with an OLDER
 * createdTime exists, delete ours and return the winner instead. The caller must then
 * re-verify `pw` against the returned manifest (a losing racer with a different password is
 * exactly the fork case, now caught cleanly instead of forking).
 *
 * @returns the canonical manifest ref and whether THIS call's write is the one that stuck.
 */
export async function createManifest(pw: string, deviceId: string): Promise<{ ref: ManifestRef; wonRace: boolean }> {
  const manifest = await buildManifest(pw, deviceId);
  const fileId = await createDriveFile(MANIFEST_NAME, JSON.stringify(manifest));

  // Race check: did anyone else also just create one?
  const after = await readManifest();
  if (after.ref && after.ref.fileId !== fileId) {
    // Someone else's manifest is canonical (older createdTime). Ours lost — remove it.
    await deleteDriveFile(fileId).catch(() => {});
    return { ref: after.ref, wonRace: false };
  }
  // We're canonical. Clean up any duplicate losers that raced behind us.
  for (const dupId of after.duplicates) {
    if (dupId !== fileId) await deleteDriveFile(dupId).catch(() => {});
  }
  return { ref: { manifest, fileId }, wonRace: true };
}

/**
 * Rotate the account password: bump the epoch, re-seal the verifier under `newPw`, and
 * overwrite the manifest in place (stable fileId). Same vaultId + createdAt, new epoch.
 * Callers are responsible for deleting now-stale-epoch data files (any device can, no key
 * needed) and re-pushing their own state under the new password.
 */
export async function rotateManifest(ref: ManifestRef, newPw: string, deviceId: string): Promise<ManifestRef> {
  const next = await buildManifest(newPw, deviceId, ref.manifest);
  await updateDriveFile(ref.fileId, JSON.stringify(next));
  return { manifest: next, fileId: ref.fileId, createdTime: ref.createdTime };
}
