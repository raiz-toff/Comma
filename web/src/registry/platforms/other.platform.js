import { SVG_OT } from './_logos.js';

export default {
  id: 'other',
  name: 'Other',
  color: '#6B7280',
  terminology: { driver: 'Driver', delivery: 'delivery', bonus: 'Bonus', surge: 'Surge' },
  logo: SVG_OT,
  relevantFields: [],
  helpUrl: '',
  payoutWeekday: 5,
  analyticsModules: {
    bonusTracking: false,
    surgeAnalysis: false,
    blockEarnings: false,
    batchTracking: false,
    orderTypeTracking: false,
    questTracking: false,
    promotionsTracking: false,
  },
};
