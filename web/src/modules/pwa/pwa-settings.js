/**
 * P12 — Settings panel exposing PWA deep features (Features 241–249).
 * Mounted by `views/settings-view.js`. UI-only; all logic lives in `pwa.js`.
 *
 * No permissions are requested on render; every API is opt-in via a button.
 */

import { t } from '../../utils/strings.js';
import { showToast } from '../../ui/components.js';
import {
  pwaCapabilities,
  getNotificationPermission,
  requestNotificationPermission,
  vibrate,
  toggleFullscreen,
  triggerPremiumInstallFlow,
} from './pwa.js';
import { getIcon } from '../../ui/icons.js';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

const PWA_EXPANDED_KEY = 'comma-pwa-expanded-v1';

function loadPwaExpanded() {
  try {
    return sessionStorage.getItem(PWA_EXPANDED_KEY) !== 'false';
  } catch {
    return true;
  }
}

function savePwaExpanded(on) {
  try {
    sessionStorage.setItem(PWA_EXPANDED_KEY, String(on));
  } catch {
    /* ignore */
  }
}

function row(labelText, valueEl, description) {
  const wrap = document.createElement('div');
  wrap.className = 'pwa-cap-row';
  const label = document.createElement('div');
  label.className = 'pwa-cap-label';
  label.textContent = labelText;
  const desc = document.createElement('p');
  desc.className = 'pwa-cap-desc text-secondary';
  desc.textContent = description || '';
  const value = document.createElement('div');
  value.className = 'pwa-cap-value';
  if (valueEl instanceof Node) value.appendChild(valueEl);
  else value.textContent = String(valueEl ?? '');
  wrap.appendChild(label);
  wrap.appendChild(value);
  if (description) wrap.appendChild(desc);
  return wrap;
}

function badge(textContent, ok) {
  const span = document.createElement('span');
  span.className = `pill pill-sm pwa-cap-pill ${ok ? 'is-supported' : 'is-unsupported'}`;
  span.textContent = textContent;
  return span;
}

/**
 * @param {HTMLElement} host
 */
export function mountPwaSettings(host) {
  host.textContent = '';
  const caps = pwaCapabilities();

  const isExpanded = loadPwaExpanded();

  const section = document.createElement('section');
  section.className = `card card-raised settings-collapsible pwa-settings ${isExpanded ? 'is-expanded' : ''}`;
  section.setAttribute('aria-labelledby', 'pwa-settings-title');
  section.setAttribute('data-settings-collapsible', 'pwa');

  const header = document.createElement('header');
  header.className = 'settings-collapsible-header';
  header.setAttribute('data-settings-toggle', 'pwa');
  header.innerHTML = `
    <div class="settings-collapsible-title-wrap">
      <h2 id="pwa-settings-title" class="settings-section-title">${esc(t('pwa.sectionTitle'))}</h2>
      <p class="settings-collapsible-summary">${esc(t('pwa.sectionLead'))}</p>
    </div>
    <span class="settings-collapsible-icon">${getIcon('chevron-down', 20)}</span>
  `;
  section.appendChild(header);

  const body = document.createElement('div');
  body.className = 'settings-collapsible-body';

  const list = document.createElement('div');
  list.className = 'pwa-cap-list';

  /* Install App (Feature 242 - Manual Trigger) */
  {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      /** @type {any} */ (window.navigator).standalone === true;

    if (!isStandalone) {
      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'btn btn-primary btn-sm';
      action.textContent = t('pwa.install.confirm');

      action.addEventListener('click', async () => {
        await triggerPremiumInstallFlow(() => {
          action.disabled = true;
          action.textContent = t('pwa.supported');
        });
      });

      list.appendChild(row(t('pwa.install.title'), action, t('pwa.install.message')));
    }
  }

  /* Background Sync (241) */
  list.appendChild(
    row(
      t('pwa.backgroundSync'),
      badge(caps.backgroundSync ? t('pwa.supported') : t('pwa.unsupported'), caps.backgroundSync),
      caps.backgroundSync ? t('pwa.backgroundSyncOn') : t('pwa.backgroundSyncOff'),
    ),
  );

  /* Share Target (244) */
  list.appendChild(
    row(
      t('pwa.shareTarget'),
      badge(t('pwa.supported'), true),
      t('pwa.shareTargetOn'),
    ),
  );

  /* File System Access (245) */
  list.appendChild(
    row(
      t('pwa.fileSystem'),
      badge(caps.fileSystemAccess ? t('pwa.supported') : t('pwa.unsupported'), caps.fileSystemAccess),
      caps.fileSystemAccess ? t('pwa.fileSystemOn') : t('pwa.fileSystemOff'),
    ),
  );

  /* Wake Lock (248) */
  list.appendChild(
    row(
      t('pwa.wakeLock'),
      badge(caps.wakeLock ? t('pwa.supported') : t('pwa.unsupported'), caps.wakeLock),
      caps.wakeLock ? t('pwa.wakeLockOn') : t('pwa.wakeLockOff'),
    ),
  );

  /* Notifications (246) */
  {
    const perm = getNotificationPermission();
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'btn btn-secondary btn-sm';
    action.textContent = t('pwa.requestNotifications');
    if (perm === 'granted') {
      action.disabled = true;
      action.textContent = t('pwa.notificationsGranted');
    } else if (perm === 'denied') {
      action.disabled = true;
      action.textContent = t('pwa.notificationsDenied');
    } else if (perm === 'unsupported') {
      action.disabled = true;
      action.textContent = t('pwa.notificationsUnsupported');
    } else {
      action.addEventListener('click', async () => {
        action.disabled = true;
        const result = await requestNotificationPermission();
        if (result === 'granted') {
          action.textContent = t('pwa.notificationsGranted');
          showToast({ type: 'success', message: t('pwa.notificationsGranted'), duration: 1600 });
        } else if (result === 'denied') {
          action.textContent = t('pwa.notificationsDenied');
        } else if (result === 'unsupported') {
          action.textContent = t('pwa.notificationsUnsupported');
        } else {
          action.disabled = false;
        }
      });
    }
    list.appendChild(row(t('notifications.title'), action, ''));
  }

  /* Vibration (247) */
  {
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'btn btn-secondary btn-sm';
    action.textContent = t('pwa.testVibrate');
    if (!caps.vibrate) {
      action.disabled = true;
      action.textContent = t('pwa.vibrationUnsupported');
    } else {
      action.addEventListener('click', () => {
        const ok = vibrate('success');
        showToast({
          type: ok ? 'success' : 'info',
          message: ok ? t('pwa.vibrationOk') : t('pwa.vibrationUnsupported'),
          duration: 1400,
        });
      });
    }
    list.appendChild(row(t('pwa.testVibrate'), action, ''));
  }

  body.appendChild(list);
  section.appendChild(body);
  host.appendChild(section);

  header.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const wasOpen = section.classList.contains('is-expanded');

    if (!wasOpen) {
      // Close others in the same panel
      const panel = section.closest('.settings-tabpanel');
      if (panel) {
        panel.querySelectorAll('.settings-collapsible').forEach((c) => c.classList.remove('is-expanded'));
      }
      section.classList.add('is-expanded');
      savePwaExpanded(true);
    } else {
      section.classList.remove('is-expanded');
      savePwaExpanded(false);
    }
  });
}
