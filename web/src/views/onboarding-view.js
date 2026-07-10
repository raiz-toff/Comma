/**
 * Onboarding route view — mounts F9 flow into the router view container.
 */

import { mountOnboarding } from '../modules/onboarding/onboarding.js';

/** @param {HTMLElement} root @param {Record<string, unknown>} _ctx */
export function render(root, _ctx) {
  root.classList.add('view-onboarding');
  return mountOnboarding(root);
}
