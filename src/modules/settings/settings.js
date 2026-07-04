import { db, getUser, saveUser, getAppState, setAppState, purgeOldDeleted } from '../../core/db.js';
import { store } from '../../core/store.js';
import { bus, THEME_CHANGED, PLATFORM_CHANGED, GOAL_UPDATED } from '../../core/events.js';
import { showConfirm, showToast } from '../../ui/components.js';
import { getIcon } from '../../ui/icons.js';
import { t } from '../../utils/strings.js';
import { resetVault, exitDemoToOnboardingStart } from '../onboarding/onboarding.js';
import { exportVaultBackupJson } from '../reports/reports.js';
import { importVaultFile } from '../backup/vault-import.js';
import { CountryRegistry, getCountryTaxProfile } from '../../registry/countries/index.js';
import { ProvinceRegistry } from '../../registry/provinces/index.js';
import { renderBackupStatus } from '../backup/backup-ui.js';
import { mountSettingsPlatforms } from './platforms-settings.js';
import { formatShortcutOverlayListItems } from './keyboard-shortcuts.js';
import { normalizeAccentHex } from './settings-utils.js';
import { updateAccentColor } from '../../core/adaptive-theme.js';
import { pwaCapabilities, toggleFullscreen } from '../pwa/pwa.js';

const DEBUG_TAP_WINDOW_MS = 5500;
const PRESET_ACCENTS = [
  '#10B981',
  '#FF4D4F',
  '#F5A623',
  '#3B82F6',
  '#8B5CF6',
  '#F97316',
  '#14B8A6',
  '#E11D48',
  '#22C55E',
  '#6366F1',
  '#D97706',
  '#6B7280',
];
const SETTINGS_EXPANDED_KEY = 'comma-settings-expanded-v1';

