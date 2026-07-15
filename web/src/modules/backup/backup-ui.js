/**
 * COMMA — Backup UI (simplified, WhatsApp-style)
 *
 * Sync always encrypts. There is no plain mode and no toggle: connecting Google Drive
 * prompts for a backup password as a normal, required part of turning Sync on — not an
 * "Advanced"/power-user setting. Renders the backup status and controls in Settings → Data tab.
 */

import { getAccessToken, isDriveConnected, requestToken, disconnectDrive } from './drive-auth.js';
import { runBackup } from './backup-engine.js';
import { listAvailableBackups, runRestore } from './restore-engine.js';
import { getAppState } from '../../core/db.js';
import { bus } from '../../core/events.js';
import { getIcon } from '../../ui/icons.js';
import { t } from '../../utils/strings.js';
import { showConfirm, showToast, showModal } from '../../ui/components.js';
import { store } from '../../core/store.js';
import { getBackupPassword, hasBackupPassword, setBackupPassword } from '../../services/sync/backupPassword.js';
import {
  isSyncEnabled,
  setSyncEnabled,
  getSyncSchedule,
  setSyncSchedule,
  getLastPushRunAt,
  setLastPushedAt,
} from '../../services/sync/syncState.js';
import { SYNC_SCHEDULES, SCHEDULE_LABELS } from '../../services/sync/schedule.js';
import { syncNow } from '../../services/sync/syncNow.js';
import { showSetBackupPassword } from './backup-password-setup.js';
import { showForgotPassword } from './forgot-password.js';

/**
 * A brand-new password (first-ever setup, or a legacy no-password account setting one for
 * the first time) changes the format of every file we write. Rewind the push cursor to 0 so
 * the very next push re-uploads this browser's FULL current state encrypted — otherwise the
 * cloud keeps only old plain files plus a thin new encrypted delta, and a device that only
 * has the password can never reconstruct the earlier history.
 */
function repushInNewMode() {
  setLastPushedAt(0);
}

/**
 * Prompt for an EXISTING backup password — lightweight modal, just a key. Setting a NEW
 * password is a full-screen flow (backup-password-setup.js) — the moment that deserves
 * attention is committing to a password, not typing one you already chose and (hopefully)
 * saved.
 * @returns {Promise<string|null>}
 */
