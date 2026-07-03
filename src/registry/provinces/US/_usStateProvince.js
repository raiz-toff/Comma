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
 * @param {{ salesTaxRate?: number, withholdingPct?: number, incomeTaxRate?: number }} [taxData]
 *   Real per-state values backfilled from mobile's `commaApp/src/registry/countries/US/provinces/*.ts`
 *   (interop plan Workstream 1 — web's `salesTax`/`incomeTax` were `null` placeholders before this).
 *   `salesTaxRate` is 0 for every US state in mobile's data (gig platforms handle marketplace-
 *   facilitator sales tax, not the driver) — still recorded as a real `0`, not `null`, so callers
 *   can tell "confirmed zero" apart from "unknown". `incomeTaxRate` is mobile's approximate
 *   effective state income tax rate for self-employed income at ~$50k (omitted entirely for
 *   no-state-income-tax states, matching mobile).
 */
export function createUsStateProvince(id, taxData = {}) {
  const code = String(id || '').toUpperCase();
  const salesTaxRate = Number.isFinite(taxData.salesTaxRate) ? taxData.salesTaxRate : 0;
  const withholdingPct = Number.isFinite(taxData.withholdingPct) ? taxData.withholdingPct : 25;
  return Object.freeze({
    id: code,
    countryId: 'US',
    labelKey: 'provinces.us.state',
    availablePlatforms: [...US_PLATFORMS],
    expenseCategories: US_EXPENSE_CATEGORIES,
    salesTax: { rate: salesTaxRate },
    incomeTax: {
      suggestedSetAsidePct: withholdingPct,
      ...(Number.isFinite(taxData.incomeTaxRate) ? { stateRate: taxData.incomeTaxRate } : {}),
    },
    vehicleExpenseMethod: 'actual_costs',
    vehicleNotes: {},
    onboardingExtras: [],
  });
}
