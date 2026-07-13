/**
 * COMMA — core UI component library (F8).
 *
 * All components are plain JS functions that either return an HTML string or mount
 * a node into `document.body`. The overlay primitives (modal / confirm / toast /
 * drawer / FAB) render through Ionic Core custom elements (`ion-modal`, `ion-alert`,
 * `ion-toast`, `ion-fab`) registered at boot by `src/core/ionic.js`; their public
 * signatures and returned handles are unchanged. `showNotifyCard` still mounts into
 * the `#toast-container` shell host. No framework, no virtual DOM.
 *
 * Component chrome lives in `src/css/components.css` — no inline styles for layout
 * or theming (only stateful CSS custom properties such as `--platform-color`).
 *
 * Accessibility (per plan F8):
 *   - Modals: `role="dialog"`, `aria-modal="true"`; focus trap, Esc + backdrop close
 *     are ion-modal's; focus returns to triggering element on close (Feature 254).
 *   - Toasts: announced by ion-toast's own live region (Feature 253).
 *   - Progress ring: `aria-valuenow / aria-valuemin / aria-valuemax / aria-valuetext`.
 *   - FAB / drawer close buttons carry localized `aria-label`.
 *
 * Touch targets default to >= 44×44px via the CSS system (Feature 255).
 *
 * All user-facing copy is fetched through `t()` from `src/utils/strings.js`.
 */

import { getIcon } from './icons.js';
import { t } from '../utils/strings.js';
import { bus, SHIFT_TIMER_START, SHIFT_TIMER_STOP } from '../core/events.js';
import { store } from '../core/store.js';
import { PlatformRegistry } from '../registry/platforms/index.js';

/* ------------------------------------------------------------------------- */
/* Small helpers                                                             */
/* ------------------------------------------------------------------------- */

/** @param {unknown} s */
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** @param {unknown} v */
function escapeAttr(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

const FOCUSABLE_SELECTOR =
  [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'details summary',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

/** @param {Element} root */
function getFocusableElements(root) {
  return /** @type {HTMLElement[]} */ (Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR))).filter(
    (el) => !el.hasAttribute('aria-hidden') && (el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement),
  );
}

function getToastHost() {
  return document.getElementById('toast-container') || document.body;
}

function reducedMotionEnabled() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ------------------------------------------------------------------------- */
/* COMMAModal                                                              */
/* ------------------------------------------------------------------------- */

/**
 * @typedef {Object} ModalAction
 * @property {string} label
 * @property {string} [class] CSS class for the button (defaults to `btn btn-secondary`)
 * @property {(api: ModalHandle) => void} [onClick]
 * @property {boolean} [close] If false, the modal stays open after click. Default true.
 * @property {boolean} [autofocus] If true, this button gets initial focus
 */

/**
 * @typedef {Object} ModalOptions
 * @property {string} [title]
 * @property {string | Node} [content] HTML string or DOM node
 * @property {ModalAction[]} [actions]
 * @property {() => void} [onClose]
 * @property {'sm' | 'md' | 'lg' | 'xl'} [size]
 * @property {boolean} [dismissible] Allow Esc + backdrop close. Default true.
 * @property {string} [ariaLabel] Override aria-label (otherwise uses title)
 * @property {string} [role] Defaults to `dialog`. Use `alertdialog` for destructive flows.
 */

/**
 * @typedef {Object} ModalHandle
 * @property {HTMLElement} root The `.comma-modal` dialog element (light DOM, queryable)
 * @property {HTMLElement} backdrop The `ion-modal` host (owns backdrop + presentation)
 * @property {HTMLElement} body The `.comma-modal-body` content slot
 * @property {() => void} close
 */

/** @type {ModalHandle[]} */
const modalStack = [];

/**
 * True on touch devices, where dragging a sheet's handle up to reveal more of it is a
 * familiar gesture. On a mouse-driven desktop it isn't.
 * @returns {boolean}
 */
export function isCoarsePointer() {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
}

/**
 * Configures an `ion-modal` as either a draggable mobile sheet (touch) or a centered,
 * content-sized dialog (mouse) — never Ionic's fixed-viewport-fraction sheet on a mouse
 * device. Ionic sheet mode always renders at exactly `breakpoint × viewport height`
 * regardless of how tall the content actually is: a short breakpoint hides content laid
 * out further down behind a drag gesture no mouse user knows to try (it's genuinely
 * off-screen, not a scrollable overflow); a tall breakpoint leaves a large blank gap
 * under short content, pushing a footer to the very bottom of an oversized box. Skipping
 * `breakpoints` on a mouse device makes Ionic fall back to its normal auto-height card
 * presentation, sized via the `--width`/`--height`/`--max-height` custom properties this
 * sets through the shared `.comma-ion-sheet` class (`@media (pointer: fine)` in
 * components.css) — the dialog hugs its own content, exactly like `showModal`.
 * @param {HTMLElement} modal
 * @param {number[]} breakpoints Must start with 0. Only applied on touch.
 * @param {number} coarseInitialBreakpoint Which breakpoint touch opens to.
 */
export function applySheetPresentation(modal, breakpoints, coarseInitialBreakpoint) {
  modal.classList.add('comma-ion-sheet');
  if (isCoarsePointer()) {
    /** @type {any} */ (modal).breakpoints = breakpoints;
    /** @type {any} */ (modal).initialBreakpoint = coarseInitialBreakpoint;
    /** @type {any} */ (modal).handle = true;
  }
}

/**
 * Show a modal dialog rendered through `ion-modal` (centered). Focus trapping, Escape +
 * backdrop dismissal, scroll locking and stacking are Ionic's; the dialog chrome
 * (header / body / footer action buttons) and the returned handle are unchanged.
 * @param {ModalOptions} [opts]
 * @returns {ModalHandle}
 */
