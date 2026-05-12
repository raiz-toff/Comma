/**
 * Template for a Canadian province / territory (plan F9).
 * Copy to `CA/{CODE}.province.js`, then register in `../index.js`.
 */
export default {
  id: 'XX',
  countryId: 'CA',
  labelKey: 'provinces.template',
  /** @type {string[]} platform ids from PlatformRegistry */
  availablePlatforms: [],
  salesTax: null,
  incomeTax: null,
  expenseCategories: [],
  vehicleExpenseMethod: 'actual_costs',
  vehicleNotes: {},
  onboardingExtras: [],
};
