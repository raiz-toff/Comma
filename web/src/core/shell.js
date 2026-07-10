/**
 * App shell markup inside `#app` (F5): header, sidebar, main + view container, timer bar, toast + modal hosts.
 */

import { getIcon } from '../ui/icons.js';
import { t } from '../utils/strings.js';
import { store } from './store.js';
import { Router } from './router.js';
import { initFAB, showDrawer, showModal, showToast } from '../ui/components.js';
import { mountPlatformSwitcher } from '../modules/platforms/platforms.js';
import { openGlobalSearchOverlay } from '../modules/search/search.js';
import { exitDemoToOnboardingStart } from '../modules/onboarding/onboarding.js';
import { renderShiftForm } from '../modules/shifts/shift-form.js';
import { restoreShiftTimerFromLocalStorage, saveShift, stopShiftTimer, startShiftTimer } from '../modules/shifts/shifts.js';
import { db } from './db.js';
import { bus } from './events.js';
import { GPSTracker } from './gps-tracker.js';

/** @type {ReturnType<typeof setInterval> | null} */
let clockTimer = null;
/** @type {ReturnType<typeof setInterval> | null} */
let shiftTimerInterval = null;
/** @type {ReturnType<typeof setInterval> | null} */
let shiftNotifInterval = null;

/**
 * Posts/updates the persistent shift-in-progress notification on the device
 * notification shade so the user can see elapsed time and platform without
 * returning to the app — similar to a music player widget.
 * @param {{ platformName: string, elapsed: string, isPaused: boolean }} opts
 */