export function promptEncryptionPassword() {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <p class="text-secondary text-sm" style="margin-bottom: var(--space-3);">
        Your Drive has data locked with a different password. Enter it to continue —
        backup is paused until you do, so your devices don't drift apart.
      </p>
      <form class="backup-password-form">
        <label class="field">
          <span class="field-label">Password</span>
          <input class="input" type="password" name="pw" autocomplete="off" autocapitalize="off" />
        </label>
        <p class="text-danger text-xs" data-pw-err style="min-height: 1em;"></p>
        <button type="button" class="text-xs text-secondary" data-action="forgot-password" style="margin-top:var(--space-2);background:none;border:none;padding:0;text-decoration:underline;cursor:pointer;">Forgot your password?</button>
      </form>
    `;
    let resolved = false;
    const handle = showModal({
      title: 'Enter your backup password',
      content: wrap,
      actions: [
        { label: t('common.cancel'), class: 'btn btn-ghost', onClick: () => { resolved = true; resolve(null); } },
        {
          label: t('common.confirm') || 'Continue',
          class: 'btn btn-primary',
          close: false,
          onClick: () => {
            const pw = /** @type {HTMLInputElement} */ (wrap.querySelector('[name="pw"]'))?.value || '';
            const errEl = wrap.querySelector('[data-pw-err]');
            if (pw.length < 6) {
              if (errEl) errEl.textContent = 'Use at least 6 characters.';
              return;
            }
            resolved = true;
            handle.close();
            resolve(pw);
          },
        },
      ],
      onClose: () => {
        if (!resolved) resolve(null);
      },
    });

    wrap.querySelector('[data-action="forgot-password"]')?.addEventListener('click', () => {
      resolved = true;
      handle.close();
      resolve(null);
      confirmForgotPassword();
    });
  });
}

/**
 * "I don't have this password anymore." Cryptographically that's final — but the remedy is
 * NOT a device wipe (plans/008 Phase 1): deleting Drive files needs no key, so we throw away
 * the unreadable cloud copy and rebuild it from THIS browser's still-readable local data under
 * a brand-new password. Local data is kept. Two full-screen gates, in order: the consequences
 * (forgot-password.js), then setting the new password (backup-password-setup.js, whose own
 * "save this, we can't recover it" warning matters for the NEW password too). Then
 * resetCloudVault does the delete-all + fresh-manifest + repush.
 */
async function confirmForgotPassword() {
  const confirmed = await showForgotPassword();
  if (!confirmed) return;

  const newPw = await showSetBackupPassword();
  if (!newPw) return;

  const { resetCloudVault } = await import('../../services/sync/cloudReset.js');
  try {
    await resetCloudVault(newPw);
    showToast({
      type: 'success',
      message: 'Backup rebuilt ✓ Your data is safe and now backs up under your new password.',
    });
  } catch (err) {
    showToast({ type: 'error', message: err?.message || 'Reset failed.' });
  }
}

/**
 * Renders the backup status section into the provided container.
 * @param {HTMLElement} container
 */
export async function renderBackupStatus(container) {
  if (!container) return;

  const lastBackupAt = await getAppState('last_backup');
  const connected = isDriveConnected();
  const token = getAccessToken();
  const online = navigator.onLine;

  let statusHtml = '';

  if (!online) {
    statusHtml = renderOfflineState();
  } else if (!connected || !token) {
    statusHtml = renderNotConnectedState();
  } else {
    statusHtml = await renderConnectedState(lastBackupAt);
  }

  container.innerHTML = `
    <div class="settings-backup-card card card-raised">
      <div class="settings-backup-header">
        <h3 class="settings-subsection-title">${getIcon('google-drive', 24)} Cloud Sync</h3>
        <p class="text-secondary text-xs">Back up and sync your data privately via Google Drive.</p>
      </div>
      <div class="settings-backup-body">
        ${statusHtml}
      </div>
    </div>
    ${connected && token && online && !store.get('demoMode') ? renderSyncCardHtml() : ''}
  `;

  attachEventListeners(container);

  // Auto-enable sync when Drive is first connected
  if (connected && token && online && !isSyncEnabled()) {
    setSyncEnabled(true);
  }
}

/**
 * Cloud Sync controls card — shows schedule and sync-now only when connected.
 */
function renderSyncCardHtml() {
  const enabled = isSyncEnabled();
  const schedule = getSyncSchedule();
  // WALL-CLOCK of the last sync run — NOT getLastPushedAt(), which is the LWW row cursor
  // (the newest syncUpdatedAt we've pushed). Rendering that as a date showed the timestamp of
  // the newest *record*, not when the sync happened, and it resets to 0 on a mode change.
  const lastSyncAt = getLastPushRunAt();

  const scheduleOptions = SYNC_SCHEDULES.map(
    (s) => `<option value="${s}" ${s === schedule ? 'selected' : ''}>${SCHEDULE_LABELS[s]}</option>`,
  ).join('');

  const advancedId = 'sync-advanced-details';

  return `
    <div class="settings-backup-card card card-raised" data-sync-card>
      <div class="settings-backup-header">
        <h3 class="settings-subsection-title">Sync controls</h3>
      </div>
      <div class="settings-backup-body">
        <!-- Status & Sync now -->
        <div class="backup-status-item status-sync-toggle">
          <div class="status-content">
            <p class="status-text">${enabled ? 'Syncing automatically' : 'Sync paused'}</p>
            <p class="status-subtext">${
              lastSyncAt > 0
                ? `Last synced ${new Date(lastSyncAt).toLocaleString()}`
                : 'Not synced from this browser yet.'
            }</p>
          </div>
          <ion-button size="small" data-action="sync-now">Sync now</ion-button>
        </div>

        <!-- Advanced (collapsible) -->
        <details id="${advancedId}" class="sync-advanced">
          <summary class="sync-advanced-toggle">Advanced settings</summary>
          <div class="sync-advanced-body">
            <!-- Auto-push schedule -->
            <div class="backup-status-item" style="padding-top:var(--space-2)">
              <div class="status-content">
                <label class="field">
                  <span class="field-label">Auto-backup schedule</span>
                  <select class="input input-sm" data-action="set-schedule">${scheduleOptions}</select>
                </label>
              </div>
            </div>
            ${hasBackupPassword() ? `
            <!-- Change backup password -->
            <div class="backup-status-item">
              <div class="status-content">
                <p class="status-text">Backup password</p>
                <p class="status-subtext">Change the password that protects your cloud backup.</p>
              </div>
              <ion-button size="small" fill="outline" data-action="change-password">Change</ion-button>
            </div>` : ''}
          </div>
        </details>
      </div>
    </div>
  `;
}

function renderOfflineState() {
  return `
    <div class="backup-status-item status-offline">
      <span class="status-icon">${getIcon('warning', 18)}</span>
      <div class="status-content">
        <p class="status-text">${t('settings.backupStatusOffline')}</p>
        <p class="status-subtext">${t('settings.backupStatusOfflineSub')}</p>
      </div>
    </div>
  `;
}

function renderNotConnectedState() {
  return `
    <div class="backup-status-item status-not-connected" style="flex-direction:column;align-items:center;text-align:center;gap:var(--space-4);padding:var(--space-5) 0;">
      <span class="status-icon" style="font-size:2rem;">${getIcon('google-drive', 36)}</span>
      <div class="status-content">
        <p class="status-text" style="font-size:1.1rem;font-weight:600;">Connect Google Drive</p>
        <p class="status-subtext" style="max-width:22rem;margin:0 auto;">Securely back up your data to your Google Account. Your GPS tracking data stays local on your phone.</p>
      </div>
      <ion-button data-action="connect-drive" style="width:100%;max-width:18rem;">
        <span slot="start">${getIcon('google-drive', 18)}</span>
        Connect Google Drive
      </ion-button>
    </div>
  `;
}

async function renderConnectedState(lastBackupAt) {
  const isDemo = store.get('demoMode');
  let statusText = 'Connected to Google Drive';
  let subtext = 'Sync is active.';
  let overdue = false;

  if (lastBackupAt) {
    const date = new Date(lastBackupAt);
    const now = new Date();
    const diffMs = now - date;
    const isToday = date.toDateString() === now.toDateString();
    statusText = isToday ? t('settings.backupStatusToday') : t('settings.backupStatusRecently');
    subtext = `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    if (diffMs > 24 * 60 * 60 * 1000) {
      overdue = true;
      statusText = t('settings.backupStatusOverdue');
    }
  }

  const userEmail = store.get('driveEmail') || '';

  return `
    <div class="backup-status-item status-connected ${overdue ? 'is-overdue' : ''}">
      <span class="status-icon">${getIcon(overdue ? 'warning' : 'check', 20, overdue ? 'text-warning' : 'text-success')}</span>
      <div class="status-content">
        <p class="status-text">${statusText}</p>
        <p class="status-subtext">${userEmail ? `Signed in as ${userEmail} · ` : ''}${subtext}</p>
        ${isDemo ? `<p class="text-warning text-xs mt-1">Backup disabled in Demo Mode</p>` : ''}
      </div>
      <div class="backup-actions">
        <ion-button size="small" fill="outline" data-action="show-restore">${t('settings.backupRestoreBtn')}</ion-button>
        <ion-button size="small" fill="clear" color="medium" data-action="disconnect-drive" title="${t('settings.backupDisconnectBtn')}">${t('common.delete') || 'Disconnect'}</ion-button>
      </div>
    </div>
  `;
}

