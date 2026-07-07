import { createSegmentedWidget } from './_segmented.js';
import weeklyProjection from './weekly-projection.widget.js';
import schedule from './schedule.widget.js';

// "What's ahead" — projection and schedule are both forward-looking, unlike
// the rest of Insights which explains the past.
export default createSegmentedWidget({
  id: 'outlook',
  label: 'Outlook',
  category: 'analytics',
  defaultVisible: false,
  segments: [
    { label: 'Projection', widget: weeklyProjection },
    { label: 'Schedule', widget: schedule },
  ],
});