function loadSettingsExpanded() {
  try {
    const raw = sessionStorage.getItem(SETTINGS_EXPANDED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSettingsExpanded(map) {
  try {
    sessionStorage.setItem(SETTINGS_EXPANDED_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}


const WORK_SCHEDULE_PRESETS = ['flexible', 'weekdays', 'evenings', 'weekends'];

/** @param {Record<string, unknown>} u */
function workSchedulePresetFromUser(u) {
  const ws = u?.workSchedule;
  if (ws && typeof ws === 'object' && typeof ws.preset === 'string' && WORK_SCHEDULE_PRESETS.includes(ws.preset)) {
    return ws.preset;
  }
  if (typeof ws === 'string' && WORK_SCHEDULE_PRESETS.includes(ws)) return ws;
  return 'flexible';
}

/** @param {string} country */
function provinceLabelKeyForCountry(country) {
  const tax = getCountryTaxProfile(country);
  if (tax?.regionLabel === 'state') return 'onboarding.steps.state';
  return 'onboarding.steps.province';
}

const SETTINGS_TAB_ENTRIES = [
  ['you', 'settings.tabYou'],
  ['appearance', 'settings.tabAppearance'],
  ['platforms', 'settings.tabPlatforms'],
  ['alerts', 'settings.tabAlerts'],
  ['data', 'settings.tabData'],
  ['about', 'settings.tabAbout'],
];
const SETTINGS_TAB_ID_SET = new Set(SETTINGS_TAB_ENTRIES.map(([id]) => id));

/** @param {Record<string, unknown>} ctx */
function getInitialSettingsTab(ctx) {
  if (ctx?.settingsTab === 'about') return 'about';
  if (typeof window === 'undefined') return 'you';
  const raw = window.location.hash || '';
  const q = raw.indexOf('?');
  if (q === -1) return 'you';
  const tab = new URLSearchParams(raw.slice(q + 1)).get('tab');
  return SETTINGS_TAB_ID_SET.has(tab) ? tab : 'you';
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function estimateBytes(value) {
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    return 0;
  }
}

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function defaultNotificationPrefs(prefs) {
  const base = prefs && typeof prefs === 'object' ? prefs : {};
  return {
    shiftReminders: Boolean(base.shiftReminders),
    goalAlerts: Boolean(base.goalAlerts),
    taxReminders: Boolean(base.taxReminders),
    weeklyDigest: Boolean(base.weeklyDigest),
    maintenanceDue: Boolean(base.maintenanceDue),
    insuranceExpiry: Boolean(base.insuranceExpiry),
    backupOverdue: Boolean(base.backupOverdue),
  };
}


function applyFontSize(size) {
  if (typeof document === 'undefined') return;
  const map = { small: '12px', medium: '15px', large: '18px', xl: '22px' };
  const val = map[size] || map.medium;
  document.documentElement.style.setProperty('--text-base', val);
  document.documentElement.dataset.uifont = size || 'medium';
}

function applyDensity(density) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.layoutDensity = density === 'compact' ? 'compact' : 'comfortable';
}

async function exportVaultSnapshot() {
  const tables = {};
  for (const table of db.tables) {
    tables[table.name] = await table.toArray();
  }
  const payload = {
    app: 'COMMA',
    exportedAt: new Date().toISOString(),
    version: window.__comma?.version || '1.0.0',
    tables,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `comma-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  const ts = new Date().toISOString();
  await setAppState('last_backup', ts);
  await db.backupLog.add({ type: 'export', summary: 'Manual settings export', createdAt: ts });
}

async function runDataIntegrityCheck() {
  const issues = [];
  const shifts = await db.shifts.toArray();
  const expenses = await db.expenses.toArray();
  const platforms = await db.platforms.toArray();
  const platformIds = new Set(platforms.map((p) => String(p.id)));
  for (const s of shifts) {
    if (!s.date || Number.isNaN(new Date(`${s.date}T00:00:00`).getTime())) {
      issues.push(`Shift ${String(s.id ?? '?')} has invalid date.`);
    }
    if (s.platformId && !platformIds.has(String(s.platformId))) {
      issues.push(`Shift ${String(s.id ?? '?')} references missing platform "${String(s.platformId)}".`);
    }
  }
  for (const e of expenses) {
    if (!e.date || Number.isNaN(new Date(`${e.date}T00:00:00`).getTime())) {
      issues.push(`Expense ${String(e.id ?? '?')} has invalid date.`);
    }
    if (e.platformId && !platformIds.has(String(e.platformId))) {
      issues.push(`Expense ${String(e.id ?? '?')} references missing platform "${String(e.platformId)}".`);
    }
  }
  return issues;
}

async function dbStats() {
  const shifts = await db.shifts.filter((s) => s.deletedAt == null).toArray();
  const count = shifts.length;
  let minDate = null;
  let maxDate = null;
  let totalKm = 0;
  for (const s of shifts) {
    if (typeof s.date === 'string') {
      if (!minDate || s.date < minDate) minDate = s.date;
      if (!maxDate || s.date > maxDate) maxDate = s.date;
    }
    totalKm += Number(s.activeMileage) || 0;
  }
  return { count, minDate, maxDate, totalKm };
}

function mountKeyboardOverlay(host) {
  const existing = host.querySelector('[data-shortcuts-overlay]');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.className = 'settings-shortcuts-overlay';
  overlay.setAttribute('data-shortcuts-overlay', '1');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <div class="card card-raised settings-shortcuts-card" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <h3 class="settings-section-title">Keyboard shortcuts</h3>
      <ul class="settings-shortcuts-list">
        ${formatShortcutOverlayListItems(esc)}
      </ul>
      <div class="settings-shortcuts-actions">
        <button type="button" class="btn btn-secondary btn-sm" data-close-shortcuts>${esc(t('common.close'))}</button>
      </div>
    </div>
  `;
  host.appendChild(overlay);

  /** @param {KeyboardEvent} ev */
  function onEscape(ev) {
    if (ev.key !== 'Escape') return;
    if (!overlay.classList.contains('is-open')) return;
    ev.preventDefault();
    ev.stopPropagation();
    close();
  }

  const close = () => {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', onEscape, true);
  };

  const open = () => {
    document.removeEventListener('keydown', onEscape, true);
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.addEventListener('keydown', onEscape, true);
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      close();
      return;
    }
    const closer = e.target instanceof Element ? e.target.closest('[data-close-shortcuts]') : null;
    if (closer) {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  });

  return { open, close };
}

/**
 * @param {HTMLElement} root
 * @param {Record<string, unknown>} ctx
 */
export async function mountSettings(root, ctx = {}) {
  root.textContent = '';
  const user = (await getUser()) || {};
  const notificationPrefs = defaultNotificationPrefs(user.notificationPrefs);
  let debugTapCount = 0;
  let debugTapStartedAt = 0;
  let exportedThisSession = false;

  const initialSettingsTab = getInitialSettingsTab(ctx);
  const aboutMode = initialSettingsTab === 'about';
  const tabButtonsHtml = SETTINGS_TAB_ENTRIES.map(([id, key]) => {
    const sel = id === initialSettingsTab;
    return `<button type="button" role="tab" class="settings-tab-btn" data-settings-tab="${id}" id="settings-tab-${id}" aria-controls="settings-panel-${id}" aria-selected="${sel ? 'true' : 'false'}" tabindex="${sel ? '0' : '-1'}">${esc(t(key))}</button>`;
  }).join('');

  const demoMode = Boolean(store.get('demoMode'));
  const countryId = String(user.countryId || user?.locale?.country || 'CA').toUpperCase();
  const provinceIdSel = String(user.provinceId || '').toUpperCase();
  const countries = CountryRegistry.getAll();
  const countriesOpts = countries
    .map((c) => `<option value="${esc(c.id)}" ${c.id === countryId ? 'selected' : ''}>${esc(t(c.labelKey))}</option>`)
    .join('');
  const provincesForCountry = ProvinceRegistry.getByCountry(countryId);
  const provincesOpts = provincesForCountry.length
    ? provincesForCountry
        .map((p) => {
          const lab = typeof p.labelKey === 'string' ? t(p.labelKey) : String(p.id);
          const sel = String(p.id).toUpperCase() === provinceIdSel ? 'selected' : '';
          return `<option value="${esc(p.id)}" ${sel}>${esc(lab)}</option>`;
        })
        .join('')
    : `<option value="">${esc(t('common.optional'))}</option>`;
  const distFromUser = user?.locale?.distanceUnit === 'mi' || user?.locale?.distanceUnit === 'km' ? user.locale.distanceUnit : null;
  const cdef0 = CountryRegistry.getById(countryId);
  const distanceUnit =
    distFromUser || (cdef0.distanceUnit === 'mi' || cdef0.distanceUnit === 'km' ? cdef0.distanceUnit : 'km');
  const activePlats = await db.platforms.filter((p) => p.active === true).toArray();
  activePlats.sort((a, b) => (Number(a.priority) || 0) - (Number(b.priority) || 0));
  const primaryId = user.primaryPlatform != null ? String(user.primaryPlatform) : '';
  const platformOpts =
    `<option value="">${esc(t('settings.primaryPlatformNone'))}</option>` +
    activePlats
      .map((p) => `<option value="${esc(String(p.id))}" ${String(p.id) === primaryId ? 'selected' : ''}>${esc(String(p.name || p.id))}</option>`)
      .join('');
  const schedPreset = workSchedulePresetFromUser(user);
  const hstOnboarding = Boolean(getCountryTaxProfile(countryId).hstOnboarding);
  const weeklyD = (Number(user.weeklyGoal) || 0) / 100;
  const monthlyD = (Number(user.monthlyGoal) || 0) / 100;
  const annualD = (Number(user.annualGoal) || 0) / 100;
  const provinceFieldLabelKey = provinceLabelKeyForCountry(countryId);
  const userAccentNorm = normalizeAccentHex(user.accentColor);

  updateAccentColor();
  applyFontSize(user.fontSize || 'medium');
  applyDensity(user.layoutDensity || 'comfortable');

  const th = (id) => (initialSettingsTab === id ? '' : 'hidden');
  root.className = 'settings-root';
  root.innerHTML = `
    <div class="settings-layout">
      <div class="settings-nav-column">
        <header class="settings-view-header">
          <h1 class="app-header-title settings-view-title">${esc(t('settings.title'))}</h1>
          <p class="text-secondary settings-view-subtitle">${esc(t('settings.subtitle'))}</p>
        </header>
        <nav class="settings-tabs" role="tablist" aria-label="${esc(t('settings.tabsAriaLabel'))}">
          ${tabButtonsHtml}
        </nav>
      </div>
      <div class="settings-panels">
        <div class="settings-tabpanel" id="settings-panel-you" role="tabpanel" aria-labelledby="settings-tab-you" data-settings-panel="you" ${th('you')}>
    ${
      demoMode
        ? `
    <section class="settings-view-section card card-raised">
      <p class="text-secondary settings-section-lead">${esc(t('settings.demoBanner'))}</p>
      <div class="settings-actions">
        <button type="button" class="btn btn-primary btn-sm" data-exit-demo>${esc(t('settings.exitDemoBtn'))}</button>
      </div>
    </section>`
        : ''
    }
    ${(() => {
      const expanded = loadSettingsExpanded();
      const isExp = (id) => expanded[id] !== false; // Default to true for now or false? User wants "less space" so maybe false.
      // Actually, if it's the first time, maybe Profile is open, others closed.
      const isOpen = (id, def = false) => (expanded[id] === undefined ? def : expanded[id]);

      return `
    <section class="settings-view-section card card-raised settings-collapsible ${isOpen('profile', true) ? 'is-expanded' : ''}" data-settings-collapsible="profile">
      <header class="settings-collapsible-header" data-settings-toggle="profile">
        <div class="settings-collapsible-title-wrap">
          <h3 class="settings-subsection-title">${esc(t('settings.groupProfileTitle'))}</h3>
          <p class="settings-collapsible-summary">${esc(user.displayName || 'No name set')}</p>
        </div>
        <span class="settings-collapsible-icon">${getIcon('chevron-down', 20)}</span>
      </header>
      <div class="settings-collapsible-body">
        <div class="settings-grid">
          <label class="input-group">
            <span class="input-label">Display name</span>
            <input class="input" type="text" data-setting-display-name value="${esc(user.displayName || '')}" />
          </label>
          <label class="input-group">
            <span class="input-label">Avatar emoji</span>
            <input class="input" type="text" maxlength="3" data-setting-avatar value="${esc(typeof user.avatarData === 'string' ? user.avatarData : '')}" placeholder="🙂" />
          </label>
        </div>
        <div class="settings-actions">
          <button type="button" class="btn btn-primary btn-sm" data-save-profile>${esc(t('common.save'))}</button>
        </div>
      </div>
    </section>

    <section class="settings-view-section card card-raised settings-collapsible ${isOpen('location') ? 'is-expanded' : ''}" data-settings-collapsible="location">
      <header class="settings-collapsible-header" data-settings-toggle="location">
        <div class="settings-collapsible-title-wrap">
          <h3 class="settings-subsection-title">${esc(t('settings.groupLocationTitle'))}</h3>
          <p class="settings-collapsible-summary">${esc(t(CountryRegistry.getById(countryId).labelKey))}</p>
        </div>
        <span class="settings-collapsible-icon">${getIcon('chevron-down', 20)}</span>
      </header>
      <div class="settings-collapsible-body">
        <p class="text-secondary settings-section-lead">${esc(t('settings.groupLocationLead'))}</p>
        <div class="settings-grid">
          <label class="input-group">
            <span class="input-label">${esc(t('settings.labelCountry'))}</span>
            <select class="input" data-setting-country>${countriesOpts}</select>
          </label>
          <label class="input-group">
            <span class="input-label" data-setting-province-label>${esc(t(provinceFieldLabelKey))}</span>
            <select class="input" data-setting-province>${provincesOpts}</select>
          </label>
          <label class="input-group">
            <span class="input-label">${esc(t('settings.labelDistanceUnit'))}</span>
            <select class="input" data-setting-distance-unit>
              <option value="km" ${distanceUnit === 'km' ? 'selected' : ''}>${esc(t('onboarding.steps.unitKm'))}</option>
              <option value="mi" ${distanceUnit === 'mi' ? 'selected' : ''}>${esc(t('onboarding.steps.unitMi'))}</option>
            </select>
          </label>
          <label class="input-group">
            <span class="input-label">${esc(t('settings.labelPrimaryPlatform'))}</span>
            <select class="input" data-setting-primary-platform>${platformOpts}</select>
          </label>
        </div>
        <div class="settings-actions">
          <button type="button" class="btn btn-primary btn-sm" data-save-market>${esc(t('settings.saveMarket'))}</button>
        </div>
      </div>
    </section>

    <section class="settings-view-section card card-raised settings-collapsible ${isOpen('goals') ? 'is-expanded' : ''}" data-settings-collapsible="goals">
      <header class="settings-collapsible-header" data-settings-toggle="goals">
        <div class="settings-collapsible-title-wrap">
          <h3 class="settings-subsection-title">${esc(t('settings.goalsTaxSectionTitle'))}</h3>
          <p class="settings-collapsible-summary">$${esc(String(weeklyD))} / week</p>
        </div>
        <span class="settings-collapsible-icon">${getIcon('chevron-down', 20)}</span>
      </header>
      <div class="settings-collapsible-body">
        <p class="text-secondary settings-section-lead">${esc(t('settings.goalsTaxSectionLead'))}</p>
        <div class="settings-grid">
          <label class="input-group">
            <span class="input-label">${esc(t('settings.labelWeeklyGoalDollars'))}</span>
            <input class="input" type="number" inputmode="decimal" min="0" step="10" data-setting-weekly-goal-dollars value="${esc(String(weeklyD))}" />
          </label>
          <label class="input-group">
            <span class="input-label">${esc(t('settings.labelMonthlyGoalDollars'))}</span>
            <input class="input" type="number" inputmode="decimal" min="0" step="50" data-setting-monthly-goal-dollars value="${esc(String(monthlyD))}" />
          </label>
          <label class="input-group">
            <span class="input-label">${esc(t('settings.labelAnnualGoalDollars'))}</span>
            <input class="input" type="number" inputmode="decimal" min="0" step="100" data-setting-annual-goal-dollars value="${esc(String(annualD))}" />
          </label>
          <label class="input-group">
            <span class="input-label">${esc(t('settings.labelTaxWithhold'))}</span>
            <input class="input" type="number" inputmode="decimal" min="0" max="60" step="0.5" data-setting-tax-withhold value="${esc(String(Number(user.taxWithholdingPct) || 0))}" />
          </label>
          <label class="input-group">
            <span class="input-label">${esc(t('settings.labelWorkSchedule'))}</span>
            <select class="input" data-setting-work-schedule>
              ${WORK_SCHEDULE_PRESETS.map(
                (preset) =>
                  `<option value="${esc(preset)}" ${schedPreset === preset ? 'selected' : ''}>${esc(t(`onboarding.schedule.${preset}`))}</option>`,
              ).join('')}
            </select>
          </label>
          <label class="settings-check" data-setting-hst-row style="${hstOnboarding ? '' : 'display:none'}">
            <input type="checkbox" data-setting-hst ${user.hstRegistered ? 'checked' : ''} />
            ${esc(t('onboarding.steps.hstToggle'))}
          </label>
        </div>
        <div class="settings-actions">
          <button type="button" class="btn btn-primary btn-sm" data-save-goals-tax>${esc(t('settings.saveGoalsTax'))}</button>
        </div>
      </div>
    </section>`;
    })()}
        </div>
            <div class="settings-tabpanel" id="settings-panel-appearance" role="tabpanel" aria-labelledby="settings-tab-appearance" data-settings-panel="appearance" ${th('appearance')}>
      ${(() => {
        const expanded = loadSettingsExpanded();
        const isOpen = (id, def = false) => (expanded[id] === undefined ? def : expanded[id]);
        return `
      <section class="settings-view-section card card-raised settings-collapsible ${isOpen('lookfeel', true) ? 'is-expanded' : ''}" data-settings-collapsible="lookfeel">
        <header class="settings-collapsible-header" data-settings-toggle="lookfeel">
          <div class="settings-collapsible-title-wrap">
            <h2 class="settings-section-title">Interface</h2>
            <p class="settings-collapsible-summary">${esc(user.theme === 'auto' ? 'System Theme' : user.theme.charAt(0).toUpperCase() + user.theme.slice(1))}</p>
          </div>
          <span class="settings-collapsible-icon">${getIcon('chevron-down', 20)}</span>
        </header>
        <div class="settings-collapsible-body">
          <p class="text-secondary settings-section-lead">Personalize the layout and visual style of COMMA.</p>
          <div class="settings-grid">
            <div class="input-group">
              <span class="input-label">${esc(t('settings.theme'))}</span>
              <div class="settings-segmented-control" role="radiogroup" aria-label="Theme selection" data-theme-switcher>
                <button type="button" role="radio" class="settings-segmented-btn ${user.theme === 'auto' ? 'is-active' : ''}" data-theme="auto" aria-checked="${user.theme === 'auto' ? 'true' : 'false'}">
                  ${getIcon('monitor', 16)} <span>Auto</span>
                </button>
                <button type="button" role="radio" class="settings-segmented-btn ${user.theme === 'light' ? 'is-active' : ''}" data-theme="light" aria-checked="${user.theme === 'light' ? 'true' : 'false'}">
                  ${getIcon('sun', 16)} <span>Light</span>
                </button>
                <button type="button" role="radio" class="settings-segmented-btn ${user.theme === 'dark' ? 'is-active' : ''}" data-theme="dark" aria-checked="${user.theme === 'dark' ? 'true' : 'false'}">
                  ${getIcon('moon', 16)} <span>Dark</span>
                </button>
              </div>
            </div>
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
            <div class="input-group">
              <span class="input-label">${esc(t('pwa.toggleFullscreen'))}</span>
              <button type="button" class="btn btn-secondary btn-sm" style="width: 100%; height: 38px; display: flex; align-items: center; justify-content: center; gap: 8px;" data-toggle-fullscreen-appearance>
                ${getIcon('maximize', 16)} <span>Toggle Full Screen</span>
              </button>
            </div>
          </div>

          <div class="settings-accent" style="margin-top: var(--space-4);">
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
                <input class="input" data-setting-accent-hex value="${esc(user.accentColor || '')}" placeholder="#10B981" />
              </label>
            </div>
          </div>

          <div class="settings-actions">
            <button type="button" class="btn btn-primary btn-sm" data-save-display>${esc(t('common.save'))}</button>
          </div>
        </div>
      </section>

      <section class="settings-view-section card card-raised settings-collapsible ${isOpen('regional') ? 'is-expanded' : ''}" data-settings-collapsible="regional">
        <header class="settings-collapsible-header" data-settings-toggle="regional">
          <div class="settings-collapsible-title-wrap">
            <h2 class="settings-section-title">Regional & Locale</h2>
            <p class="settings-collapsible-summary">${esc(user?.locale?.currency || 'USD')} · ${esc(user?.locale?.dateFormat || 'YYYY-MM-DD')}</p>
          </div>
          <span class="settings-collapsible-icon">${getIcon('chevron-down', 20)}</span>
        </header>
        <div class="settings-collapsible-body">
          <p class="text-secondary settings-section-lead">Adjust localization settings and data formatting.</p>
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
          <div class="settings-actions">
            <button type="button" class="btn btn-primary btn-sm" data-save-display>${esc(t('common.save'))}</button>
          </div>
        </div>
      </section>

`;
      })()}
    </div>
    <div class="settings-tabpanel" id="settings-panel-platforms" role="tabpanel" aria-labelledby="settings-tab-platforms" data-settings-panel="platforms" ${th('platforms')}>
      <section class="settings-view-section card card-raised" data-platforms-host></section>
    </div>
    <div class="settings-tabpanel" id="settings-panel-alerts" role="tabpanel" aria-labelledby="settings-tab-alerts" data-settings-panel="alerts" ${th('alerts')}>
      ${(() => {
        const expanded = loadSettingsExpanded();
        const isOpen = (id, def = false) => (expanded[id] === undefined ? def : expanded[id]);
        return `
      <section class="settings-view-section card card-raised settings-collapsible ${isOpen('notifs') ? 'is-expanded' : ''}" data-settings-collapsible="notifs">
        <header class="settings-collapsible-header" data-settings-toggle="notifs">
          <div class="settings-collapsible-title-wrap">
            <h2 class="settings-section-title">${esc(t('settings.notifications'))}</h2>
            <p class="settings-collapsible-summary">System alerts and reminders</p>
          </div>
          <span class="settings-collapsible-icon">${getIcon('chevron-down', 20)}</span>
        </header>
        <div class="settings-collapsible-body">
          <p class="text-secondary settings-section-lead">${esc(t('settings.notificationsLead'))}</p>
          <div class="settings-grid settings-tight-grid">
            ${Object.entries(notificationPrefs)
              .map(([k, v]) => `<label class="settings-check"><input type="checkbox" data-setting-notif="${esc(k)}" ${v ? 'checked' : ''} /> ${esc(k)}</label>`)
              .join('')}
          </div>
          <div class="settings-actions">
            <button type="button" class="btn btn-primary btn-sm" data-save-notifications>${esc(t('common.save'))}</button>
            <button type="button" class="btn btn-secondary btn-sm" data-open-shortcuts>${esc(t('settings.shortcutsTitle'))}</button>
          </div>
        </div>
      </section>
      <section class="settings-view-section" data-pwa-settings-host></section>`;
      })()}
    </div>
    <div class="settings-tabpanel" id="settings-panel-data" role="tabpanel" aria-labelledby="settings-tab-data" data-settings-panel="data" ${th('data')}>
      <div data-backup-status-host></div>
      ${(() => {
        const expanded = loadSettingsExpanded();
        const isOpen = (id, def = false) => (expanded[id] === undefined ? def : expanded[id]);
        return `
      <section class="settings-view-section card card-raised settings-collapsible ${isOpen('vault') ? 'is-expanded' : ''}" data-settings-collapsible="vault">
        <header class="settings-collapsible-header" data-settings-toggle="vault">
          <div class="settings-collapsible-title-wrap">
            <h2 class="settings-section-title">${getIcon('vault', 20)} ${esc(t('settings.dataVaultSectionTitle'))}</h2>
            <p class="settings-collapsible-summary">Health and backups</p>
          </div>
          <span class="settings-collapsible-icon">${getIcon('chevron-down', 20)}</span>
        </header>
        <div class="settings-collapsible-body">
          <p class="text-secondary settings-section-lead">${esc(t('settings.dataSectionLead'))}</p>
          
          <div class="settings-data-health-grid" data-data-health-output>
            <div class="health-skeleton">Loading vault status...</div>
          </div>

          <div class="settings-data-group">
            <h4 class="settings-group-title">${getIcon('download', 14)} ${esc(t('settings.dataVaultActions'))}</h4>
            <div class="settings-actions settings-wrap">
              <a class="btn btn-primary btn-sm" href="#/reports">${getIcon('chart-bar', 14)} ${esc(t('settings.openReportsBtn'))}</a>
              <button type="button" class="btn btn-secondary btn-sm" data-export-vault-reports>${getIcon('file-text', 14)} ${esc(t('settings.exportVaultBtn'))}</button>
              <button type="button" class="btn btn-secondary btn-sm" data-import-vault-file-btn>${getIcon('upload', 14)} Import backup file</button>
              <input type="file" data-import-vault-file accept=".json,.comdb,application/json" style="display:none" />
              <button type="button" class="btn btn-secondary btn-sm" data-export-snapshot>${getIcon('camera', 14)} ${esc(t('settings.quickSnapshotBtn'))}</button>
            </div>
          </div>

          <div class="settings-data-group">
            <h4 class="settings-group-title">${getIcon('shield', 14)} ${esc(t('settings.dataMaintenance'))}</h4>
            <div class="settings-row-inline">
              <label class="input-group">
                <span class="input-label">Auto-archive deleted records older than days</span>
                <input class="input" data-archive-days type="number" min="7" step="1" value="30" />
              </label>
              <button type="button" class="btn btn-secondary btn-sm" data-run-archive>Run archive</button>
            </div>
            <div class="settings-actions">
              <button type="button" class="btn btn-secondary btn-sm" data-run-integrity>${getIcon('check', 14)} Run integrity check</button>
            </div>
          </div>
          
          <pre class="settings-pre" data-integrity-output aria-live="polite"></pre>
        </div>
      </section>

      <section class="settings-view-section card card-raised settings-danger-card settings-collapsible ${isOpen('danger') ? 'is-expanded' : ''}" data-settings-collapsible="danger">
        <header class="settings-collapsible-header" data-settings-toggle="danger">
          <div class="settings-collapsible-title-wrap">
            <h2 class="settings-section-title">${esc(t('settings.dangerZone'))}</h2>
            <p class="settings-collapsible-summary">Wipe and resets</p>
          </div>
          <span class="settings-collapsible-icon">${getIcon('chevron-down', 20)}</span>
        </header>
        <div class="settings-collapsible-body">
          <div class="settings-grid">
            <label class="input-group">
              <span class="input-label">Reset single platform</span>
              <select class="input" data-reset-platform-select ${activePlats.length === 0 ? 'disabled' : ''}>
                ${activePlats.length > 0
                  ? activePlats.map((p) => `<option value="${esc(String(p.id))}">${esc(String(p.name || p.id))}</option>`).join('')
                  : `<option value="" disabled selected>No platforms detected</option>`
                }
              </select>
            </label>
          </div>
          <div class="settings-actions">
            <button type="button" class="btn btn-danger btn-sm" data-reset-platform ${activePlats.length === 0 ? 'disabled' : ''}>Reset platform data</button>
          </div>
          <hr class="settings-divider" />
          <p class="text-secondary settings-section-lead">Export is required before full vault wipe.</p>
          <div class="settings-actions">
            <button type="button" class="btn btn-secondary btn-sm" data-export-backup>Export backup first</button>
            <button type="button" class="btn btn-danger btn-sm" data-reset-vault>Reset vault</button>
          </div>
        </div>
      </section>`;
      })()}
    </div>
    <div class="settings-tabpanel" id="settings-panel-about" role="tabpanel" aria-labelledby="settings-tab-about" data-settings-panel="about" ${th('about')}>
      <section class="settings-view-section card card-raised" style="display: flex; flex-direction: column; gap: var(--space-4);">
        <div>
          <h2 class="settings-section-title" style="margin-bottom: var(--space-1);">${esc(t('settings.about'))}</h2>
          <p class="text-secondary settings-section-lead" style="font-size: var(--text-sm); margin: 0;">
            Version <span style="cursor: pointer; font-weight: 700; text-decoration: underline; color: var(--color-brand);" data-debug-tap>${esc(window.__comma?.version || '1.0.0')}</span><span id="debug-note" style="font-size: var(--text-xs); color: var(--color-text-secondary); margin-left: var(--space-1);"></span> · local-first data vault.
          </p>
        </div>
        <div class="settings-actions settings-wrap" style="display: flex; flex-wrap: wrap; gap: var(--space-2);">
          <button type="button" class="btn btn-secondary btn-sm" data-open-install>Install COMMA</button>
          <a class="btn btn-secondary btn-sm" href="#/about">Data Portability Manifesto</a>
          <a class="btn btn-secondary btn-sm" href="https://github.com/raiz-toff/comma/blob/main/CHANGELOG.md" target="_blank" rel="noopener noreferrer">Changelog</a>
          <a class="btn btn-secondary btn-sm" href="#/support">Support & Feedback</a>
          <button type="button" class="btn btn-secondary btn-sm" data-share-comma>Share COMMA</button>
          <a class="btn btn-secondary btn-sm" href="https://en.wikipedia.org/wiki/Glossary_of_economics" target="_blank" rel="noopener noreferrer">Driver Financial Glossary</a>
          <button type="button" class="btn btn-primary btn-sm" style="display: none;" data-open-dev-tools>Open Developer Tools</button>
        </div>
        <p class="text-xs text-secondary" style="margin: 0; min-height: var(--space-4);" data-debug-hint></p>
      </section>
    </div>
  </div>
</div>
  `;

  const shortcuts = mountKeyboardOverlay(root);
  const platformsHost = /** @type {HTMLElement | null} */ (root.querySelector('[data-platforms-host]'));
  if (platformsHost) await mountSettingsPlatforms(platformsHost);

  const backupHost = /** @type {HTMLElement | null} */ (root.querySelector('[data-backup-status-host]'));
  if (backupHost) {
    await renderBackupStatus(backupHost);
    bus.on('drive:auth_success', () => renderBackupStatus(backupHost));
    bus.on('drive:disconnected', () => renderBackupStatus(backupHost));
    bus.on('backup:success', () => renderBackupStatus(backupHost));
    bus.on('backup:failed', () => renderBackupStatus(backupHost));
  }

  function replaceSettingsTabHash(tab) {
    try {
      if (window.location.hash === '#/settings/about' && tab === 'about') return;
      const base = `${window.location.pathname}${window.location.search}`;
      window.history.replaceState(null, '', `${base}#/settings?tab=${encodeURIComponent(tab)}`);
    } catch {
      /* ignore */
    }
  }

  function applySettingsTab(tab, { fromClick = false } = {}) {
    if (!SETTINGS_TAB_ID_SET.has(tab)) return;
    root.querySelectorAll('[data-settings-tab]').forEach((btn) => {
      const id = btn.getAttribute('data-settings-tab');
      const on = id === tab;
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
      btn.tabIndex = on ? 0 : -1;
    });
    root.querySelectorAll('[data-settings-panel]').forEach((pan) => {
      const id = pan.getAttribute('data-settings-panel');
      if (id === tab) pan.removeAttribute('hidden');
      else pan.setAttribute('hidden', '');
    });
    if (fromClick) {
      replaceSettingsTabHash(tab);
      const b = /** @type {HTMLElement | null} */ (root.querySelector(`[data-settings-tab="${tab}"]`));
      b?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  root.querySelectorAll('[data-settings-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-settings-tab');
      if (!id || !SETTINGS_TAB_ID_SET.has(id)) return;
      applySettingsTab(id, { fromClick: true });
    });
  });

  async function refreshDataHealth() {
    const out = root.querySelector('[data-data-health-output]');
    if (!out) return;
    const [stats, backupRows, shiftCount, expenseCount, users, vehicleCount, goalCount] = await Promise.all([
      dbStats(),
      db.backupLog.orderBy('createdAt').reverse().limit(5).toArray(),
      db.shifts.count(),
      db.expenses.count(),
      db.users.count(),
      db.vehicles.count(),
      db.goals.count(),
    ]);
    const usage = estimateBytes({
      shifts: shiftCount,
      expenses: expenseCount,
      users,
      vehicles: vehicleCount,
      goals: goalCount,
      backupRows,
      stats,
    });
    out.innerHTML = `
      <div class="health-card">
        <div class="health-icon">${getIcon('hard-drive', 20)}</div>
        <div class="health-content">
          <span class="health-label">Vault size</span>
          <span class="health-value">${esc(formatBytes(usage))}</span>
        </div>
      </div>
      <div class="health-card">
        <div class="health-icon">${getIcon('clock', 20)}</div>
        <div class="health-content">
          <span class="health-label">Shift count</span>
          <span class="health-value">${esc(stats.count)}</span>
        </div>
      </div>
      <div class="health-card">
        <div class="health-icon">${getIcon('bike', 20)}</div>
        <div class="health-content">
          <span class="health-label">Total distance</span>
          <span class="health-value">${esc(stats.totalKm.toFixed(0))} km</span>
        </div>
      </div>
      <div class="health-card">
        <div class="health-icon">${getIcon('database', 20)}</div>
        <div class="health-content">
          <span class="health-label">Total records</span>
          <span class="health-value">${esc(String(shiftCount + expenseCount + goalCount))}</span>
        </div>
      </div>
      <div class="health-recent-backups">
        <strong>Recent backups:</strong> ${backupRows.length ? esc(backupRows.map((r) => r.createdAt.split('T')[0]).join(' | ')) : 'none yet'}
      </div>
    `;
  }

  root.querySelector('[data-save-profile]')?.addEventListener('click', async () => {
    const name = /** @type {HTMLInputElement | null} */ (root.querySelector('[data-setting-display-name]'))?.value || '';
    const avatar = /** @type {HTMLInputElement | null} */ (root.querySelector('[data-setting-avatar]'))?.value || '';
    await saveUser({ displayName: name.trim(), avatarType: avatar.trim() ? 'emoji' : 'initials', avatarData: avatar.trim() || null });
    await store.refresh('user');
    showToast({ type: 'success', message: 'Profile saved.' });
  });

  root.querySelector('[data-theme-switcher]')?.addEventListener('click', (ev) => {
    const btn = ev.target instanceof Element ? ev.target.closest('[data-theme]') : null;
    if (!(btn instanceof HTMLButtonElement)) return;
    const theme = btn.dataset.theme;
    if (!theme) return;

    root.querySelectorAll('[data-theme]').forEach((b) => {
      const active = b === btn;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-checked', active ? 'true' : 'false');
    });
  });

  root.querySelectorAll('[data-save-display]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const currency = /** @type {HTMLSelectElement | null} */ (root.querySelector('[data-setting-currency]'))?.value || 'USD';
      const activeBtn = /** @type {HTMLElement | null} */ (root.querySelector('[data-theme].is-active'));
      const theme = activeBtn?.dataset.theme || 'auto';
      const fontSize = /** @type {HTMLSelectElement | null} */ (root.querySelector('[data-setting-font]'))?.value || 'medium';
      const layoutDensity = /** @type {HTMLSelectElement | null} */ (root.querySelector('[data-setting-density]'))?.value || 'comfortable';
      const dateFormat = /** @type {HTMLSelectElement | null} */ (root.querySelector('[data-setting-date-format]'))?.value || 'YYYY-MM-DD';
      const weekStartDay = Number(/** @type {HTMLSelectElement | null} */ (root.querySelector('[data-setting-week-start]'))?.value || 0);
      const timeFormat = /** @type {HTMLSelectElement | null} */ (root.querySelector('[data-setting-time-format]'))?.value || '12h';
      const accentRaw = /** @type {HTMLInputElement | null} */ (root.querySelector('[data-setting-accent-hex]'))?.value || '';
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
      updateAccentColor();
      applyFontSize(fontSize);
      applyDensity(layoutDensity);
      await store.refresh('user');
      bus.emit(THEME_CHANGED, { theme });
      showToast({ type: 'success', message: 'Display settings saved.' });
    });
  });

  function refreshAccentPresetSelection() {
    const input = /** @type {HTMLInputElement | null} */ (root.querySelector('[data-setting-accent-hex]'));
    const v = normalizeAccentHex(input?.value || '');
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
      const input = /** @type {HTMLInputElement | null} */ (root.querySelector('[data-setting-accent-hex]'));
      if (!hex || !input) return;
      input.value = hex;
      updateAccentColor(hex);
      refreshAccentPresetSelection();
    });
  });

  root.querySelector('[data-setting-accent-hex]')?.addEventListener('input', (e) => {
    const raw = e.target instanceof HTMLInputElement ? e.target.value.trim() : '';
    const ok = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw);
    if (ok) updateAccentColor(raw);
    else if (!raw) updateAccentColor();
    refreshAccentPresetSelection();
  });

  const btnFullscreen = root.querySelector('[data-toggle-fullscreen-appearance]');
  if (btnFullscreen) {
    const caps = pwaCapabilities();
    if (!caps.fullscreen) {
      btnFullscreen.disabled = true;
      btnFullscreen.innerHTML = `${getIcon('maximize', 16)} <span>${esc(t('pwa.fullscreenUnsupported'))}</span>`;
    } else {
      btnFullscreen.addEventListener('click', async () => {
        const entered = await toggleFullscreen();
        showToast({
          type: 'info',
          message: entered ? t('pwa.fullscreenOn') : t('pwa.fullscreenOff'),
          duration: 1400,
        });
      });
    }
  }

  root.addEventListener('click', (ev) => {
    const toggle = ev.target instanceof Element ? ev.target.closest('[data-settings-toggle]') : null;
    if (toggle) {
      const id = toggle.getAttribute('data-settings-toggle');
      const card = root.querySelector(`[data-settings-collapsible="${id}"]`);
      if (card) {
        const wasOpen = card.classList.contains('is-expanded');
        const expanded = loadSettingsExpanded();

        if (!wasOpen) {
          // Accordion: Close all other blocks in the same tab panel
          const panel = card.closest('.settings-tabpanel');
          if (panel) {
            panel.querySelectorAll('.settings-collapsible').forEach((c) => {
              const otherId = c.getAttribute('data-settings-collapsible');
              c.classList.remove('is-expanded');
              if (otherId) expanded[otherId] = false;
            });
          }
          card.classList.add('is-expanded');
          expanded[id] = true;
        } else {
          card.classList.remove('is-expanded');
          expanded[id] = false;
        }

        saveSettingsExpanded(expanded);
      }
      return;
    }
  });

  root.querySelector('[data-save-notifications]')?.addEventListener('click', async () => {
    const next = {};
    root.querySelectorAll('[data-setting-notif]').forEach((el) => {
      if (el instanceof HTMLInputElement) {
        const key = el.getAttribute('data-setting-notif');
        if (key) next[key] = el.checked;
      }
    });
    await saveUser({ notificationPrefs: next });
    await store.refresh('user');
    showToast({ type: 'success', message: 'Notification settings saved.' });
  });

  root.querySelector('[data-open-shortcuts]')?.addEventListener('click', () => shortcuts.open());

  function renderProvinceOptions(country) {
    const list = ProvinceRegistry.getByCountry(country);
    const provSelect = root.querySelector('[data-setting-province]');
    if (!(provSelect instanceof HTMLSelectElement)) return;
    const cur = String(provSelect.value || '');
    const nextPid = list.find((p) => String(p.id).toUpperCase() === cur.toUpperCase())?.id ?? (list[0] ? list[0].id : '');
    provSelect.innerHTML = list.length
      ? list
          .map((p) => {
            const lab = typeof p.labelKey === 'string' ? t(p.labelKey) : String(p.id);
            const sel = String(p.id) === String(nextPid) ? 'selected' : '';
            return `<option value="${esc(p.id)}" ${sel}>${esc(lab)}</option>`;
          })
          .join('')
      : `<option value="">${esc(t('common.optional'))}</option>`;
    const labEl = root.querySelector('[data-setting-province-label]');
    if (labEl) labEl.textContent = t(provinceLabelKeyForCountry(country));
    const hstRow = root.querySelector('[data-setting-hst-row]');
    if (hstRow instanceof HTMLElement) {
      hstRow.style.display = getCountryTaxProfile(country).hstOnboarding ? '' : 'none';
    }
  }

  root.querySelector('[data-setting-country]')?.addEventListener('change', (e) => {
    const sel = /** @type {HTMLSelectElement} */ (e.target);
    renderProvinceOptions(String(sel.value || 'CA').toUpperCase());
  });

  root.querySelector('[data-save-market]')?.addEventListener('click', async () => {
    const country = String(/** @type {HTMLSelectElement} */ (root.querySelector('[data-setting-country]'))?.value || 'CA').toUpperCase();
    const provSel = /** @type {HTMLSelectElement | null} */ (root.querySelector('[data-setting-province]'));
    const rawProv = provSel instanceof HTMLSelectElement ? String(provSel.value || '').trim().toUpperCase() : '';
    const plist = ProvinceRegistry.getByCountry(country);
    const match = plist.find((p) => String(p.id).toUpperCase() === rawProv);
    const provinceId = match ? match.id : plist[0] ? plist[0].id : '';
    const distanceUnitSel = /** @type {HTMLSelectElement | null} */ (root.querySelector('[data-setting-distance-unit]'));
    const distanceUnit = distanceUnitSel?.value === 'mi' ? 'mi' : 'km';
    const primaryRaw = /** @type {HTMLSelectElement | null} */ (root.querySelector('[data-setting-primary-platform]'))?.value;
    const primaryPlatform = primaryRaw && String(primaryRaw).trim() ? String(primaryRaw).trim() : null;
    const cdef = CountryRegistry.getById(country);
    const prevLocale = user?.locale && typeof user.locale === 'object' ? user.locale : {};
    await saveUser({
      countryId: country,
      provinceId: provinceId || '',
      primaryPlatform,
      locale: {
        ...prevLocale,
        country,
        currency: cdef.currency,
        currencySymbol: cdef.symbol,
        distanceUnit,
      },
    });
    await store.refresh('user');
    bus.emit(PLATFORM_CHANGED, { source: 'settings_market' });
    showToast({ type: 'success', message: t('settings.marketSaved'), duration: 2200 });
  });

  root.querySelector('[data-save-goals-tax]')?.addEventListener('click', async () => {
    const country = String(/** @type {HTMLSelectElement} */ (root.querySelector('[data-setting-country]'))?.value || 'CA').toUpperCase();
    const weeklyDol = Number(/** @type {HTMLInputElement} */ (root.querySelector('[data-setting-weekly-goal-dollars]'))?.value || 0);
    const monthlyDol = Number(/** @type {HTMLInputElement} */ (root.querySelector('[data-setting-monthly-goal-dollars]'))?.value || 0);
    const annualDol = Number(/** @type {HTMLInputElement} */ (root.querySelector('[data-setting-annual-goal-dollars]'))?.value || 0);
    let taxWithholdingPct = Number(/** @type {HTMLInputElement} */ (root.querySelector('[data-setting-tax-withhold]'))?.value ?? 0);
    if (!Number.isFinite(taxWithholdingPct)) taxWithholdingPct = 0;
    taxWithholdingPct = Math.max(0, Math.min(60, taxWithholdingPct));
    const presetRaw = String(/** @type {HTMLSelectElement} */ (root.querySelector('[data-setting-work-schedule]'))?.value || 'flexible');
    const safePreset = WORK_SCHEDULE_PRESETS.includes(presetRaw) ? presetRaw : 'flexible';
    const hstEl = /** @type {HTMLInputElement | null} */ (root.querySelector('[data-setting-hst]'));
    const hstOn = Boolean(getCountryTaxProfile(country).hstOnboarding);
    await saveUser({
      weeklyGoal: Math.round(weeklyDol * 100),
      monthlyGoal: Math.round(monthlyDol * 100),
      annualGoal: Math.round(annualDol * 100),
      taxWithholdingPct,
      workSchedule: { preset: safePreset, label: t(`onboarding.schedule.${safePreset}`) },
      hstRegistered: hstOn && hstEl ? hstEl.checked : false,
    });
    await store.refresh('user');
    bus.emit(GOAL_UPDATED, { source: 'settings_goals_tax' });
    showToast({ type: 'success', message: t('settings.goalsTaxSaved'), duration: 2200 });
  });

  root.querySelector('[data-exit-demo]')?.addEventListener('click', async () => {
    await exitDemoToOnboardingStart();
  });

  root.querySelector('[data-run-integrity]')?.addEventListener('click', async () => {
    const out = root.querySelector('[data-integrity-output]');
    if (!out) return;
    const issues = await runDataIntegrityCheck();
    out.textContent = issues.length ? issues.join('\n') : 'Integrity check passed. No issues found.';
  });

  root.querySelector('[data-run-archive]')?.addEventListener('click', async () => {
    const days = Number(/** @type {HTMLInputElement | null} */ (root.querySelector('[data-archive-days]'))?.value || 30);
    const cleanDays = Number.isFinite(days) ? Math.max(7, Math.floor(days)) : 30;
    await purgeOldDeleted('shifts', cleanDays);
    await purgeOldDeleted('expenses', cleanDays);
    await db.backupLog.add({ type: 'archive', summary: `Purged deleted rows older than ${cleanDays}d`, createdAt: new Date().toISOString() });
    await refreshDataHealth();
    showToast({ type: 'info', message: 'Archive sweep complete.' });
  });

  root.querySelector('[data-reset-platform]')?.addEventListener('click', async () => {
    const platformId = /** @type {HTMLSelectElement | null} */ (root.querySelector('[data-reset-platform-select]'))?.value || '';
    if (!platformId) return;
    showConfirm({
      title: 'Reset platform data?',
      message: `This deactivates ${platformId} and permanently deletes all shifts, expenses, and goals associated with it. This action cannot be undone.`,
      confirmLabel: 'Reset platform',
      confirmClass: 'btn btn-danger',
      onConfirm: async () => {
        // Soft-delete (interop audit): a hard .delete() leaves no tombstone, so synced peers
        // never drop these rows — and they'd resurrect here on the next pull. Tombstones
        // propagate the wipe; reads already filter syncDeletedAt.
        const ts = new Date().toISOString();
        const stamp = Date.now();
        const tombstone = { deletedAt: ts, updatedAt: ts, syncDeletedAt: stamp, syncUpdatedAt: stamp };
        await db.platforms.update(platformId, {
          active: false,
          deactivatedAt: ts,
          isActive: false, // mobile mirror
          syncUpdatedAt: stamp,
        });
        await db.shifts.where('platformId').equals(platformId).modify(tombstone);
        await db.expenses.where('platformId').equals(platformId).modify(tombstone);
        // .filter(), not .where(): goals' Dexie store doesn't index platformId (the old
        // .where() here threw SchemaError at runtime).
        await db.goals
          .filter((g) => g.platformId === platformId)
          .modify({ ...tombstone, active: false, isActive: false });
        const fresh = await getUser();
        const nextIds = Array.isArray(fresh?.platforms) ? fresh.platforms.filter((id) => id !== platformId) : [];
        await saveUser({
          platforms: nextIds,
          primaryPlatform: fresh?.primaryPlatform === platformId ? nextIds[0] || null : fresh?.primaryPlatform || null,
        });
        await store.refresh('user');
        await store.refresh('platforms');
        bus.emit(PLATFORM_CHANGED, { source: 'settings_reset_platform', platformId });
        showToast({ type: 'info', message: 'Platform reset complete. All associated data deleted.' });
      },
    });
  });

  root.querySelector('[data-export-snapshot]')?.addEventListener('click', async () => {
    try {
      await exportVaultSnapshot();
      exportedThisSession = true;
      await refreshDataHealth();
      showToast({ type: 'success', message: t('settings.quickSnapshotToast'), duration: 2200 });
    } catch (e) {
      console.error(e);
      showToast({ type: 'error', message: t('errors.exportFailed') });
    }
  });

  root.querySelector('[data-export-vault-reports]')?.addEventListener('click', async () => {
    try {
      await exportVaultBackupJson();
      await setAppState('last_backup', new Date().toISOString());
      exportedThisSession = true;
      await refreshDataHealth();
      showToast({ type: 'success', message: t('settings.exportVaultToast'), duration: 2400 });
    } catch (e) {
      console.error(e);
      showToast({ type: 'error', message: t('errors.exportFailed') });
    }
  });

  root.querySelector('[data-export-backup]')?.addEventListener('click', async () => {
    try {
      await exportVaultSnapshot();
      exportedThisSession = true;
      await refreshDataHealth();
      showToast({ type: 'success', message: 'Backup exported.' });
    } catch (e) {
      console.error(e);
      showToast({ type: 'error', message: t('errors.exportFailed') });
    }
  });

  // Import backup file — accepts current vault JSON, encrypted .comdb (password-prompted),
  // and legacy pre-interop exports (cents money, HH:mm times, numeric ids) — see
  // backup/vault-import.js. Replaces this device's data after an explicit confirm.
  const importVaultInput = /** @type {HTMLInputElement | null} */ (root.querySelector('[data-import-vault-file]'));
  root.querySelector('[data-import-vault-file-btn]')?.addEventListener('click', () => importVaultInput?.click());
  importVaultInput?.addEventListener('change', async (e) => {
    const file = /** @type {HTMLInputElement} */ (e.target).files?.[0];
    if (importVaultInput) importVaultInput.value = ''; // allow re-picking the same file
    if (!file) return;
    const res = await importVaultFile(file);
    if ('cancelled' in res && res.cancelled) return;
    if (res.success) {
      const skippedNote = res.skipped?.length ? ` (${res.skipped.length} rows skipped)` : '';
      if (res.skipped?.length) console.warn('[comma] import skipped rows:', res.skipped);
      showToast({ type: 'success', message: `Backup imported ✓${skippedNote}`, duration: 2400 });
      setTimeout(() => window.location.reload(), 1000);
    } else {
      showToast({ type: 'error', message: res.error || 'Import failed.', duration: 3600 });
    }
  });

  root.querySelector('[data-reset-vault]')?.addEventListener('click', async () => {
    if (!exportedThisSession) {
      showToast({ type: 'warning', message: 'Export a backup first.' });
      return;
    }
    await resetVault();
  });

  root.querySelector('[data-open-install]')?.addEventListener('click', async () => {
    const installed = document.documentElement.dataset.installed === 'true';
    if (installed) {
      showToast({ type: 'info', message: 'COMMA is already installed.' });
      return;
    }
    const accepted = await window.__comma?.triggerInstall?.();
    if (accepted) showToast({ type: 'success', message: 'Install prompt accepted.' });
    else showToast({ type: 'info', message: 'Install prompt not available right now.' });
  });

  root.querySelector('[data-share-comma]')?.addEventListener('click', async () => {
    const shareData = {
      title: 'COMMA',
      text: 'Track your gig work earnings with a local-first vault.',
      url: window.location.href,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        /* user cancelled */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast({ type: 'success', message: 'Link copied.' });
    } catch {
      showToast({ type: 'warning', message: 'Copy not available in this browser.' });
    }
  });

  root.querySelector('[data-open-dev-tools]')?.addEventListener('click', () => {
    window.location.hash = '#/debug';
  });

  root.querySelector('[data-debug-tap]')?.addEventListener('click', async () => {
    const isUnlocked = await getAppState('debug_mode_unlocked');
    if (isUnlocked) {
      window.location.hash = '#/debug';
      return;
    }
    const now = Date.now();
    if (now - debugTapStartedAt > DEBUG_TAP_WINDOW_MS) {
      debugTapStartedAt = now;
      debugTapCount = 0;
    }
    debugTapCount += 1;
    const hint = root.querySelector('[data-debug-hint]');
    const debugNote = root.querySelector('#debug-note');
    if (debugTapCount >= 5) {
      await setAppState('debug_mode_unlocked', true);
      if (hint) hint.textContent = 'Developer Tools are unlocked.';
      if (debugNote) debugNote.textContent = ' (click to view)';
      
      const devToolsBtn = root.querySelector('[data-open-dev-tools]');
      if (devToolsBtn) devToolsBtn.style.display = 'inline-flex';

      showToast({ type: 'success', message: 'Debug mode unlocked! Opening Dev Tools...' });
      debugTapCount = 0;
      debugTapStartedAt = now;
      setTimeout(() => {
        window.location.hash = '#/debug';
      }, 500);
      return;
    }
    if (hint) hint.textContent = `${5 - debugTapCount} more taps to unlock debug mode.`;
  });

  const debugUnlocked = await getAppState('debug_mode_unlocked');
  const debugNote = root.querySelector('#debug-note');
  if (debugUnlocked) {
    const hint = root.querySelector('[data-debug-hint]');
    if (hint) hint.textContent = 'Developer Tools are unlocked.';
    if (debugNote) debugNote.textContent = ' (click to view)';
    const btn = root.querySelector('[data-open-dev-tools]');
    if (btn) btn.style.display = 'inline-flex';
  } else {
    if (debugNote) debugNote.textContent = ' (tap 5 times to unlock)';
  }

  await refreshDataHealth();
}

export { mountSettingsPlatforms };