export function showModal(opts = {}) {
  const {
    title = '',
    content = '',
    actions = [],
    onClose,
    size = 'md',
    dismissible = true,
    role = 'dialog',
    ariaLabel,
  } = opts;

  const trigger = /** @type {HTMLElement | null} */ (document.activeElement);

  const modal = /** @type {HTMLElement & { present: () => Promise<void>; dismiss: () => Promise<boolean> }} */ (
    document.createElement('ion-modal')
  );
  modal.classList.add('comma-ion-modal', `comma-ion-modal--${size}`);
  /** @type {any} */ (modal).backdropDismiss = dismissible;

  const dialog = document.createElement('div');
  dialog.className = `comma-modal comma-modal--${size}`;
  dialog.setAttribute('role', role);
  dialog.setAttribute('aria-modal', 'true');
  dialog.tabIndex = -1;
  const labelText = ariaLabel || (typeof title === 'string' ? title : '');
  if (labelText) dialog.setAttribute('aria-label', labelText);
  dialog.dataset.dismissible = dismissible ? 'true' : 'false';

  const headerHtml = `
    <div class="comma-modal-header">
      <h2 class="comma-modal-title">${escapeHtml(title)}</h2>
      <button type="button" class="comma-modal-close" aria-label="${escapeAttr(t('ui.modal.close'))}">${getIcon('x', 18, 'comma-modal-close-icon')}</button>
    </div>`;
  dialog.innerHTML = `${title ? headerHtml : ''}<div class="comma-modal-body"></div><div class="comma-modal-footer" hidden></div>`;

  const bodyEl = /** @type {HTMLElement} */ (dialog.querySelector('.comma-modal-body'));
  if (content instanceof Node) {
    bodyEl.appendChild(content);
  } else if (typeof content === 'string') {
    bodyEl.innerHTML = content;
  }

  const footerEl = /** @type {HTMLElement} */ (dialog.querySelector('.comma-modal-footer'));
  if (actions.length > 0) {
    footerEl.hidden = false;
    for (const action of actions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = action.class || 'btn btn-secondary';
      btn.textContent = action.label || '';
      if (action.autofocus) btn.dataset.autofocus = 'true';
      btn.addEventListener('click', () => {
        try {
          action.onClick?.(handle);
        } catch (err) {
          console.error('[comma modal] action handler failed', err);
        }
        if (action.close !== false) handle.close();
      });
      footerEl.appendChild(btn);
    }
  }

  const closeBtn = dialog.querySelector('.comma-modal-close');
  if (closeBtn) closeBtn.addEventListener('click', () => handle.close());

  modal.appendChild(dialog);

  /** @type {ModalHandle} */
  const handle = {
    root: dialog,
    backdrop: modal,
    body: bodyEl,
    close: () => {
      void modal.dismiss();
    },
  };
  modalStack.push(handle);

  modal.addEventListener('ionModalDidDismiss', () => {
    const idx = modalStack.indexOf(handle);
    if (idx >= 0) modalStack.splice(idx, 1);
    modal.remove();
    try {
      onClose?.();
    } catch (err) {
      console.error('[comma modal] onClose failed', err);
    }
    if (trigger && typeof trigger.focus === 'function' && document.contains(trigger)) {
      try {
        trigger.focus();
      } catch {
        /* element no longer focusable */
      }
    }
  });

  document.body.appendChild(modal);
  void modal.present().then(() => {
    const auto = dialog.querySelector('[data-autofocus="true"]');
    const focusable = getFocusableElements(dialog);
    const first =
      (auto instanceof HTMLElement && auto) ||
      focusable[0] ||
      dialog;
    try {
      first.focus({ preventScroll: true });
    } catch {
      /* ignore */
    }
  });

  return handle;
}

/** Close the top-most open modal (if any). */
export function closeModal() {
  const top = modalStack.length > 0 ? modalStack[modalStack.length - 1] : null;
  top?.close();
}

/* ------------------------------------------------------------------------- */
/* COMMAConfirm                                                            */
/* ------------------------------------------------------------------------- */

/**
 * @typedef {Object} ConfirmOptions
 * @property {string} [title]
 * @property {string} [message]
 * @property {string} [confirmLabel]
 * @property {string} [cancelLabel]
 * @property {string} [confirmClass] CSS class for confirm button (default `btn btn-primary`)
 * @property {string} [requireType] If set, user must type this string before confirm enables.
 * @property {() => void | Promise<void>} [onConfirm]
 * @property {() => void} [onCancel]
 */

/**
 * Show a confirmation dialog rendered through `ion-alert`. Supports type-to-confirm
 * gating for danger zones (Features 20, 180) via the `requireType` option: the confirm
 * button stays disabled — and the alert stays open — until the exact string is typed.
 * `onConfirm` / `onCancel` fire on their buttons only (never on Esc/backdrop), as before.
 *
 * @param {ConfirmOptions} [opts]
 * @returns {{ root: HTMLElement, backdrop: HTMLElement, body: HTMLElement, close: () => void }}
 */
