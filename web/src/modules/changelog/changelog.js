/**
 * COMMA — Changelog & What's New
 * Detects version updates and prompts the user with a highlight reel of new features.
 */

import { showModal } from '../../ui/components.js';
import { getIcon } from '../../ui/icons.js';
import { t } from '../../utils/strings.js';

export const APP_VERSION = '1.3.1';
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
          <div class="changelog-item-icon">${getIcon('bolt', 24)}</div>
          <div class="changelog-item-text">
            <h4>Setup is now two steps</h4>
            <p>Tell us where you drive, then log your last shift — Comma shows you what that shift was really worth. Everything else is optional and offered later.</p>
          </div>
        </div>

        <div class="changelog-item">
          <div class="changelog-item-icon">${getIcon('upload-cloud', 24)}</div>
          <div class="changelog-item-text">
            <h4>One-tap cloud sync</h4>
            <p>Connecting your Google Drive is all it takes to keep this browser and your phone in step. No sync password to invent, no account to create.</p>
          </div>
        </div>

        <div class="changelog-item">
          <div class="changelog-item-icon">${getIcon('shield', 24)}</div>
          <div class="changelog-item-text">
            <h4>End-to-end encryption, when you want it</h4>
            <p>Your vault syncs through your own Drive by default. Switch on end-to-end encryption and it is sealed with a password only you hold.</p>
          </div>
        </div>

        <div class="changelog-item">
          <div class="changelog-item-icon">${getIcon('moon', 24)}</div>
          <div class="changelog-item-text">
            <h4>A calmer interface</h4>
            <p>A design pass across every screen: consistent surfaces, softer dividers, and a dark theme that is now the default.</p>
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
