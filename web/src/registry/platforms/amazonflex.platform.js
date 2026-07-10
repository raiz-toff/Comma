import { SVG_AF } from './_logos.js';

export default {
  id: 'amazonflex',
  name: 'Amazon Flex',
  color: '#232F3E',
  terminology: { driver: 'Flex driver', delivery: 'block', bonus: 'Incentive', surge: 'Surge' },
  logo: SVG_AF,
  relevantFields: ['blockType', 'warehouseCode'],
  helpUrl: 'https://flex.amazon.com/',
  payoutWeekday: 5,
  analyticsModules: {
    bonusTracking: false,
    surgeAnalysis: false,
    blockEarnings: true,
    batchTracking: false,
    orderTypeTracking: false,
    questTracking: false,
    promotionsTracking: false,
  },
  specificSchema: [
    { key: 'blockDurationMinutes', kind: 'number', min: 0 },
    { key: 'blockType', kind: 'string' },
  ],
};
