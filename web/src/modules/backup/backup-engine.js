/**
 * COMMA — Backup Engine (interop plan Workstream 2)
 * Orchestrates the manual "export everything" backup flow: Serialize → Encrypt → Upload → Rotate.
 *
 * Uses the password-derived `BackupEnvelope` (see `encryption.js`) instead of the old
 * `{magic:'COMMA_VAULT', iv, ciphertext}` shape + separately-generated raw AES key. This is a
 * SEPARATE mechanism from the sync engine (Workstream 3, `src/services/sync/`) — this backs up
 * the ENTIRE Dexie vault as one `.comdb` file (a manual, whole-vault "get me out of here" export),
 * while sync incrementally exchanges per-table change-logs. Both share only the crypto helper,
 * exactly as mobile keeps its own backup and sync features separate.
 */

import { serializeVault } from './vault-serializer.js';
import { encryptBackup } from './encryption.js';
import { listAppDataFiles, uploadFile, renameFile } from './drive-api.js';
import { ensureAccessToken, isDriveConnected } from './drive-auth.js';
import { setAppState, getUser, saveUser } from '../../core/db.js';
import { bus } from '../../core/events.js';
import { store } from '../../core/store.js';
import { getBackupPassword } from '../../services/sync/backupPassword.js';

let backupInProgress = false;

/**
 * Runs the full backup process.
 * @param {Object} [options]
 * @param {boolean} [options.silent] If true, won't trigger silent re-auth if token missing.
 * @param {string} [options.passphrase] Backup password; falls back to the stored one.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function runBackup({ silent = false, passphrase } = {}) {
  if (store.get('demoMode')) {
    return { success: false, error: 'Backup disabled in Demo Mode.' };
  }

  if (backupInProgress) return { success: false, error: 'Backup already in progress.' };

  if (!navigator.onLine) {
    return { success: false, error: 'No internet connection.' };
  }

  if (!isDriveConnected()) {
    return { success: false, error: 'Google Drive not connected.' };
  }

  const pw = passphrase || getBackupPassword();
  if (!pw) {
    return { success: false, error: 'Set a backup password first.' };
  }

  try {
    // Automatically handles silent re-auth if token is missing or nearly expired
    const token = await ensureAccessToken();
    if (!token) {
      return { success: false, error: 'Failed to obtain access token.' };
    }

    backupInProgress = true;
    bus.emit('backup:started');

    // 1. Serialize the vault
    const plaintext = await serializeVault();

    // 2. Encrypt (BackupEnvelope v2 — see encryption.js)
    const envelope = await encryptBackup(plaintext, pw);
    const blob = new Blob([envelope], { type: 'application/json' });

    // 3. Rotate and Upload
    await rotateAndUpload(blob);

    // 4. Cleanup
    const now = new Date().toISOString();
    await setAppState('last_backup', now);
    try {
      const user = await getUser();
      if (user) {
        await saveUser({ lastBackupAt: now });
      }
    } catch (e) {
      console.warn('[backup-engine] failed to save lastBackupAt to user profile', e);
    }
    localStorage.setItem('comma_vault_dirty', 'false');

    backupInProgress = false;
    bus.emit('backup:success', { timestamp: now });
    return { success: true };
  } catch (err) {
    console.error('[backup-engine] Backup failed:', err);
    backupInProgress = false;
    bus.emit('backup:failed', { error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * Handles the 3-version rotation and uploads the new backup.
 * @param {Blob} blob
 */
async function rotateAndUpload(blob) {
  const files = await listAppDataFiles();
  const current = files.find((f) => f.name === 'comma-vault.comdb');
  const prev1 = files.find((f) => f.name === 'comma-vault-prev1.comdb');
  const prev2 = files.find((f) => f.name === 'comma-vault-prev2.comdb');

  // Rotate: prev1 -> prev2
  if (prev1) {
    await renameFile(prev1.id, 'comma-vault-prev2.comdb');
  }

  // Rotate: current -> prev1
  if (current) {
    await renameFile(current.id, 'comma-vault-prev1.comdb');
  }

  // Upload new
  await uploadFile('comma-vault.comdb', blob);
}
