/**
 * "Forgot your backup password → reset the cloud" (plans/008 Phase 1, scenario 6). Web twin of
 * `src/services/sync/cloudReset.ts`.
 *
 * A forgotten password is mathematically unrecoverable, so the remedy can't be "decrypt the
 * old data." But deleting Drive files needs NO key — so the recoverable path is to throw away
 * the unreadable cloud copy and rebuild it from THIS browser's still-readable local data under
 * a brand-new password. Keeps local data (unlike the old flow, which wiped the vault): the
 * only thing lost is changes that live ONLY on another device and were never pulled here.
 */

import { listAppDataFiles, deleteFile } from '../../modules/backup/drive-api.js';
import { setBackupPassword } from './backupPassword.js';
import { clearSyncTrackingForCloudReset } from './syncState.js';
import { syncNow } from './syncNow.js';

/**
 * Delete everything in the appDataFolder (manifest, per-device state, any legacy logs — all of
 * it, no key required), set the new local password, rewind this browser's cursors, then run one
 * sync. The engine sees an empty folder + a password and mints a fresh manifest (epoch 1)
 * before pushing this browser's full local state under `newPw`.
 * @param {string} newPw
 */
export async function resetCloudVault(newPw) {
  const files = await listAppDataFiles();
  for (const f of files) {
    await deleteFile(f.id).catch(() => {
      /* best-effort: a leftover we can't delete is stale (dead epoch) and harmless */
    });
  }
  setBackupPassword(newPw);
  clearSyncTrackingForCloudReset();
  await syncNow(newPw);
}
