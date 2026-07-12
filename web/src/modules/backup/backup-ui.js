/**
 * COMMA — Backup UI (simplified, WhatsApp-style)
 *
 * Sync activates the moment the user connects Google Drive — no password required.
 * E2E encryption is optional and lives in an "Advanced" collapsible section.
 * Renders the backup status and controls in Settings → Data tab.
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
import { getBackupPassword, hasBackupPassword, setBackupPassword, clearBackupPassword } from '../../services/sync/backupPassword.js';
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
import { showE2EESetup } from './e2ee-setup.js';

/**
 * Switching encryption mode changes the format of every file we write. Rewind the push cursor
 * to 0 so the very next push re-uploads this browser's FULL state in the new mode — otherwise
 * the cloud keeps only old-mode files plus a thin new-mode delta, and a device without the
 * password can never reconstruct the history.
 */
function repushInNewMode() {
  setLastPushedAt(0);
}

/**
 * Prompt user to set or enter an E2E encryption password (advanced feature only).
 * @param {'set'|'enter'} mode
 * @returns {Promise<string|null>}
 */
export function promptEncryptionPassword(mode) {
  return new Promise((resolve) => {
    const isSet = mode === 'set';
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <p class="text-secondary text-sm" style="margin-bottom: var(--space-3);">
        ${
          isSet
            ? 'This password encrypts your backup end-to-end. You will need it on every device. If you lose it, your cloud data cannot be recovered.'
            : 'Enter the encryption password used when E2E encryption was enabled.'
        }
      </p>
      <form class="backup-password-form">
        <label class="field">
          <span class="field-label">Password</span>
          <input class="input" type="password" name="pw" autocomplete="off" autocapitalize="off" />
        </label>
        ${
          isSet
            ? `<label class="field">
                 <span class="field-label">Confirm password</span>
                 <input class="input" type="password" name="pw2" autocomplete="off" autocapitalize="off" />
               </label>`
            : ''
        }
        <p class="text-danger text-xs" data-pw-err style="min-height: 1em;"></p>
      </form>
    `;
    let resolved = false;
    const handle = showModal({
      title: isSet ? 'Set encryption password' : 'Enter encryption password',
      content: wrap,
      actions: [
        { label: t('common.cancel'), class: 'btn btn-ghost', onClick: () => { resolved = true; resolve(null); } },
        {
          label: t('common.confirm') || 'Continue',
          class: 'btn btn-primary',
          close: false,
          onClick: () => {
            const pw = /** @type {HTMLInputElement} */ (wrap.querySelector('[name="pw"]'))?.value || '';
            const pw2 = /** @type {HTMLInputElement} */ (wrap.querySelector('[name="pw2"]'))?.value || '';
            const errEl = wrap.querySelector('[data-pw-err]');
            if (pw.length < 6) {
              if (errEl) errEl.textContent = 'Use at least 6 characters.';
              return;
            }
            if (isSet && pw !== pw2) {
              if (errEl) errEl.textContent = "Passwords don't match.";
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
  });
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
    ${connected && token && online ? renderSyncCardHtml() : ''}
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
  const pwSet = hasBackupPassword();

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
          <button type="button" class="btn btn-primary btn-sm" data-action="sync-now">Sync now</button>
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

            <!-- E2E Encryption toggle -->
            <div class="backup-status-item">
              <div class="status-content">
                <p class="status-text">End-to-End Encryption</p>
                <p class="status-subtext">${
                  pwSet
                    ? 'On — data encrypted with your password before leaving this device.'
                    : 'Off — data protected by your Google Account (same as Google Drive).'
                }</p>
              </div>
              <label class="toggle">
                <input type="checkbox" data-action="toggle-e2e" ${pwSet ? 'checked' : ''} />
                <span class="toggle-track"><span class="toggle-thumb"></span></span>
              </label>
            </div>
          </div>
        </details>
      </div>
    </div>
  `;
}

function renderOfflineState() {
  return `
    <div class="backup-status-item status-offline">
      <span class="status-icon">${getIcon('wifi-off', 18)}</span>
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
      <button type="button" class="btn btn-primary" data-action="connect-drive" style="width:100%;max-width:18rem;">
        ${getIcon('google-drive', 18)} Connect Google Drive
      </button>
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
      <span class="status-icon">${getIcon('check-circle', 20, overdue ? 'text-warning' : 'text-success')}</span>
      <div class="status-content">
        <p class="status-text">${statusText}</p>
        <p class="status-subtext">${userEmail ? `Signed in as ${userEmail} · ` : ''}${subtext}</p>
        ${isDemo ? `<p class="text-warning text-xs mt-1">Backup disabled in Demo Mode</p>` : ''}
      </div>
      <div class="backup-actions">
        <button type="button" class="btn btn-secondary btn-sm" data-action="show-restore">${t('settings.backupRestoreBtn')}</button>
        <button type="button" class="btn btn-ghost btn-xs" data-action="disconnect-drive" title="${t('settings.backupDisconnectBtn')}">${t('common.delete') || 'Disconnect'}</button>
      </div>
    </div>
  `;
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
        // Listen for connect success and re-render
        bus.once('drive:auth_success', () => {
          setSyncEnabled(true);
          renderBackupStatus(container);
        });
        break;

      case 'sync-now': {
        const btn = e.target.closest('button');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '…';
        try {
          // The stored password IS the mode: present → E2E, absent → plain (one-tap).
          // An empty string is a legal passphrase; the engine writes a plain envelope.
          let res = await syncNow(getBackupPassword() ?? '');

          // Some files on Drive are E2E-encrypted and we couldn't open them. Everything else
          // synced fine — ask for the password and re-run to pick up the rest.
          if (res.needsPassphrase) {
            const pw = await promptEncryptionPassword('enter');
            if (pw) {
              setBackupPassword(pw);
              res = await syncNow(pw);
            }
          }

          showToast({
            type: 'success',
            message: `Synced — ${res.appliedRows} row(s) received, ${res.pushedRows} pushed.`,
          });
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

  container.addEventListener('change', async (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;

    if (action === 'set-schedule') {
      const select = /** @type {HTMLSelectElement} */ (e.target);
      setSyncSchedule(/** @type {import('../../services/sync/schedule.js').SyncSchedule} */ (select.value));
      showToast({ type: 'success', message: 'Sync schedule updated.' });
    }

    if (action === 'toggle-e2e') {
      const checkbox = /** @type {HTMLInputElement} */ (e.target);
      if (checkbox.checked) {
        // Full-page takeover, not a dialog: losing this password is the only unrecoverable
        // action in the app, so the risk must be read and explicitly acknowledged first.
        const pw = await showE2EESetup();
        if (!pw) {
          checkbox.checked = false;
          return;
        }
        setBackupPassword(pw);
        repushInNewMode();
        showToast({ type: 'success', message: 'Encryption is on. Enter this same password on your other devices to keep them syncing.' });
        renderBackupStatus(container);
      } else {
        // Disable E2E — confirm then clear
        const confirmed = await showConfirm({
          title: 'Disable E2E Encryption?',
          message: 'Your backup will still be private and only accessible via your Google Account.',
          confirmText: 'Disable',
          danger: true
        });
        if (confirmed) {
          clearBackupPassword();
          repushInNewMode();
          showToast({ type: 'info', message: 'End-to-End Encryption disabled.' });
          renderBackupStatus(container);
        } else {
          checkbox.checked = true; // revert
        }
      }
    }
  });
}

async function renderRestoreList(container) {
  container.innerHTML = `
    <div class="settings-backup-card card card-raised">
      <div class="settings-backup-header">
        <button type="button" class="btn btn-ghost btn-xs" data-action="back-to-status">${getIcon('arrow-left', 14)} ${t('common.back')}</button>
        <h3 class="settings-subsection-title">${t('settings.backupRestoreTitle')}</h3>
      </div>
      <div class="settings-backup-body">
        <div class="restore-loading">${t('settings.backupRestoreSearching')}</div>
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
            <button type="button" class="btn btn-secondary btn-sm" data-action="restore-file" data-file-id="${b.id}">${t('settings.backupRestoreBtn')}</button>
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
      const passphrase = hasBackupPassword() ? await promptEncryptionPassword('enter') : '';
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
