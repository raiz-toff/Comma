/**
 * COMMA — Backup Engine
 * Orchestrates the full backup flow: Serialize → Encrypt → Upload → Rotate.
 */

import { serializeVault } from './vault-serializer.js';
import { 
  getActiveKey, 
  setActiveKey, 
  generateVaultKey, 
  exportKeyToJwk, 
  importKeyFromJwk, 
  encryptVault 
} from './encryption.js';
import { 
  listAppDataFiles, 
  uploadFile, 
  downloadFile, 
  renameFile 
} from './drive-api.js';
import { getAccessToken, ensureAccessToken, requestToken, isDriveConnected } from './drive-auth.js';
import { setAppState, getUser, saveUser, CURRENT_LOGICAL_SCHEMA_VERSION } from '../../core/db.js';
import { bus } from '../../core/events.js';
import { store } from '../../core/store.js';

let backupInProgress = false;

/**
 * Runs the full backup process.
 * @param {Object} options 
 * @param {boolean} options.silent If true, won't trigger silent re-auth if token missing.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function runBackup({ silent = false } = {}) {
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

  try {
    // Automatically handles silent re-auth if token is missing or nearly expired
    const token = await ensureAccessToken();
    if (!token) {
      return { success: false, error: 'Failed to obtain access token.' };
    }

    backupInProgress = true;
    bus.emit('backup:started');

    // 1. Ensure we have the encryption key
    let key = getActiveKey();
    if (!key) {
      key = await ensureEncryptionKey();
    }

    // 2. Serialize the vault
    const plaintext = await serializeVault();
    const encoder = new TextEncoder();
    const plaintextBytes = encoder.encode(plaintext);

    // 3. Encrypt the data
    const { iv, ciphertext } = await encryptVault(plaintextBytes, key);

    // 4. Build the .comdb wrapper
    const wrapper = {
      magic: 'COMMA_VAULT',
      formatVersion: 1,
      schemaVersion: CURRENT_LOGICAL_SCHEMA_VERSION,
      appVersion: window.__comma?.version || '1.0.0',
      encryptedAt: new Date().toISOString(),
      deviceHint: navigator.userAgent.split(') ')[0].split(' (')[1] || 'Unknown Device',
      iv: iv,
      ciphertext: ciphertext
    };

    const blob = new Blob([JSON.stringify(wrapper)], { type: 'application/json' });

    // 5. Rotate and Upload
    await rotateAndUpload(blob);

    // 6. Cleanup
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
 * Ensures a valid CryptoKey exists, fetching from Drive or generating if needed.
 */
async function ensureEncryptionKey() {
  const files = await listAppDataFiles();
  const keyFile = files.find(f => f.name === 'comma-key.json');

  if (keyFile) {
    const blob = await downloadFile(keyFile.id);
    const text = await blob.text();
    const jwk = JSON.parse(text);
    const key = await importKeyFromJwk(jwk);
    setActiveKey(key);
    return key;
  } else {
    // Generate new key
    const key = await generateVaultKey();
    const jwk = await exportKeyToJwk(key);
    const blob = new Blob([JSON.stringify(jwk)], { type: 'application/json' });
    await uploadFile('comma-key.json', blob);
    setActiveKey(key);
    return key;
  }
}

/**
 * Handles the 3-version rotation and uploads the new backup.
 * @param {Blob} blob 
 */
async function rotateAndUpload(blob) {
  const files = await listAppDataFiles();
  const current = files.find(f => f.name === 'comma-vault.comdb');
  const prev1 = files.find(f => f.name === 'comma-vault-prev1.comdb');
  const prev2 = files.find(f => f.name === 'comma-vault-prev2.comdb');

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
