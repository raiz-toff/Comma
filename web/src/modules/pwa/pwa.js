/**
 * P12 — PWA Deep Features (Features 241–249) + accessibility helpers (251, 253).
 *
 * All wrappers are progressive-enhancement only: every API is feature-detected and
 * gracefully no-ops when unsupported. Permissions are NEVER requested implicitly —
 * UI explicitly invokes `requestNotificationPermission` / `toggleFullscreen` etc.
 *
 * Data rule (matches plan SW architecture): the service worker still NEVER touches
 * IndexedDB. Background Sync (241) only schedules a tag and posts a message to
 * clients on `sync` — the page reads the queue from `appState` and replays exports.
 *
 * Storage:
 *   - Deferred-export queue lives in Dexie `appState` under key `pwa_deferred_exports`.
 *     Shape: { items: [{ id, kind, payload, createdAt }] }
 *   - Notification permission timestamp under `pwa_notification_permission`.
 */

import { getAppState, setAppState } from '../../core/db.js';
import { store } from '../../core/store.js';
import { t } from '../../utils/strings.js';
import { showModal } from '../../ui/components.js';
import { getIcon } from '../../ui/icons.js';

/* ------------------------------------------------------------------------- */
/* Feature detection (single source of truth)                                */
/* ------------------------------------------------------------------------- */

export function pwaCapabilities() {
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const win = typeof window !== 'undefined' ? window : null;
  return {
    serviceWorker: !!(nav && 'serviceWorker' in nav),
    backgroundSync: !!(
      nav &&
      'serviceWorker' in nav &&
      win &&
      'SyncManager' in win
    ),
    shareTarget: !!(nav && typeof nav.share === 'function'),
    fileSystemAccess: !!(win && typeof win.showSaveFilePicker === 'function'),
    notifications:
      typeof Notification !== 'undefined' && typeof Notification.requestPermission === 'function',
    vibrate: !!(nav && typeof nav.vibrate === 'function'),
    wakeLock: !!(nav && nav.wakeLock && typeof nav.wakeLock.request === 'function'),
    fullscreen: !!(
      typeof document !== 'undefined' &&
      (document.fullscreenEnabled || /** @type {any} */ (document).webkitFullscreenEnabled)
    ),
  };
}

/* ------------------------------------------------------------------------- */
/* Feature 241 — Background Sync for deferred exports                        */
/* ------------------------------------------------------------------------- */

const DEFERRED_KEY = 'pwa_deferred_exports';
const SYNC_TAG = 'comma-deferred-exports';

/**
 * @typedef {Object} DeferredExportItem
 * @property {string} id
 * @property {string} kind  e.g. `vault-json`, `shifts-csv`, `tax-csv`
 * @property {Record<string, unknown>} [payload]
 * @property {string} createdAt
 */

/** @returns {Promise<DeferredExportItem[]>} */
export async function getDeferredExports() {
  const raw = await getAppState(DEFERRED_KEY);
  if (!raw || typeof raw !== 'object') return [];
  const items = /** @type {{ items?: unknown }} */ (raw).items;
  return Array.isArray(items) ? /** @type {DeferredExportItem[]} */ (items.filter(Boolean)) : [];
}

/**
 * Queue an export for later replay (offline export attempts).
 * @param {{ kind: string, payload?: Record<string, unknown> }} item
 */
export async function queueDeferredExport(item) {
  if (!item || typeof item.kind !== 'string' || !item.kind) {
    throw new Error('pwa:deferred:invalid');
  }
  const list = await getDeferredExports();
  const entry = {
    id: `dex_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`,
    kind: item.kind,
    payload: item.payload || {},
    createdAt: new Date().toISOString(),
  };
  const next = [entry, ...list].slice(0, 50);
  await setAppState(DEFERRED_KEY, { items: next });
  await tryRegisterDeferredSync().catch(() => {});
  return entry.id;
}

/**
 * Drop one deferred export (after successful replay).
 * @param {string} id
 */
export async function removeDeferredExport(id) {
  const list = await getDeferredExports();
  const next = list.filter((it) => it.id !== id);
  await setAppState(DEFERRED_KEY, { items: next });
}