export function showConfirm(opts = {}) {
  const {
    title = t('ui.confirm.title'),
    message = '',
    confirmLabel = t('common.confirm'),
    cancelLabel = t('common.cancel'),
    confirmClass = 'btn btn-primary',
    requireType,
    onConfirm,
    onCancel,
  } = opts;

  const trigger = /** @type {HTMLElement | null} */ (document.activeElement);
  const isDanger = /\bdanger\b/.test(confirmClass);
  const gated = typeof requireType === 'string' && requireType.length > 0;

  const alert = /** @type {HTMLElement & { present: () => Promise<void>; dismiss: () => Promise<boolean> }} */ (
    document.createElement('ion-alert')
  );
  alert.classList.add('comma-alert');
  /** @type {any} */ (alert).header = title;
  // ion-alert renders `message` as plain text (HTML templating is off by default) —
  // same contract as the old textContent-based confirm body.
  /** @type {any} */ (alert).message = String(message ?? '');

  if (gated) {
    const prompt = t('ui.confirm.typeToConfirm').replace('{value}', requireType);
    /** @type {any} */ (alert).subHeader = prompt;
    /** @type {any} */ (alert).inputs = [
      {
        name: 'confirmType',
        type: 'text',
        cssClass: 'comma-alert-type-input',
        attributes: { 'aria-label': prompt, autocomplete: 'off' },
      },
    ];
  }

  const buttons = [];
  // An explicitly empty cancelLabel means "OK-only" (used by demo-mode warnings).
  if (cancelLabel) {
    buttons.push({ text: cancelLabel, role: 'cancel', cssClass: 'comma-alert-btn comma-alert-btn--cancel' });
  }
  buttons.push({
    text: confirmLabel,
    role: isDanger ? 'destructive' : undefined,
    cssClass: `comma-alert-btn comma-alert-btn--confirm${isDanger ? ' comma-alert-btn--danger' : ''}`,
    handler: (/** @type {Record<string, string> | undefined} */ values) => {
      if (gated) {
        const typed = values && typeof values === 'object' ? String(values.confirmType ?? '') : '';
        if (typed !== requireType) return false; // keep the alert open until the text matches
      }
      try {
        const r = onConfirm?.();
        if (r && typeof (/** @type {Promise<unknown>} */ (r).then) === 'function') {
          /** @type {Promise<unknown>} */ (r).catch((err) =>
            console.error('[comma confirm] onConfirm rejected', err),
          );
        }
      } catch (err) {
        console.error('[comma confirm] onConfirm failed', err);
      }
      return true;
    },
  });
  /** @type {any} */ (alert).buttons = buttons;

  alert.addEventListener('ionAlertDidDismiss', (ev) => {
    const role = /** @type {CustomEvent<{ role?: string }>} */ (ev).detail?.role;
    // Cancel-button only — Esc/backdrop dismiss with role 'backdrop' and, as before,
    // do not fire onCancel.
    if (role === 'cancel') {
      try {
        onCancel?.();
      } catch (err) {
        console.error('[comma confirm] onCancel failed', err);
      }
    }
    alert.remove();
    if (trigger && typeof trigger.focus === 'function' && document.contains(trigger)) {
      try {
        trigger.focus();
      } catch {
        /* ignore */
      }
    }
  });

  document.body.appendChild(alert);
  void alert.present().then(() => {
    if (!gated) return;
    // Type-to-confirm parity: ion-alert is scoped (light DOM), so its input and buttons
    // are directly reachable for the disabled-until-match wiring.
    const input = alert.querySelector('input.alert-input');
    const confirmBtn = alert.querySelector('button.comma-alert-btn--confirm');
    if (input instanceof HTMLInputElement && confirmBtn instanceof HTMLButtonElement) {
      confirmBtn.disabled = true;
      confirmBtn.setAttribute('aria-disabled', 'true');
      input.addEventListener('input', () => {
        const matches = input.value === requireType;
        confirmBtn.disabled = !matches;
        if (matches) confirmBtn.removeAttribute('aria-disabled');
        else confirmBtn.setAttribute('aria-disabled', 'true');
      });
      try {
        input.focus({ preventScroll: true });
      } catch {
        /* ignore */
      }
    }
  });

  return {
    root: alert,
    backdrop: alert,
    body: alert,
    close: () => {
      void alert.dismiss();
    },
  };
}

/* ------------------------------------------------------------------------- */
/* COMMAToast                                                              */
/* ------------------------------------------------------------------------- */

/**
 * @typedef {'success' | 'error' | 'warning' | 'info' | 'celebration'} ToastType
 */

/**
 * @typedef {Object} ToastOptions
 * @property {string} message
 * @property {ToastType} [type]
 * @property {number} [duration] ms before auto-dismiss. 0 = sticky.
 * @property {() => void} [action] Click handler for the action button
 * @property {() => void} [onAction] Alias for `action` (both are used by callers)
 * @property {string} [actionLabel]
 */

const MAX_TOASTS = 3;
/** @type {{ root: HTMLElement, close: () => void }[]} */
const toastQueue = [];

/** ToastType → ion-toast color (celebration keeps its positive tone). */
const TOAST_COLOR_BY_TYPE = {
  success: 'success',
  error: 'danger',
  warning: 'warning',
  info: 'primary',
  celebration: 'success',
};

/**
 * ion-toast hosts overlap at the same position; lift older toasts so up to
 * MAX_TOASTS stay visible (parity with the old stacked toast host).
 */
function restackToasts() {
  for (let i = 0; i < toastQueue.length; i++) {
    const lift = toastQueue.length - 1 - i;
    toastQueue[i].root.style.setProperty('--comma-toast-lift', `${lift * 60}px`);
  }
}

/**
 * Show a transient toast notification, rendered through `ion-toast`.
 * Stacks up to 3 visible toasts.
 * @param {ToastOptions} opts
 * @returns {{ root: HTMLElement, close: () => void }}
 */
export function showToast(opts) {
  const { message, type = 'info', duration = 4000, action, onAction, actionLabel } = opts || {};
  const actionFn = typeof action === 'function' ? action : typeof onAction === 'function' ? onAction : null;

  const toast = /** @type {HTMLElement & { present: () => Promise<void>; dismiss: () => Promise<boolean> }} */ (
    document.createElement('ion-toast')
  );
  toast.classList.add('comma-toast', `comma-toast--${type}`);
  /** @type {any} */ (toast).color = TOAST_COLOR_BY_TYPE[type] || 'primary';
  /** @type {any} */ (toast).message = String(message ?? '');
  /** @type {any} */ (toast).duration = Number(duration) > 0 ? Number(duration) : 0; // 0 = sticky
  /** @type {any} */ (toast).position = 'bottom';
  /** @type {any} */ (toast).swipeGesture = 'vertical';

  const buttons = [];
  if (actionFn && actionLabel) {
    buttons.push({
      text: actionLabel,
      cssClass: 'comma-toast-action',
      handler: () => {
        try {
          actionFn();
        } catch (err) {
          console.error('[comma toast] action failed', err);
        }
        return true; // dismiss after the action, as before
      },
    });
  }
  buttons.push({ text: t('ui.toast.dismiss'), role: 'cancel', cssClass: 'comma-toast-close' });
  /** @type {any} */ (toast).buttons = buttons;

  const handle = {
    root: toast,
    close: () => {
      void toast.dismiss();
    },
  };

  toast.addEventListener('ionToastDidDismiss', () => {
    const idx = toastQueue.indexOf(handle);
    if (idx >= 0) toastQueue.splice(idx, 1);
    toast.remove();
    restackToasts();
  });

  document.body.appendChild(toast);
  while (toastQueue.length >= MAX_TOASTS) {
    const oldest = toastQueue.shift();
    if (oldest) oldest.close();
  }
  toastQueue.push(handle);
  restackToasts();
  void toast.present();

  return handle;
}

/**
 * @typedef {Object} NotifyAction
 * @property {string} label
 * @property {(close: () => void) => void} [onClick]
 * @property {string} [class]
 */

/**
 * @typedef {Object} NotifyCardOptions
 * @property {string} title
 * @property {string} [message]
 * @property {string} [icon] icons.js key (default `info`)
 * @property {NotifyAction[]} [actions]
 * @property {ToastType} [type]
 * @property {number} [duration] ms before auto-dismiss. 0 = sticky (default).
 */

