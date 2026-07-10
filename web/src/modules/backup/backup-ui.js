/**
 * COMMA — Backup UI
 * Renders the backup status and controls in the Settings -> Data tab.
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
  getLastPushedAt,
} from '../../services/sync/syncState.js';
import { SYNC_SCHEDULES, SCHEDULE_LABELS } from '../../services/sync/schedule.js';
import { syncNow } from '../../services/sync/syncNow.js';

const MIN_PW = 6;

/**
 * Prompt the user to set (mode:'set', with confirm field) or enter (mode:'enter') the backup
 * password. Resolves to the password string, or null if cancelled. Mirrors mobile's
 * `PasswordPrompt` modal (`app/settings/backup.tsx`) in spirit — same copy, vanilla-JS modal.
 * @param {'set'|'enter'} mode
 * @returns {Promise<string|null>}
 */
function promptBackupPassword(mode) {
  return new Promise((resolve) => {
    const isSet = mode === 'set';
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <p class="text-secondary text-sm" style="margin-bottom: var(--space-3);">
        ${
          isSet
            ? 'This password encrypts your backups and sync data. You will need it on every device — including a brand-new one. If you lose it, your cloud data cannot be recovered.'
            : 'Enter the password used when this data was encrypted.'
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
      title: isSet ? 'Set backup password' : 'Enter backup password',
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
            if (pw.length < MIN_PW) {
              if (errEl) errEl.textContent = `Use at least ${MIN_PW} characters.`;
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
 * Resolve the backup password: the stored one if present, otherwise prompt to set one (first
 * use) or enter one (restoring on a device that's never had it typed in).
 * @param {'set'|'enter'} modeIfMissing
 * @returns {Promise<string|null>}
 */
async function resolveBackupPassword(modeIfMissing) {
  const stored = getBackupPassword();
  if (stored) return stored;
  const pw = await promptBackupPassword(modeIfMissing);
  if (pw) setBackupPassword(pw);
  return pw;
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
  } else if (!connected) {
    statusHtml = renderNotConnectedState();
  } else if (!token) {
    statusHtml = renderDisconnectedState();
  } else {
    statusHtml = await renderConnectedState(lastBackupAt);
  }

  container.innerHTML = `
    <div class="settings-backup-card card card-raised">
      <div class="settings-backup-header">
        <h3 class="settings-subsection-title">${getIcon('vault', 24)} ${t('settings.backupTitle')}</h3>
        <p class="text-secondary text-xs">${t('settings.backupLead')}</p>
      </div>
      <div class="settings-backup-body">
        ${statusHtml}
      </div>
    </div>
    ${connected && online ? renderSyncCardHtml() : ''}
  `;

  attachEventListeners(container);
}

/**
 * Cloud Sync card (interop plan Workstream 3) — separate from the whole-vault `.comdb` backup
 * above. Lets the user turn on incremental multi-device sync (shifts/expenses/vehicles/etc.
 * pushed+pulled as change-logs through the same Drive appDataFolder), pick an auto-push
 * schedule, and trigger a manual sync. Requires the same backup password as `.comdb` backups
 * (shared crypto helper, see encryption.js).
 */
function renderSyncCardHtml() {
  const enabled = isSyncEnabled();
  const schedule = getSyncSchedule();
  const lastPushedAt = getLastPushedAt();
  const scheduleOptions = SYNC_SCHEDULES.map(
    (s) => `<option value="${s}" ${s === schedule ? 'selected' : ''}>${SCHEDULE_LABELS[s]}</option>`,
  ).join('');

  return `
    <div class="settings-backup-card card card-raised" data-sync-card>
      <div class="settings-backup-header">
        <h3 class="settings-subsection-title">${getIcon('google-drive', 24)} Cloud Sync</h3>
        <p class="text-secondary text-xs">Keep this device and your phone's Comma app continuously in sync via the same Google Drive folder.</p>
      </div>
      <div class="settings-backup-body">
        <div class="backup-status-item status-sync-toggle">
          <div class="status-content">
            <p class="status-text">${enabled ? 'Sync is on' : 'Sync is off'}</p>
            <p class="status-subtext">${
              lastPushedAt > 0
                ? `Last pushed ${new Date(lastPushedAt).toLocaleString()}`
                : 'Never pushed on this device yet.'
            }</p>
          </div>
          <label class="toggle">
            <input type="checkbox" data-action="toggle-sync" ${enabled ? 'checked' : ''} />
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
          </label>
        </div>
        ${
          enabled
            ? `<div class="backup-status-item status-sync-controls">
                <div class="status-content">
                  <label class="field">
                    <span class="field-label">Auto-push schedule</span>
                    <select class="input" data-action="set-schedule">${scheduleOptions}</select>
                  </label>
                </div>
                <div class="backup-actions">
                  <button type="button" class="btn btn-secondary btn-sm" data-action="sync-now">Sync now</button>
                </div>
              </div>`
            : ''
        }
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
    <div class="backup-status-item status-not-connected">
      <span class="status-icon">${getIcon('google-drive', 24)}</span>
      <div class="status-content">
        <p class="status-text">${t('settings.backupConnectBtn')}</p>
        <p class="status-subtext">${t('settings.backupConnectSub')}</p>
      </div>
      <div class="backup-actions">
        <button type="button" class="btn btn-primary btn-sm" data-action="connect-drive">${t('common.confirm') || 'Connect'}</button>
      </div>
    </div>
  `;
}

function renderDisconnectedState() {
  return `
    <div class="backup-status-item status-reconnect">
      <span class="status-icon">${getIcon('google-drive', 24)}</span>
      <div class="status-content">
        <p class="status-text">${t('settings.backupStatusDisconnected')}</p>
        <p class="status-subtext">${t('settings.backupStatusDisconnectedSub')}</p>
      </div>
      <div class="backup-actions">
        <button type="button" class="btn btn-primary btn-sm" data-action="connect-drive">${t('common.retry') || 'Reconnect'}</button>
      </div>
    </div>
  `;
}

async function renderConnectedState(lastBackupAt) {
  const isDemo = store.get('demoMode');
  let statusText = t('settings.backupStatusConnected');
  let subtext = t('settings.backupStatusNone');
  let icon = getIcon('google-drive', 24);
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
      icon = getIcon('alert-circle', 18, 'text-warning');
      statusText = t('settings.backupStatusOverdue');
    }
  }

  const pwSet = hasBackupPassword();

  return `
    <div class="backup-status-item status-connected ${overdue ? 'is-overdue' : ''}">
      <span class="status-icon">${icon}</span>
      <div class="status-content">
        <p class="status-text">${statusText}</p>
        <p class="status-subtext">${subtext}</p>
        ${isDemo ? `<p class="text-warning text-xs mt-1">Backup disabled in Demo Mode</p>` : ''}
      </div>
      <div class="backup-actions">
        <button type="button" class="btn btn-secondary btn-sm" data-action="backup-now" ${isDemo ? 'disabled title="Disabled in Demo Mode"' : ''}>${t('settings.backupNowBtn')}</button>
        <button type="button" class="btn btn-secondary btn-sm" data-action="show-restore">${t('settings.backupRestoreBtn')}</button>
        <button type="button" class="btn btn-ghost btn-xs" data-action="disconnect-drive" title="${t('settings.backupDisconnectBtn')}">${t('common.delete') || 'Disconnect'}</button>
      </div>
    </div>
    <div class="backup-status-item status-password">
      <span class="status-icon">${getIcon('shield', 18)}</span>
      <div class="status-content">
        <p class="status-text">Backup password</p>
        <p class="status-subtext">${pwSet ? 'Set on this device.' : 'Not set — required before your first backup or sync.'}</p>
      </div>
      <div class="backup-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-action="set-password">${pwSet ? 'Change' : 'Set password'}</button>
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
        break;
      case 'set-password': {
        const pw = await promptBackupPassword('set');
        if (pw) {
          setBackupPassword(pw);
          showToast({ type: 'success', message: 'Backup password saved on this device.' });
          renderBackupStatus(container);
        }
        break;
      }
      case 'backup-now': {
        const btn = e.target.closest('button');
        const originalText = btn.textContent;
        const passphrase = await resolveBackupPassword('set');
        if (!passphrase) return;
        btn.disabled = true;
        btn.textContent = '...';
        const res = await runBackup({ passphrase });
        if (res.success) {
          showToast({ type: 'success', message: t('settings.backupSuccessToast') });
          renderBackupStatus(container);
        } else {
          showToast({ type: 'error', message: res.error || t('settings.backupFailToast') });
          btn.disabled = false;
          btn.textContent = originalText;
        }
        break;
      }
      case 'show-restore':
        renderRestoreList(container);
        break;
      case 'disconnect-drive':
        const confirmed = await showConfirm({
          title: t('settings.backupDisconnectConfirmTitle'),
          message: t('settings.backupDisconnectConfirmMessage'),
          confirmText: t('settings.backupDisconnectBtn'),
          danger: true
        });
        if (confirmed) {
          disconnectDrive();
          renderBackupStatus(container);
        }
        break;
      case 'toggle-sync': {
        const checkbox = /** @type {HTMLInputElement} */ (e.target);
        if (checkbox.checked) {
          const passphrase = await resolveBackupPassword('set');
          if (!passphrase) {
            checkbox.checked = false;
            return;
          }
          setSyncEnabled(true);
          showToast({ type: 'success', message: 'Cloud Sync turned on.' });
          const res = await syncNow(passphrase).catch((err) => ({ success: false, error: err.message }));
          if (res && res.error) showToast({ type: 'error', message: res.error });
        } else {
          setSyncEnabled(false);
          showToast({ type: 'info', message: 'Cloud Sync turned off.' });
        }
        renderBackupStatus(container);
        break;
      }
      case 'sync-now': {
        const btn = e.target.closest('button');
        const passphrase = await resolveBackupPassword('enter');
        if (!passphrase) return;
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '...';
        try {
          const res = await syncNow(passphrase);
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
    }
  });

  container.addEventListener('change', async (e) => {
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

      const passphrase = await resolveBackupPassword('enter');
      if (!passphrase) return;

      btn.disabled = true;
      btn.textContent = 'Restoring...';
      const res = await runRestore(fileId, passphrase);
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
