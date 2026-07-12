export default {
  id: 'US',
  labelKey: 'onboarding.steps.countryUS',
  currency: 'USD',
  symbol: '$',
  distanceUnit: 'mi',
  // IRS Notice 2026-10: 72.5¢/mile for cars, vans, pickups and panel trucks. No published rate for
  // motorcycles or bicycles, so those are absent (= not eligible) rather than guessed at.
  mileage: {
    authority: 'IRS',
    rates: {
      car: { ratePrimary: 0.725, rateSecondary: null, rateThreshold: null, label: 'IRS Standard Mileage Rate (2026)' },
    },
  },
  taxInstallmentDates: [
    { month: 4, day: 15, label: 'Q1 payment' },
    { month: 6, day: 15, label: 'Q2 payment' },
    { month: 9, day: 15, label: 'Q3 payment' },
    { month: 1, day: 15, label: 'Q4 payment', followYear: true },
  ],
  hasSETax: true,
  mileageRateSource: 'IRS',
  tax: {
    taxInstallmentReminderDays: 10,
    hstOnboarding: false,
    intlLocaleTag: 'en-US',
    defaultWithholdingPct: 25,
    regionPresetType: 'US',
    fallbackCurrency: 'USD',
    hstRateWhenRegistered: 0,
    calcCpp: false,
    calcSeTax: true,
    stdMileageChoice: 'IRS',
    regionLabel: 'state',
    secondaryEstimator: 'se',
    footnote: 'us',
    defaultRegionCode: 'CA',
  },
  /** US gig catalog default when no `*.province.js` exists for that state. */
  defaultAvailablePlatforms: ['doordash', 'ubereats', 'instacart', 'amazonflex', 'other'],
};
