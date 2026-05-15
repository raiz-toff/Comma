/**
 * Hash router (F5). Offline-safe; route guard for onboarding; nav sync; error boundary on view render.
 */

import { bus, NAVIGATION } from './events.js';
import { store } from './store.js';
import { render as renderDashboard } from '../views/dashboard.js';
import { render as renderShifts } from '../views/shifts-view.js';
import { render as renderAnalytics } from '../views/analytics-view.js';
import { render as renderExpenses } from '../views/expenses-view.js';
import { render as renderTax } from '../views/tax-view.js';
import { render as renderVehicles } from '../views/vehicles-view.js';
import { render as renderSchedule } from '../views/schedule-view.js';
import { render as renderGoals } from '../views/goals-view.js';
import { render as renderReports } from '../views/reports-view.js';
import { openGlobalSearchOverlay } from '../modules/search/search.js';
import { render as renderSettings } from '../views/settings-view.js';
import { render as renderOnboarding } from '../views/onboarding-view.js';
import { render as renderAbout } from '../views/about-view.js';
import { render as renderPrint } from '../views/print-view.js';
import { t } from '../utils/strings.js';

/** @typedef {{ hash: string, name: string, context: Record<string, unknown>, render: (el: HTMLElement, ctx: Record<string, unknown>) => void | Promise<void> }} COMMARoute */

function canonicalHash() {
  const raw = window.location.hash || '';
  const noQuery = raw.split('?')[0];
  if (noQuery === '' || noQuery === '#' || noQuery === '#/') return '#/';
  if (!noQuery.startsWith('#/')) return '#/';
  return noQuery;
}

/**
 * @param {string} hash
 * @returns {COMMARoute | null}
 */
function resolveRouteDef(hash) {
  /** @type {Array<{ hash: string; name: string; render: (el: HTMLElement, ctx: Record<string, unknown>) => void }>} */
  const table = [
    { hash: '#/shifts/new', name: 'shifts', render: renderShifts },
    { hash: '#/analytics/week', name: 'analytics', render: renderAnalytics },
    { hash: '#/settings/about', name: 'settings', render: renderSettings },
    { hash: '#/dashboard', name: 'dashboard', render: renderDashboard },
    { hash: '#/shifts', name: 'shifts', render: renderShifts },
    { hash: '#/analytics', name: 'analytics', render: renderAnalytics },
    { hash: '#/expenses', name: 'expenses', render: renderExpenses },
    { hash: '#/tax', name: 'tax', render: renderTax },
    { hash: '#/vehicles', name: 'vehicles', render: renderVehicles },
    { hash: '#/schedule', name: 'schedule', render: renderSchedule },
    { hash: '#/goals', name: 'goals', render: renderGoals },
    { hash: '#/reports', name: 'reports', render: renderReports },
    { hash: '#/settings', name: 'settings', render: renderSettings },
    { hash: '#/onboarding', name: 'onboarding', render: renderOnboarding },
    { hash: '#/about', name: 'about', render: renderAbout },
    { hash: '#/print', name: 'print', render: renderPrint },
  ];
  const row = table.find((r) => r.hash === hash);
  return row ? { hash: row.hash, name: row.name, context: buildContext(row), render: row.render } : null;
}

/**
 * @param {{ hash: string; name: string; render: Function }} row
 */
function buildContext(row) {
  const ctx = { hash: row.hash, routeName: row.name };
  if (row.hash === '#/shifts/new') ctx.openNew = true;
  if (row.hash === '#/analytics/week') ctx.analyticsPeriod = 'week';
  if (row.hash === '#/settings/about') ctx.settingsTab = 'about';
  try {
    const raw = window.location.hash || '';
    const qi = raw.indexOf('?');
    if (qi === -1) return ctx;
    const params = new URLSearchParams(raw.slice(qi + 1));
    const fab = params.get('fab');
    if (fab === 'expense') ctx.fabQuickExpense = true;
    if (fab === 'schedule') ctx.fabQuickSchedule = true;
    if (fab === 'goals') ctx.fabQuickGoals = true;
  } catch {
    /* ignore malformed query */
  }
  return ctx;
}

