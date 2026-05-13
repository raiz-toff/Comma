import { t } from '../../utils/strings.js';
import { esc } from './esc.js';

export default {
  id: 'stabilityScore',
  label: 'Stability Score',
  defaultSize: '1x1',
  defaultVisible: false,
  category: 'analytics',

  /** @param {unknown} ctx */
  render: async (ctx) => {
    const c = /** @type {any} */ (ctx);
    const score = Math.round(Number(c?.data?.stabilityScore?.score) || 0);
    const label = t('analytics.stabilityScore') || 'Stability Score';
    
    // SVG Arc math
    const radius = 35;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;

    return `
      <div class="wr">
        <div class="wh">
          <div class="wi">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
          </div>
          <span class="stat-label">${esc(label)}</span>
        </div>
        
        <div class="warc" style="margin-top: 10px;">
          <svg width="80" height="80" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="${radius}" fill="none" stroke="rgba(var(--war, 139, 92, 246), 0.1)" stroke-width="8" />
            <circle cx="50" cy="50" r="${radius}" fill="none" stroke="var(--wa, #8b5cf6)" stroke-width="8" 
              stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round" 
              transform="rotate(-90 50 50)" style="transition: stroke-dashoffset 1s ease-out;" />
            <text x="50" y="55" text-anchor="middle" font-size="20" font-weight="800" fill="var(--color-text-main)">${score}</text>
          </svg>
        </div>
        
        <p style="font-size: 0.65rem; color: var(--color-text-secondary); text-align: center; margin-top: 4px; font-weight: 600;">Income Reliability</p>
      </div>
    `;
  },
  afterRender: (_el, _ctx) => {},
  destroy: (_el) => {},
};
