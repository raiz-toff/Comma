import { createSegmentedWidget } from './_segmented.js';
import deadMiles from './dead-miles.widget.js';
import stabilityScore from './stability-score.widget.js';

// "How sustainable is this pattern" — dead-mile ratio and income stability,
// as opposed to "how much did I make."
export default createSegmentedWidget({
  id: 'efficiencyStability',
  label: 'Efficiency & Stability',
  category: 'analytics',
  defaultVisible: false,
  segments: [
    { label: 'Dead Miles', widget: deadMiles },
    { label: 'Stability', widget: stabilityScore },
  ],
});
