/**
 * COMMA — Changelog & What's New
 * Detects version updates and prompts the user with a highlight reel of new features.
 */

import { showModal } from '../../ui/components.js';
import { getIcon } from '../../ui/icons.js';
import { t } from '../../utils/strings.js';

export const APP_VERSION = '1.4.1';
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
          <div class="changelog-item-icon">${getIcon('dollar', 24)}</div>
          <div class="changelog-item-text">
            <h4>Correct mileage and expenses for multi-vehicle drivers</h4>
            <p>Mileage write-off now resolves each vehicle's own rate against only the distance it drove, and an expense only counts against a vehicle you actually used in that period.</p>
          </div>
        </div>

        <div class="changelog-item">
          <div class="changelog-item-icon">${getIcon('filter', 24)}</div>
          <div class="changelog-item-text">
            <h4>Filter by vehicle, and pick more than one platform</h4>
            <p>If you drive more than one vehicle, the same switcher that filters by delivery platform now filters by vehicle too — and both switchers let you hold a few selected at once, not just one or all.</p>
          </div>
        </div>

        <div class="changelog-item">
          <div class="changelog-item-icon">${getIcon('bell', 24)}</div>
          <div class="changelog-item-text">
            <h4>Recurring expense reminders, now on the phone app too</h4>
            <p>Expenses marked recurring nudge you when they're due — weekly, monthly or yearly — with a "Recurring" badge on the row.</p>
          </div>
        </div>

        <div class="changelog-item">
          <div class="changelog-item-icon">${getIcon('receipt', 24)}</div>
          <div class="changelog-item-text">
            <h4>Tap a shift to see its full details</h4>
            <p>Net earnings, hourly rate, distance, per-platform and mileage breakdowns, notes and linked expenses — one tap away, like the phone app. Edit and delete are one tap from there.</p>
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
