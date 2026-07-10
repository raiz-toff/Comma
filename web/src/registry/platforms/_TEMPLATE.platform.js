/**
 * Copy to `{id}.platform.js`, fill required fields, add import + entry in `./index.js`.
 * @see docs/Registry_arch.md
 */
import { SVG_OT } from './_logos.js';

export default {
  id: 'example',
  name: 'Example Platform',
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
  specificSchema: [
    { key: 'exampleMetric', kind: 'number', min: 0, max: 100 },
    { key: 'exampleNote', kind: 'string' },
  ],
};
