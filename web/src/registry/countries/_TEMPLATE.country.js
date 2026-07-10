/**
 * Copy to `{ISO}.country.js`, fill fields, add import + entry in `./index.js`.
 * @see docs/Registry_arch.md
 */
export default {
  id: 'XX',
  labelKey: '',
  currency: 'USD',
  symbol: '$',
  distanceUnit: 'km',
  taxInstallmentDates: [],
  mileageRateSource: '',
  tax: {
    taxInstallmentReminderDays: 10,
    hstOnboarding: false,
    intlLocaleTag: 'en-US',
    defaultWithholdingPct: 25,
    regionPresetType: null,
    fallbackCurrency: 'USD',
    hstRateWhenRegistered: 0,
    calcCpp: false,
    calcSeTax: false,
    stdMileageChoice: 'SIMPLE',
    regionLabel: 'state',
    secondaryEstimator: 'none',
    footnote: 'generic',
    defaultRegionCode: '',
  },
  /** Optional: platform ids when no province modules exist yet; see docs/market_resolution.md */
  // defaultAvailablePlatforms: ['doordash', 'ubereats', 'instacart', 'amazonflex', 'other'],
};
