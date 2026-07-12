/**
 * COMMA — Sync Triggers
 * Manages when cloud sync should be checked, based on app open/close — NOT on every data change.
 *
 * User-driven redesign (interop plan Workstream 3 follow-up): sync is deliberately NOT triggered
 * by individual data-change events (no more "save a shift, fire off a network call 90 seconds
 * later"). The two things that trigger a sync CHECK are:
 *   - App open (tab becomes visible, or first load): always PULL + merge (cheap, read-only,
 *     "did anything change elsewhere while I was away"), and PUSH too if the user's chosen
 *     schedule (manual/daily/weekly) says a push is actually due.
 *   - App close (tab becomes hidden): PUSH only, and only if due.
 *   - Otherwise: sync only happens when the user taps "Sync now" in Settings.
 *
 * This mirrors mobile's `hooks/useAutoSync.ts` exactly (foreground = pull + push-if-due,
 * background = push-if-due, manual = always both). Web has no exact equivalent of React
 * Native's `AppState` foreground/background lifecycle — `visibilitychange` (`document.hidden`
 * false→true / true→false) is the closest web analogue, used here for exactly that purpose.
 *
 * The old whole-vault `.comdb` backup feature (`runBackup()`/`backup-engine.js`) is intentionally
 * NOT wired to any automatic trigger here — it's a manual-only "export a full backup" action from
 * Settings now that the incremental sync engine above handles routine cloud upkeep. See the
 * "Backup now" button in `backup-ui.js`.
 *
 * Every sync trigger is gated: sync must be enabled, Drive connected, and a backup password
 * present (it's the encryption key) — see `resolveAutoSyncPassphrase`. If any is missing the
 * trigger is a silent no-op; background/auto sync must never prompt or crash. Errors are
 * swallowed (logged) — an auto-sync failure isn't something to surface mid-session; the manual
 * "Sync now" button surfaces errors instead.
 */

import { isDriveConnected } from './drive-auth.js';
import { store } from '../../core/store.js';
import { getBackupPassword } from '../../services/sync/backupPassword.js';
import { isSyncEnabled, getSyncSchedule, getLastPushRunAt } from '../../services/sync/syncState.js';
import { isSyncDue } from '../../services/sync/schedule.js';
import { syncNow } from '../../services/sync/syncNow.js';

let autoSyncBusy = false;

/**
 * Initializes the open/close sync-check triggers.
 * Call this at app startup.
 */
export async function initBackupTriggers() {
  // Listen for app open/close (visibility changes).
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // App close: push only, and only if due.
      void runAutoSync('background');
    } else {
      // App (re)open: always pull, push too if due.
      void runAutoSync('foreground');
    }
  });

  // Treat initial app load as the first "app open" check.
  void runAutoSync('foreground');
}

/**
 * Resolve the gate, returning `{ passphrase }` to sync with — or null if auto-sync can't run.
 *
 * The passphrase may legitimately be an EMPTY STRING: that's the default one-tap mode (no E2E
 * password), where change-logs are written as plain envelopes into the Drive appDataFolder
 * sandbox. Returning null for a missing password — as this used to — silently disabled
 * auto-sync for every default user while the UI still said sync was on: a silent lie about
 * data safety.
 * @returns {{ passphrase: string } | null}
 */
function resolveAutoSyncPassphrase() {
  if (store.get('demoMode')) return null;
  if (!isSyncEnabled()) return null;
  if (!isDriveConnected()) return null;
  return { passphrase: getBackupPassword() ?? '' };
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
    const gate = resolveAutoSyncPassphrase();
    if (!gate) return;
    const { passphrase } = gate;

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
