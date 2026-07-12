export default {
  id: 'UK',
  labelKey: 'onboarding.steps.countryUK',
  currency: 'GBP',
  symbol: '£',
  distanceUnit: 'mi',
  // HMRC Approved Mileage Allowance Payments: 45p/mile for cars. Matches the phone app, which
  // already shipped this rate — the web app previously had no UK mileage data at all and silently
  // gave UK drivers a £0 write-off.
  //
  // KNOWN SIMPLIFICATION: the real AMAP scheme steps down to 25p/mile beyond 10,000 miles in a tax
  // year, which this does not yet model — set rateSecondary: 0.25 / rateThreshold: 10000 to fix,
  // exactly as CA does. Motorcycles (24p) and bicycles (20p) have their own AMAP rates and are
  // deliberately absent until verified, rather than inheriting the car rate.
  mileage: {
    authority: 'HMRC',
    rates: {
      car: { ratePrimary: 0.45, rateSecondary: null, rateThreshold: null, label: 'HMRC AMAP Rate' },
    },
  },
  taxInstallmentDates: [
    { month: 1, day: 31, label: 'Payment on account (balancing)' },
    { month: 7, day: 31, label: 'Payment on account' },
  ],
  mileageRateSource: '',
  tax: {
    taxInstallmentReminderDays: 10,
    hstOnboarding: false,
    intlLocaleTag: 'en-GB',
    defaultWithholdingPct: 25,
    regionPresetType: null,
    fallbackCurrency: 'GBP',
    hstRateWhenRegistered: 0,
    calcCpp: false,
    calcSeTax: false,
    stdMileageChoice: 'SIMPLE',
    regionLabel: 'state',
    secondaryEstimator: 'none',
    footnote: 'generic',
    defaultRegionCode: '',
  },
  defaultAvailablePlatforms: ['doordash', 'ubereats', 'instacart', 'amazonflex', 'other'],
};