/**
 * Run one sync, handling the password prompt automatically. Shared by the manual "Sync now"
 * button and the auto-kick right after Drive connects.
 *
 * Sync has no plain mode: a device that's never set a password (a brand-new account, or one
 * that pre-dates always-on encryption) gets prompted to set one, exactly as a returning
 * device gets prompted to enter an existing one. Either prompt can resolve to a retry.
 */
async function runSyncNow() {
  let res = await syncNow(getBackupPassword() ?? '');

  // wrongPassword (manifest verifier rejected us) or needsPassphrase (legacy undecryptable
  // files) — both mean "enter the account password to continue"; the push is already held.
  if (res.wrongPassword || res.needsPassphrase) {
    const pw = await promptEncryptionPassword();
    if (pw) {
      setBackupPassword(pw);
      res = await syncNow(pw);
    }
    return res;
  }

  if (res.needsPasswordSetup) {
    if (res.vaultExists) {
      // A vault already exists on this account — ENTER its password, don't set a new one
      // (setting a new one is how a second device used to fork the vault).
      const pw = await promptEncryptionPassword();
      if (pw) {
        setBackupPassword(pw);
        res = await syncNow(pw);
      }
      return res;
    }
    // No vault anywhere — this browser is starting one. Full screen: the "save this, we
    // can't recover it" warning needs to land, not a small dialog.
    const pw = await showSetBackupPassword();
    if (pw) {
      setBackupPassword(pw);
      repushInNewMode();
      res = await syncNow(pw);
    }
    return res;
  }

  return res;
}