/** Wipe queue (e.g. after vault reset). */
export async function clearDeferredExports() {
  await setAppState(DEFERRED_KEY, { items: [] });
}

/**
 * Register a Background Sync tag (no-op when SyncManager is unavailable, e.g. Firefox).
 * The service worker's `sync` handler posts `{ type: 'comma:replay-deferred' }` to clients.
 */
export async function tryRegisterDeferredSync() {
  const caps = pwaCapabilities();
  if (!caps.backgroundSync) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    /** @type {any} */ const r = reg;
    if (r.sync && typeof r.sync.register === 'function') {
      await r.sync.register(SYNC_TAG);
      return true;
    }
  } catch {
    /* ignore — SW may not be ready yet */
  }
  return false;
}

/**
 * Listen for SW replay messages. The page-side replayer is registered by the
 * reports module (which knows how to actually run an export). This helper
 * simply normalizes the wiring.
 * @param {(items: DeferredExportItem[]) => void} handler
 */
export function onDeferredReplay(handler) {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => {};
  const fn = (event) => {
    const data = event && event.data;
    if (!data || data.type !== 'comma:replay-deferred') return;
    getDeferredExports()
      .then((list) => {
        try {
          handler(list);
        } catch (e) {
          console.warn('[comma pwa] deferred replay handler failed', e);
        }
      })
      .catch(() => {});
  };
  navigator.serviceWorker.addEventListener('message', fn);
  return () => navigator.serviceWorker.removeEventListener('message', fn);
}

/* ------------------------------------------------------------------------- */
/* Feature 244 — Share Target intent handling                                */
/* ------------------------------------------------------------------------- */

/**
 * Parse a navigation URL for share-target query params.
 * Detects either the manifest-mapped params (`title`, `text`, `url`) or an
 * explicit `shared=1` marker. Returns `null` when this is not a share-target
 * invocation.
 *
 * @param {string} [href]
 */
export function parseShareTargetIntent(href) {
  if (typeof window === 'undefined') return null;
  const raw = href ?? window.location.href;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const params = url.searchParams;
  const hasMapped =
    params.has('title') ||
    params.has('text') ||
    params.has('url') ||
    params.get('shared') === '1' ||
    params.get('share') === '1';
  if (!hasMapped) return null;
  return {
    title: params.get('title') || '',
    text: params.get('text') || '',
    url: params.get('url') || '',
  };
}

/* ------------------------------------------------------------------------- */
/* Feature 245 — File System Access API for desktop exports                  */
/* ------------------------------------------------------------------------- */

/**
 * Try to save a text-ish blob via `showSaveFilePicker`. Falls back to a hidden
 * download anchor (matching `reports.js` behavior). Returns true if the user
 * confirmed a save target via the picker.
 *
 * @param {{ filename: string, contents: string | Blob, mime: string, description?: string }} opts
 */
export async function saveTextFile(opts) {
  const { filename, contents, mime, description } = opts || /** @type {any} */ ({});
  if (!filename || typeof filename !== 'string') throw new Error('pwa:save:filename');
  const blob = contents instanceof Blob ? contents : new Blob([String(contents ?? '')], { type: mime });

  if (pwaCapabilities().fileSystemAccess) {
    try {
      /** @type {any} */ const picker = await /** @type {any} */ (window).showSaveFilePicker({
        suggestedName: filename,
        types: mime
          ? [
              {
                description: description || filename.split('.').pop()?.toUpperCase() || 'File',
                accept: { [mime]: [`.${filename.split('.').pop() || 'txt'}`] },
              },
            ]
          : undefined,
      });
      const writable = await picker.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (err) {
      if (err && /** @type {any} */ (err).name === 'AbortError') return false;
      /* fall through to anchor download */
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return false;
}

/* ------------------------------------------------------------------------- */
/* Feature 246 — Notification API for timed reminders                        */
/* ------------------------------------------------------------------------- */

/**
 * Current notification permission state (without prompting).
 * @returns {'granted' | 'denied' | 'default' | 'unsupported'}
 */
export function getNotificationPermission() {
  if (!pwaCapabilities().notifications) return 'unsupported';
  return Notification.permission;
}

/** Request notification permission (no-op if already decided). */
export async function requestNotificationPermission() {
  if (!pwaCapabilities().notifications) return 'unsupported';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  try {
    const res = await Notification.requestPermission();
    await setAppState('pwa_notification_permission', {
      state: res,
      updatedAt: new Date().toISOString(),
    });
    return res;
  } catch {
    return Notification.permission;
  }
}

/**
 * Show a local notification immediately. Uses the SW registration when available
 * so that it survives the page being backgrounded.
 * @param {{ title: string, body?: string, icon?: string, tag?: string, data?: any, silent?: boolean }} opts
 */
export async function showLocalNotification(opts) {
  if (!opts || typeof opts.title !== 'string') return false;
  if (!pwaCapabilities().notifications) return false;
  if (Notification.permission !== 'granted') return false;
  const init = {
    body: opts.body || '',
    icon: opts.icon || 'web-app-manifest-192x192.png',
    tag: opts.tag,
    data: opts.data,
    silent: !!opts.silent,
  };
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(opts.title, init);
        return true;
      }
    }
    new Notification(opts.title, init);
    return true;
  } catch {
    return false;
  }
}

