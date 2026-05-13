import { bus, NAVIGATION, PLATFORM_CHANGED } from '../core/events.js';
import { renderExpensesView } from '../modules/expenses/expenses.js';

/** @type {WeakMap<HTMLElement, () => void>} */
const teardownByRoot = new WeakMap();

function isExpensesRouteHash(h) {
  return h === '#/expenses' || h.startsWith('#/expenses/');
}

/** @param {HTMLElement} root @param {Record<string, unknown>} ctx */
export async function render(root, ctx) {
  void ctx;
  const prev = teardownByRoot.get(root);
  if (typeof prev === 'function') prev();

  let disposed = false;
  /** @type {(() => void) | null} */
  let destroyLedger = null;

  const runLedger = async () => {
    if (disposed || !(root instanceof HTMLElement)) return;
    if (typeof destroyLedger === 'function') {
      destroyLedger();
      destroyLedger = null;
    }
    destroyLedger = await renderExpensesView(root);
  };

  await runLedger();

  /** @type {(() => void)[]} */
  const unsubs = [];

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    if (typeof destroyLedger === 'function') {
      destroyLedger();
      destroyLedger = null;
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
      void runLedger();
    }),
  );

  unsubs.push(
    bus.on(NAVIGATION, (payload) => {
      const h =
        payload && typeof payload === 'object' && payload && 'hash' in payload
          ? String(/** @type {{ hash?: string }} */ (payload).hash)
          : '';
      if (isExpensesRouteHash(h)) return;
      cleanup();
    }),
  );

  teardownByRoot.set(root, cleanup);
}
