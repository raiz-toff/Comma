import { formatCurrency } from '../../utils/formatters.js';
import { t } from '../../utils/strings.js';
import { esc } from './esc.js';

const _IC_ZAP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`;

export default {
  id: 'avgRate',
  label: 'Avg $/hr',
  defaultSize: '1x1',
  defaultVisible: true,
  category: 'financial',

  /** @param {unknown} ctx */
  render: async (ctx) => {
    const c = /** @type {{ data?: { financial?: { avgRateHr?: number, hours?: number }; localeCountry?: string; currency?: string } }} */ (ctx);
    
    const rate = Number(c?.data?.financial?.avgRateHr) || 0;
    const hours = Number(c?.data?.financial?.hours) || 0;
    const country = String(c?.data?.localeCountry || 'US');
    const currency = String(c?.data?.currency || 'USD');

    // Intelligence: Efficiency Tiering
    let tier = 'Standard';
    let tierClass = 'ar-tier-standard';
    let tierColor = 'var(--color-text-muted)';
    
    if (rate >= 35) {
      tier = 'Elite';
      tierClass = 'ar-tier-elite';
      tierColor = '#f5a623'; // Gold
    } else if (rate >= 25) {
      tier = 'Pro';
      tierClass = 'ar-tier-pro';
      tierColor = 'var(--color-success)';
    } else if (rate >= 18) {
      tier = 'Active';
      tierClass = 'ar-tier-active';
      tierColor = 'var(--color-info)';
    }

    const fmtRate = formatCurrency(rate, country, { currency });
    const labelText = t('views.dashboard.financial.avgRateHr') || 'Avg $/hr';

    const scopedStyles = `
      <style>
        @keyframes arPulse {
          0% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 0.8; }
        }
        @keyframes arSlideIn {
          from { transform: translateX(-10px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        .ar-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          justify-content: flex-start;
          padding: 2px;
        }

        .ar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .ar-icon-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: color-mix(in srgb, #0ea5e9 12%, var(--color-surface-raised));
          color: #0ea5e9;
        }

        .ar-tier-badge {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 3px 8px;
          border-radius: 6px;
          border: 1px solid var(--color-border);
          background: var(--color-surface-raised);
          color: var(--color-text-main);
        }

        .ar-body {
          margin-top: 0;
          animation: arSlideIn 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .ar-val {
          font-size: 1.8rem;
          font-weight: 900;
          line-height: 1.1;
          letter-spacing: -0.03em;
          color: var(--color-text-main);
          font-variant-numeric: tabular-nums;
        }

        .ar-sub {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 700;
          color: var(--color-text-muted);
          margin-top: 4px;
        }

        .ar-unit {
          font-size: 0.55em;
          font-weight: 800;
          color: #0ea5e9;
          margin-left: 4px;
          opacity: 0.9;
        }

        .ar-stars {
          display: flex;
          gap: 3px;
          margin-top: 10px;
          color: #0ea5e9;
          opacity: 0.9;
        }
      </style>
    `;

    const starsHTML = Array.from({ length: 3 }).map((_, i) => {
      const active = i < starCount;
      return `<svg width="12" height="12" fill="${active ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
    }).join('');

    // Generate a simple sparkline for the background
    const rollingPoints = Array.from({ length: 12 }).map(() => rate * (0.8 + Math.random() * 0.4));
    const maxP = Math.max(...rollingPoints, 1);
    const minP = Math.min(...rollingPoints);
    const rng = (maxP - minP) || 1;
    const sparkPath = rollingPoints.map((p, i) => {
      const x = (i / (rollingPoints.length - 1)) * 100;
      const y = 40 - ((p - minP) / rng) * 25;
      return `${x},${y}`;
    }).join(' L ');

    return `
      ${scopedStyles}
      <div class="ar-container">
        <div class="ar-header">
          <div class="ar-icon-wrap">${_IC_ZAP}</div>
        </div>

        <div class="ar-body" style="position: relative; z-index: 2;">
          <div class="ar-val">
            ${esc(fmtRate)}<span class="ar-unit">/hr</span>
          </div>
          <div class="ar-sub">
            <span>Avg over ${hours.toFixed(1)} hrs</span>
          </div>
        </div>

        <!-- Background Graph -->
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" style="position: absolute; bottom: 35px; left: 0; width: 100%; height: 35px; opacity: 0.15; color: #0ea5e9; pointer-events: none; z-index: 1;">
          <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M ${sparkPath}" />
        </svg>

        <!-- Bottom Tier Pill -->
        <div style="margin-top: auto; display: flex;">
           <div style="background: var(--color-surface-raised); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; color: var(--color-text-main); display: flex; gap: 6px; align-items: center; border: 1px solid var(--color-border);">
              <span style="color: #0ea5e9;">${esc(tier)}</span> 
              <span style="opacity: 0.7; font-size: 9px;">EFFICIENCY</span>
           </div>
        </div>
      </div>
    `;
  },

  afterRender: (_el, _ctx) => {},
  destroy: (_el) => {},
};
