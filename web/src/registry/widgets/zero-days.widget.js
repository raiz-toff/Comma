import { formatLargeNumber } from '../../utils/formatters.js';
import { t }                 from '../../utils/strings.js';
import { esc }               from './esc.js';

const _IC_XCIRCLE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;

export default {
  id: 'zeroDays',
  label: 'Zero Days',
  defaultSize: '1x1',
  defaultVisible: false,
  category: 'analytics',

  render: async (ctx) => {
    const c      = /** @type {any} */ (ctx);
    const n      = Number(c?.data?.zeroDaysCount) || 0;
    const DOTS   = 28; // 4-week grid
    const active = DOTS - Math.min(n, DOTS);
    const badge  = n === 0 ? 'pos' : n <= 3 ? 'warn' : 'neg';
    const label  = n === 0 ? 'Perfect' : n <= 3 ? 'Good' : 'Review';

    // Build calendar dot grid: zero days = accent (rose), active days = green tint
    // Distribute zero-day dots evenly for visual representation
    const dotsHtml = Array.from({ length: DOTS }, (_, i) => {
      const cls = i < n ? 'z' : i < DOTS ? 'nt' : 'ft';
      return `<div class="wcd ${cls}"></div>`;
    }).join('');

    return `
      <div class="wr">
        <div class="wh">
          <div class="wi">${_IC_XCIRCLE}</div>
          <span class="wl">${esc(t('analytics.zeroDays'))}</span>
          <span class="wb ${badge}">${esc(label)}</span>
        </div>
        <div style="display:flex;align-items:baseline;gap:6px;flex-shrink:0">
          <div class="wv">${esc(formatLargeNumber(n))}</div>
          <div class="ws">zero-earning days</div>
        </div>
        <div class="wcg" style="flex:1;padding-top:4px">${dotsHtml}</div>
        <div class="ws" style="font-size:9px">
          <span style="color:var(--wa)">■</span> zero &nbsp;
          <span style="color:#10b981">■</span> active &nbsp;
          <span style="opacity:.4">■</span> rest
        </div>
      </div>`;
  },
  afterRender: (_el, _ctx) => {},
  destroy:     (_el)       => {},
};
