/**
 * COMMA — Changelog & What's New
 * Detects version updates and prompts the user with a highlight reel of new features.
 */

import { showModal } from '../../ui/components.js';
import { getIcon } from '../../ui/icons.js';
import { t } from '../../utils/strings.js';

export const APP_VERSION = '1.4.0';
const STORAGE_KEY = 'comma_last_seen_version';

/**
 * Checks if the app has been updated since the last visit.
 * If so, displays the "What's New" modal.
 */
export function initChangelog() {
  const lastSeen = localStorage.getItem(STORAGE_KEY);
  
  // Don't show on very first visit (onboarding will handle that)
  if (!lastSeen) {
    localStorage.setItem(STORAGE_KEY, APP_VERSION);
    return;
  }

  if (lastSeen !== APP_VERSION) {
    // Set seen version immediately to guarantee no duplicate popups occur on concurrent boot cycles
    localStorage.setItem(STORAGE_KEY, APP_VERSION);

    // Small delay to ensure the main UI is ready
    setTimeout(() => {
      showChangelogModal(lastSeen);
    }, 1500);
  }
}

/**
 * Displays the What's New modal.
 * @param {string} lastVersion 
 */
export function showChangelogModal(lastVersion = '') {
  const content = `
    <div class="changelog-modal">
      <div class="changelog-header">
        <div class="changelog-badge">${APP_VERSION}</div>
        <h2 class="changelog-title">${t('changelog.title') || "What's New"}</h2>
        <p class="changelog-subtitle">${t('changelog.subtitle') || "We've added some powerful new tools to your vault."}</p>
      </div>

      <div class="changelog-highlights">
        <div class="changelog-item">
          <div class="changelog-item-icon">${getIcon('moon', 24)}</div>
          <div class="changelog-item-text">
            <h4>Light mode comes to the phone app</h4>
            <p>Comma's Android app now follows your phone's own light/dark setting automatically, the way this browser app always has.</p>
          </div>
        </div>

        <div class="changelog-item">
          <div class="changelog-item-icon">${getIcon('layout-grid', 24)}</div>
          <div class="changelog-item-text">
            <h4>App-grade interactions everywhere</h4>
            <p>Swipe a shift, expense, vehicle or notification for its actions. Pickers and forms open as bottom sheets you can drag, snap and flick away. Same look, same speed — new touch.</p>
          </div>
        </div>

        <div class="changelog-item">
          <div class="changelog-item-icon">${getIcon('check', 24)}</div>
          <div class="changelog-item-text">
            <h4>Dashboard checklist opens the right screen</h4>
            <p>"Add your other apps," "Tell us your real vehicle" and "Set a weekly goal" now each open one small screen that does exactly that job, instead of dropping you into Settings to hunt for it.</p>
          </div>
        </div>

        <div class="changelog-item">
          <div class="changelog-item-icon">${getIcon('shield', 24)}</div>
          <div class="changelog-item-text">
            <h4>No more sign-in prompts on every open</h4>
            <p>Your Google Drive session now survives reloads. The app never asks you to sign in on its own — only when you tap a sync or backup action yourself.</p>
          </div>
        </div>
      </div>

      <div class="changelog-footer">
        <button type="button" class="btn btn-primary btn-block" data-action="close-changelog">${t('common.done') || 'Awesome'}</button>
      </div>
    </div>
  `;

  const handle = showModal({
    title: '', // Custom header used in content
    content,
    size: 'sm',
    actions: [] // Custom footer used in content
  });

  // Attach close listener
  const closeBtn = handle.root.querySelector('[data-action="close-changelog"]');
  if (closeBtn) {
    closeBtn.onclick = () => {
      handle.close();
      localStorage.setItem(STORAGE_KEY, APP_VERSION);
    };
  }
}