function postShiftNotification({ platformName, elapsed, isPaused }) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    // We use a stable `tag` so Android/Chrome replaces the existing
    // notification in-place (acts as an updating live widget).
    const n = new Notification(
      `${isPaused ? '⏸' : '🟢'} ${platformName} — ${elapsed}`,
      {
        body: isPaused
          ? 'Shift paused. Tap to resume or end.'
          : 'Shift in progress. Tap to view your timer.',
        icon: './favicon-96x96.png',
        badge: './favicon.ico',
        tag: 'comma-shift-live',          // replaces previous notification
        renotify: false,
        silent: true,                    // no sound on update
        requireInteraction: false,
      }
    );
    // Tapping the notification should open the app
    n.onclick = () => { window.focus(); };
  } catch (err) {
    console.warn('[comma] shift notification failed', err);
  }
}

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
    } catch (e) {
      console.error('[comma shell] exit demo failed', e);
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
        <div class="app-header-actions">
          <a class="btn btn-secondary btn-xs header-btn" href="#/analytics/week" title="${escapeAttr(t('views.dashboard.financial.weeklyLog'))}">
            ${getIcon('calendar', 16)} <span class="header-btn-text">${escapeHtml(t('views.dashboard.financial.weeklyLog'))}</span>
          </a>
          <a class="btn btn-secondary btn-xs header-btn" href="#/expenses" title="${escapeAttr(t('views.dashboard.financial.expensesNav'))}">
            ${getIcon('receipt', 16)} <span class="header-btn-text">${escapeHtml(t('views.dashboard.financial.expensesNav'))}</span>
          </a>
          <a class="btn btn-primary btn-xs header-btn" href="#/reports" title="${escapeAttr(t('views.dashboard.financial.export'))}">
            ${getIcon('export', 16)} <span class="header-btn-text">${escapeHtml(t('views.dashboard.financial.export'))}</span>
          </a>
        </div>
        <time id="header-clock" class="app-header-clock"></time>
        <a href="#/notifications" class="app-header-notifications" data-nav-route="#/notifications" aria-label="Notifications" style="position:relative; display:flex; align-items:center;">
          ${getIcon('bell', 22, 'header-bell-icon')}
          <span id="header-unread-badge" style="position:absolute; top:-4px; right:-4px; background:var(--color-danger); color:white; font-size:10px; font-weight:700; border-radius:10px; padding:2px 5px; display:none;"></span>
        </a>
        <a href="#/settings" class="app-header-settings" data-nav-route="#/settings" aria-label="${escapeAttr(t('app.navSettings'))}">
          ${getIcon('settings', 22, 'header-settings-icon')}
        </a>
        </header>
      </div>
      <div class="app-body">
        <nav class="app-sidebar" aria-label="${escapeAttr(t('app.navAria'))}">
          ${navLink('#/dashboard', 'home', 'app.navDashboard')}
          ${navLink('#/shifts', 'calendar', 'app.navShifts')}
          ${navLink('#/analytics', 'trending-up', 'app.navAnalytics')}
          ${navLink('#/expenses', 'receipt', 'app.navExpenses')}
          ${navLink('#/tax', 'tax', 'app.navTax')}
          ${navLink('#/vehicles', 'truck', 'app.navVehicles')}
          ${navLink('#/schedule', 'calendar', 'app.navSchedule')}
          ${navLink('#/goals', 'trophy', 'app.navGoals')}
          ${navLink('#/reports', 'bag', 'app.navReports')}
          ${navLink('#/import', 'file-plus', 'app.navImport')}
          ${navLink('#/settings', 'settings', 'app.navSettings')}
          ${navLink('#/support', 'info', 'app.navSupport')}
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
        ${bottomNavButton('#/shifts', 'calendar', 'app.navShifts')}
        ${bottomNavButton('#/analytics', 'trending-up', 'app.navAnalytics')}
        ${bottomNavButton('#/goals', 'trophy', 'app.navGoals')}
        <button type="button" class="nav-link" id="bottom-nav-more" aria-label="More Pages">
          ${getIcon('layout-grid', 20, 'nav-icon')}
          <span>More</span>
        </button>
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

  root.querySelector('#bottom-nav-more')?.addEventListener('click', () => {
    openMoreNavMenu();
  });

  store.subscribe('user', () => {
    const av = root.querySelector('.app-header-avatar');
    if (av) av.textContent = initialsFromUser(store.get('user'));
  });

  async function updateUnreadBadge() {
    try {
      const count = await db.notifications.filter((n) => !n.read && !n.dismissed).count();
      const badge = root.querySelector('#header-unread-badge');
      const link = root.querySelector('.app-header-notifications');
      if (badge) {
        if (count > 0) {
          badge.style.display = 'inline-block';
          badge.textContent = count > 99 ? '99+' : String(count);
          if (link) {
            link.innerHTML = `${getIcon('bell-active', 22, 'header-bell-icon')} ` + badge.outerHTML;
            link.style.color = 'var(--color-primary, #10b981)';
          }
        } else {
          badge.style.display = 'none';
          if (link) {
            link.innerHTML = `${getIcon('bell', 22, 'header-bell-icon')} ` + badge.outerHTML;
            link.style.color = '';
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  void updateUnreadBadge();
  bus.on('notification:unread-change', () => {
    void updateUnreadBadge();
  });

  function openMoreNavMenu() {
    const morePages = [
      { href: '#/expenses', icon: 'receipt', label: 'app.navExpenses' },
      { href: '#/tax', icon: 'bolt', label: 'app.navTax' },
      { href: '#/vehicles', icon: 'fuel', label: 'app.navVehicles' },
      { href: '#/schedule', icon: 'clock', label: 'app.navSchedule' },
      { href: '#/reports', icon: 'receipt', label: 'app.navReports' },
      { href: '#/import', icon: 'file-plus', label: 'app.navImport' },
      { href: '#/settings', icon: 'settings', label: 'app.navSettings' },
      { href: '#/support', icon: 'info', label: 'app.navSupport' },
    ];

    const drawer = showDrawer({
      title: 'More Insights & Tools',
      content: `
        <div class="more-nav-list">
          ${morePages.map(p => `
            <a href="${p.href}" class="more-nav-item" data-nav-more-link>
              <div class="more-nav-icon">${getIcon(p.icon, 22)}</div>
              <span class="more-nav-label">${t(p.label)}</span>
              <div class="more-nav-arrow">${getIcon('chevron-left', 14)}</div>
            </a>
          `).join('')}
        </div>
      `,
      snapPoints: [0.5, 0.85],
    });

    // Close drawer when a link is clicked
    drawer.body.querySelectorAll('[data-nav-more-link]').forEach(link => {
      link.addEventListener('click', () => drawer.close());
    });
  }

  function openQuickShiftDrawer() {
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
          console.warn('[comma shifts] FAB save failed', err);
          showToast({ type: 'error', message: t('errors.generic'), duration: 2200 });
        }
      });
    }
  }

  /* F11: mount FAB — speed dial (shift / expense / goals / schedule) + end-shift timer. */
  initFAB({
    addMenu: [
      {
        id: 'shift',
        labelKey: 'ui.fab.addShift',
        icon: 'calendar',
        onSelect: () => openQuickShiftDrawer(),
      },
      {
        id: 'expense',
        labelKey: 'ui.fab.addExpense',
        icon: 'receipt',
        onSelect: () => Router.navigate('expenses?fab=expense'),
      },
      {
        id: 'goals',
        labelKey: 'ui.fab.addGoals',
        icon: 'goal',
        onSelect: () => Router.navigate('goals?fab=goals'),
      },
      {
        id: 'schedule',
        labelKey: 'ui.fab.addSchedule',
        icon: 'clock',
        onSelect: () => Router.navigate('schedule?fab=schedule'),
      },
    ],
    onAdd: () => openQuickShiftDrawer(),
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
          allowWeeklyEntry: false,
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
              console.warn('[comma shifts] timer save failed', err);
              showToast({ type: 'error', message: t('errors.generic'), duration: 2200 });
            }
          });
        }
      } catch (err) {
        console.warn('[comma shifts] FAB end shift failed', err);
        showToast({ type: 'error', message: t('errors.generic'), duration: 2200 });
      }
    },
  });
}

