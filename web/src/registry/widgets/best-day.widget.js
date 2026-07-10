import { t }   from '../../utils/strings.js';
import { esc } from './esc.js';

const _IC_CAL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;

const DOW_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
// Relative heights for a visually-weighted bar (not real earnings data —
// just a decorative scaffold; adjust if per-day earnings are available in ctx)
const DOW_HEIGHTS = [55, 70, 75, 80, 90, 100, 65]; // % heights, Fri is peak shape

export default {
  id: 'bestDay',
  label: 'Best Day',
  defaultSize: '1x1',
  defaultVisible: false,
  category: 'analytics',

  render: async (ctx) => {
    const c   = /** @type {any} */ (ctx);
    const day = Number(c?.data?.bestDay?.day ?? -1);
    const label = day >= 0 && day <= 6 ? DOW_LABELS[day] : '—';

    const bars = DOW_LABELS.map((d, i) => {
      const isActive = i === day;
      const h = DOW_HEIGHTS[i];
      return `
        <div class="wdow-d">
          <div class="wdow-b${isActive ? ' act' : ''}" style="height:${h}%"></div>
          <span class="wdow-l${isActive ? ' act' : ''}">${d.slice(0,1)}</span>
        </div>`;
    }).join('');

    return `
      <div class="wr">
        <div class="wh">
          <div class="wi">${_IC_CAL}</div>
          <span class="wl">${esc(t('analytics.bestDay'))}</span>
          <span class="wb acc">${esc(label)}</span>
        </div>
        <div class="wv" style="font-size:clamp(18px,3vw,24px)">${esc(label)}</div>
        <div class="wdow" style="flex:1;padding-top:4px">${bars}</div>
      </div>`;
  },
  afterRender: (_el, _ctx) => {},
  destroy:     (_el)       => {},
};
