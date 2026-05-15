/*
 * COMMA — entry point (F2 SW, F4 Dexie, F5 shell + router + event bus).
 * Theme: `public/theme-init.js` runs before paint (`comma-theme`); `store.loadFromDB` syncs user.theme.
 */

import { db, initDatabase, getAppState, purgeOldDeleted } from './core/db.js';
import { bus } from './core/events.js';
import { store } from './core/store.js';
import { Router, updateOnboardingFocusClass } from './core/router.js';
import { assertPlatformRegistryValid, PlatformRegistry } from './registry/platforms/index.js';
import { assertCountryRegistryValid, CountryRegistry } from './registry/countries/index.js';
import { assertProvinceRegistryValid, ProvinceRegistry } from './registry/provinces/index.js';
import { assertWidgetRegistryValid, WidgetRegistry } from './registry/widgets/index.js';
import { assertNotificationRegistryValid, NotificationRegistry } from './registry/notifications/index.js';
import { assertBadgeRegistryValid, BadgeRegistry } from './registry/badges/index.js';
import { assertMetricRegistryValid, MetricRegistry } from './registry/metrics/index.js';
import { assertReportRegistryValid, ReportRegistry } from './registry/reports/index.js';
import { assertExpenseCategoryRegistryValid, ExpenseCategoryRegistry } from './registry/expense-categories/index.js';
import { assertGoalTypeRegistryValid, GoalScopeRegistry, GoalTypeRegistry } from './registry/goal-types/index.js';
import { assertShiftFieldRegistryValid, ShiftFieldRegistry } from './registry/shift-fields/index.js';
import { renderAppShell } from './core/shell.js';
import { initPlatforms } from './modules/platforms/platforms.js';
import { runOnOpenNotificationCheck } from './modules/notifications/notifications.js';
import { initExpensesModule, runRecurringExpensePromptOnce } from './modules/expenses/expenses.js';
import { initGoalsModule } from './modules/goals/goals.js';
import { initSearchModule } from './modules/search/search.js';
import { apiSpecMarkdown, initP13 } from './modules/p13/p13.js';
import {
  initPwaModule,
  parseShareTargetIntent,
  onDeferredReplay,
  tryRegisterDeferredSync,
} from './modules/pwa/pwa.js';
import './utils/formatters.js';
import './utils/calculations.js';
import './utils/locale.js';
import './utils/strings.js';
import { t } from './utils/strings.js';
import './ui/icons.js';

/** @type {ServiceWorkerRegistration | null} */
let commaSwRegistration = null;

let deferredInstallPrompt = null;

window.__comma = window.__comma || {
  version: '1.0.0',
  db: null,
  store: null,
  bus: null,
  router: null,
  triggerInstall: null,
  swRegistration: null,
};

window.__comma.bus = bus;

function setStandaloneDataset() {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    /** @type {boolean | undefined} */ (window.navigator).standalone === true;
  if (standalone) {
    document.documentElement.dataset.installed = 'true';
  }
}

setStandaloneDataset();
window.matchMedia('(display-mode: standalone)').addEventListener('change', setStandaloneDataset);

function showSwUpdateBanner() {
  if (document.getElementById('comma-sw-update-banner')) return;

  const bar = document.createElement('div');
  bar.id = 'comma-sw-update-banner';
  bar.setAttribute('role', 'status');
  bar.style.cssText = [
    'position:fixed',
    'left:0',
    'right:0',
    'bottom:0',
    'z-index:400',
    'display:flex',
    'align-items:center',
    'justify-content:space-between',
    'gap:12px',
    'flex-wrap:wrap',
    'padding:12px 16px',
    'background:#1A1916',
    'color:#FAFAF8',
    'font:15px/1.4 system-ui,sans-serif',
    'box-shadow:0 -4px 24px rgba(0,0,0,0.2)',
  ].join(';');

  const msg = document.createElement('span');
  msg.textContent = t('app.updateAvailable');

  const reload = document.createElement('button');
  reload.type = 'button';
  reload.textContent = t('app.reload');
  reload.style.cssText = [
    'cursor:pointer',
    'border:none',
    'border-radius:8px',
    'padding:8px 16px',
    'font:inherit',
    'font-weight:600',
    'background:#F5A623',
    'color:#1A1916',
  ].join(';');
  reload.addEventListener('click', () => {
    window.location.reload();
  });

  bar.appendChild(msg);
  bar.appendChild(reload);
  document.body.appendChild(bar);
}

