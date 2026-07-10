import { SVG_FD } from './_logos.js';

export default {
  id: 'foodora',
  name: 'Foodora',
  color: '#E21B70',
  terminology: { driver: 'Rider', delivery: 'order', bonus: 'Bonus', surge: 'Busy pay' },
  logo: SVG_FD,
  relevantFields: ['busyPay', 'orderCount'],
  helpUrl: 'https://www.foodora.ca/',
  payoutWeekday: 3,
  analyticsModules: {
    bonusTracking: false,
    surgeAnalysis: false,
    blockEarnings: false,
    batchTracking: false,
    orderTypeTracking: true,
    questTracking: false,
    promotionsTracking: false,
  },
  specificSchema: [
    { key: 'orderTypeSplit', kind: 'object' },
    { key: 'attendanceScore', kind: 'number', min: 0, max: 100 },
  ],
};
