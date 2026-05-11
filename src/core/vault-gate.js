/**
 * Whether the vault should receive product/financial nudges (P8, P13).
 * During onboarding the seeded user exists but the experience is guided — no P8 cards or P13 toasts/modals.
 */

import { getUser } from './db.js';

/**
 * @param {Record<string, unknown> | null | undefined} user
 * @returns {boolean}
 */
export function isUserVaultActive(user) {
  return Boolean(user?.onboardingComplete);
}

/** @returns {Promise<boolean>} */
export async function isVaultActive() {
  return isUserVaultActive(await getUser());
}