function watchForWaitingWorker(reg) {
  if (reg.waiting && navigator.serviceWorker.controller) {
    showSwUpdateBanner();
  }
  reg.addEventListener('updatefound', () => {
    const nw = reg.installing;
    if (!nw) return;
    nw.addEventListener('statechange', () => {
      if (nw.state === 'installed' && navigator.serviceWorker.controller) {
        showSwUpdateBanner();
      }
    });
  });
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker
    .register('./sw.js', { type: 'module', scope: './' })
    .then((reg) => {
      commaSwRegistration = reg;
      window.__comma.swRegistration = reg;
      watchForWaitingWorker(reg);
      reg.update().catch(() => {});
    })
    .catch((err) => {
      console.warn('[comma] service worker registration failed', err);
    });
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
});

window.__comma.triggerInstall = async () => {
  if (!deferredInstallPrompt) return false;
  deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  return choice.outcome === 'accepted';
};

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (commaSwRegistration) {
    commaSwRegistration.update().catch(() => {});
  }
});

function wireConnectivity() {
  window.addEventListener('online', () => store.set('isOnline', true));
  window.addEventListener('offline', () => store.set('isOnline', false));
}

async function checkBackupOverdue() {
  await getAppState('last_backup');
  /* Phase 2: surface reminder UI */
}

document.addEventListener('DOMContentLoaded', async () => {
  const splash = document.getElementById('comma-splash');
  registerServiceWorker();
  wireConnectivity();

  const app = document.getElementById('app');
  if (!app) return;

  try {
    await initDatabase();
    window.__comma.db = db;

    await store.loadFromDB();
    window.__comma.store = store;

    updateOnboardingFocusClass(!store.get('user')?.onboardingComplete);

    await initPlatforms();
    initExpensesModule();
    initSearchModule();
    await initGoalsModule();
    await renderAppShell(app);

    window.__comma.router = Router;
    Router.init();

    // Features & Registries
    try {
      assertPlatformRegistryValid();
      assertCountryRegistryValid();
      assertProvinceRegistryValid();
      assertWidgetRegistryValid();
      assertNotificationRegistryValid();
      assertBadgeRegistryValid();
      assertMetricRegistryValid();
      assertReportRegistryValid();
      assertExpenseCategoryRegistryValid();
      assertGoalTypeRegistryValid();
      assertShiftFieldRegistryValid();
    } catch (regErr) {
      console.error('[comma] registry validation failed', regErr);
    }

    try {
      await runOnOpenNotificationCheck();
      await runRecurringExpensePromptOnce();
      await purgeOldDeleted('shifts', 30);
      await purgeOldDeleted('expenses', 30);
      await checkBackupOverdue();
      await initP13();
    } catch (e) {
      console.warn('[comma] post-boot tasks failed', e);
    }

    try {
      initPwaModule();
      void tryRegisterDeferredSync();
      window.addEventListener('online', () => void tryRegisterDeferredSync());
      onDeferredReplay(async (items) => {
        for (const it of items) {
          try {
            bus.emit('pwa:replay-deferred-export', it);
          } catch (err) {
            console.warn('[comma] deferred replay dispatch failed', err);
          }
        }
      });
      const intent = parseShareTargetIntent();
      if (intent) {
        window.__comma.shareIntent = intent;
        bus.emit('pwa:share-intent', intent);
      }
    } catch (e) {
      console.warn('[comma] pwa init failed', e);
    }

    window.__comma.apiSpecMarkdown = apiSpecMarkdown;

    // Finalize: Hide splash only after EVERYTHING is ready
    if (splash) {
      splash.classList.add('is-done');
      setTimeout(() => splash.remove(), 400);
    }
  } catch (err) {
    console.error('[comma] boot failed', err);
    if (app) app.textContent = t('errors.dbOpen');
    if (splash) splash.remove();
    return;
  }
});
