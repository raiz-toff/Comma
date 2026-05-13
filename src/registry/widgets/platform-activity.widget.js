import { t } from '../../utils/strings.js';
import { esc } from './esc.js';

export default {
  id: 'platformActivity',
  label: 'Platform Mix',
  defaultSize: '1x1',
  defaultVisible: false,
  category: 'analytics',

  /** @param {unknown} ctx */
  render: async (ctx) => {
    const c = /** @type {any} */ (ctx);
    const data = c?.data?.platformActivity || {};
    const label = t('analytics.platformMix') || 'Platform Mix';
    
    // Sort platforms by gross
    const platforms = Object.entries(data)
      .map(([id, stats]) => ({ id, gross: Number(stats?.gross || 0) }))
      .sort((a, b) => b.gross - a.gross)
      .slice(0, 3);

    return `
      <div class="wr">
        <div class="wh">
          <div class="wi">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <span class="stat-label">${esc(label)}</span>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 12px; flex-grow: 1; justify-content: center;">
          ${platforms.length ? platforms.map(p => `
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem;">
              <span style="font-weight: 700; color: var(--color-text-secondary); text-transform: capitalize;">${esc(p.id)}</span>
              <span style="font-weight: 800; color: var(--color-text-main);">$${esc(Math.round(p.gross))}</span>
            </div>
            <div style="height: 3px; background: rgba(var(--war, 16, 185, 129), 0.1); border-radius: 99px; overflow: hidden;">
              <div style="height: 100%; background: var(--wa, #10b981); width: ${Math.min(100, (p.gross / (platforms[0].gross || 1)) * 100)}%;"></div>
            </div>
          `).join('') : '<p style="font-size:0.7rem; opacity:0.5; text-align:center;">No platform data</p>'}
        </div>
      </div>
    `;
  },
  afterRender: (_el, _ctx) => {},
  destroy: (_el) => {},
};
