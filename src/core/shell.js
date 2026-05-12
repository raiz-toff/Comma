/**
 * App shell markup inside `#app` (F5): header, sidebar, main + view container, timer bar, toast + modal hosts.
 */

import { getIcon } from '../ui/icons.js';
import { t } from '../utils/strings.js';
import { store } from './store.js';
import { initFAB, showDrawer, showModal, showToast } from '../ui/components.js';
import { mountPlatformSwitcher } from '../modules/platforms/platforms.js';
import { openGlobalSearchOverlay } from '../modules/search/search.js';
import { exitDemoToOnboardingStart } from '../modules/onboarding/onboarding.js';
import { renderShiftForm } from '../modules/shifts/shift-form.js';
import { restoreShiftTimerFromLocalStorage, saveShift, stopShiftTimer, startShiftTimer } from '../modules/shifts/shifts.js';

/** @type {ReturnType<typeof setInterval> | null} */
let clockTimer = null;
/** @type {ReturnType<typeof setInterval> | null} */
let shiftTimerInterval = null;

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function navLink(href, iconName, labelKey) {
  const label = t(labelKey);
  return `<a href="${escapeAttr(href)}" data-nav-route="${escapeAttr(href)}" class="nav-link">${getIcon(iconName, 20, 'nav-icon')}<span>${label}</span></a>`;
}

function bottomNavButton(href, iconName, labelKey) {
  const label = t(labelKey);
  return `<a href="${escapeAttr(href)}" data-nav-route="${escapeAttr(href)}" class="nav-link">${getIcon(iconName, 20, 'nav-icon')}<span>${label}</span></a>`;
}