function attachEventListeners(container) {
  container.addEventListener('click', async (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;

    switch (action) {
      case 'connect-drive':
        if (store.get('demoMode')) {
          showConfirm({
            title: t('common.warning'),
            message: t('settings.backupDemoWarning'),
            confirmLabel: t('common.ok') || 'OK',
            cancelLabel: ''
          });
          return;
        }
        requestToken();
        // Listen for connect success and re-render. Kick a sync immediately so the password
        // prompt (set or enter, whichever applies) surfaces right away instead of waiting for
        // a manual "Sync now" tap.
        bus.once('drive:auth_success', async () => {
          setSyncEnabled(true);
          await runSyncNow();
          renderBackupStatus(container);
        });
        break;

      case 'sync-now': {
        if (store.get('demoMode')) {
          showConfirm({
            title: t('common.warning'),
            message: t('settings.backupDemoWarning'),
            confirmLabel: t('common.ok') || 'OK',
            cancelLabel: ''
          });
          return;
        }
        // The control is an ion-button now — resolve it by action, not by tag name.
        const btn = e.target.closest('[data-action="sync-now"]');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '…';
        try {
          const res = await runSyncNow();
          if (res.needsPassphrase || res.pushBlocked) {
            // The engine held this browser's push because Drive has data locked with a
            // different password (plans/008 Phase 0) — a green "Synced" toast would lie.
            showToast({
              type: 'warning',
              message: 'Backup paused — enter the password your other device uses to continue.',
            });
          } else {
            showToast({
              type: 'success',
              message: `Synced — ${res.appliedRows} row(s) received, ${res.pushedRows} pushed.`,
            });
          }
        } catch (err) {
          showToast({ type: 'error', message: err.message || 'Sync failed.' });
        }
        btn.disabled = false;
        btn.textContent = originalText;
        renderBackupStatus(container);
        break;
      }

      case 'show-restore':
        renderRestoreList(container);
        break;

      case 'change-password': {
        // Set a new password (full-screen, its own "save this" warning), then rotate. We sync
        // under the CURRENT password first so any peer data not yet on this browser is merged
        // in — otherwise resetCloudVault (delete-all + repush THIS browser's state under the
        // new password) would drop changes that only lived on other devices.
        const newPw = await showSetBackupPassword();
        if (!newPw) break;
        try {
          const current = getBackupPassword() ?? '';
          if (current) await syncNow(current);
          const { resetCloudVault } = await import('../../services/sync/cloudReset.js');
          await resetCloudVault(newPw);
          showToast({ type: 'success', message: 'Password changed ✓ Enter it on your other devices to keep them syncing.' });
        } catch (err) {
          showToast({ type: 'error', message: err?.message || 'Could not change the password.' });
        }
        renderBackupStatus(container);
        break;
      }

      case 'disconnect-drive': {
        const confirmed = await showConfirm({
          title: t('settings.backupDisconnectConfirmTitle'),
          message: t('settings.backupDisconnectConfirmMessage'),
          confirmText: t('settings.backupDisconnectBtn'),
          danger: true
        });
        if (confirmed) {
          setSyncEnabled(false);
          disconnectDrive();
          renderBackupStatus(container);
        }
        break;
      }
    }
  });

  container.addEventListener('change', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;

    if (action === 'set-schedule') {
      const select = /** @type {HTMLSelectElement} */ (e.target);
      setSyncSchedule(/** @type {import('../../services/sync/schedule.js').SyncSchedule} */ (select.value));
      showToast({ type: 'success', message: 'Sync schedule updated.' });
    }
  });
}

