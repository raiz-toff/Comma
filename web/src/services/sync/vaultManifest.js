/**
 * Vault manifest — the one place that says what the account's backup password IS
 * (cloud-sync v2, plans/008 §2b). Web twin of `src/services/sync/vaultManifest.ts`; the
 * manifest file format is byte-identical so either app reads the other's.
 *
 * The "two devices, two different passwords, silent fork" bug comes from the password being a
 * per-device secret nothing on Drive can arbitrate. The manifest fixes that: a single small
 * PLAIN-JSON file, `comma-vault.json`, carrying a password VERIFIER —
 * `encryptBackup("comma-keycheck-v1", pw)`. A device proves it holds the account password by
 * decrypting the verifier back to that constant. No match ⇒ no push (enforced in syncNow), so
 * a wrong password can never write a competing stream.
 *
 * Holds NO user data. The `epoch` bumps on every password change; data files below the
 * manifest's epoch are dead and any device may delete them without the key.
 */

import { newDashFreeId } from '../../core/id.js';
import { encryptBackup, decryptBackup } from '../../modules/backup/encryption.js';
import { isPassphraseError } from '../../modules/backup/cryptoEnvelope.js';
import { listAppDataFiles, downloadFile, uploadFile, deleteFile } from '../../modules/backup/drive-api.js';

export const MANIFEST_NAME = 'comma-vault.json';
export const MANIFEST_VERSION = 1;
/** The fixed plaintext the verifier envelope must decrypt back to. Never changes. */
const VERIFIER_PLAINTEXT = 'comma-keycheck-v1';

/**
 * @typedef {Object} VaultManifest
 * @property {number} v
 * @property {string} vaultId
 * @property {number} epoch
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {string} writerDeviceId
 * @property {string} verifier encryptBackup(VERIFIER_PLAINTEXT, accountPassword)
 */

/**
 * @typedef {Object} ManifestRef
 * @property {VaultManifest} manifest
 * @property {string} fileId
 * @property {string} [createdTime]
 */

/** @param {unknown} m @returns {m is VaultManifest} */
function isManifest(m) {
  return (
    !!m && typeof m === 'object' &&
    typeof m.v === 'number' &&
    typeof m.vaultId === 'string' &&
    typeof m.epoch === 'number' &&
    typeof m.verifier === 'string'
  );
}

/**
 * Read the vault manifest from Drive. `{ ref: null }` when none exists (fresh/legacy vault).
 * If a creation race left more than one, the oldest `createdTime` is canonical and the rest
 * come back in `duplicates`. Throws on a manifest from a NEWER app version.
 * @returns {Promise<{ ref: ManifestRef | null, duplicates: string[] }>}
 */
export async function readManifest() {
  const files = await listAppDataFiles();
  const manifests = files.filter((f) => f.name === MANIFEST_NAME);
  if (manifests.length === 0) return { ref: null, duplicates: [] };

  manifests.sort((a, b) => (a.createdTime ?? '~').localeCompare(b.createdTime ?? '~'));
  const canonical = manifests[0];
  const duplicates = manifests.slice(1).map((f) => f.id);

  const raw = await (await downloadFile(canonical.id)).text();
  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch {
    throw new Error('The vault manifest on Drive is corrupted.');
  }
  if (!isManifest(manifest)) {
    throw new Error('The vault manifest on Drive is not in a recognized format.');
  }
  if (manifest.v > MANIFEST_VERSION) {
    throw new Error('This backup was set up by a newer version of Comma. Please update the app.');
  }
  return { ref: { manifest, fileId: canonical.id, createdTime: canonical.createdTime }, duplicates };
}

/**
 * True iff `pw` decrypts the manifest's verifier back to the fixed constant. Never throws.
 * @param {string} pw @param {VaultManifest} manifest @returns {Promise<boolean>}
 */
export async function verifyPassword(pw, manifest) {
  if (!pw) return false;
  try {
    const plain = await decryptBackup(manifest.verifier, pw);
    return plain === VERIFIER_PLAINTEXT;
  } catch (e) {
    if (!isPassphraseError(e)) console.warn('[manifest] verify error:', e);
    return false;
  }
}

/** @param {string} pw @param {string} deviceId @param {VaultManifest} [base] @returns {Promise<VaultManifest>} */
async function buildManifest(pw, deviceId, base) {
  const now = Date.now();
  const verifier = await encryptBackup(VERIFIER_PLAINTEXT, pw);
  return {
    v: MANIFEST_VERSION,
    vaultId: base?.vaultId ?? newDashFreeId(16),
    epoch: base ? base.epoch + 1 : 1,
    createdAt: base?.createdAt ?? now,
    updatedAt: now,
    writerDeviceId: deviceId,
    verifier,
  };
}

const asBlob = (json) => new Blob([json], { type: 'application/json' });

/**
 * Create the vault manifest (epoch 1) with the verifier sealed under `pw`. Handles the
 * simultaneous-creation race: after writing, re-read; if another manifest with an OLDER
 * createdTime exists, delete ours and return the winner. The caller must then re-verify `pw`
 * against the returned manifest.
 * @param {string} pw @param {string} deviceId
 * @returns {Promise<{ ref: ManifestRef, wonRace: boolean }>}
 */
export async function createManifest(pw, deviceId) {
  const manifest = await buildManifest(pw, deviceId);
  const fileId = await uploadFile(MANIFEST_NAME, asBlob(JSON.stringify(manifest)));

  const after = await readManifest();
  if (after.ref && after.ref.fileId !== fileId) {
    await deleteFile(fileId).catch(() => {});
    return { ref: after.ref, wonRace: false };
  }
  for (const dupId of after.duplicates) {
    if (dupId !== fileId) await deleteFile(dupId).catch(() => {});
  }
  return { ref: { manifest, fileId }, wonRace: true };
}

/**
 * Rotate the account password: bump the epoch, re-seal the verifier under `newPw`, overwrite
 * the manifest in place (stable fileId). Same vaultId + createdAt, new epoch.
 * @param {ManifestRef} ref @param {string} newPw @param {string} deviceId
 * @returns {Promise<ManifestRef>}
 */
export async function rotateManifest(ref, newPw, deviceId) {
  const next = await buildManifest(newPw, deviceId, ref.manifest);
  await uploadFile(MANIFEST_NAME, asBlob(JSON.stringify(next)), ref.fileId);
  return { manifest: next, fileId: ref.fileId, createdTime: ref.createdTime };
}