function updateNavActive(hash) {
  document.querySelectorAll('[data-nav-route]').forEach((el) => {
    const target = el.getAttribute('data-nav-route');
    if (!target) return;
    const active = hash === target || (target !== '#/dashboard' && hash.startsWith(target + '/'));
    if (active) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
}

function renderErrorBoundary(root, err) {
  console.error('[comma] view render failed', err);
  root.textContent = '';
  const box = document.createElement('div');
  box.className = 'card card-raised route-error';
  box.setAttribute('role', 'alert');
  const p = document.createElement('p');
  p.textContent = t('errors.viewRender');
  box.appendChild(p);
  root.appendChild(box);
}

/**
 * Full-bleed onboarding: hide global chrome (see `body.comma-onboarding-focus` in CSS).
 * Derived from `!user?.onboardingComplete` so it stays correct across redirect early-returns.
 * @param {boolean} shouldFocus
 */
export function updateOnboardingFocusClass(shouldFocus) {
  if (typeof document === 'undefined' || !document.body) return;
  document.body.classList.toggle('comma-onboarding-focus', Boolean(shouldFocus));
}

function handleRoute() {
  const user = /** @type {{ onboardingComplete?: boolean } | null} */ (store.get('user'));
  const incomplete = !user?.onboardingComplete;

  const viewRoot = document.getElementById('view-container');
  if (!viewRoot) {
    updateOnboardingFocusClass(incomplete);
    return;
  }

  let hash = canonicalHash();

  if (hash === '#/') {
    const next = user?.onboardingComplete ? '#/dashboard' : '#/onboarding';
    if (window.location.hash !== next) {
      updateOnboardingFocusClass(next === '#/onboarding');
      window.location.hash = next;
      return;
    }
    hash = next;
  }

  if (!user?.onboardingComplete) {
    if (hash !== '#/onboarding') {
      updateOnboardingFocusClass(true);
      window.location.hash = '#/onboarding';
      return;
    }
  } else if (hash === '#/onboarding') {
    updateOnboardingFocusClass(false);
    window.location.hash = '#/dashboard';
    return;
  }

  if (hash === '#/search' && user?.onboardingComplete) {
    void openGlobalSearchOverlay();
    try {
      const base = `${window.location.pathname}${window.location.search}`;
      window.history.replaceState(null, '', `${base}#/dashboard`);
    } catch {
      /* ignore */
    }
    hash = '#/dashboard';
  }

  let def = resolveRouteDef(hash);
  if (!def) {
    updateOnboardingFocusClass(false);
    window.location.hash = '#/dashboard';
    return;
  }

  updateOnboardingFocusClass(incomplete);

  window.__comma = window.__comma || {};
  window.__comma.currentRoute = def;

  updateNavActive(hash);

  viewRoot.textContent = '';
  viewRoot.className = '';
  try {
    const maybe = def.render(viewRoot, def.context);
    if (maybe && typeof /** @type {{ then?: unknown }} */ (maybe).then === 'function') {
      /** @type {Promise<unknown>} */ (maybe).catch((e) => renderErrorBoundary(viewRoot, e));
    }
  } catch (e) {
    renderErrorBoundary(viewRoot, e);
  }

  bus.emit(NAVIGATION, { hash: def.hash, name: def.name, context: def.context });
}

export const Router = {
  /** @param {string} path e.g. `dashboard` or `#/shifts` */
  navigate(path) {
    const h = path.startsWith('#') ? path : `#/${path.replace(/^\//, '')}`;
    const navUser = /** @type {{ onboardingComplete?: boolean } | null} */ (store.get('user'));
    if (h === '#/search' && navUser?.onboardingComplete) {
      void openGlobalSearchOverlay();
      return;
    }
    if (!navUser?.onboardingComplete && h !== '#/onboarding') {
      if (window.location.hash !== '#/onboarding') window.location.hash = '#/onboarding';
      else handleRoute();
      return;
    }
    if (window.location.hash === h) handleRoute();
    else window.location.hash = h;
  },

  init() {
    window.addEventListener('hashchange', () => handleRoute());
    return handleRoute();
  },

  refresh() {
    return handleRoute();
  },
};
