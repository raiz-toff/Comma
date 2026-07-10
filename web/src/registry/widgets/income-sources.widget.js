import { createSegmentedWidget } from './_segmented.js';
import platformActivity from './platform-activity.widget.js';
import incomeBreakdown from './income-breakdown.widget.js';

// "Where did the money come from" — platform mix and income breakdown are
// the same question asked two ways.
export default createSegmentedWidget({
  id: 'incomeSources',
  label: 'Income Sources',
  category: 'analytics',
  defaultVisible: false,
  segments: [
    { label: 'Platform', widget: platformActivity },
    { label: 'Breakdown', widget: incomeBreakdown },
  ],
});
