import { db } from '../core/db.js';
import { bus, NAVIGATION, PLATFORM_CHANGED } from '../core/events.js';
import { getIcon } from '../ui/icons.js';
import { markNotificationRead, dismissNotification } from '../modules/notifications/notifications.js';

/** @type {WeakMap<HTMLElement, () => void>} */
const teardownByRoot = new WeakMap();

function isNotificationsRouteHash(h) {
  return h === '#/notifications' || h.startsWith('#/notifications/');
}

function escapeAttr(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function escapeHtml(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Icon + tone for a notification row — the same type→icon mapping this screen always had
 * (goal/best → trophy, risk/due/expiry → warning triangle, summary → calendar).
 * @param {Record<string, unknown>} item
 * @returns {{ icon: string, tone: 'brand' | 'warning' | 'danger' }}
 */
function notificationIconMeta(item) {
  const type = typeof item.type === 'string' ? item.type : '';
  if (type.includes('goal') || type.includes('best')) return { icon: 'trophy', tone: 'warning' };
  if (type.includes('risk') || type.includes('due') || type.includes('expiry')) {
    return { icon: 'alert-triangle', tone: 'danger' };
  }
  if (type.includes('summary')) return { icon: 'calendar', tone: 'brand' };
  return { icon: 'info', tone: 'brand' };
}

/** @param {Record<string, unknown>} item */
function notificationDateLabel(item) {
  return new Date(String(item.createdAt)).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * One notification row. The card rides inside an ion-item-sliding so touch users swipe left
 * for Mark Read / Dismiss (the in-card buttons stay for mouse users and are hidden on coarse
 * pointers in notifications.css). data-notification-id lives on the sliding host so the click
 * delegation resolves the id for swipe-option taps too.
 * @param {Record<string, unknown>} item
 */
function notificationCardHtml(item) {
  const { icon, tone } = notificationIconMeta(item);
  const unread = !item.read;
  const canDismiss = !item.dismissed;

  const cardButtons = [
    unread ? `<ion-button size="small" data-action="read">${getIcon('check', 14)}Mark Read</ion-button>` : '',
    canDismiss ? `<ion-button size="small" fill="outline" data-action="dismiss">${getIcon('x', 14)}Dismiss</ion-button>` : '',
  ].join('');

  const options = [
    unread ? '<ion-item-option color="medium" data-action="read">Mark Read</ion-item-option>' : '',
    canDismiss ? '<ion-item-option color="danger" data-action="dismiss">Dismiss</ion-item-option>' : '',
  ].join('');

  return `
    <ion-item-sliding class="notif-sliding" data-notification-id="${escapeAttr(String(item.id))}">
      <ion-item class="notif-ion-item" lines="none">
        <article class="notification-card${unread ? ' is-unread' : ''}">
          <div class="notification-card-icon notification-card-icon--${tone}">${getIcon(icon, 24)}</div>
          <div class="notification-card-body">
            <div class="notification-card-head">
              <h4 class="notification-card-title">
                ${escapeHtml(item.title)}
                ${unread ? '<ion-badge class="notif-unread-dot" aria-label="Unread"></ion-badge>' : ''}
              </h4>
              <span class="notification-card-date">${escapeHtml(notificationDateLabel(item))}</span>
            </div>
            <p class="notification-card-message">${escapeHtml(item.message)}</p>
            ${cardButtons ? `<div class="notification-card-actions">${cardButtons}</div>` : ''}
          </div>
        </article>
      </ion-item>
      ${options ? `<ion-item-options side="end">${options}</ion-item-options>` : ''}
    </ion-item-sliding>
  `;
}

/** @param {string} tab */
function emptyStateHtml(tab) {
  const msg =
    tab === 'unread'
      ? "You don't have any unread alerts. Great job staying on top of things!"
      : 'No notifications in this view.';
  return `
    <div class="notifications-empty">
      <div class="notifications-empty-icon">${getIcon('bell', 36)}</div>
      <div>
        <h3 class="notifications-empty-title">No notifications found</h3>
        <p class="notifications-empty-msg">${escapeHtml(msg)}</p>
      </div>
    </div>
  `;
}

/**
 * Paints the notifications screen into `root` and returns its destroy function. The data flow
 * (Dexie query, throttle-key filter, read/dismiss actions, `notification:unread-change` bus
 * wiring) is unchanged from the previous renderer — only the presentation moved to Ionic
 * components (ion-segment tabs, ion-badge counts, ion-item-sliding rows, ion-button actions).
 * @param {HTMLElement} root
 * @returns {Promise<() => void>}
 */
async function renderNotificationsScreen(root) {
  root.textContent = '';
  root.className = 'notifications-view-container';

  const container = document.createElement('div');
  container.className = 'notifications-page';
  container.innerHTML = `
    <header class="notifications-header">
      <div class="notifications-title-box">
        <div class="notifications-title-icon">${getIcon('bell', 28)}</div>
        <div>
          <h1 class="notifications-title">Notifications</h1>
          <p class="notifications-subtitle">Stay updated with system alerts, goal tracking, and vault reminders.</p>
        </div>
      </div>
      <div class="notifications-actions" data-slot="actions"></div>
    </header>
    <div class="notifications-controls">
      <ion-segment value="all" data-notif-segment>
        <ion-segment-button value="all">
          <ion-label>All <ion-badge data-slot="count-all">0</ion-badge></ion-label>
        </ion-segment-button>
        <ion-segment-button value="unread">
          <ion-label>Unread <ion-badge data-slot="count-unread">0</ion-badge></ion-label>
        </ion-segment-button>
        <ion-segment-button value="dismissed">
          <ion-label>Archive <ion-badge data-slot="count-dismissed">0</ion-badge></ion-label>
        </ion-segment-button>
      </ion-segment>
    </div>
    <div class="notifications-list" data-slot="list">
      <div class="notif-skel-list">
        ${Array.from({ length: 3 }, () => `
          <div class="notif-skel">
            <ion-skeleton-text animated style="width: 42%; height: 16px;"></ion-skeleton-text>
            <ion-skeleton-text animated style="width: 88%; height: 14px;"></ion-skeleton-text>
            <ion-skeleton-text animated style="width: 30%; height: 12px;"></ion-skeleton-text>
          </div>`).join('')}
      </div>
    </div>
  `;
  root.appendChild(container);

  const listSlot = /** @type {HTMLElement | null} */ (container.querySelector('[data-slot="list"]'));
  const actionsSlot = /** @type {HTMLElement | null} */ (container.querySelector('[data-slot="actions"]'));
  const segmentEl = /** @type {HTMLElement | null} */ (container.querySelector('[data-notif-segment]'));
  const countAllEl = /** @type {HTMLElement | null} */ (container.querySelector('[data-slot="count-all"]'));
  const countUnreadEl = /** @type {HTMLElement | null} */ (container.querySelector('[data-slot="count-unread"]'));
  const countDismissedEl = /** @type {HTMLElement | null} */ (container.querySelector('[data-slot="count-dismissed"]'));

  let currentTab = 'all'; // 'all', 'unread', 'dismissed'
  /** @type {Array<Record<string, unknown>>} */
  let lastAll = [];

  async function loadNotifications() {
    const rawItems = await db.notifications.orderBy('createdAt').reverse().toArray();
    // Filter out internal system throttle keys which lack titles/messages
    const all = rawItems.filter((n) => !String(n.id).startsWith('notif:throttle:'));
    lastAll = all;
    const activeCount = all.filter((n) => !n.dismissed).length;
    const unreadCount = all.filter((n) => !n.read && !n.dismissed).length;
    const dismissedCount = all.filter((n) => n.dismissed).length;

    if (actionsSlot) {
      actionsSlot.innerHTML = [
        unreadCount > 0
          ? `<ion-button size="small" fill="outline" data-action="mark-all">${getIcon('check', 16)}Mark all as read</ion-button>`
          : '',
        dismissedCount > 0
          ? `<ion-button size="small" fill="clear" data-action="clear-history">${getIcon('trash', 16)}Clear history</ion-button>`
          : '',
      ].join('');
    }

    if (countAllEl) countAllEl.textContent = String(activeCount);
    if (countUnreadEl) countUnreadEl.textContent = String(unreadCount);
    if (countDismissedEl) countDismissedEl.textContent = String(dismissedCount);

    // Filter items
    let items = all.filter((n) => !n.dismissed);
    if (currentTab === 'unread') {
      items = all.filter((n) => !n.read && !n.dismissed);
    } else if (currentTab === 'dismissed') {
      items = all.filter((n) => n.dismissed);
    }

    if (!listSlot) return;
    if (items.length === 0) {
      listSlot.innerHTML = emptyStateHtml(currentTab);
      return;
    }
    listSlot.innerHTML = items.map((item) => notificationCardHtml(item)).join('');
  }

  const onSegmentChange = (e) => {
    const detail = /** @type {{ value?: unknown } | null} */ (/** @type {CustomEvent} */ (e).detail);
    const v = String(detail?.value ?? 'all');
    currentTab = v === 'unread' || v === 'dismissed' ? v : 'all';
    void loadNotifications();
  };
  if (segmentEl) segmentEl.addEventListener('ionChange', onSegmentChange);

  const onClick = async (e) => {
    const tEl = /** @type {HTMLElement | null} */ (
      e.target && /** @type {HTMLElement} */ (e.target).closest('[data-action]')
    );
    if (!tEl || !container.contains(tEl)) return;
    const action = tEl.getAttribute('data-action');

    // Swipe-action taps come from inside an open ion-item-sliding — snap it shut before acting.
    const slider = /** @type {{ close?: () => Promise<void> } | null} */ (tEl.closest('ion-item-sliding'));
    if (slider && typeof slider.close === 'function') void slider.close();

    if (action === 'mark-all') {
      const unreads = lastAll.filter((n) => !n.read && !n.dismissed);
      for (const u of unreads) {
        await markNotificationRead(String(u.id));
      }
      await loadNotifications();
      return;
    }

    if (action === 'clear-history') {
      const dismissed = lastAll.filter((n) => n.dismissed);
      for (const d of dismissed) {
        await db.notifications.delete(d.id);
      }
      bus.emit('notification:unread-change');
      await loadNotifications();
      return;
    }

    if (action === 'read' || action === 'dismiss') {
      const host = /** @type {HTMLElement | null} */ (tEl.closest('[data-notification-id]'));
      const id = host ? host.getAttribute('data-notification-id') : null;
      if (!id) return;
      if (action === 'read') {
        await markNotificationRead(id);
      } else {
        await dismissNotification(id);
      }
      await loadNotifications();
    }
  };
  container.addEventListener('click', onClick);

  await loadNotifications();

  const unsub = bus.on('notification:unread-change', () => {
    void loadNotifications();
  });

  return () => {
    unsub();
  };
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
    destroyView = await renderNotificationsScreen(root);
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
