import { getUser, saveUser } from '../../core/db.js';
import { store } from '../../core/store.js';
import { bus, THEME_CHANGED } from '../../core/events.js';
import { showToast } from '../../ui/components.js';
import { t } from '../../utils/strings.js';
import { esc, applyAccent, applyFontSize, applyDensity, normalizeAccentHex } from './settings-utils.js';

const PRESET_ACCENTS = [
  '#F5A623', '#FF4D4F', '#10B981', '#3B82F6',
  '#8B5CF6', '#F97316', '#14B8A6', '#E11D48',
  '#22C55E', '#6366F1', '#D97706', '#6B7280',
];

export async function mountAppearanceSettings(root) {
  root.textContent = '';
  const user = (await getUser()) || {};
  const userAccentNorm = normalizeAccentHex(user.accentColor);

  root.innerHTML = `
    <div class="settings-sections-stack">
      <section class="settings-view-section card card-raised">
        <h2 class="settings-section-title">Interface</h2>
        <div class="settings-grid">
          <label class="input-group">
            <span class="input-label">${esc(t('settings.theme'))}</span>
            <select class="input" data-setting-theme>
              <option value="auto" ${user.theme === 'auto' ? 'selected' : ''}>Auto</option>
              <option value="light" ${user.theme === 'light' ? 'selected' : ''}>Light</option>
              <option value="dark" ${user.theme === 'dark' ? 'selected' : ''}>Dark</option>
            </select>
          </label>
          <label class="input-group">
            <span class="input-label">Font size</span>
            <select class="input" data-setting-font>
              <option value="small" ${user.fontSize === 'small' ? 'selected' : ''}>Small</option>
              <option value="medium" ${!user.fontSize || user.fontSize === 'medium' ? 'selected' : ''}>Medium</option>
              <option value="large" ${user.fontSize === 'large' ? 'selected' : ''}>Large</option>
              <option value="xl" ${user.fontSize === 'xl' ? 'selected' : ''}>XL</option>
            </select>
          </label>
          <label class="input-group">
            <span class="input-label">Layout density</span>
            <select class="input" data-setting-density>
              <option value="comfortable" ${!user.layoutDensity || user.layoutDensity === 'comfortable' ? 'selected' : ''}>Comfortable</option>
              <option value="compact" ${user.layoutDensity === 'compact' ? 'selected' : ''}>Compact</option>
            </select>
          </label>
        </div>
      </section>

      <section class="settings-view-section card card-raised">
        <h2 class="settings-section-title">Branding</h2>
        <div class="settings-accent">
          <p class="input-label">${esc(t('settings.accentLabel'))}</p>
          <div class="settings-accent-row">
            <div
              class="settings-accent-tabs"
              role="radiogroup"
              aria-label="${esc(t('settings.accentPresetsAria'))}"
              data-setting-accent-swatches
            >
              ${PRESET_ACCENTS.map((hex) => {
                const sel = Boolean(userAccentNorm && userAccentNorm === normalizeAccentHex(hex));
                return `<button type="button" role="radio" class="settings-accent-tab${sel ? ' is-selected' : ''}" data-accent="${esc(hex)}" style="--accent:${hex}" aria-checked="${sel ? 'true' : 'false'}" aria-label="${esc(`${t('settings.accentPresetUse')} ${hex}`)}"></button>`;
              }).join('')}
            </div>
            <label class="settings-accent-hex-inline">
              <span class="settings-accent-hex-label">${esc(t('settings.accentCustomHex'))}</span>
              <input class="input" data-setting-accent-hex value="${esc(user.accentColor || '')}" placeholder="#RRGGBB" />
            </label>
          </div>
        </div>
      </section>

      <section class="settings-view-section card card-raised">
        <h2 class="settings-section-title">Regional & Locale</h2>
        <div class="settings-grid">
          <label class="input-group">
            <span class="input-label">${esc(t('settings.currency'))}</span>
            <select class="input" data-setting-currency>
              ${['USD', 'CAD', 'EUR', 'GBP', 'AUD'].map((c) => `<option value="${c}" ${user?.locale?.currency === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </label>
          <label class="input-group">
            <span class="input-label">${esc(t('settings.dateFormat'))}</span>
            <select class="input" data-setting-date-format>
              <option value="YYYY-MM-DD" ${user?.locale?.dateFormat === 'YYYY-MM-DD' ? 'selected' : ''}>YYYY-MM-DD</option>
              <option value="MM/DD/YYYY" ${user?.locale?.dateFormat === 'MM/DD/YYYY' ? 'selected' : ''}>MM/DD/YYYY</option>
              <option value="DD/MM/YYYY" ${user?.locale?.dateFormat === 'DD/MM/YYYY' ? 'selected' : ''}>DD/MM/YYYY</option>
            </select>
          </label>
          <label class="input-group">
            <span class="input-label">Week starts on</span>
            <select class="input" data-setting-week-start>
              <option value="0" ${Number(user?.locale?.weekStartDay) === 0 ? 'selected' : ''}>Sunday</option>
              <option value="1" ${Number(user?.locale?.weekStartDay) === 1 ? 'selected' : ''}>Monday</option>
            </select>
          </label>
          <label class="input-group">
            <span class="input-label">Shift duration format</span>
            <select class="input" data-setting-time-format>
              <option value="12h" ${user?.locale?.timeFormat === '12h' ? 'selected' : ''}>12-hour</option>
              <option value="24h" ${user?.locale?.timeFormat === '24h' ? 'selected' : ''}>24-hour</option>
            </select>
          </label>
        </div>
      </section>

      <div class="settings-actions" style="margin-top: var(--space-2); display: flex; justify-content: flex-end;">
        <ion-button style="min-width: 140px;" data-save-display>${esc(t('common.save'))}</ion-button>
      </div>
    </div>
  `;

  root.querySelector('[data-save-display]')?.addEventListener('click', async () => {
    const currency = root.querySelector('[data-setting-currency]')?.value || 'USD';
    const theme = root.querySelector('[data-setting-theme]')?.value || 'auto';
    const fontSize = root.querySelector('[data-setting-font]')?.value || 'medium';
    const layoutDensity = root.querySelector('[data-setting-density]')?.value || 'comfortable';
    const dateFormat = root.querySelector('[data-setting-date-format]')?.value || 'YYYY-MM-DD';
    const weekStartDay = Number(root.querySelector('[data-setting-week-start]')?.value || 0);
    const timeFormat = root.querySelector('[data-setting-time-format]')?.value || '12h';
    const accentRaw = root.querySelector('[data-setting-accent-hex]')?.value || '';
    const accentColor = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(accentRaw.trim()) ? accentRaw.trim() : null;
    const prevLocale = user?.locale && typeof user.locale === 'object' ? user.locale : {};

    await saveUser({
      theme: theme === 'light' || theme === 'dark' || theme === 'auto' ? theme : 'auto',
      accentColor,
      fontSize,
      layoutDensity: layoutDensity === 'compact' ? 'compact' : 'comfortable',
      locale: {
        ...prevLocale,
        currency,
        dateFormat,
        weekStartDay: weekStartDay === 1 ? 1 : 0,
        timeFormat: timeFormat === '24h' ? '24h' : '12h',
      },
    });

    applyAccent(accentColor);
    applyFontSize(fontSize);
    applyDensity(layoutDensity);
    await store.refresh('user');
    bus.emit(THEME_CHANGED, { theme });
    showToast({ type: 'success', message: 'Display settings saved.' });
  });

  function refreshAccentPresetSelection() {
    const input = root.querySelector('[data-setting-accent-hex]');
    const v = normalizeAccentHex(input instanceof HTMLInputElement ? input.value : '');
    root.querySelectorAll('[data-accent]').forEach((btn) => {
      const hx = normalizeAccentHex(btn.getAttribute('data-accent') || '');
      const on = Boolean(v && hx === v);
      btn.classList.toggle('is-selected', on);
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }

  root.querySelectorAll('[data-accent]').forEach((el) => {
    el.addEventListener('click', () => {
      const hex = el.getAttribute('data-accent');
      const input = root.querySelector('[data-setting-accent-hex]');
      if (!hex || !(input instanceof HTMLInputElement)) return;
      input.value = hex;
      applyAccent(hex);
      refreshAccentPresetSelection();
    });
  });

  root.querySelector('[data-setting-accent-hex]')?.addEventListener('input', (e) => {
    const raw = e.target instanceof HTMLInputElement ? e.target.value.trim() : '';
    const ok = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw);
    if (ok) applyAccent(raw);
    else if (!raw) applyAccent(null);
    refreshAccentPresetSelection();
  });
}
