/**
 * Ontario — reference province (plan v3 F9).
 * Engine reads this via ProvinceRegistry; do not hardcode ON-specific rates elsewhere.
 */

/** Federal + ON combined marginal brackets (simplified annual taxable income, CAD) — planning only. */
const INCOME_TAX_BRACKETS_2025 = [
  { upTo: 57375, rate: 0.15 },
  { upTo: 114750, rate: 0.205 },
  { upTo: 177882, rate: 0.26 },
  { upTo: 253414, rate: 0.29 },
  { upTo: Infinity, rate: 0.33 },
];

export default {
  id: 'ON',
  countryId: 'CA',
  labelKey: 'provinces.on',

  availablePlatforms: ['doordash', 'ubereats', 'skip', 'foodora', 'instacart', 'amazonflex'],

  salesTax: {
    name: 'HST',
    rate: 0.13,
    registrationThresholdCents: 3000000,
    infoKey: 'tax.hstRegistrationInfo',
    quarterlyDueDates: [
      { month: 4, day: 30, labelKey: 'tax.hstQ1Due' },
      { month: 7, day: 31, labelKey: 'tax.hstQ2Due' },
      { month: 10, day: 31, labelKey: 'tax.hstQ3Due' },
      { month: 1, day: 31, labelKey: 'tax.hstQ4Due' },
    ],
  },

  incomeTax: {
    suggestedSetAsidePct: 27,
    brackets: INCOME_TAX_BRACKETS_2025,
  },

  pensionContribution: {
    noteKey: 'tax.cppOntarioNote',
  },

  vehicleExpenseMethod: 'actual_costs',
  referenceUrl: 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/sole-proprietorships-partnerships/report-business-income-expenses.html',

  vehicleNotes: {
    ebikeKey: 'provinces.on.ebikeInsurance',
    commercialInsuranceKey: 'provinces.on.commercialInsurance',
  },

  /**
   * Expense categories for Ontario T2125-style tracking (CRA line hints).
   * @type {Array<{ id: string; labelKey: string; craLine: string; mixedUse?: boolean; vehicleTypes?: string[] }>}
   */
  expenseCategories: [
    { id: 'fuel', labelKey: 'expenses.cat.fuel', craLine: 'Line 8521 — Fuel costs (except for motor vehicles)' },
    { id: 'maintenance', labelKey: 'expenses.cat.maintenance', craLine: 'Line 8590 — Maintenance and repairs' },
    { id: 'insurance', labelKey: 'expenses.cat.insurance', craLine: 'Line 8690 — Insurance', mixedUse: true },
    { id: 'licensing', labelKey: 'expenses.cat.licensing', craLine: 'Line 8760 — Licence, registration, and dues' },
    { id: 'interest', labelKey: 'expenses.cat.interest', craLine: 'Line 8710 — Interest and bank charges (vehicle loan)' },
    { id: 'leasing', labelKey: 'expenses.cat.leasing', craLine: 'Line 9281 — Motor vehicle expenses (leasing)' },
    { id: 'fees', labelKey: 'expenses.cat.fees', craLine: 'Line 8760 — Licence, registration, and dues' },
    { id: 'parking', labelKey: 'expenses.cat.parking', craLine: 'Line 8910 — Parking, meter, and tolls' },
    { id: 'tolls', labelKey: 'expenses.cat.tolls', craLine: 'Line 8910 — Parking, meter, and tolls' },
    { id: 'phone', labelKey: 'expenses.cat.phone', craLine: 'Line 9220 — Telephone and utilities', mixedUse: true },
    { id: 'data_plan', labelKey: 'expenses.cat.data_plan', craLine: 'Line 9220 — Telephone and utilities', mixedUse: true },
    { id: 'supplies', labelKey: 'expenses.cat.supplies', craLine: 'Line 8810 — Office expenses' },
    { id: 'bank_fees', labelKey: 'expenses.cat.bank_fees', craLine: 'Line 8710 — Interest and bank charges' },
    { id: 'accounting', labelKey: 'expenses.cat.accounting', craLine: 'Line 8860 — Professional fees' },
    { id: 'software', labelKey: 'expenses.cat.software', craLine: 'Line 9270 — Other expenses' },
    { id: 'wash', labelKey: 'expenses.cat.wash', craLine: 'Line 8590 — Maintenance and repairs' },
    { id: 'out_of_pocket', labelKey: 'expenses.cat.out_of_pocket', craLine: 'Not deductible — personal / reimbursed' },
    { id: 'meals', labelKey: 'expenses.cat.meals', craLine: 'Line 8523 — Meals and entertainment (50% limit may apply)' },
    { id: 'bike_maintenance', labelKey: 'expenses.cat.bike_maintenance', craLine: 'Line 8590 — Maintenance and repairs', vehicleTypes: ['bicycle', 'ebike'] },
    { id: 'other', labelKey: 'expenses.cat.other', craLine: 'Line 9270 — Other expenses' },
  ],

  /** Injected into onboarding tax step (plan step 8). */
  onboardingExtras: [{ type: 'hst_registration', toggleField: 'hstRegistered' }],
};