async function renderRestoreList(container) {
  container.innerHTML = `
    <div class="settings-backup-card card card-raised">
      <div class="settings-backup-header">
        <ion-button size="small" fill="clear" data-action="back-to-status"><span slot="start">${getIcon('chevron-left', 14)}</span>${t('common.back')}</ion-button>
        <h3 class="settings-subsection-title">${t('settings.backupRestoreTitle')}</h3>
      </div>
      <div class="settings-backup-body">
        <div class="restore-loading">
          <ion-progress-bar type="indeterminate"></ion-progress-bar>
          ${t('settings.backupRestoreSearching')}
        </div>
      </div>
    </div>
  `;

  const backups = await listAvailableBackups();
  const body = container.querySelector('.settings-backup-body');

  if (backups.length === 0) {
    body.innerHTML = `<p class="text-secondary">${t('settings.backupRestoreEmpty')}</p>`;
  } else {
    body.innerHTML = `
      <div class="restore-list">
        ${backups.map(b => `
          <div class="restore-item">
            <div class="restore-info">
              <p class="restore-date">${b.encryptedAt ? new Date(b.encryptedAt).toLocaleString() : 'Unknown date'}</p>
            </div>
            <ion-button size="small" fill="outline" data-action="restore-file" data-file-id="${b.id}">${t('settings.backupRestoreBtn')}</ion-button>
          </div>
        `).join('')}
      </div>
    `;
  }

  container.querySelector('[data-action="back-to-status"]').onclick = () => renderBackupStatus(container);

  container.querySelectorAll('[data-action="restore-file"]').forEach(btn => {
    btn.onclick = async () => {
      const fileId = btn.dataset.fileId;
      const confirmed = await showConfirm({
        title: t('settings.backupRestoreConfirmTitle'),
        message: t('settings.backupRestoreConfirmMessage'),
        confirmText: t('settings.backupRestoreConfirmText'),
        requireType: 'RESTORE',
        danger: true
      });

      if (!confirmed) return;

      // Only need password if E2E encryption was enabled
      const passphrase = hasBackupPassword() ? await promptEncryptionPassword() : '';
      if (passphrase === null) return; // user cancelled the password prompt

      btn.disabled = true;
      btn.textContent = 'Restoring...';
      const res = await runRestore(fileId, passphrase ?? '');
      if (res.success) {
        showToast({ type: 'success', message: t('settings.backupRestoreSuccessToast') });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        showToast({ type: 'error', message: res.error || t('settings.backupRestoreFailToast') });
        btn.disabled = false;
        btn.textContent = t('settings.backupRestoreBtn');
      }
    };
  });
}
