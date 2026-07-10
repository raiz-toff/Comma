import { bus, NAVIGATION, PLATFORM_CHANGED } from '../core/events.js';
import { renderNotificationsView } from '../modules/notifications/notifications-ui.js';

/** @type {WeakMap<HTMLElement, () => void>} */
const teardownByRoot = new WeakMap();

function isNotificationsRouteHash(h) {
  return h === '#/notifications' || h.startsWith('#/notifications/');
}

/** @param {HTMLElement} root */
export async function render(root) {
  const prev = teardownByRoot.get(root);
  if (typeof prev === 'function') prev();

  let disposed = false;
  /** @type {(() => void) | null} */
  let destroyView = null;

  const runView = async () => {
    if (disposed || !(root instanceof HTMLElement)) return;
    if (typeof destroyView === 'function') {
      destroyView();
      destroyView = null;
    }
    destroyView = await renderNotificationsView(root);
  };

  await runView();

  /** @type {(() => void)[]} */
  const unsubs = [];

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    if (typeof destroyView === 'function') {
      destroyView();
      destroyView = null;
    }
    while (unsubs.length) {
      const u = unsubs.pop();
      try {
        if (typeof u === 'function') u();
      } catch {
        /* ignore */
      }
    }
    teardownByRoot.delete(root);
  };

  unsubs.push(
    bus.on(PLATFORM_CHANGED, () => {
      if (disposed) return;
      void runView();
    }),
  );

  unsubs.push(
    bus.on(NAVIGATION, (payload) => {
      const h =
        payload && typeof payload === 'object' && payload && 'hash' in payload
          ? String(/** @type {{ hash?: string }} */ (payload).hash)
          : '';
      if (isNotificationsRouteHash(h)) return;
      cleanup();
    }),
  );

  teardownByRoot.set(root, cleanup);
}
