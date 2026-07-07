import { createSegmentedWidget } from './_segmented.js';
import rollingTrend from './rolling-trend.widget.js';
import weekCompare from './week-compare.widget.js';
import hoursCompare from './hours-compare.widget.js';
import scatter from './scatter.widget.js';

// Merges 4 formerly-standalone Performance cards (all answer "how is this
// trending") behind one segmented control instead of 4 full-width cards.
export default createSegmentedWidget({
  id: 'trends',
  label: 'Trends',
  category: 'analytics',
  defaultVisible: false,
  segments: [
    { label: '30-Day', widget: rollingTrend },
    { label: 'WoW', widget: weekCompare },
    { label: 'Hours', widget: hoursCompare },
    { label: 'Scatter', widget: scatter },
  ],
});
