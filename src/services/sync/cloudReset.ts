/**
 * "Forgot your backup password → reset the cloud" (plans/008 Phase 1, scenario 6).
 *
 * A forgotten password is mathematically unrecoverable, so the remedy can't be "decrypt the
 * old data." But deleting Drive files needs NO key — so the recoverable path is to throw away
 * the unreadable cloud copy and rebuild it from THIS device's still-perfectly-readable local
 * data under a brand-new password. Crucially this keeps local data (unlike the old flow, which
 * wiped the device): the only thing lost is changes that live ONLY on another device and were
 * never pulled here.
 */

import { listAppDataFiles } from "./driveIO";
import { deleteDriveFile } from "../googleDrive";
import { setBackupPassword } from "../backupPassword";
import { clearSyncTrackingForCloudReset } from "../../database/syncState";
import { syncNow } from "./syncNow";

/**
 * Delete everything in the appDataFolder (manifest, per-device state, any legacy logs — all
 * of it, no key required), set the new local password, rewind this device's cursors, then run
 * one sync. The engine sees an empty folder + a password and mints a fresh manifest (epoch 1)
 * before pushing this device's full local state under `newPw`.
 */
export async function resetCloudVault(newPw: string): Promise<void> {
  const files = await listAppDataFiles();
  for (const f of files) {
    await deleteDriveFile(f.id).catch(() => {
      /* best-effort: a leftover file we can't delete is stale (dead epoch) and harmless */
    });
  }
  await setBackupPassword(newPw);
  await clearSyncTrackingForCloudReset();
  await syncNow(newPw);
}