/**
 * @param {HTMLElement | null} bar
 */
/**
 * @param {HTMLElement | null} bar
 */
async function hydrateShiftTimerBar(bar) {
  if (!bar) return;
  try {
    await restoreShiftTimerFromLocalStorage();

    const getDistanceUnit = () => {
      const user = store.get('user');
      return user && user.locale && typeof user.locale.distanceUnit === 'string' ? user.locale.distanceUnit : 'km';
    };

    const apply = () => {
      const timer = store.get('activeShiftTimer');
      const startIso = timer && typeof timer.startTime === 'string' ? timer.startTime : null;
      if (!startIso) {
        bar.hidden = true;
        bar.textContent = '';
        bar.classList.add('is-collapsed');
        return;
      }

      const isPaused = Boolean(timer.pausedAt);
      let elapsedMs = timer.elapsedMs || 0;
      if (!isPaused) {
        elapsedMs += Date.now() - new Date(startIso).getTime();
      }

      const mins = Math.max(0, Math.floor(elapsedMs / 60000));
      const hh = Math.floor(mins / 60);
      const mm = mins % 60;
      const elapsed = hh > 0 ? `${hh}h ${mm}m` : `${mm}m`;

      const distanceKm = GPSTracker.getAccumulatedDistance();
      let distanceStr = '';
      if (distanceKm > 0.01) {
        const unit = getDistanceUnit();
        const dist = unit === 'mi' ? distanceKm / 1.60934 : distanceKm;
        const prefix = GPSTracker.isFirstOrderReceived() ? '' : '💀 ';
        distanceStr = ` • ${prefix}${dist.toFixed(1)} ${unit}`;
      }

      bar.hidden = false;
      bar.removeAttribute('hidden');
      bar.classList.remove('is-collapsed');
      bar.style.cursor = 'pointer';

      // Resolve platform details
      const platforms = store.get('platforms') || [];
      const platform = platforms.find(p => p.id === timer.platformId);
      const platformName = platform ? platform.name : (timer.platformId || 'Shift');
      const platformColor = platform ? (platform.color || '#10b981') : '#10b981';

      bar.innerHTML = `
        <div class="shift-timer-bar-inner" style="display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 4px 0;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="shift-timer-dot" style="width: 10px; height: 10px; border-radius: 50%; display: inline-block; background: ${escapeAttr(platformColor)}; box-shadow: 0 0 10px ${escapeAttr(platformColor)}; animation: ${isPaused ? 'none' : 'pulse 1.8s infinite'};" aria-hidden="true"></span>
            <span class="shift-timer-label" style="font-weight: 600; color: var(--color-text-primary);">${escapeHtml(platformName)} ${isPaused ? '(Paused)' : t('shifts.shiftTimer')}</span>
            <span class="shift-timer-meta" style="font-weight: 700; color: var(--color-text-primary); background: var(--color-surface-raised); border: 1px solid var(--color-border); padding: 2px 8px; border-radius: 4px; font-size: 13px; display: inline-flex; align-items: center; gap: 4px;">${escapeHtml(elapsed)}${escapeHtml(distanceStr)}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 11px; color: var(--color-text-secondary); opacity: 0.8; font-weight: 600; display: inline-block; vertical-align: middle;">View Timer</span>
            <button type="button" class="btn btn-ghost btn-xs shift-timer-cta" data-action="end-shift" style="color: var(--color-danger); border-color: rgba(239, 68, 68, 0.35); background: rgba(239, 68, 68, 0.08); font-weight: 700; border-radius: 4px; padding: 4px 8px; font-size: 12px;">${escapeHtml(
              t('shifts.endShift'),
            )}</button>
          </div>
        </div>
      `;
    };

    apply();
    store.subscribe('activeShiftTimer', apply);
    if (shiftTimerInterval) clearInterval(shiftTimerInterval);
    shiftTimerInterval = setInterval(apply, 10000);

    // --- Persistent shift notification ticker ---
    // Post an updating notification every 60 s so the user sees elapsed time
    // in their device notification shade / status bar (like a live widget).
    if (shiftNotifInterval) clearInterval(shiftNotifInterval);
    const tickNotif = () => {
      const timer = store.get('activeShiftTimer');
      if (!timer || !timer.startTime) {
        // Shift ended — dismiss our live notification
        if (shiftNotifInterval) { clearInterval(shiftNotifInterval); shiftNotifInterval = null; }
        return;
      }
      const isPaused = Boolean(timer.pausedAt);
      let elapsedMs = timer.elapsedMs || 0;
      if (!isPaused) elapsedMs += Date.now() - new Date(timer.startTime).getTime();
      const mins = Math.max(0, Math.floor(elapsedMs / 60000));
      const hh = Math.floor(mins / 60);
      const mm = mins % 60;
      const elapsed = hh > 0 ? `${hh}h ${mm}m` : `${mm}m`;
      const platforms = store.get('platforms') || [];
      const platform = platforms.find(p => p.id === timer.platformId);
      const platformName = platform ? platform.name : (timer.platformId || 'Shift');
      postShiftNotification({ platformName, elapsed, isPaused });
    };
    tickNotif();  // post immediately on shift start
    shiftNotifInterval = setInterval(tickNotif, 60000);

    bar.addEventListener('click', async (e) => {
      const endBtn = /** @type {HTMLElement | null} */ (e.target && /** @type {HTMLElement} */ (e.target).closest('[data-action="end-shift"]'));
      if (endBtn) {
        e.preventDefault();
        e.stopPropagation();
        try {
          const prefill = await stopShiftTimer();
          if (!prefill) return;
          const formApi = renderShiftForm({ mode: 'full', initial: prefill, submitLabel: t('common.save'), allowWeeklyEntry: false });
          const handle = showModal({ title: t('shifts.endShift'), content: formApi.el, actions: [] });
          formApi.el.querySelector('form')?.addEventListener('submit', async (evt) => {
            evt.preventDefault();
            await saveShift(formApi.getValue());
            showToast({ type: 'success', message: t('shifts.savedToast'), duration: 1800 });
            handle.close();
          });
        } catch (err) {
          console.warn('[comma shifts] end shift from bar failed', err);
          showToast({ type: 'error', message: t('errors.generic'), duration: 2200 });
        }
        return;
      }

      // Click on timer bar opens the full-screen Big Clock
      e.preventDefault();
      const { openBigClockOverlay } = await import('../modules/shifts/big-clock.js');
      openBigClockOverlay();
    });

    // Listen for SW notificationclick relay — opens big clock when user taps the notification
    navigator.serviceWorker?.addEventListener('message', async (evt) => {
      if (evt.data?.type === 'comma:shift-action') {
        const { openBigClockOverlay: open } = await import('../modules/shifts/big-clock.js');
        open();
      }
    });

    // Register PWA target time push notification checker
    setInterval(async () => {
      const timer = store.get('activeShiftTimer');
      if (timer && timer.targetTime && !timer.targetTimeNotified && !timer.pausedAt) {
        const target = new Date(timer.targetTime).getTime();
        if (Date.now() >= target) {
          const updated = { ...timer, targetTimeNotified: true };
          const { setAppState } = await import('./db.js');
          await setAppState('active_shift_start', updated);
          try {
            localStorage.setItem('comma_active_shift_timer', JSON.stringify(updated));
          } catch {}
          bus.emit(SHIFT_TIMER_START, updated);

          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
              new Notification('Shift Target Reached! 🏁', {
                body: 'You have worked until your target time. Wrap up and log your shift!',
                icon: './favicon.ico',
                badge: './favicon.ico',
                tag: 'comma-shift-target',
                requireInteraction: true,
              });
            } catch (err) {
              console.warn('Notification trigger failed', err);
            }
          }
          showToast({ type: 'success', message: '🏁 Target shift time reached! Time to wrap up.', duration: 6000 });
          // Clear the live shift widget and post a final "done" notification
          if (shiftNotifInterval) { clearInterval(shiftNotifInterval); shiftNotifInterval = null; }
        }
      }
    }, 5000);
  } catch {
    bar.hidden = true;
  }
}
