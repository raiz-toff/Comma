/**
 * COMMA — Changelog & What's New
 * Detects version updates and prompts the user with a highlight reel of new features.
 */

import { showModal } from '../../ui/components.js';
import { getIcon } from '../../ui/icons.js';
import { t } from '../../utils/strings.js';

export const APP_VERSION = '1.3.0';
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
          <div class="changelog-item-icon">${getIcon('layout-grid', 24)}</div>
          <div class="changelog-item-text">
            <h4>Interactive Shift Breakdowns</h4>
            <p>Click shift rows or timeline blocks to slide open sleek glassmorphic accordions with computed hourly rates, tips, base pay, and custom notes.</p>
          </div>
        </div>
        
        <div class="changelog-item">
          <div class="changelog-item-icon">${getIcon('bolt', 24)}</div>
          <div class="changelog-item-text">
            <h4>Horizontal Mobile Filters</h4>
            <p>Presets now slide smoothly on mobile viewports without wrapping, keeping your controls incredibly clean and readable.</p>
          </div>
        </div>

        <div class="changelog-item">
          <div class="changelog-item-icon">${getIcon('clock', 24)}</div>
          <div class="changelog-item-text">
            <h4>Year-to-Date (YTD) Preset</h4>
            <p>Quickly filter all dashboard metrics and shift logs to evaluate your performance starting from January 1st to today with a single tap.</p>
          </div>
        </div>

        <div class="changelog-item">
          <div class="changelog-item-icon">${getIcon('filter', 24)}</div>
          <div class="changelog-item-text">
            <h4>Auto-Collapsing Drawers</h4>
            <p>Selecting any filter preset or clicking apply now automatically collapses the date filter drawer to maximize your screen space.</p>
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