/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const scheduledReminders = new Map();

/**
 * Schedule a local reminder using setTimeout (Page Visibility-aware, in-page only).
 * Returns a cancel function. For persistent timing, use the active shift timer +
 * Wake Lock combo; the Notifications + Triggers proposal is not widely shipped.
 *
 * @param {{ id: string, fireAt: number | Date, title: string, body?: string }} opts
 */
export function scheduleLocalReminder(opts) {
  if (!opts || typeof opts.id !== 'string') throw new Error('pwa:reminder:id');
  cancelLocalReminder(opts.id);
  const fireAtMs = opts.fireAt instanceof Date ? opts.fireAt.getTime() : Number(opts.fireAt);
  const delay = Math.max(0, fireAtMs - Date.now());
  if (!Number.isFinite(delay)) throw new Error('pwa:reminder:time');
  /* setTimeout caps at 2^31-1 ms (~24.8 days). */
  const safeDelay = Math.min(delay, 2147483647);
  const handle = setTimeout(() => {
    scheduledReminders.delete(opts.id);
    void showLocalNotification({
      title: opts.title,
      body: opts.body,
      tag: opts.id,
    });
  }, safeDelay);
  scheduledReminders.set(opts.id, handle);
  return () => cancelLocalReminder(opts.id);
}

export function cancelLocalReminder(id) {
  const handle = scheduledReminders.get(id);
  if (handle) {
    clearTimeout(handle);
    scheduledReminders.delete(id);
  }
}

/* ------------------------------------------------------------------------- */
/* Feature 247 — Vibration API                                               */
/* ------------------------------------------------------------------------- */

/**
 * Best-effort haptic feedback. Patterns:
 *   - 'tap'      → 10ms
 *   - 'success'  → [15, 60, 15]
 *   - 'warning'  → [25, 80, 25]
 *   - 'error'    → [40, 50, 40, 50, 40]
 *   - number     → that many ms
 *   - number[]   → custom on/off pattern
 *
 * @param {'tap' | 'success' | 'warning' | 'error' | number | number[]} pattern
 */
