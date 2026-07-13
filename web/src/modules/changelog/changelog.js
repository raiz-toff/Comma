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
            <p>Comma's Android app can now be light, dark, or set to follow your phone — under Settings, Appearance, Theme. This browser app has always had that choice; now the two match.</p>
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
