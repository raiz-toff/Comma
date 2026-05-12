/**
 * Shared factory for US state / DC rows (`*.province.js` per jurisdiction).
 * Keeps platforms and expense categories aligned with the Canadian reference + US country defaults.
 */

import ON from '../CA/ON.province.js';
import US from '../../countries/US.country.js';

const US_EXPENSE_CATEGORIES = Object.freeze(
  (ON.expenseCategories || []).map((c) => ({
    ...c,
    craLine: 'Schedule C (US); see IRS Pub. 535',
  })),
);

const US_PLATFORMS = Object.freeze(
  Array.isArray(US.defaultAvailablePlatforms) && US.defaultAvailablePlatforms.length
    ? [...US.defaultAvailablePlatforms]
    : ['doordash', 'ubereats', 'instacart', 'amazonflex', 'other'],
);

/**
 * @param {string} id Two-letter state / DC code (e.g. `TX`, `DC`).
 */
export function createUsStateProvince(id) {
  const code = String(id || '').toUpperCase();
  return Object.freeze({
    id: code,
    countryId: 'US',
    labelKey: 'provinces.us.state',
    availablePlatforms: [...US_PLATFORMS],
    expenseCategories: US_EXPENSE_CATEGORIES,
    salesTax: null,
    incomeTax: null,
    vehicleExpenseMethod: 'actual_costs',
    vehicleNotes: {},
    onboardingExtras: [],
  });
}