export function vibrate(pattern) {
  if (!pwaCapabilities().vibrate) return false;
  let p = pattern;
  if (typeof pattern === 'string') {
    p =
      pattern === 'tap'
        ? 10
        : pattern === 'success'
          ? [15, 60, 15]
          : pattern === 'warning'
            ? [25, 80, 25]
            : pattern === 'error'
              ? [40, 50, 40, 50, 40]
              : 0;
  }
  try {
    return navigator.vibrate(/** @type {number | number[]} */ (p)) === true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------------- */
/* Feature 248 — Screen Wake Lock manager                                    */
/* ------------------------------------------------------------------------- */

/** @type {{ sentinel: any, requested: boolean, visibilityHandler: ((e: Event) => void) | null }} */
const wakeState = {
  sentinel: null,
  requested: false,
  visibilityHandler: null,
};

/**
 * Acquire a screen wake lock. Re-requests automatically when the page becomes
 * visible again (the sentinel auto-releases on visibility=hidden per spec).
 */
export async function acquireWakeLock() {
  if (!pwaCapabilities().wakeLock) return false;
  wakeState.requested = true;
  try {
    if (wakeState.sentinel) return true;
    wakeState.sentinel = await navigator.wakeLock.request('screen');
    wakeState.sentinel.addEventListener?.('release', () => {
      wakeState.sentinel = null;
    });
    if (!wakeState.visibilityHandler) {
      wakeState.visibilityHandler = async () => {
        if (
          wakeState.requested &&
          document.visibilityState === 'visible' &&
          !wakeState.sentinel
        ) {
          try {
            wakeState.sentinel = await navigator.wakeLock.request('screen');
          } catch {
            /* permission denied or document not visible */
          }
        }
      };
      document.addEventListener('visibilitychange', wakeState.visibilityHandler);
    }
    return true;
  } catch {
    return false;
  }
}

export async function releaseWakeLock() {
  wakeState.requested = false;
  try {
    if (wakeState.sentinel && typeof wakeState.sentinel.release === 'function') {
      await wakeState.sentinel.release();
    }
  } catch {
    /* ignore */
  } finally {
    wakeState.sentinel = null;
  }
  if (wakeState.visibilityHandler) {
    document.removeEventListener('visibilitychange', wakeState.visibilityHandler);
    wakeState.visibilityHandler = null;
  }
}

export function isWakeLockActive() {
  return !!wakeState.sentinel;
}

/* ------------------------------------------------------------------------- */
/* Feature 249 — Fullscreen mode toggle                                      */
/* ------------------------------------------------------------------------- */

function fullscreenElement() {
  if (typeof document === 'undefined') return null;
  /** @type {any} */ const d = document;
  return d.fullscreenElement || d.webkitFullscreenElement || null;
}

export function isFullscreen() {
  return !!fullscreenElement();
}

export async function toggleFullscreen(target) {
  if (!pwaCapabilities().fullscreen) return false;
  const el = target || document.documentElement;
  /** @type {any} */ const d = document;
  /** @type {any} */ const ae = el;
  try {
    if (isFullscreen()) {
      if (typeof d.exitFullscreen === 'function') await d.exitFullscreen();
      else if (typeof d.webkitExitFullscreen === 'function') d.webkitExitFullscreen();
      return false;
    }
    if (typeof ae.requestFullscreen === 'function') await ae.requestFullscreen();
    else if (typeof ae.webkitRequestFullscreen === 'function') ae.webkitRequestFullscreen();
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------------- */
/* PWA module initialization                                                 */
/* ------------------------------------------------------------------------- */

let pwaInitialized = false;

/**
 * One-time wiring called from `main.js` after the SW registers. Idempotent.
 * Wires the deferred-export replay channel; does NOT request any permissions.
 */
export function initPwaModule() {
  if (pwaInitialized) return;
  pwaInitialized = true;
  /* Hook used by P6 (Reports) — page-side replay handler is registered there. */

  // Feature 242 — Delayed install prompt for mobile users
  setupInstallPrompt();
}

/**
 * Sets up a delayed check to prompt mobile users to install the PWA.
 * Conditions: Mobile view, Not Demo Mode, Not already installed, 15s delay.
 */
export function setupInstallPrompt() {
  if (typeof window === 'undefined') return;

  // Wait 15 seconds as requested
  setTimeout(async () => {
    const isMobile = window.innerWidth <= 768;
    const isDemo = store.get('demoMode');
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      /** @type {any} */ (window.navigator).standalone === true;

    if (!isMobile || isDemo || isStandalone) return;

    // Check if dismissed recently (don't annoy the user)
    const lastPrompt = localStorage.getItem('comma_pwa_prompt_last');
    const now = Date.now();
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    if (lastPrompt && now - Number(lastPrompt) < SEVEN_DAYS) return;

    showPwaInstallModal();
  }, 15000);
}

/**
 * Triggers the premium PWA install flow. If native prompt is supported, launches it.
 * If unsupported or unavailable (e.g. iOS or manual triggers), opens a beautiful step-by-step modal guide.
 * @param {() => void} [onSuccess]
 * @param {any} [parentModalHandle]
 */
export async function triggerPremiumInstallFlow(onSuccess, parentModalHandle = null) {
  let success = false;
  if (typeof window !== 'undefined' && /** @type {any} */ (window).__comma?.triggerInstall) {
    success = await /** @type {any} */ (window).__comma.triggerInstall();
  }

  if (success) {
    onSuccess?.();
    return;
  }

  // Close parent modal if provided
  if (parentModalHandle && typeof parentModalHandle.close === 'function') {
    parentModalHandle.close();
  }

  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const isIOS = nav && /iPad|iPhone|iPod/.test(nav.userAgent) && !(/** @type {any} */ (window).MSStream);
  const isAndroid = nav && /Android/.test(nav.userAgent);
  const isChrome = nav && /Chrome/.test(nav.userAgent) && !/Edg/.test(nav.userAgent);

  const guide = document.createElement('div');
  guide.className = 'pwa-install-guide';
  guide.style.cssText = `display:flex;flex-direction:column;gap:var(--space-4);padding:var(--space-2) 0;`;

  function step(num, html) {
    return `
      <div style="display:flex;gap:var(--space-3);align-items:flex-start;">
        <div style="background:var(--color-surface-raised);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:8px;font-weight:800;font-size:16px;color:var(--color-brand);width:36px;height:36px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${num}</div>
        <div style="flex:1;font-size:var(--text-sm);line-height:1.6;color:var(--color-text-primary);">${html}</div>
      </div>`;
  }

  if (isIOS) {
    guide.innerHTML =
      step(1, 'Tap the <strong>Share</strong> button in Safari\'s toolbar — the box with an arrow pointing up.') +
      step(2, 'Scroll the share sheet and tap <strong>"Add to Home Screen"</strong>.') +
      step(3, 'Tap <strong>"Add"</strong> in the top-right corner. COMMA will appear on your home screen like a native app!');
  } else if (isAndroid && isChrome) {
    guide.innerHTML =
      step(1, 'Tap the <strong>menu button</strong> (⋮ three dots) in Chrome\'s top-right corner.') +
      step(2, 'Tap <strong>"Install app"</strong> from the menu.') +
      step(3, 'Tap <strong>"Install"</strong> on the prompt. COMMA installs as a full-screen app — no browser chrome!');
  } else {
    // Generic Chrome/Edge desktop or other browsers
    guide.innerHTML =
      step(1, 'Look for the <strong>install icon</strong> (⊕) in your browser\'s address bar, or open the browser menu (⋮).') +
      step(2, 'Click <strong>"Install COMMA"</strong> or <strong>"Install app"</strong>.') +
      step(3, 'Click <strong>"Install"</strong> on the confirmation dialog. COMMA opens as a standalone app!');
  }

  showModal({
    title: 'Install COMMA',
    content: guide,
    size: 'sm',
    actions: [{ label: 'Got it', class: 'btn btn-primary btn-block' }],
  });
}

/**
 * Shows a premium bottom-sheet modal inviting the user to install the app.
 */
function showPwaInstallModal() {
  const content = document.createElement('div');
  content.className = 'pwa-install-prompt';
  content.innerHTML = `
    <div class="pwa-install-icon-wrap">
      <div class="pwa-install-icon-bg">
        ${getIcon('bolt', 32, 'pwa-install-icon')}
      </div>
    </div>
    <div class="pwa-install-body">
      <p class="pwa-install-text">${t('pwa.install.message')}</p>
    </div>
  `;

  showModal({
    title: t('pwa.install.title'),
    content,
    size: 'sm',
    actions: [
      {
        label: t('pwa.install.confirm'),
        class: 'btn btn-primary btn-block',
        close: false, // Handle closing manually in triggerPremiumInstallFlow
        onClick: async (handle) => {
          await triggerPremiumInstallFlow(null, handle);
        },
      },
      {
        label: t('pwa.install.later'),
        class: 'btn btn-ghost btn-block',
        onClick: () => {
          localStorage.setItem('comma_pwa_prompt_last', String(Date.now()));
        },
      },
    ],
  });
}
