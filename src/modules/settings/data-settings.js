import { setAppState } from '../../core/db.js';
import { t } from '../../utils/strings.js';
import { showToast } from '../../ui/components.js';
import { exportVaultBackupJson } from '../reports/reports.js';
import { esc } from './settings-utils.js';

/**
 * Data export entry points, vault reset, and about links (F10 / F20).
 * @param {HTMLElement} root
 */
export async function mountDataAndSafetySettings(root) {
  root.textContent = '';
  root.className = 'settings-data-stack';

  root.innerHTML = `
    <section class="settings-view-section card card-raised">
      <h2 class="settings-section-title">${esc(t('settings.dataSectionTitle'))}</h2>
      <p class="text-secondary settings-section-lead" style="margin-top:0">${esc(t('settings.dataSectionLead'))}</p>
      <div class="settings-actions">
        <a class="btn btn-primary" href="#/reports">${esc(t('settings.openReportsBtn'))}</a>
        <button type="button" class="btn btn-secondary" data-action="export-vault-json">${esc(t('settings.exportVaultBtn'))}</button>
      </div>
    </section>

    <section class="settings-view-section card card-raised">
      <h2 class="settings-section-title">${esc(t('zones.sectionTitle'))}</h2>
      <p class="text-secondary settings-section-lead" style="margin-top:0">${esc(t('zones.sectionLead'))}</p>
      <div class="settings-actions">
        <a class="btn btn-secondary" href="#/shifts">${esc(t('app.navShifts'))}</a>
      </div>
    </section>

    <section class="settings-view-section card settings-danger-card">
      <h2 class="settings-section-title">${esc(t('settings.dangerSectionTitle'))}</h2>
      <p class="text-secondary settings-section-lead" style="margin-top:0">${esc(t('settings.dangerSectionLead'))}</p>
      <div class="settings-actions">
        <button type="button" class="btn btn-danger" data-action="reset-vault">${esc(t('settings.dangerResetBtn'))}</button>
      </div>
    </section>

    <section class="settings-view-section card card-raised">
      <h2 class="settings-section-title">${esc(t('settings.aboutSectionTitle'))}</h2>
      <p class="text-secondary settings-section-lead" style="margin-top:0">${esc(t('settings.aboutSectionLead'))}</p>
      <div class="settings-actions">
        <a class="btn btn-secondary" href="#/about">${esc(t('settings.aboutAppLink'))}</a>
        <a class="btn btn-ghost" href="#/settings?tab=about">${esc(t('settings.aboutRouteLink'))}</a>
      </div>
    </section>
  `;

  root.querySelector('[data-action="export-vault-json"]')?.addEventListener('click', async () => {
    try {
      await exportVaultBackupJson();
      await setAppState('last_backup', new Date().toISOString());
      showToast({ type: 'success', message: t('settings.exportVaultToast'), duration: 2400 });
    } catch (e) {
      console.error('[macadam] vault export failed', e);
      showToast({ type: 'error', message: t('errors.exportFailed'), duration: 3200 });
    }
  });

  root.querySelector('[data-action="reset-vault"]')?.addEventListener('click', async () => {
    try {
      const { resetVault } = await import('../onboarding/onboarding.js');
      await resetVault();
    } catch (e) {
      console.error('[macadam] reset vault failed', e);
      showToast({ type: 'error', message: t('errors.generic'), duration: 2400 });
    }
  });
}
