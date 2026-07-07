import { esc } from './esc.js';

const _IC_CAL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** @param {number} hour */
function formatHour(hour) {
  if (hour < 0 || hour > 23) return '—';
  const isPM = hour >= 12;
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}${isPM ? 'pm' : 'am'}`;
}

export default {
  id: 'workRhythm',
  label: 'Work Rhythm',
  defaultSize: '1x1',
  defaultVisible: false,
  category: 'analytics',

  // Merges bestDay + bestHour + streak + zeroDays — all answer
  // "when am I actually working well" — into one 4-up grid instead of 4 cards.
  render: async (ctx) => {
    const c = /** @type {any} */ (ctx);
    const day = Number(c?.data?.bestDay?.day ?? -1);
    const hour = Number(c?.data?.bestHour?.hour ?? -1);
    const streak = Number(c?.data?.streakCount) || 0;
    const zeroDays = Number(c?.data?.zeroDaysCount) || 0;

    const dayLabel = day >= 0 && day <= 6 ? DOW_LABELS[day] : '—';

    const items = [
      { label: 'Best Day', value: dayLabel },
      { label: 'Best Hour', value: formatHour(hour) },
      { label: 'Streak', value: `${streak}d` },
      { label: 'Zero Days', value: String(zeroDays) },
    ];

    return `
      <div class="wr">
        <div class="wh">
          <div class="wi">${_IC_CAL}</div>
          <span class="wl">Work Rhythm</span>
        </div>
        <div class="wquad">
          ${items.map((i) => `
            <div class="wquad-cell">
              <span class="wquad-l">${esc(i.label)}</span>
              <span class="wquad-v">${esc(i.value)}</span>
            </div>
          `).join('')}
        </div>
      </div>`;
  },
  afterRender: (_el, _ctx) => {},
  destroy: (_el) => {},
};
