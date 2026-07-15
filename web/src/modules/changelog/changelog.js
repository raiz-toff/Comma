/**
 * COMMA — Changelog & What's New
 * Detects version updates and prompts the user with a highlight reel of new features.
 */

import { showModal } from '../../ui/components.js';
import { getIcon } from '../../ui/icons.js';
import { t } from '../../utils/strings.js';

export const APP_VERSION = '1.4.2';
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
          <div class="changelog-item-icon">${getIcon('shield', 24)}</div>
          <div class="changelog-item-text">
            <h4>Cloud Sync is always encrypted now</h4>
            <p>Connecting Google Drive asks you to set a backup password, and everything is end-to-end encrypted with it before it leaves your device. A second device enters the same password to join; forget it and "Forgot your password?" rebuilds the cloud copy from a device that still has your data.</p>
          </div>
        </div>

        <div class="changelog-item">
          <div class="changelog-item-icon">${getIcon('edit', 24)}</div>
          <div class="changelog-item-text">
            <h4>Adding a shift or expense is now step by step</h4>
            <p>Logging a shift or an expense walks you through it a page at a time, with a progress bar and Back/Continue buttons — the same paced flow the phone app uses, instead of one long form.</p>
          </div>
        </div>

        <div class="changelog-item">
          <div class="changelog-item-icon">${getIcon('layout-grid', 24)}</div>
          <div class="changelog-item-text">
            <h4>Analytics and Goals use the whole screen on a computer</h4>
            <p>On a wide screen the pages no longer hide half of themselves behind a tab switch — Analytics shows performance, insights and stat cards side by side, and Goals sits next to your progress. On a phone they stay tabbed.</p>
          </div>
        </div>

        <div class="changelog-item">
          <div class="changelog-item-icon">${getIcon('fuel', 24)}</div>
          <div class="changelog-item-text">
            <h4>The vehicle form only asks what fits your vehicle</h4>
            <p>Adding or editing a vehicle now adapts to the type you pick — a fuel car shows fuel economy and price, an EV shows kWh/100km and your electricity rate, a hybrid shows both, and a bicycle drops fuel, registration and oil-change fields entirely.</p>
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
