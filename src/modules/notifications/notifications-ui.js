import { db } from '../../core/db.js';
import { bus } from '../../core/events.js';
import { getIcon } from '../../ui/icons.js';
import { markNotificationRead, dismissNotification } from './notifications.js';

export async function renderNotificationsView(root) {
  root.textContent = '';
  root.className = 'notifications-view-container';

  const container = document.createElement('div');
  container.className = 'notifications-page';
  container.style.cssText = `
    max-width: 800px;
    margin: 0 auto;
    padding: var(--space-6) var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  `;

  // Header section
  const headerEl = document.createElement('div');
  headerEl.className = 'notifications-header';
  headerEl.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-4);
    border-bottom: 1px solid var(--color-border);
    padding-bottom: var(--space-4);
  `;

  const titleBox = document.createElement('div');
  titleBox.style.cssText = `
    display: flex;
    align-items: center;
    gap: var(--space-3);
  `;
  titleBox.innerHTML = `
    <div style="background: color-mix(in srgb, var(--color-brand) 15%, transparent); color: var(--color-brand); padding: var(--space-3); border-radius: var(--radius-lg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px color-mix(in srgb, var(--color-brand) 10%, transparent);">
      ${getIcon('bell', 28)}
    </div>
    <div>
      <h1 style="font-size: var(--text-2xl); font-weight: 800; color: var(--color-text); margin: 0; letter-spacing: -0.03em;">Notifications</h1>
      <p style="font-size: var(--text-sm); color: var(--color-text-muted); margin: var(--space-1) 0 0 0;">Stay updated with system alerts, goal tracking, and vault reminders.</p>
    </div>
  `;

  const actionsBox = document.createElement('div');
  actionsBox.style.cssText = `
    display: flex;
    align-items: center;
    gap: var(--space-2);
  `;

  headerEl.appendChild(titleBox);
  headerEl.appendChild(actionsBox);
  container.appendChild(headerEl);

  // Filter tabs & list container
  const controlsEl = document.createElement('div');
  controlsEl.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-4);
  `;

  const tabsBox = document.createElement('div');
  tabsBox.className = 'comma-button-group';
  tabsBox.style.cssText = `
    display: flex;
    background: var(--color-surface);
    padding: var(--space-1);
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border);
    gap: var(--space-1);
  `;

  let currentTab = 'all'; // 'all', 'unread', 'dismissed'

  const listContainer = document.createElement('div');
  listContainer.className = 'notifications-list';
  listContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  `;

  container.appendChild(controlsEl);
  container.appendChild(listContainer);
  root.appendChild(container);

  async function loadNotifications() {
    const rawItems = await db.notifications.orderBy('createdAt').reverse().toArray();
    // Filter out internal system throttle keys which lack titles/messages
    const all = rawItems.filter(n => !n.id.startsWith('notif:throttle:'));
    const unreadCount = all.filter((n) => !n.read && !n.dismissed).length;

    // Update actions box
    actionsBox.innerHTML = '';
    if (unreadCount > 0) {
      const markAllBtn = document.createElement('button');
      markAllBtn.type = 'button';
      markAllBtn.className = 'btn btn-secondary btn-sm';
      markAllBtn.innerHTML = `${getIcon('check', 16)} Mark all as read`;
      markAllBtn.addEventListener('click', async () => {
        const unreads = all.filter((n) => !n.read && !n.dismissed);
        for (const u of unreads) {
          await markNotificationRead(u.id);
        }
        await loadNotifications();
      });
      actionsBox.appendChild(markAllBtn);
    }

    const dismissedCount = all.filter((n) => n.dismissed).length;
    if (dismissedCount > 0) {
      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'btn btn-ghost btn-sm';
      clearBtn.innerHTML = `${getIcon('trash', 16)} Clear history`;
      clearBtn.addEventListener('click', async () => {
        const dismissed = all.filter((n) => n.dismissed);
        for (const d of dismissed) {
          await db.notifications.delete(d.id);
        }
        bus.emit('notification:unread-change');
        await loadNotifications();
      });
      actionsBox.appendChild(clearBtn);
    }

    // Update tabs
    tabsBox.innerHTML = `
      <button type="button" class="btn ${currentTab === 'all' ? 'btn-primary' : 'btn-ghost'} btn-sm" data-tab="all">
        All (${all.filter((n) => !n.dismissed).length})
      </button>
      <button type="button" class="btn ${currentTab === 'unread' ? 'btn-primary' : 'btn-ghost'} btn-sm" data-tab="unread">
        Unread (${unreadCount})
      </button>
      <button type="button" class="btn ${currentTab === 'dismissed' ? 'btn-primary' : 'btn-ghost'} btn-sm" data-tab="dismissed">
        Archive (${dismissedCount})
      </button>
    `;

    tabsBox.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentTab = btn.getAttribute('data-tab') || 'all';
        loadNotifications();
      });
    });
    controlsEl.innerHTML = '';
    controlsEl.appendChild(tabsBox);

    // Filter items
    let items = all;
    if (currentTab === 'unread') {
      items = all.filter((n) => !n.read && !n.dismissed);
    } else if (currentTab === 'dismissed') {
      items = all.filter((n) => n.dismissed);
    } else {
      items = all.filter((n) => !n.dismissed);
    }

    listContainer.innerHTML = '';

    if (items.length === 0) {
      listContainer.innerHTML = `
        <div style="padding: var(--space-12) var(--space-6); text-align: center; background: var(--color-surface); border-radius: var(--radius-xl); border: 1px dashed var(--color-border); display: flex; flex-direction: column; align-items: center; gap: var(--space-4);">
          <div style="background: color-mix(in srgb, var(--color-text-muted) 10%, transparent); color: var(--color-text-muted); padding: var(--space-6); border-radius: 50%;">
            ${getIcon('bell', 36)}
          </div>
          <div>
            <h3 style="font-size: var(--text-lg); font-weight: 700; color: var(--color-text); margin: 0;">No notifications found</h3>
            <p style="font-size: var(--text-sm); color: var(--color-text-muted); margin: var(--space-1) 0 0 0; max-width: 300px;">
              ${currentTab === 'unread' ? "You don't have any unread alerts. Great job staying on top of things!" : "No notifications in this view."}
            </p>
          </div>
        </div>
      `;
      return;
    }

    items.forEach((item) => {
      const card = document.createElement('div');
      card.className = `notification-card ${!item.read ? 'is-unread' : ''}`;
      card.style.cssText = `
        background: var(--color-surface);
        border-radius: var(--radius-xl);
        border: 1px solid ${!item.read ? 'var(--color-brand)' : 'var(--color-border)'};
        padding: var(--space-4) var(--space-5);
        display: flex;
        align-items: flex-start;
        gap: var(--space-4);
        transition: all 0.2s ease;
        box-shadow: ${!item.read ? '0 4px 20px color-mix(in srgb, var(--color-brand) 10%, transparent)' : 'none'};
        position: relative;
        overflow: hidden;
      `;

      let iconKey = 'info';
      let iconColor = 'var(--color-brand)';
      let bgMix = 'color-mix(in srgb, var(--color-brand) 12%, transparent)';

      if (item.type?.includes('goal') || item.type?.includes('best')) {
        iconKey = 'trophy';
        iconColor = '#f59e0b';
        bgMix = 'color-mix(in srgb, #f59e0b 12%, transparent)';
      } else if (item.type?.includes('risk') || item.type?.includes('due') || item.type?.includes('expiry')) {
        iconKey = 'alert-triangle';
        iconColor = 'var(--color-danger)';
        bgMix = 'color-mix(in srgb, var(--color-danger) 12%, transparent)';
      } else if (item.type?.includes('summary')) {
        iconKey = 'calendar';
      }

      const dateStr = new Date(item.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      card.innerHTML = `
        <div style="background: ${bgMix}; color: ${iconColor}; padding: var(--space-3); border-radius: var(--radius-lg); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          ${getIcon(iconKey, 24)}
        </div>
        <div style="flex-grow: 1; min-width: 0;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); margin-bottom: var(--space-1);">
            <h4 style="font-size: var(--text-base); font-weight: 700; color: var(--color-text); margin: 0; display: flex; align-items: center; gap: var(--space-2);">
              ${item.title}
              ${!item.read ? `<span style="width: 8px; height: 8px; border-radius: 50%; background: var(--color-brand); display: inline-block;"></span>` : ''}
            </h4>
            <span style="font-size: var(--text-xs); color: var(--color-text-muted); white-space: nowrap;">${dateStr}</span>
          </div>
          <p style="font-size: var(--text-sm); color: var(--color-text-secondary); margin: 0 0 var(--space-3) 0; line-height: 1.5;">
            ${item.message}
          </p>
          <div class="notification-card-actions" style="display: flex; align-items: center; gap: var(--space-2);"></div>
        </div>
      `;

      const cardActions = card.querySelector('.notification-card-actions');
      if (cardActions && !item.read) {
        const readBtn = document.createElement('button');
        readBtn.type = 'button';
        readBtn.className = 'btn btn-primary btn-xs';
        readBtn.innerHTML = `${getIcon('check', 14)} Mark Read`;
        readBtn.addEventListener('click', async () => {
          await markNotificationRead(item.id);
          await loadNotifications();
        });
        cardActions.appendChild(readBtn);
      }

      if (cardActions && !item.dismissed) {
        const dismissBtn = document.createElement('button');
        dismissBtn.type = 'button';
        dismissBtn.className = 'btn btn-secondary btn-xs';
        dismissBtn.innerHTML = `${getIcon('x', 14)} Dismiss`;
        dismissBtn.addEventListener('click', async () => {
          await dismissNotification(item.id);
          await loadNotifications();
        });
        cardActions.appendChild(dismissBtn);
      }

      listContainer.appendChild(card);
    });
  }

  await loadNotifications();

  const unsub = bus.on('notification:unread-change', () => {
    void loadNotifications();
  });

  return () => {
    unsub();
  };
}
