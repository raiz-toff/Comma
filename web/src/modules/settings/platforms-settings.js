/**
 * F10 — Settings: active platform cards, add / deactivate / goals / tax / notes.
 */

import { db, saveUser, getUser } from '../../core/db.js';
import { store } from '../../core/store.js';
import { t } from '../../utils/strings.js';
import { showConfirm, showToast } from '../../ui/components.js';
import { getPlatformConfig } from '../../registry/platforms/terminology.js';
import { getIcon } from '../../ui/icons.js';
import {
  addPlatform,
  deactivatePlatform,
  updatePlatformGoal,
  updatePlatformTaxRate,
  updatePlatformNotes,
} from '../platforms/platforms.js';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

const PLATFORMS_EXPANDED_KEY = 'comma-platforms-expanded-v1';

function loadPlatformExpanded() {
  try {
    const raw = sessionStorage.getItem(PLATFORMS_EXPANDED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePlatformExpanded(map) {
  try {
    sessionStorage.setItem(PLATFORMS_EXPANDED_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/**
 * @param {HTMLElement} root
 */
export async function mountSettingsPlatforms(root) {
  root.textContent = '';
  root.className = 'settings-platforms';

  const title = document.createElement('h2');
  title.className = 'settings-section-title';
  title.textContent = t('platforms.settingsSectionTitle');
  root.appendChild(title);

  const lead = document.createElement('p');
  lead.className = 'text-secondary settings-section-lead';
  lead.textContent = t('platforms.settingsSectionLead');
  root.appendChild(lead);

  const switcherRow = document.createElement('div');
  switcherRow.className = 'settings-field-row';
  switcherRow.innerHTML = `
    <div style="text-align: center; margin-bottom: var(--space-4); width: 100%; display: flex; flex-direction: column; align-items: center;">
      <span class="input-label" style="display: block; margin-bottom: var(--space-2)">Choose style for switcher</span>
      <div class="settings-segmented-control" role="radiogroup" aria-label="${esc(t('platforms.switcherMode'))}">
        <button type="button" role="radio" class="settings-segmented-btn" data-mode="tabs" aria-checked="false">
          ${getIcon('layout-grid', 16)} <span>${esc(t('platforms.switcherTabs'))}</span>
        </button>
        <button type="button" role="radio" class="settings-segmented-btn" data-mode="dropdown" aria-checked="false">
          ${getIcon('chevron-down', 16)} <span>${esc(t('platforms.switcherDropdown'))}</span>
        </button>
      </div>
    </div>`;
  root.appendChild(switcherRow);

  const list = document.createElement('div');
  list.className = 'platform-settings-cards';
  root.appendChild(list);

  const actions = document.createElement('div');
  actions.className = 'settings-platform-actions';
  root.appendChild(actions);

  const disclaimer = document.createElement('p');
  disclaimer.className = 'text-xs text-secondary platform-api-disclaimer';
  disclaimer.textContent = t('platforms.apiDisclaimer');
  root.appendChild(disclaimer);

  const modeBtns = /** @type {NodeListOf<HTMLButtonElement>} */ (switcherRow.querySelectorAll('[data-mode]'));

  const paint = async () => {
    const user = await getUser();
    const mode = user?.platformSwitcherMode === 'dropdown' ? 'dropdown' : 'tabs';

    modeBtns.forEach((btn) => {
      const on = btn.dataset.mode === mode;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
    });

    const active = await db.platforms.filter((p) => p.active === true).toArray();
    active.sort((a, b) => (Number(a.priority) || 0) - (Number(b.priority) || 0));
    const inactive = await db.platforms.filter((p) => p.active === false).toArray();
    inactive.sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));

    const isOpen = () => false;

    list.textContent = '';
    for (const p of active) {
      const id = String(p.id);
      const cfg = getPlatformConfig(id);
      const help = cfg.helpUrl
        ? `<a href="${esc(cfg.helpUrl)}" target="_blank" rel="noopener noreferrer">${esc(t('platforms.helpLink'))}</a>`
        : '';
      const card = document.createElement('article');
      card.className = `card card-raised platform-settings-card settings-collapsible ${isOpen(id) ? 'is-expanded' : ''}`;
      card.dataset.platformId = id;
      card.setAttribute('data-platform-collapsible', id);
      card.style.setProperty('--platform-color', typeof p.color === 'string' ? p.color : cfg.color);
      card.innerHTML = `
        <header class="platform-settings-card-head settings-collapsible-header" data-platform-toggle="${id}">
          <div class="platform-settings-card-title">
            <span class="platform-settings-logo" aria-hidden="true">${cfg.logo}</span>
            <div class="settings-collapsible-title-wrap">
              <h3 class="platform-settings-name">${esc(typeof p.name === 'string' ? p.name : cfg.name)}</h3>
              <p class="settings-collapsible-summary">${esc(t('platforms.cardMeta'))}</p>
            </div>
          </div>
          <div class="platform-settings-card-actions">
            ${help}
            <button type="button" class="btn btn-secondary btn-sm" data-deactivate>${esc(t('platforms.deactivate'))}</button>
          </div>
          <span class="settings-collapsible-icon" style="margin-left:var(--space-3)">${getIcon('chevron-down', 20)}</span>
        </header>
        <div class="settings-collapsible-body">
          <div class="platform-settings-grid">
            <label class="input-group">
              <span class="input-label">${esc(t('platforms.weeklyGoal'))}</span>
              <input type="number" class="input" min="0" step="1" data-weekly value="${Number(p.weeklyGoal) || 0}" />
            </label>
            <label class="input-group">
              <span class="input-label">${esc(t('platforms.monthlyGoal'))}</span>
              <input type="number" class="input" min="0" step="1" data-monthly value="${Number(p.monthlyGoal) || 0}" />
            </label>
            <label class="input-group">
              <span class="input-label">${esc(t('platforms.taxRate'))}</span>
              <input type="number" class="input" min="0" max="100" step="0.1" data-tax value="${Number(p.taxRatePct) || 0}" />
            </label>
          </div>
          <label class="input-group" style="margin-top:var(--space-3)">
            <span class="input-label">${esc(t('platforms.notes'))}</span>
            <textarea class="input" rows="3" data-notes></textarea>
          </label>
          <div class="platform-settings-save">
            <button type="button" class="btn btn-primary btn-sm" data-save-card>${esc(t('common.save'))}</button>
          </div>
        </div>`;
      list.appendChild(card);
      const notesEl = /** @type {HTMLTextAreaElement | null} */ (card.querySelector('[data-notes]'));
      if (notesEl) notesEl.value = typeof p.notes === 'string' ? p.notes : '';

      card.querySelector('[data-save-card]')?.addEventListener('click', async () => {
        const w = /** @type {HTMLInputElement | null} */ (card.querySelector('[data-weekly]'));
        const m = /** @type {HTMLInputElement | null} */ (card.querySelector('[data-monthly]'));
        const tx = /** @type {HTMLInputElement | null} */ (card.querySelector('[data-tax]'));
        const n = /** @type {HTMLTextAreaElement | null} */ (card.querySelector('[data-notes]'));
        try {
          await updatePlatformGoal(id, Number(w?.value), Number(m?.value));
          await updatePlatformTaxRate(id, Number(tx?.value));
          await updatePlatformNotes(id, n?.value ?? '');
          showToast({ message: t('platforms.saved'), type: 'success' });
        } catch (e) {
          console.warn(e);
          showToast({ message: t('errors.generic'), type: 'error' });
        }
      });

      card.querySelector('[data-deactivate]')?.addEventListener('click', () => {
        showConfirm({
          title: t('platforms.deactivateTitle'),
          message: t('platforms.deactivateMessage').replace('{name}', typeof p.name === 'string' ? p.name : id),
          confirmLabel: t('platforms.deactivate'),
          confirmClass: 'btn btn-danger',
          onConfirm: async () => {
            try {
              await deactivatePlatform(id);
              showToast({ message: t('platforms.deactivated'), type: 'info' });
              await paint();
            } catch (err) {
              if (err instanceof Error && err.message === 'last_platform') {
                showToast({ message: t('platforms.lastActive'), type: 'warning' });
              } else {
                showToast({ message: t('errors.generic'), type: 'error' });
              }
            }
          },
        });
      });

      card.addEventListener('click', (ev) => {
        const target = /** @type {Element} */ (ev.target);
        const toggle = target.closest('[data-platform-toggle]');
        if (!toggle) return;

        // If clicking an action button or link, don't toggle
        if (target.closest('.platform-settings-card-actions') || target.closest('button') || target.closest('a')) {
          return;
        }

        const pid = toggle.getAttribute('data-platform-toggle');
        if (pid === id) {
          const isExpanding = !card.classList.contains('is-expanded');
          if (isExpanding) {
            // Close all others
            list.querySelectorAll('.platform-settings-card').forEach((c) => {
              if (c !== card) c.classList.remove('is-expanded');
            });
          }
          card.classList.toggle('is-expanded');
        }
      });
    }

    actions.textContent = '';
    if (inactive.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'text-secondary';
      empty.textContent = t('platforms.noInactive');
      actions.appendChild(empty);
    } else {
      const addHeader = document.createElement('h3');
      addHeader.className = 'settings-subsection-title';
      addHeader.style.marginTop = 'var(--space-6)';
      addHeader.textContent = t('platforms.add');
      actions.appendChild(addHeader);

      const grid = document.createElement('div');
      grid.className = 'platform-add-grid';
      grid.innerHTML = inactive
        .map((p) => {
          const pid = String(p.id);
          const cfg = getPlatformConfig(pid);
          return `
            <button type="button" class="platform-add-item card" data-add-pid="${esc(pid)}">
              <span class="platform-add-logo">${cfg.logo}</span>
              <span class="platform-add-name">${esc(typeof p.name === 'string' ? p.name : cfg.name)}</span>
            </button>`;
        })
        .join('');
      actions.appendChild(grid);

      grid.addEventListener('click', async (ev) => {
        const btn = ev.target instanceof Element ? ev.target.closest('[data-add-pid]') : null;
        if (!btn) return;
        const pid = btn.getAttribute('data-add-pid');
        if (!pid) return;

        try {
          await addPlatform(pid);
          showToast({ message: t('platforms.added'), type: 'success' });
          await paint();
        } catch (e) {
          console.warn(e);
          showToast({ message: t('errors.generic'), type: 'error' });
        }
      });
    }
  };

  modeBtns.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const v = btn.dataset.mode === 'dropdown' ? 'dropdown' : 'tabs';
      await saveUser({ platformSwitcherMode: v });
      await store.refresh('user');
      await paint();
      showToast({ message: t('platforms.switcherModeSaved'), type: 'info' });
    });
  });

  await paint();
}
