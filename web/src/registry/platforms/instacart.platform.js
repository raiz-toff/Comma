import { SVG_IC } from './_logos.js';

export default {
  id: 'instacart',
  name: 'Instacart',
  color: '#0AAD0A',
  terminology: { driver: 'Shopper', delivery: 'batch', bonus: 'Boost', surge: 'Peak' },
  logo: SVG_IC,
  relevantFields: ['batchSize', 'itemCount', 'boost'],
  helpUrl: 'https://shoppers.instacart.com/help',
  payoutWeekday: 3,
  analyticsModules: {
    bonusTracking: false,
    surgeAnalysis: false,
    blockEarnings: false,
    batchTracking: true,
    orderTypeTracking: false,
    questTracking: false,
    promotionsTracking: false,
  },
  specificSchema: [
    { key: 'batchCount', kind: 'number', min: 0 },
    { key: 'batchTypes', kind: 'stringArray' },
  ],
};
