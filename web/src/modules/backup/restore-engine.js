/**
 * COMMA — Restore Engine (interop plan Workstream 2)
 * Orchestrates the full restore flow: Download → Decrypt → Validate → Write.
 *
 * Uses the password-derived `BackupEnvelope` (see `encryption.js`) — the same envelope shape
 * mobile's backups use, so a `.comdb` written by mobile can be restored on web (and vice versa)
 * given the shared backup password. This is a listing-only step for `.comdb` files (see
 * `backup-engine.js` doc); the sync engine (Workstream 3) has its own separate pull/apply path.
 */

import { deserializeVault } from './vault-serializer.js';
import { decryptBackup } from './encryption.js';
import { listAppDataFiles, downloadFile } from './drive-api.js';
import { isDriveConnected } from './drive-auth.js';
import { bus } from '../../core/events.js';

/**
 * Fetches a list of available `.comdb` backups from Drive with metadata. The new envelope has
 * NO plaintext metadata (unlike the old `{magic, encryptedAt, appVersion, ...}` wrapper) — every
 * field is inside the encrypted `content`, so listing no longer requires (or reveals anything
 * without) the backup password. Drive's own file metadata (`modifiedTime`) stands in for the old
 * `encryptedAt` field.
 */
export async function listAvailableBackups() {
  if (!isDriveConnected()) return [];

  const files = await listAppDataFiles();
  const backupFiles = files.filter((f) => f.name.startsWith('comma-vault'));

  return backupFiles
    .map((file) => ({
      id: file.id,
      name: file.name,
      encryptedAt: file.modifiedTime || file.createdTime || null,
      size: file.size,
    }))
    .sort((a, b) => new Date(b.encryptedAt || 0) - new Date(a.encryptedAt || 0));
}

/**
 * Runs the full restore process for a specific file.
 * @param {string} fileId
 * @param {string} passphrase Backup password (the decryption key).
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function runRestore(fileId, passphrase) {
  if (!navigator.onLine) return { success: false, error: 'No internet connection.' };
  if (!passphrase) return { success: false, error: 'Enter the backup password.' };

  try {
    bus.emit('restore:started');

    // 1. Download the .comdb file (a BackupEnvelope JSON string, see encryption.js)
    const blob = await downloadFile(fileId);
    const envelopeJson = await blob.text();

    // 2. Decrypt
    const plaintext = await decryptBackup(envelopeJson, passphrase);
    const vaultData = JSON.parse(plaintext);

    // 3. Restore to Dexie
    const result = await deserializeVault(vaultData);

    if (result.success) {
      bus.emit('restore:success');
      // The caller should handle the page reload / state refresh
      return { success: true };
    } else {
      throw new Error(result.error || 'Restore failed during database write.');
    }
  } catch (err) {
    console.error('[restore-engine] Restore failed:', err);
    bus.emit('restore:failed', { error: err.message });
    return { success: false, error: err.message };
  }
}
