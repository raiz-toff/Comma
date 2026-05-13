import { t } from '../utils/strings.js';
import { mountSettings } from '../modules/settings/settings.js';
import { mountPwaSettings } from '../modules/pwa/pwa-settings.js';

/** @param {HTMLElement} root @param {Record<string, unknown>} ctx */
export async function render(root, ctx) {
  root.textContent = '';
  const wrap = document.createElement('div');
  wrap.className = 'settings-view';

  const settingsHost = document.createElement('section');
  settingsHost.className = 'settings-view-section';
  wrap.appendChild(settingsHost);

  root.appendChild(wrap);

  try {
    await mountSettings(settingsHost, ctx);
  } catch (e) {
    console.error('[macadam] settings mount failed', e);
    const err = document.createElement('p');
    err.className = 'route-error';
    err.setAttribute('role', 'alert');
    err.textContent = t('errors.viewRender');
    settingsHost.appendChild(err);
  }

  /* P12 — PWA deep features: mounted inside Settings → Alerts tab (see `data-pwa-settings-host`). */
  const pwaMount = settingsHost.querySelector('[data-pwa-settings-host]');
  if (pwaMount) {
    try {
      mountPwaSettings(pwaMount);
    } catch (e) {
      console.error('[macadam] pwa settings mount failed', e);
      const err = document.createElement('p');
      err.className = 'route-error';
      err.setAttribute('role', 'alert');
      err.textContent = t('errors.viewRender');
      pwaMount.appendChild(err);
    }
  }
}
