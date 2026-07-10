import { SVG_DD } from './_logos.js';

export default {
  id: 'doordash',
  name: 'DoorDash',
  color: '#FF3008',
  terminology: { driver: 'Dasher', delivery: 'order', bonus: 'Peak Pay', surge: 'Peak Pay' },
  logo: SVG_DD,
  relevantFields: ['peakPay', 'dashZone', 'acceptanceRate', 'customerRating'],
  helpUrl: 'https://help.doordash.com/dashers',
  payoutWeekday: 1,
  analyticsModules: {
    bonusTracking: true,
    surgeAnalysis: false,
    blockEarnings: false,
    batchTracking: false,
    orderTypeTracking: false,
    questTracking: false,
    promotionsTracking: false,
  },
  specificSchema: [
    { key: 'peakPay', kind: 'number', min: 0 },
    { key: 'dashZone', kind: 'string' },
    { key: 'acceptanceRate', kind: 'number', min: 0, max: 100 },
    { key: 'customerRating', kind: 'number', min: 0, max: 5 },
  ],
  alertChecks: [
    {
      inputKey: 'doordashCustomerRating',
      min: 0,
      max: 5,
      below: 4.7,
      alertType: 'doordash_customer_rating_low',
      payloadKey: 'rating',
    },
  ],
};
