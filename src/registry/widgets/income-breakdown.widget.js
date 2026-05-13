import { formatCurrency } from '../../utils/formatters.js';
import { t } from '../../utils/strings.js';
import { esc } from './esc.js';

export default {
  id: 'incomeBreakdown',
  label: 'Income Breakdown',
  defaultSize: '2x2',
  defaultVisible: false,
  category: 'analytics',

  /** @param {unknown} ctx */
  render: async (ctx) => {
    // 1. Safe Data Extraction & Fallbacks
    const c = /** @type {{ data?: { financial?: { gross?: number, tips?: number, bonus?: number } }; localeCountry?: string; currency?: string } }} */ (ctx);
    
    const gross = Number(c?.data?.financial?.gross) || 0;
    const tips = Number(c?.data?.financial?.tips) || 0;
    const bonus = Number(c?.data?.financial?.bonus) || 0;
    
    // Ensure base pay never goes negative due to floating math
    const base = Math.max(0, gross - tips - bonus);

    const country = String(c?.data?.localeCountry || 'US');
    const currency = String(c?.data?.currency || 'USD');

    // 2. Percentage Calculations for the Infographic Bar
    const basePct = gross > 0 ? (base / gross) * 100 : 0;
    const tipsPct = gross > 0 ? (tips / gross) * 100 : 0;
    const bonusPct = gross > 0 ? (bonus / gross) * 100 : 0;

    // Translation fallbacks
    const labelText = t('analytics.incomeBreakdown') || 'Income Breakdown';

    // 3. Scoped CSS for the bespoke infographic (removes Chart.js dependency)
    const scopedStyles = `
      <style>
        @keyframes slideFill {
          0% { width: 0%; opacity: 0; }
          100% { opacity: 1; }
        }
        .ib-container { display: flex; flex-direction: column; height: 100%; padding: 4px; }
        
        /* Stacked Bar */
        .ib-bar-wrapper { 
          display: flex; 
          height: 14px; 
          border-radius: 8px; 
          overflow: hidden; 
          background: var(--color-surface-raised, rgba(150, 150, 150, 0.15)); 
          gap: 2px; 
          margin: 16px 0 12px 0; 
          box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
        }
        .ib-segment { height: 100%; animation: slideFill 1s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
        .ib-segment.base { background: var(--widget-accent, #8b5cf6); }
        .ib-segment.tips { background: #10b981; } /* Emerald */
        .ib-segment.bonus { background: #f5a623; } /* Amber */

        /* Legend Layout */
        .ib-legend { display: flex; flex-direction: column; gap: 8px; flex-grow: 1; justify-content: flex-end; }
        .ib-legend-row { display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; }
        .ib-label-group { display: flex; align-items: center; gap: 8px; }
        .ib-dot { width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 0 2px color-mix(in srgb, currentColor 20%, transparent); }
        .ib-dot.base { background: var(--widget-accent, #8b5cf6); color: var(--widget-accent, #8b5cf6); }
        .ib-dot.tips { background: #10b981; color: #10b981; }
        .ib-dot.bonus { background: #f5a623; color: #f5a623; }
        .ib-name { font-weight: 700; color: var(--color-text-muted, #888); text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.65rem; }
        .ib-value { font-weight: 800; font-variant-numeric: tabular-nums; }
        .ib-pct { color: var(--color-text-muted, #888); font-size: 0.65rem; font-weight: 600; min-width: 28px; text-align: right; }
      </style>
    `;

    // 4. HTML Composition
    return `
      ${scopedStyles}
      <div class="ib-container">
        
        <!-- Header -->
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; background: color-mix(in srgb, var(--widget-accent, #8b5cf6) 15%, transparent); color: var(--widget-accent, #8b5cf6);">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
              <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
              <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
            </svg>
          </div>
          <span class="stat-label">${esc(labelText)}</span>
        </div>

        <!-- Animated Stacked Progress Bar -->
        <div class="ib-bar-wrapper">
          <div class="ib-segment base" style="width: ${basePct}%;" title="Base: ${basePct.toFixed(1)}%"></div>
          <div class="ib-segment tips" style="width: ${tipsPct}%;" title="Tips: ${tipsPct.toFixed(1)}%"></div>
          <div class="ib-segment bonus" style="width: ${bonusPct}%;" title="Bonus: ${bonusPct.toFixed(1)}%"></div>
        </div>

        <!-- Dense Data Legend -->
        <div class="ib-legend">
          <div class="ib-legend-row">
            <div class="ib-label-group">
              <div class="ib-dot base"></div>
              <span class="ib-name">${esc(t('analytics.basePay'))}</span>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="ib-value">${esc(formatCurrency(base, country, { currency }))}</span>
              <span class="ib-pct">${Math.round(basePct)}%</span>
            </div>
          </div>
          
          <div class="ib-legend-row">
            <div class="ib-label-group">
              <div class="ib-dot tips"></div>
              <span class="ib-name">${esc(t('analytics.tipsLabel'))}</span>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="ib-value">${esc(formatCurrency(tips, country, { currency }))}</span>
              <span class="ib-pct">${Math.round(tipsPct)}%</span>
            </div>
          </div>

          <div class="ib-legend-row">
            <div class="ib-label-group">
              <div class="ib-dot bonus"></div>
              <span class="ib-name">${esc(t('analytics.bonusPromo'))}</span>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="ib-value">${esc(formatCurrency(bonus, country, { currency }))}</span>
              <span class="ib-pct">${Math.round(bonusPct)}%</span>
            </div>
          </div>

        </div>

      </div>
    `;
  },
  
  afterRender: (_el, _ctx) => {},
  destroy: (_el) => {},
};
