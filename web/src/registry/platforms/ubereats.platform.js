import { SVG_UE } from './_logos.js';

export default {
  id: 'ubereats',
  name: 'Uber Eats',
  color: '#06C167',
  terminology: { driver: 'Courier', delivery: 'trip', bonus: 'Quest', surge: 'Surge' },
  logo: SVG_UE,
  relevantFields: ['quest', 'surge', 'boost', 'tripCount'],
  helpUrl: 'https://help.uber.com/riders/article/uber-eats-merchant-support',
  payoutWeekday: 5,
  analyticsModules: {
    bonusTracking: true,
    surgeAnalysis: true,
    blockEarnings: false,
    batchTracking: false,
    orderTypeTracking: false,
    questTracking: true,
    promotionsTracking: false,
  },
  specificSchema: [
    { key: 'surgeMultiplier', kind: 'number', min: 0 },
    { key: 'proStatus', kind: 'string' },
    { key: 'completionRate', kind: 'number', min: 0, max: 100 },
    { key: 'questOnlineMinutes', kind: 'number', min: 0 },
  ],
  alertChecks: [
    {
      inputKey: 'uberCompletionRate',
      min: 0,
      max: 100,
      below: 95,
      alertType: 'ubereats_completion_rate_low',
      payloadKey: 'completionRate',
    },
  ],
};