function initialsFromUser(user) {
  const name = (user && typeof user.displayName === 'string' && user.displayName.trim()) || '';
  if (!name) return '?';
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function updateClock(el) {
  if (!el) return;
  const d = new Date();
  el.textContent = d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function bindOfflineIndicator() {
  const el = document.getElementById('offline-indicator');
  if (!el) return;
  const apply = () => {
    const on = store.get('isOnline');
    el.textContent = on ? t('app.online') : t('app.offline');
    el.dataset.online = on ? 'true' : 'false';
  };
  store.subscribe('isOnline', apply);
  apply();
}

/**
 * @param {HTMLElement} root `#app`
 */
function bindDemoModeBar(root) {
  const bar = root.querySelector('#demo-mode-bar');
  if (!bar) return;

  const apply = (isDemo) => {
    const on = Boolean(isDemo);
    bar.hidden = !on;
    if (on) bar.removeAttribute('hidden');
    else bar.setAttribute('hidden', '');
  };
  apply(store.get('demoMode'));
  store.subscribe('demoMode', (v) => apply(v));

  bar.querySelector('[data-exit-demo]')?.addEventListener('click', async () => {
    try {
      await exitDemoToOnboardingStart();
      showToast({ type: 'success', message: t('app.exitDemoToast'), duration: 4500 });
    } catch (e) {
      console.error('[macadam shell] exit demo failed', e);
      showToast({ type: 'error', message: t('errors.generic'), duration: 2800 });
    }
  });
}

/**
 * @param {HTMLElement} root `#app`
 */
export async function renderAppShell(root) {
  if (clockTimer) clearInterval(clockTimer);
  if (shiftTimerInterval) clearInterval(shiftTimerInterval);

  const user = store.get('user');
  const initials = initialsFromUser(user);

  root.innerHTML = `
    <a href="#view-container" class="skip-link" data-skip-link>${escapeHtml(t('app.skipToContent'))}</a>
    <div class="app-shell">
      <div class="app-shell-chrome">
        <div
          id="demo-mode-bar"
          class="demo-mode-bar"
          role="status"
          aria-live="polite"
          hidden
        >
          <span class="demo-mode-bar-text">${escapeHtml(t('app.demoModeBanner'))}</span>
          <button type="button" class="btn btn-sm demo-mode-bar-exit" data-exit-demo>
            ${escapeHtml(t('app.exitDemo'))}
          </button>
        </div>
        <header class="app-header" role="banner" aria-label="${escapeAttr(t('app.headerAria'))}">
        <div class="app-header-avatar" aria-hidden="true">${initials}</div>
        <div id="platform-tabs-slot" class="platform-tabs app-header-platforms" aria-label="${escapeAttr(t('platforms.switcher'))}"></div>
        <div class="app-header-spacer"></div>
        <time id="header-clock" class="app-header-clock"></time>
        <span id="offline-indicator" class="offline-pill" role="status" aria-live="polite" data-online="true"></span>
        <button type="button" class="app-header-search" data-open-global-search aria-label="${escapeAttr(t('app.navSearch'))}">
          ${getIcon('search', 22, 'header-search-icon')}
        </button>
        <a href="#/settings" class="app-header-settings" data-nav-route="#/settings" aria-label="${escapeAttr(t('app.navSettings'))}">
          ${getIcon('settings', 22, 'header-settings-icon')}
        </a>
        </header>
      </div>
      <div class="app-body">
        <nav class="app-sidebar" aria-label="${escapeAttr(t('app.navAria'))}">
          ${navLink('#/dashboard', 'home', 'app.navDashboard')}
          ${navLink('#/shifts', 'clock', 'app.navShifts')}
          ${navLink('#/analytics', 'trending-up', 'app.navAnalytics')}
          ${navLink('#/tax', 'percent', 'app.navTax')}
          ${navLink('#/vehicles', 'truck', 'app.navVehicles')}
          ${navLink('#/schedule', 'calendar', 'app.navSchedule')}
          ${navLink('#/goals', 'trophy', 'app.navGoals')}
          ${navLink('#/reports', 'bag', 'app.navReports')}
          ${navLink('#/settings', 'settings', 'app.navSettings')}
        </nav>
        <main class="app-main" role="main" id="app-main">
          <div id="shift-timer-bar" class="shift-timer-bar is-collapsed" hidden></div>
          <div id="view-container" tabindex="-1"></div>
          <div id="toast-container" class="toast-host" aria-live="polite" aria-atomic="true"></div>
          <div id="modal-overlay" class="modal-host" aria-live="polite"></div>
        </main>
      </div>
      <nav class="bottom-nav" aria-label="${escapeAttr(t('app.navAria'))}">
        ${bottomNavButton('#/dashboard', 'home', 'app.navDashboard')}
        ${bottomNavButton('#/shifts', 'clock', 'app.navShifts')}
        ${bottomNavButton('#/analytics', 'trending-up', 'app.navAnalytics')}
        ${bottomNavButton('#/goals', 'trophy', 'app.navGoals')}
        ${bottomNavButton('#/settings', 'settings', 'app.navSettings')}
      </nav>
    </div>
  `;

  const clockEl = root.querySelector('#header-clock');
  if (clockEl) {
    updateClock(clockEl);
    clockTimer = setInterval(() => updateClock(clockEl), 60000);
  }

  const skipLink = root.querySelector('[data-skip-link]');
  if (skipLink) {
    skipLink.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById('view-container');
      if (target && typeof target.focus === 'function') {
        target.focus({ preventScroll: false });
        target.scrollIntoView({ block: 'start' });
      }
    });
  }

  bindOfflineIndicator();
  bindDemoModeBar(root);
  root.querySelector('[data-open-global-search]')?.addEventListener('click', () => {
    void openGlobalSearchOverlay();
  });
  mountPlatformSwitcher(root.querySelector('#platform-tabs-slot'));
  await hydrateShiftTimerBar(root.querySelector('#shift-timer-bar'));

  store.subscribe('user', () => {
    const av = root.querySelector('.app-header-avatar');
    if (av) av.textContent = initialsFromUser(store.get('user'));
  });

  /* F11: mount FAB with real shift handlers (quick-add + end shift timer). */
  initFAB({
    onAdd: () => {
      const drawer = showDrawer({
        title: t('shifts.addShift'),
        content: '',
        snapPoints: [0.65, 0.95],
      });
      const formApi = renderShiftForm({
        mode: 'quick',
        initial: {},
        onCancel: () => drawer.close(),
      });
      drawer.body.textContent = '';
      drawer.body.appendChild(formApi.el);
      const formEl = formApi.el.querySelector('form');
      if (formEl) {
        formEl.addEventListener('submit', async (e) => {
          e.preventDefault();
          try {
            await saveShift(formApi.getValue());
            showToast({ type: 'success', message: t('shifts.savedToast'), duration: 1800 });
            drawer.close();
          } catch (err) {
            console.warn('[macadam shifts] FAB save failed', err);
            showToast({ type: 'error', message: t('errors.generic'), duration: 2200 });
          }
        });
      }
    },
    onEndShift: async () => {
      try {
        const prefill = await stopShiftTimer();
        if (!prefill) {
          showToast({ type: 'info', message: t('shifts.timerNotRunning'), duration: 1800 });
          return;
        }
        const formApi = renderShiftForm({
          mode: 'full',
          initial: prefill,
          submitLabel: t('common.save'),
        });
        const handle = showModal({
          title: t('shifts.endShift'),
          content: formApi.el,
          actions: [],
        });
        const formEl = formApi.el.querySelector('form');
        if (formEl) {
          formEl.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
              await saveShift(formApi.getValue());
              showToast({ type: 'success', message: t('shifts.savedToast'), duration: 1800 });
              handle.close();
            } catch (err) {
              console.warn('[macadam shifts] timer save failed', err);
              showToast({ type: 'error', message: t('errors.generic'), duration: 2200 });
            }
          });
        }
      } catch (err) {
        console.warn('[macadam shifts] FAB end shift failed', err);
        showToast({ type: 'error', message: t('errors.generic'), duration: 2200 });
      }
    },
  });
}

