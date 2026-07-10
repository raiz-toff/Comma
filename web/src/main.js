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
import { initDatePickers, showToast } from './ui/components.js';
import { initAdaptiveTheme } from './core/adaptive-theme.js';
import { initDriveAuth } from './modules/backup/drive-auth.js';
import { initBackupTriggers } from './modules/backup/backup-triggers.js';
import { initChangelog, APP_VERSION } from './modules/changelog/changelog.js';
import './libs/flatpickr.min.js';
import './libs/clocklet.min.js';

/** @type {ServiceWorkerRegistration | null} */
let commaSwRegistration = null;

let deferredInstallPrompt = null;

window.__comma = window.__comma || {
  version: APP_VERSION,
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

window.__comma.canInstall = () => !!deferredInstallPrompt;

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

async function initBackupOverdue() {
  await getAppState('last_backup');
  /* Phase 2: surface reminder UI */
}

document.addEventListener('DOMContentLoaded', async () => {
  const splash = document.getElementById('comma-splash');
  registerServiceWorker();
  wireConnectivity();

  const app = document.getElementById('app');
  if (!app) return;

  // The database open is the one boot step whose failure genuinely means "could not open local
  // database" — keep it in its own try so a later boot failure never mis-reports as a DB error.
  // initDatabase() self-heals recoverable version/schema conflicts (stale service worker, corrupt
  // upgrade) by recreating the local DB, so this only rejects on a truly unopenable IndexedDB.
  /** @type {boolean} */
  let dbRecovered = false;
  try {
    ({ recovered: dbRecovered } = await initDatabase());
    window.__comma.db = db;
  } catch (err) {
    console.error('[comma] database open failed', err);
    if (app) app.textContent = t('errors.dbOpen');
    if (splash) splash.remove();
    return;
  }

  try {
    await store.loadFromDB();
    window.__comma.store = store;

    updateOnboardingFocusClass(!store.get('user')?.onboardingComplete);

    await initPlatforms();
    initAdaptiveTheme();
    initExpensesModule();
    initSearchModule();
    await initGoalsModule();
    await renderAppShell(app);

    window.__comma.router = Router;
    Router.init();

    // If the local DB had to be reset to recover from an unopenable/corrupt state, tell the user
    // now that the shell (and its toast host) exists — so they understand why local data is empty
    // and that synced data will come back, instead of silently losing it.
    if (dbRecovered) {
      showToast({ type: 'info', message: t('errors.dbRecovered'), duration: 6000 });
    }

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
      // Proactive notification detectors disabled — mobile parity not built yet,
      // see comma/../now-as-the-app-cozy-gray.md Workstream 7.
      // await runOnOpenNotificationCheck();
      await runRecurringExpensePromptOnce();
      await purgeOldDeleted('shifts', 30);
      await purgeOldDeleted('expenses', 30);
      await initBackupOverdue();
      await initP13();
      
      // Initialize Drive Backup
      try {
        await initDriveAuth();
        await initBackupTriggers();
      } catch (driveErr) {
        console.warn('[comma] drive backup init failed', driveErr);
      }
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

    // What's New
    initChangelog();

    // Global Date Picker Interceptor
    const pickerObserver = new MutationObserver((mutations) => {
      let shouldInit = false;
      for (const m of mutations) {
        if (m.addedNodes.length > 0) {
          shouldInit = true;
          break;
        }
      }
      if (shouldInit) initDatePickers(document.body);
    });
    pickerObserver.observe(document.body, { childList: true, subtree: true });
    // Catch anything already rendered
    initDatePickers(document.body);

    // Finalize: Hide splash only after EVERYTHING is ready
    if (splash) {
      splash.classList.add('is-done');
      setTimeout(() => splash.remove(), 400);
    }
  } catch (err) {
    // The DB is already open by here (its own try above handles open failures), so a failure at
    // this point is a general boot error, not a database one — don't mislabel it as "dbOpen".
    console.error('[comma] boot failed', err);
    if (app) app.textContent = t('errors.generic');
    if (splash) splash.remove();
    return;
  }
});
