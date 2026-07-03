/**
 * COMMA — Backup + Sync Triggers
 * Manages when backups and cloud syncs should be triggered based on user activity and app state.
 *
 * Two independent mechanisms live here side by side (interop plan Workstream 3):
 *   - BACKUP (Workstream 2): the existing debounced-push-on-data-change + tab-hide-if-dirty +
 *     staleness-on-open triggers, UNCHANGED in shape — still just call `runBackup()`.
 *   - SYNC (Workstream 3, new): mirrors mobile's `hooks/useAutoSync.ts` — foreground (tab
 *     becomes visible) always PULLs + merges, and PUSHes too if the user's chosen schedule says
 *     a push is due; background (tab hidden) PUSHes only if due. Web has no exact equivalent of
 *     React Native's `AppState` foreground/background lifecycle — `visibilitychange`
 *     (`document.hidden` false→true / true→false) is the closest web analogue, used here for
 *     exactly that purpose.
 *
 * Every sync trigger is gated: sync must be enabled, Drive connected, and a backup password
 * present (it's the encryption key) — see `resolveAutoSyncPassphrase`. If any is missing the
 * trigger is a silent no-op; background/auto sync must never prompt or crash. Errors are
 * swallowed (logged) — an auto-sync failure isn't something to surface mid-session; the manual
 * "Sync now" button surfaces errors instead.
 */

import { bus, SHIFT_SAVED, SHIFT_DELETED, EXPENSE_SAVED, GOAL_UPDATED, PLATFORM_CHANGED, DATA_IMPORTED, ONBOARDING_COMPLETE } from '../../core/events.js';
import { runBackup } from './backup-engine.js';
import { isDriveConnected } from './drive-auth.js';
import { getAppState } from '../../core/db.js';
import { store } from '../../core/store.js';
import { getBackupPassword } from '../../services/sync/backupPassword.js';
import { isSyncEnabled, getSyncSchedule, getLastPushRunAt } from '../../services/sync/syncState.js';
import { isSyncDue } from '../../services/sync/schedule.js';
import { syncNow } from '../../services/sync/syncNow.js';

const DEBOUNCE_MS = 90 * 1000; // 90 seconds
const STALENESS_THRESHOLD_MS = 6 * 60 * 60 * 1000; // 6 hours
let debounceTimer = null;
let autoSyncBusy = false;

/**
 * Initializes all backup + sync triggers.
 * Call this at app startup.
 */
export async function initBackupTriggers() {
  // 1. Listen for data-changing events (BACKUP only — unchanged from before Workstream 3)
  const dataEvents = [
    SHIFT_SAVED,
    SHIFT_DELETED,
    EXPENSE_SAVED,
    GOAL_UPDATED,
    PLATFORM_CHANGED,
    DATA_IMPORTED,
    ONBOARDING_COMPLETE
  ];

  dataEvents.forEach(event => {
    bus.on(event, () => {
      markVaultDirty();
      scheduleDebouncedBackup();
    });
  });

  // 2. Listen for app visibility changes.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // BACKUP (Trigger 2, unchanged): user is leaving — try a background backup immediately.
      if (isVaultDirty() && !store.get('demoMode')) {
        runBackup({ silent: true }).catch(() => {});
      }
      // SYNC (new): background-equivalent — push only, and only if due.
      void runAutoSync('background');
    } else {
      // SYNC (new): foreground-equivalent — always pull, push too if due.
      void runAutoSync('foreground');
    }
  });

  // 3. Staleness check on app open (BACKUP, Trigger 3, unchanged).
  checkStaleness();

  // 4. Treat initial app load as the first "foreground" sync trigger.
  void runAutoSync('foreground');
}

/** Resolve the sync gate + passphrase, or null if auto-sync can't run right now. */
function resolveAutoSyncPassphrase() {
  if (store.get('demoMode')) return null;
  if (!isSyncEnabled()) return null;
  if (!isDriveConnected()) return null;
  return getBackupPassword() || null;
}

/**
 * Run one auto-sync trigger. Guarded against overlapping runs (visibilitychange can fire in
 * quick succession); `syncNow`'s own queue already serializes actual Drive calls, but this
 * avoids piling up identical no-op triggers.
 * @param {'foreground'|'background'} event
 */
async function runAutoSync(event) {
  if (autoSyncBusy) return;
  autoSyncBusy = true;
  try {
    const passphrase = resolveAutoSyncPassphrase();
    if (!passphrase) return;

    const schedule = getSyncSchedule();
    const lastPushRunAt = getLastPushRunAt();
    const pushDue = isSyncDue(schedule, lastPushRunAt, Date.now());

    if (event === 'foreground') {
      await syncNow(passphrase, { pull: true, push: pushDue });
    } else if (pushDue) {
      await syncNow(passphrase, { pull: false, push: true });
    }
  } catch (e) {
    console.warn('[autoSync] trigger failed:', e);
  } finally {
    autoSyncBusy = false;
  }
}

/**
 * Marks the vault as dirty in localStorage.
 */
function markVaultDirty() {
  localStorage.setItem('comma_vault_dirty', 'true');
  localStorage.setItem('comma_vault_dirty_at', new Date().toISOString());
}

/**
 * Checks if the vault is currently dirty.
 */
function isVaultDirty() {
  return localStorage.getItem('comma_vault_dirty') === 'true';
}

/**
 * Schedules a backup with a debounce timer.
 */
function scheduleDebouncedBackup() {
  if (debounceTimer) clearTimeout(debounceTimer);

  debounceTimer = setTimeout(async () => {
    if (isVaultDirty() && isDriveConnected() && navigator.onLine && !store.get('demoMode')) {
      await runBackup({ silent: true });
    }
  }, DEBOUNCE_MS);
}

/**
 * Checks if the last backup is older than the staleness threshold.
 */
async function checkStaleness() {
  if (!isDriveConnected() || !navigator.onLine || store.get('demoMode')) return;

  const lastBackupAt = await getAppState('last_backup');
  if (!lastBackupAt) {
    // Never backed up
    runBackup({ silent: true }).catch(() => {});
    return;
  }

  const lastMs = new Date(lastBackupAt).getTime();
  const nowMs = Date.now();

  if (nowMs - lastMs > STALENESS_THRESHOLD_MS) {
    // Backup is stale, run one silently
    runBackup({ silent: true }).catch(() => {});
  }
}