/**
 * Show a richer "COMMANotify" card variant of a toast — supports title, message,
 * icon, and an actions row. Mounted into `#toast-container`. (Used by Phase 2
 * Features 195–207 notification triggers.)
 *
 * @param {NotifyCardOptions} opts
 * @returns {{ root: HTMLElement, close: () => void }}
 */
export function showNotifyCard(opts) {
  const { title, message = '', icon = 'info', actions = [], type = 'info', duration = 0 } = opts || {};
  const host = getToastHost();
  host.setAttribute('aria-live', type === 'error' || type === 'warning' ? 'assertive' : 'polite');
  host.setAttribute('aria-atomic', 'true');

  const root = document.createElement('div');
  root.className = `comma-notify comma-notify--${type}`;
  root.setAttribute('role', type === 'error' || type === 'warning' ? 'alert' : 'status');
  const titleId = `mn-title-${Math.random().toString(36).slice(2, 9)}`;
  root.setAttribute('aria-labelledby', titleId);

  root.innerHTML = `
    <span class="comma-notify-icon" aria-hidden="true">${getIcon(icon, 24, 'comma-notify-icon-svg')}</span>
    <div class="comma-notify-body">
      <h3 id="${titleId}" class="comma-notify-title"></h3>
      <p class="comma-notify-message"></p>
      <div class="comma-notify-actions"></div>
    </div>
    <button type="button" class="comma-notify-close" aria-label="${escapeAttr(t('ui.toast.dismiss'))}">${getIcon('x', 18, 'comma-notify-close-icon')}</button>
  `;
  const tEl = root.querySelector('.comma-notify-title');
  if (tEl) tEl.textContent = String(title ?? '');
  const mEl = root.querySelector('.comma-notify-message');
  if (mEl) {
    if (message) mEl.textContent = String(message);
    else mEl.remove();
  }

  const actionsHost = /** @type {HTMLElement} */ (root.querySelector('.comma-notify-actions'));
  if (actions.length === 0) actionsHost.remove();
  else {
    for (const a of actions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = a.class || 'btn btn-secondary btn-sm';
      btn.textContent = a.label;
      btn.addEventListener('click', () => {
        try {
          a.onClick?.(handle.close);
        } catch (err) {
          console.error('[comma notify] action failed', err);
        }
      });
      actionsHost.appendChild(btn);
    }
  }

  /** @type {ReturnType<typeof setTimeout> | null} */
  let timer = null;
  const handle = {
    root,
    close: () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      root.classList.remove('is-open');
      root.classList.add('is-closing');
      const finish = () => {
        if (root.parentElement) root.parentElement.removeChild(root);
      };
      if (reducedMotionEnabled()) finish();
      else setTimeout(finish, 200);
    },
  };

  root.querySelector('.comma-notify-close')?.addEventListener('click', () => handle.close());

  host.appendChild(root);
  if (!reducedMotionEnabled()) requestAnimationFrame(() => root.classList.add('is-open'));
  else root.classList.add('is-open');

  if (duration > 0) timer = setTimeout(() => handle.close(), duration);

  return handle;
}

/* ------------------------------------------------------------------------- */
/* FAB + speed-dial quick actions                                            */
/* ------------------------------------------------------------------------- */

/**
 * @typedef {Object} FabMenuItem
 * @property {string} id
 * @property {string} [labelKey] i18n key (passed to `t()`)
 * @property {string} [label] literal label (overrides labelKey)
 * @property {string} icon icon name for `getIcon`
 * @property {() => void} onSelect
 */

/**
 * @typedef {Object} FabOptions
 * @property {() => void} [onAdd] legacy single-tap when `addMenu` is empty
 * @property {() => void} [onEndShift]
 * @property {FabMenuItem[]} [addMenu] when non-empty, + opens a vertical speed dial
 */

/** @type {HTMLElement | null} */
let fabRootEl = null; // <ion-fab> host — comma fixes its position + hides it for the keyboard
/** @type {HTMLElement | null} */
let fabEl = null; // main <ion-fab-button> (keeps the legacy .comma-fab class for zen-mode CSS)
/** @type {HTMLDivElement | null} */
let fabBackdropEl = null;
/** @type {HTMLElement | null} */
let fabMenuEl = null; // <ion-fab-list> speed dial (legacy .comma-fab-menu class kept too)
/** @type {HTMLSpanElement | null} */
let fabLabelEl = null; // end-mode "End shift" chip — ion-fab-button clips slotted overflow
let fabState = /** @type {'add' | 'end'} */ ('add');
/** @type {FabOptions} */
let fabHandlers = {};
/** @type {FabMenuItem[]} */
let fabAddMenu = [];
let fabMenuOpen = false;
/** @type {((ev: KeyboardEvent) => void) | null} */
let fabMenuKeyHandler = null;