/**
 * @param {HTMLElement | null} bar
 */
async function hydrateShiftTimerBar(bar) {
  if (!bar) return;
  try {
    await restoreShiftTimerFromLocalStorage();

    const apply = () => {
      const timer = store.get('activeShiftTimer');
      const startIso = timer && typeof timer.startTime === 'string' ? timer.startTime : null;
      if (!startIso) {
        bar.hidden = true;
        bar.textContent = '';
        bar.classList.add('is-collapsed');
        return;
      }
      const start = new Date(startIso);
      const ms = Date.now() - start.getTime();
      const mins = Math.max(0, Math.floor(ms / 60000));
      const hh = Math.floor(mins / 60);
      const mm = mins % 60;
      const elapsed = hh > 0 ? `${hh}h ${mm}m` : `${mm}m`;

      bar.hidden = false;
      bar.removeAttribute('hidden');
      bar.classList.remove('is-collapsed');
      bar.innerHTML = `
        <div class="shift-timer-bar-inner">
          <span class="shift-timer-dot" aria-hidden="true"></span>
          <span class="shift-timer-label">${escapeAttr(t('shifts.shiftTimer'))}</span>
          <span class="shift-timer-meta">${escapeAttr(elapsed)}</span>
          <button type="button" class="btn btn-ghost shift-timer-cta" data-action="end-shift">${escapeHtml(
            t('shifts.endShift'),
          )}</button>
        </div>
      `;
    };

    apply();
    store.subscribe('activeShiftTimer', apply);
    if (shiftTimerInterval) clearInterval(shiftTimerInterval);
    shiftTimerInterval = setInterval(apply, 30000);

    bar.addEventListener('click', async (e) => {
      const el = /** @type {HTMLElement | null} */ (e.target && /** @type {HTMLElement} */ (e.target).closest('[data-action="end-shift"]'));
      if (!el) return;
      e.preventDefault();
      try {
        const prefill = await stopShiftTimer();
        if (!prefill) return;
        const formApi = renderShiftForm({ mode: 'full', initial: prefill, submitLabel: t('common.save') });
        const handle = showModal({ title: t('shifts.endShift'), content: formApi.el, actions: [] });
        formApi.el.querySelector('form')?.addEventListener('submit', async (evt) => {
          evt.preventDefault();
          await saveShift(formApi.getValue());
          showToast({ type: 'success', message: t('shifts.savedToast'), duration: 1800 });
          handle.close();
        });
      } catch (err) {
        console.warn('[macadam shifts] end shift from bar failed', err);
        showToast({ type: 'error', message: t('errors.generic'), duration: 2200 });
      }
    });
  } catch {
    bar.hidden = true;
  }
}
