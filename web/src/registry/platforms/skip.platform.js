import { SVG_SK } from './_logos.js';

export default {
  id: 'skip',
  name: 'SkipTheDishes',
  color: '#ED5A1F',
  terminology: { driver: 'Courier', delivery: 'order', bonus: 'Promo', surge: 'Busy fee' },
  logo: SVG_SK,
  relevantFields: ['busyFee', 'transitPay'],
  helpUrl: 'https://help.skipthedishes.com/',
  payoutWeekday: 4,
  analyticsModules: {
    bonusTracking: false,
    surgeAnalysis: false,
    blockEarnings: false,
    batchTracking: false,
    orderTypeTracking: false,
    questTracking: false,
    promotionsTracking: true,
  },
  specificSchema: [
    { key: 'creditsPromos', kind: 'number', min: 0 },
    { key: 'cityScore', kind: 'number', min: 0, max: 100 },
  ],
};
