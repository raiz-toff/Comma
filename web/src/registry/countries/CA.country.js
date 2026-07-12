export default {
  id: 'CA',
  labelKey: 'onboarding.steps.countryCA',
  currency: 'CAD',
  symbol: '$',
  distanceUnit: 'km',
  // CRA 2026: 73¢/km for the first 5,000 km, 67¢/km after. Automobiles only — the per-km
  // allowance does not cover motorcycles or bicycles, so those categories are absent (= not
  // eligible) and the driver is pointed at actual expenses instead.
  mileage: {
    authority: 'CRA',
    rates: {
      car: { ratePrimary: 0.73, rateSecondary: 0.67, rateThreshold: 5000, label: 'CRA Automobile Allowance Rate (2026)' },
    },
  },
  taxInstallmentDates: [
    { month: 3, day: 15, label: 'Q1 payment' },
    { month: 6, day: 15, label: 'Q2 payment' },
    { month: 9, day: 15, label: 'Q3 payment' },
    { month: 12, day: 15, label: 'Q4 payment' },
  ],
  hasCPP: true,
  hasHST: true,
  tax: {
    taxInstallmentReminderDays: 10,
    hstOnboarding: true,
    intlLocaleTag: 'en-CA',
    defaultWithholdingPct: 28,
    regionPresetType: 'CA',
    fallbackCurrency: 'CAD',
    hstRateWhenRegistered: 0.13,
    calcCpp: true,
    calcSeTax: false,
    regionLabel: 'province',
    secondaryEstimator: 'cpp',
    footnote: 'canada',
    defaultRegionCode: 'ON',
  },
  /** Default platform picker ids when no province row applies (inherit before union). @see docs/market_resolution.md */
  defaultAvailablePlatforms: ['doordash', 'ubereats', 'skip', 'foodora', 'instacart', 'amazonflex'],
};
