/**
 * Local storage for the user's backup password (interop plan Workstream 2/3).
 *
 * Mirrors mobile's `commaApp/src/services/backupPassword.ts` web branch (mobile keeps it in
 * `expo-secure-store` on native, `localStorage` on its own web build — web has no native
 * keystore, so this is the only storage backend here). Stored in plain `localStorage` so
 * repeat backups/restores/syncs on THIS device/browser don't require re-typing it. It is never
 * uploaded anywhere — on a brand-new browser profile the storage is empty, so the user must
 * re-enter the password they memorised in order to restore/sync. That's the whole point of the
 * password-only encryption scheme (see `encryption.js`): lose the password, lose the data.
 */

const KEY = 'comma_backup_password';

/** @returns {string | null} */
export function getBackupPassword() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** @returns {boolean} */
export function hasBackupPassword() {
  return getBackupPassword() != null;
}

/** @param {string} password */
export function setBackupPassword(password) {
  try {
    localStorage.setItem(KEY, password);
  } catch {
    /* private mode / quota */
  }
}

export function clearBackupPassword() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