/** Mirror the speed-dial open state onto the backdrop, ARIA and the Escape handler. */
function syncFabMenuChrome(open) {
  fabMenuOpen = open;
  if (fabBackdropEl) {
    fabBackdropEl.hidden = !open;
    fabBackdropEl.setAttribute('aria-hidden', open ? 'false' : 'true');
  }
  if (fabEl && fabState === 'add') {
    fabEl.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  if (open) {
    if (typeof document !== 'undefined' && !fabMenuKeyHandler) {
      fabMenuKeyHandler = (ev) => {
        if (ev.key === 'Escape') {
          ev.preventDefault();
          closeFabMenu();
        }
      };
      document.addEventListener('keydown', fabMenuKeyHandler);
    }
  } else if (fabMenuKeyHandler && typeof document !== 'undefined') {
    document.removeEventListener('keydown', fabMenuKeyHandler);
    fabMenuKeyHandler = null;
  }
}

function closeFabMenu() {
  if (fabRootEl) /** @type {any} */ (fabRootEl).activated = false;
  syncFabMenuChrome(false);
}

/** The ion-fab-list takes part in ion-fab's own toggle only while the speed dial is usable. */
function syncFabList() {
  if (!fabRootEl || !fabMenuEl) return;
  const wanted = fabState === 'add' && fabAddMenu.length > 0;
  if (wanted && !fabMenuEl.isConnected) fabRootEl.appendChild(fabMenuEl);
  if (!wanted && fabMenuEl.isConnected) fabMenuEl.remove();
}

function rebuildFabMenu() {
  if (!fabMenuEl) return;
  fabMenuEl.textContent = '';
  for (let i = 0; i < fabAddMenu.length; i++) {
    const item = fabAddMenu[i];
    // Row = label chip + circular ion-fab-button. The label cannot be slotted into the
    // button (its shadow button is contain: strict and clips overflow), so it sits
    // beside it; the whole row is clickable.
    const row = document.createElement('div');
    row.className = 'comma-fab-menu-row';
    row.style.setProperty('--fab-i', String(i));
    const lab = item.label || (item.labelKey ? t(item.labelKey) : item.id);
    const labEl = document.createElement('span');
    labEl.className = 'comma-fab-menu-item-label';
    labEl.textContent = lab;
    const btn = document.createElement('ion-fab-button');
    btn.className = 'comma-fab-menu-item';
    btn.dataset.fabMenuItem = item.id;
    btn.setAttribute('role', 'menuitem');
    btn.setAttribute('aria-label', lab);
    btn.innerHTML = getIcon(item.icon, 20, 'comma-fab-menu-item-icon');
    row.appendChild(labEl);
    row.appendChild(btn);
    row.addEventListener('click', () => {
      closeFabMenu();
      try {
        item.onSelect?.();
      } catch (err) {
        console.error('[comma fab] menu item failed', err);
      }
    });
    fabMenuEl.appendChild(row);
  }
  syncFabList();
}

function applyFabMode(mode) {
  if (!fabEl) return;
  closeFabMenu();
  fabState = mode;
  if (mode === 'end') {
    fabEl.dataset.mode = 'end';
    fabEl.classList.add('comma-fab--end');
    fabEl.setAttribute('color', 'danger');
    fabEl.setAttribute('aria-label', t('ui.fab.endShift'));
    fabEl.removeAttribute('aria-haspopup');
    fabEl.setAttribute('aria-expanded', 'false');
    fabEl.innerHTML = getIcon('clock', 22, 'comma-fab-icon');
    // The visible label sits beside the button in the ion-fab's light DOM —
    // ion-fab-button's shadow button clips (contain: strict) anything slotted beyond 56px.
    if (fabRootEl) {
      if (!fabLabelEl) {
        fabLabelEl = document.createElement('span');
        fabLabelEl.className = 'comma-fab-label';
        fabLabelEl.setAttribute('aria-hidden', 'true'); // the button carries the accessible label
      }
      fabLabelEl.textContent = t('ui.fab.endShift');
      if (!fabLabelEl.isConnected) fabRootEl.appendChild(fabLabelEl);
    }
  } else {
    fabEl.dataset.mode = 'add';
    fabEl.classList.remove('comma-fab--end');
    fabEl.setAttribute('color', 'primary');
    if (fabLabelEl) fabLabelEl.remove();
    fabEl.setAttribute('aria-label', fabAddMenu.length ? t('ui.fab.openQuickActions') : t('ui.fab.addShift'));
    if (fabAddMenu.length) {
      fabEl.setAttribute('aria-haspopup', 'true');
      fabEl.setAttribute('aria-expanded', 'false');
      fabEl.setAttribute('aria-controls', 'comma-fab-menu');
    } else {
      fabEl.removeAttribute('aria-haspopup');
      fabEl.removeAttribute('aria-expanded');
      fabEl.removeAttribute('aria-controls');
    }
    fabEl.innerHTML = getIcon('plus', 22, 'comma-fab-icon');
  }
  syncFabList();
}

/** @param {MouseEvent} ev */
function fabOnClick(ev) {
  try {
    if (fabState === 'end') {
      // No ion-fab-list is attached in end mode, so ion-fab's own toggle is a no-op.
      closeFabMenu();
      fabHandlers.onEndShift?.();
    } else if (fabAddMenu.length) {
      // ion-fab-button's own click listener (a vdom Host prop, attached at first render —
      // i.e. AFTER this listener) runs fab.toggle() only after us, so reading `activated`
      // here would see the pre-toggle value. Take over the toggle instead: stop ion's
      // listener and flip `activated` ourselves, so the backdrop / Escape / aria chrome
      // always mirrors the real speed-dial state.
      ev.stopImmediatePropagation();
      const open = !(fabRootEl && /** @type {any} */ (fabRootEl).activated);
      if (fabRootEl) /** @type {any} */ (fabRootEl).activated = open;
      syncFabMenuChrome(open);
    } else {
      fabHandlers.onAdd?.();
    }
  } catch (err) {
    console.error('[comma fab] click handler failed', err);
  }
}

let fabKeyboardHandler = /** @type {(() => void) | null} */ (null);

function wireFabKeyboardVisibility() {
  if (typeof window === 'undefined') return;
  const vv = window.visualViewport;
  if (!vv) return;
  const onResize = () => {
    if (!fabRootEl) return;
    const ratio = vv.height / window.innerHeight;
    const keyboardOpen = ratio < 0.7;
    fabRootEl.classList.toggle('comma-fab--hidden', keyboardOpen);
    if (keyboardOpen) closeFabMenu();
  };
  vv.addEventListener('resize', onResize);
  fabKeyboardHandler = () => vv.removeEventListener('resize', onResize);
}

/**
 * Initialize the floating action button (ion-fab + ion-fab-button + ion-fab-list).
 * Idempotent — calling twice updates handlers.
 * @param {FabOptions} [opts]
 * @returns {{ setMode: (mode: 'add' | 'end') => void, destroy: () => void, element: HTMLElement }}
 */
export function initFAB(opts = {}) {
  fabHandlers = { ...fabHandlers, ...opts };
  fabAddMenu = Array.isArray(opts.addMenu) ? opts.addMenu : [];

  if (!fabEl) {

    fabBackdropEl = document.createElement('div');
    fabBackdropEl.className = 'comma-fab-backdrop';
    fabBackdropEl.hidden = true;
    fabBackdropEl.setAttribute('aria-hidden', 'true');
    fabBackdropEl.addEventListener('click', () => closeFabMenu());

    fabRootEl = document.createElement('ion-fab');
    fabRootEl.classList.add('comma-fab-root');

    fabMenuEl = document.createElement('ion-fab-list');
    fabMenuEl.id = 'comma-fab-menu';
    fabMenuEl.className = 'comma-fab-menu';
    fabMenuEl.setAttribute('side', 'top');
    fabMenuEl.setAttribute('role', 'menu');
    fabMenuEl.setAttribute('aria-label', t('ui.fab.quickActionsMenu'));

    fabEl = document.createElement('ion-fab-button');
    fabEl.id = 'comma-fab';
    fabEl.classList.add('comma-fab');
    fabEl.addEventListener('click', fabOnClick);

    fabRootEl.appendChild(fabEl);
    document.body.appendChild(fabBackdropEl);
    document.body.appendChild(fabRootEl);
    wireFabKeyboardVisibility();
  }

  rebuildFabMenu();

  const timer = store.get('activeShiftTimer');
  applyFabMode(timer ? 'end' : 'add');

  bus.on(SHIFT_TIMER_START, () => applyFabMode('end'));
  bus.on(SHIFT_TIMER_STOP, () => applyFabMode('add'));
  store.subscribe('activeShiftTimer', (v) => applyFabMode(v ? 'end' : 'add'));

  return {
    setMode: (mode) => applyFabMode(mode),
    destroy: () => {
      closeFabMenu();
      if (fabBackdropEl && fabBackdropEl.parentElement) fabBackdropEl.parentElement.removeChild(fabBackdropEl);
      if (fabRootEl && fabRootEl.parentElement) fabRootEl.parentElement.removeChild(fabRootEl);
      fabBackdropEl = null;
      fabMenuEl = null;
      fabEl = null;
      fabRootEl = null;
      fabLabelEl = null;
      fabAddMenu = [];
      if (fabKeyboardHandler) {
        fabKeyboardHandler();
        fabKeyboardHandler = null;
      }
    },
    element: fabEl,
  };
}

/* ------------------------------------------------------------------------- */
/* Bottom drawer                                                             */
/* ------------------------------------------------------------------------- */

/**
 * @typedef {Object} DrawerOptions
 * @property {string} [title]
 * @property {string | Node} [content]
 * @property {() => void} [onClose]
 * @property {number[]} [snapPoints] Vh fractions, e.g. [0.5, 0.9]. Default [0.5, 0.9].
 * @property {boolean} [dismissible] Default true.
 */

/**
 * @typedef {Object} DrawerHandle
 * @property {HTMLElement} root The `ion-modal` sheet host
 * @property {HTMLElement} panel The `.comma-drawer-panel` content host (light DOM)
 * @property {HTMLElement} body Content slot inside the panel
 * @property {(snap: number) => void} setSnap Snaps to the nearest configured snap point
 * @property {() => void} close
 */

/**
 * Open a bottom drawer, rendered as an `ion-modal` sheet. Drag handle, snap
 * breakpoints, swipe-down / backdrop / Escape dismissal are Ionic's.
 * @param {DrawerOptions} [opts]
 * @returns {DrawerHandle}
 */
export function showDrawer(opts = {}) {
  const { title = '', content = '', onClose, snapPoints = [0.5, 0.9], dismissible = true } = opts;

  const trigger = /** @type {HTMLElement | null} */ (document.activeElement);

  const points = (Array.isArray(snapPoints) && snapPoints.length > 0 ? snapPoints : [0.5, 0.9]).map((p) =>
    Math.min(0.95, Math.max(0.2, Number(p) || 0.5)),
  );

  const modal = /** @type {HTMLElement & { present: () => Promise<void>; dismiss: () => Promise<boolean>; setCurrentBreakpoint?: (bp: number) => Promise<void> }} */ (
    document.createElement('ion-modal')
  );
  modal.classList.add('comma-drawer');
  applySheetPresentation(modal, [0, ...points], points[0]);
  if (!dismissible) {
    /** @type {any} */ (modal).backdropDismiss = false;
    // Block swipe-down and backdrop dismissal; programmatic close() still works.
    /** @type {any} */ (modal).canDismiss = (_data, role) => role !== 'gesture' && role !== 'backdrop';
  }

  const panel = document.createElement('div');
  panel.className = 'comma-drawer-panel';
  if (title) panel.setAttribute('aria-label', title);

  panel.innerHTML = `
    <div class="comma-drawer-header" ${title ? '' : 'hidden'}>
      <h2 class="comma-drawer-title">${escapeHtml(title)}</h2>
      <button type="button" class="comma-drawer-close" aria-label="${escapeAttr(t('ui.drawer.close'))}">${getIcon('x', 16, 'comma-drawer-close-icon')}</button>
    </div>
    <div class="comma-drawer-body"></div>
  `;
  const body = /** @type {HTMLElement} */ (panel.querySelector('.comma-drawer-body'));
  if (content instanceof Node) body.appendChild(content);
  else if (typeof content === 'string') body.innerHTML = content;

  modal.appendChild(panel);

  /** @type {DrawerHandle} */
  const handle = {
    root: modal,
    panel,
    body,
    setSnap(snap) {
      const v = Math.min(0.95, Math.max(0.2, Number(snap) || 0.5));
      // ion-modal only accepts breakpoints it was created with — snap to the nearest.
      const nearest = points.reduce((best, p) => (Math.abs(p - v) < Math.abs(best - v) ? p : best), points[0]);
      if (typeof modal.setCurrentBreakpoint === 'function') void modal.setCurrentBreakpoint(nearest);
    },
    close: () => {
      void modal.dismiss();
    },
  };

  panel.querySelector('.comma-drawer-close')?.addEventListener('click', () => handle.close());

  modal.addEventListener('ionModalDidDismiss', () => {
    modal.remove();
    try {
      onClose?.();
    } catch (err) {
      console.error('[comma drawer] onClose failed', err);
    }
    if (trigger && typeof trigger.focus === 'function' && document.contains(trigger)) {
      try {
        trigger.focus();
      } catch {
        /* ignore */
      }
    }
  });

  document.body.appendChild(modal);
  void modal.present().then(() => {
    const focusable = getFocusableElements(panel);
    if (focusable[0]) {
      try {
        focusable[0].focus({ preventScroll: true });
      } catch {
        /* ignore */
      }
    }
  });

  return handle;
}

/* ------------------------------------------------------------------------- */
/* Progress ring                                                             */
/* ------------------------------------------------------------------------- */

/**
 * @typedef {Object} ProgressRingOptions
 * @property {number} value Numerator
 * @property {number} max Denominator (defaults 100)
 * @property {number} [size] px diameter (default 64)
 * @property {number} [strokeWidth] (default 6)
 * @property {string} [color] CSS color (default `var(--color-brand)`)
 * @property {string} [label] short label inside the ring
 * @property {string} [ariaLabel]
 * @property {boolean} [animated] Apply ring-fill animation (default true)
 */

/**
 * Render a circular progress ring as HTML.
 * @param {ProgressRingOptions} opts
 * @returns {string}
 */
export function renderProgressRing(opts) {
  const {
    value = 0,
    max = 100,
    size = 64,
    strokeWidth = 6,
    color = 'var(--color-brand)',
    label = '',
    ariaLabel,
    animated = true,
  } = opts || {};
  const safeMax = Math.max(1, Number(max) || 100);
  const safeValue = Math.max(0, Math.min(safeMax, Number(value) || 0));
  const pct = Math.round((safeValue / safeMax) * 100);
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const aria = escapeAttr(ariaLabel || label || t('ui.progressRing.label'));
  const animatedClass = animated ? 'progress-ring--animated' : '';
  return `
    <div class="comma-progress-ring ${animatedClass}" style="--ring-color:${escapeAttr(color)};--ring-size:${size}px" role="progressbar" aria-valuenow="${escapeAttr(String(safeValue))}" aria-valuemin="0" aria-valuemax="${escapeAttr(String(safeMax))}" aria-valuetext="${escapeAttr(String(pct) + '%')}" aria-label="${aria}">
      <svg class="progress-ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
        <circle class="progress-ring-bg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${strokeWidth}"></circle>
        <circle class="progress-ring-fill" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${strokeWidth}"
          stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"></circle>
      </svg>
      <span class="comma-progress-ring-label">${escapeHtml(label || pct + '%')}</span>
    </div>
  `;
}

/* ------------------------------------------------------------------------- */
/* Skeleton loader                                                           */
/* ------------------------------------------------------------------------- */

/**
 * @param {'card' | 'list-item' | 'stat' | 'chart' | 'text'} [shape]
 * @returns {string}
 */
export function renderSkeleton(shape = 'card') {
  const label = escapeAttr(t('ui.skeleton.loading'));
  switch (shape) {
    case 'list-item':
      return `
        <div class="comma-skeleton comma-skeleton--list-item" role="status" aria-label="${label}">
          <span class="skeleton comma-skeleton-avatar"></span>
          <span class="comma-skeleton-lines">
            <span class="skeleton comma-skeleton-line comma-skeleton-line--lg"></span>
            <span class="skeleton comma-skeleton-line comma-skeleton-line--sm"></span>
          </span>
        </div>`;
    case 'stat':
      return `
        <div class="comma-skeleton comma-skeleton--stat card" role="status" aria-label="${label}">
          <span class="skeleton comma-skeleton-line comma-skeleton-line--sm"></span>
          <span class="skeleton comma-skeleton-value"></span>
        </div>`;
    case 'chart':
      return `
        <div class="comma-skeleton comma-skeleton--chart card" role="status" aria-label="${label}">
          <span class="skeleton comma-skeleton-chart-body"></span>
        </div>`;
    case 'text':
      return `
        <div class="comma-skeleton comma-skeleton--text" role="status" aria-label="${label}">
          <span class="skeleton comma-skeleton-line comma-skeleton-line--lg"></span>
          <span class="skeleton comma-skeleton-line comma-skeleton-line--md"></span>
          <span class="skeleton comma-skeleton-line comma-skeleton-line--sm"></span>
        </div>`;
    case 'card':
    default:
      return `
        <div class="comma-skeleton comma-skeleton--card card" role="status" aria-label="${label}">
          <span class="skeleton comma-skeleton-line comma-skeleton-line--lg"></span>
          <span class="skeleton comma-skeleton-line comma-skeleton-line--md"></span>
          <span class="skeleton comma-skeleton-line comma-skeleton-line--sm"></span>
        </div>`;
  }
}

/* ------------------------------------------------------------------------- */
/* Empty state                                                               */
/* ------------------------------------------------------------------------- */

/**
 * @typedef {Object} EmptyStateOptions
 * @property {string} [icon] icons.js key (default `info`)
 * @property {string} [title]
 * @property {string} [message]
 * @property {string} [action] hash route or arbitrary URL
 * @property {string} [actionLabel]
 * @property {string} [actionAttr] e.g. `data-action="open-form"` for delegated handlers
 */

/**
 * Render an empty-state block used by lists, dashboards, etc.
 * @param {EmptyStateOptions} [opts]
 * @returns {string}
 */
export function renderEmptyState(opts = {}) {
  const {
    icon = 'info',
    title = t('ui.emptyState.defaultTitle'),
    message = t('ui.emptyState.defaultMessage'),
    action,
    actionLabel,
    actionAttr,
  } = opts;
  const iconHtml = getIcon(icon, 36, 'comma-empty-state-icon');
  let actionHtml = '';
  if (action && actionLabel) {
    if (action.startsWith('#') || /^https?:/i.test(action)) {
      actionHtml = `<a class="btn btn-primary" href="${escapeAttr(action)}">${escapeHtml(actionLabel)}</a>`;
    } else {
      actionHtml = `<button type="button" class="btn btn-primary" ${actionAttr ? actionAttr : `data-empty-action="${escapeAttr(action)}"`}>${escapeHtml(actionLabel)}</button>`;
    }
  } else if (actionLabel && actionAttr) {
    actionHtml = `<button type="button" class="btn btn-primary" ${actionAttr}>${escapeHtml(actionLabel)}</button>`;
  }
  return `
    <div class="empty-state comma-empty-state">
      <span class="comma-empty-state-icon-wrap" aria-hidden="true">${iconHtml}</span>
      <h3 class="comma-empty-state-title">${escapeHtml(title)}</h3>
      ${message ? `<p class="comma-empty-state-message">${escapeHtml(message)}</p>` : ''}
      ${actionHtml}
    </div>
  `;
}

/* ------------------------------------------------------------------------- */
/* Numeric keypad                                                            */
/* ------------------------------------------------------------------------- */

/**
 * @typedef {Object} KeypadOptions
 * @property {string | number} [value] initial value
 * @property {string} [currency] currency symbol prefix (e.g. `$`)
 * @property {string} [title]
 * @property {(value: string) => void} [onConfirm]
 * @property {() => void} [onCancel]
 * @property {boolean} [allowDecimal]
 */

/**
 * Large tap-friendly numeric keypad overlay for amount entry (Feature 36).
 * Built as a small modal.
 * @param {KeypadOptions} [opts]
 * @returns {ModalHandle}
 */
export function showNumericKeypad(opts = {}) {
  const {
    value = '',
    currency = '',
    title = t('ui.keypad.title'),
    onConfirm,
    onCancel,
    allowDecimal = true,
  } = opts;

  let buffer = String(value ?? '').replace(/[^0-9.]/g, '');

  const wrap = document.createElement('div');
  wrap.className = 'comma-keypad';
  wrap.innerHTML = `
    <div class="comma-keypad-display" aria-live="polite">
      <span class="comma-keypad-currency" aria-hidden="true">${escapeHtml(currency)}</span>
      <span class="comma-keypad-value" data-keypad-value></span>
    </div>
    <div class="comma-keypad-grid" role="group" aria-label="${escapeAttr(title)}">
      ${['1', '2', '3', '4', '5', '6', '7', '8', '9']
        .map((n) => `<button type="button" class="comma-keypad-key" data-key="${n}">${n}</button>`) 
        .join('')}
      <button type="button" class="comma-keypad-key comma-keypad-key--util" data-key="clear" aria-label="${escapeAttr(t('ui.keypad.clear'))}">${getIcon('x', 18)}</button>
      <button type="button" class="comma-keypad-key" data-key="0">0</button>
      <button type="button" class="comma-keypad-key comma-keypad-key--util" data-key="back" aria-label="${escapeAttr(t('ui.keypad.backspace'))}">${getIcon('arrow-right', 18, 'comma-keypad-back-icon')}</button>
      ${allowDecimal ? '<button type="button" class="comma-keypad-key comma-keypad-key--util" data-key=".">.</button>' : ''}
    </div>
  `;

  function updateDisplay() {
    const dEl = wrap.querySelector('[data-keypad-value]');
    if (dEl) dEl.textContent = buffer || '0';
  }
  updateDisplay();

  wrap.addEventListener('click', (e) => {
    const target = /** @type {HTMLElement | null} */ (e.target instanceof Element ? e.target.closest('[data-key]') : null);
    if (!target) return;
    const k = target.getAttribute('data-key');
    if (!k) return;
    if (k === 'clear') buffer = '';
    else if (k === 'back') buffer = buffer.slice(0, -1);
    else if (k === '.') {
      if (allowDecimal && !buffer.includes('.')) buffer = (buffer || '0') + '.';
    } else if (/^[0-9]$/.test(k)) {
      buffer = buffer + k;
    }
    updateDisplay();
  });

  const handle = showModal({
    title,
    content: wrap,
    size: 'sm',
    role: 'dialog',
    actions: [
      {
        label: t('common.cancel'),
        class: 'btn btn-secondary',
        onClick: () => {
          try {
            onCancel?.();
          } catch (err) {
            console.error('[comma keypad] onCancel failed', err);
          }
        },
      },
      {
        label: t('ui.keypad.confirm'),
        class: 'btn btn-primary',
        autofocus: true,
        onClick: () => {
          try {
            onConfirm?.(buffer);
          } catch (err) {
            console.error('[comma keypad] onConfirm failed', err);
          }
        },
      },
    ],
  });
  return handle;
}

/* ------------------------------------------------------------------------- */
/* Platform color + badge                                                    */
/* ------------------------------------------------------------------------- */

/** CSS theme tokens exist per catalog id — keep in sync via PlatformRegistry (Category A). */
const KNOWN_PLATFORMS = new Set(PlatformRegistry.getAll().map((p) => String(p.id || '').toLowerCase()));

/**
 * Resolve a CSS color reference for a given platform id. Falls back to brand.
 * @param {string} platformId
 * @returns {string}
 */
export function getPlatformColor(platformId) {
  const id = String(platformId || '').toLowerCase();
  if (KNOWN_PLATFORMS.has(id)) return `var(--color-${id})`;
  return 'var(--color-brand)';
}

/**
 * Inline SVG from the bundled platform catalog only (trusted). Empty if missing.
 * End users do not supply SVG in Settings — logos are defined in registry modules.
 * @param {string} platformId
 * @returns {string}
 */
export function resolvePlatformLogoHtml(platformId) {
  const id = String(platformId || '').toLowerCase();
  const def = PlatformRegistry.getById(id);
  const logo = def && typeof def.logo === 'string' ? def.logo.trim() : '';
  return logo;
}

/**
 * Render a small badge with the platform brand color.
 * @param {string} platformId
 * @param {string} [label]
 * @returns {string}
 */
export function renderPlatformBadge(platformId, label) {
  const id = String(platformId || '').toLowerCase();
  const color = getPlatformColor(id);
  const lbl = typeof label === 'string' && label.length > 0 ? label : id || t('app.platformAll');
  const logo = resolvePlatformLogoHtml(id);
  if (!logo) {
    return `<span class="badge badge-platform" style="--platform-color:${escapeAttr(color)}" data-platform-id="${escapeAttr(id)}">${escapeHtml(lbl)}</span>`;
  }
  return `<span class="badge badge-platform badge-platform--has-logo" role="img" aria-label="${escapeAttr(lbl)}" style="--platform-color:${escapeAttr(color)}" data-platform-id="${escapeAttr(id)}"><span class="badge-platform-logo" aria-hidden="true">${logo}</span><span class="badge-platform-label">${escapeHtml(lbl)}</span></span>`;
}

/* ------------------------------------------------------------------------- */
/* Date Pickers                                                              */
/* ------------------------------------------------------------------------- */

/**
 * Attaches Flatpickr to any `<input type="date">` element within the given root.
 * Ensures the app uses the custom calendar library consistently everywhere.
 * @param {HTMLElement | Document} root
 */
export function initDatePickers(root) {
  if (!window.flatpickr) return;
  const inputs = root.querySelectorAll('input[type="date"]');
  for (const input of inputs) {
    if (!input._fp) {
      input._fp = window.flatpickr(input, {
        dateFormat: 'Y-m-d',
        disableMobile: true, // Forces Flatpickr custom UI over native on all devices
        onChange: function (selectedDates, dateStr, instance) {
          input.value = dateStr;
          // Trigger native events so app routing/state controllers pick up the change
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      // Flatpickr usually converts to 'text' if needed but let's ensure styling remains consistent:
      input.classList.add('flatpickr-input-upgraded');
      input.style.cursor = 'pointer';
    }
  }
}

