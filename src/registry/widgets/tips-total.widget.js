import { formatCurrency } from '../../utils/formatters.js';
import { t } from '../../utils/strings.js';
import { esc } from './esc.js';

export default {
  id: 'tipsTotal',
  label: 'Tips Total',
  defaultSize: '1x1',
  defaultVisible: false,
  category: 'financial',
  
  /** @param {unknown} ctx */
  render: async (ctx) => {
    const c = /** @type {{ data?: { financial?: { tips?: number, gross?: number }; localeCountry?: string; currency?: string } }} */ (ctx);
    
    const tips = Number(c?.data?.financial?.tips) || 0;
    const gross = Number(c?.data?.financial?.gross) || 0;
    const country = String(c?.data?.localeCountry || 'US');
    const currency = String(c?.data?.currency || 'USD');

    // Calculate how much of their total income is purely from tips
    const tipsPct = gross > 0 ? (tips / gross) * 100 : 0;
    
    const labelText = t('views.dashboard.financial.tipsTotal') || 'Tips Total';
    const formattedTips = formatCurrency(tips, country, { currency });

    const scopedStyles = `
      <style>
        /* A premium metallic/shimmer text effect for the tip value */
        @keyframes shimmerText {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }

        /* Ambient floating particles to represent "extra" value */
        @keyframes floatSparkle {
          0% { transform: translateY(10px) scale(0.5) rotate(0deg); opacity: 0; }
          30% { opacity: 0.6; }
          70% { opacity: 0.6; }
          100% { transform: translateY(-30px) scale(1.2) rotate(45deg); opacity: 0; }
        }
        
        @keyframes scaleIn {
          0% { transform: scale(0.9); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }

        .tt-container { display: flex; flex-direction: column; height: 100%; justify-content: space-between; padding: 4px; position: relative; }
        
        .tt-header { display: flex; align-items: center; gap: 10px; position: relative; z-index: 2; }
        .tt-icon-wrap {
          display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; 
          border-radius: 8px; background: color-mix(in srgb, var(--widget-accent, #3b82f6) 15%, transparent); 
          color: var(--widget-accent, #3b82f6);
        }

        /* Typography & Value */
        .tt-body { margin-top: 12px; position: relative; z-index: 2; animation: scaleIn 0.4s cubic-bezier(0.2, 0.8, 0.2, 1); }
        
        .tt-value { 
          font-size: 2.25rem; 
          font-weight: 800; 
          line-height: 1.1; 
          letter-spacing: -0.03em; 
          /* The Shimmer Gradient */
          background: linear-gradient(
            110deg, 
            var(--color-text-main) 0%, 
            var(--color-text-main) 40%, 
            var(--widget-accent, #3b82f6) 50%, 
            var(--color-text-main) 60%, 
            var(--color-text-main) 100%
          );
          background-size: 200% auto;
          color: transparent;
          -webkit-background-clip: text;
          background-clip: text;
          animation: shimmerText 5s linear infinite;
        }

        /* Insight Badge */
        .tt-badge {
          display: inline-flex; align-items: center; gap: 6px; margin-top: 8px;
          font-size: 0.7rem; font-weight: 700; letter-spacing: 0.03em;
          color: var(--color-text-main); 
          background: var(--color-surface-raised, rgba(150, 150, 150, 0.15));
          padding: 4px 8px; border-radius: 6px;
          box-shadow: inset 0 1px 2px rgba(255,255,255,0.05);
        }
        .tt-badge-highlight { color: var(--widget-accent, #3b82f6); font-weight: 800; font-variant-numeric: tabular-nums; }

        /* Floating Background Particles */
        .tt-particle-layer { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 1; border-radius: inherit; }
        .tt-sparkle { position: absolute; fill: var(--widget-accent, #3b82f6); opacity: 0; mix-blend-mode: screen; }
        .tt-sparkle-1 { right: 10%; bottom: 15%; width: 20px; animation: floatSparkle 4s infinite 0.5s; }
        .tt-sparkle-2 { right: 25%; bottom: 5%; width: 12px; animation: floatSparkle 3.5s infinite 1.8s; }
        .tt-sparkle-3 { right: 5%; bottom: 30%; width: 14px; animation: floatSparkle 5s infinite 3.2s; }
      </style>
    `;

    return `
      ${scopedStyles}
      <div class="tt-container">
        
        <!-- Header -->
        <div class="tt-header">
          <div class="tt-icon-wrap">
            <!-- Sparkle / Star Icon -->
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
              <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"></path>
            </svg>
          </div>
          <span class="stat-label">${esc(labelText)}</span>
          <button type="button" class="btn btn-sm btn-success" style="margin-left: auto; padding: 2px 8px; font-size: 11px; height: 24px;">+ Add</button>
        </div>

        <!-- Metric Body -->
        <div class="tt-body">
          <div class="tt-value">${esc(formattedTips)}</div>
          
          <!-- Intelligence Badge -->
          ${tipsPct > 0 ? `
            <div class="tt-badge">
              <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24" style="color: var(--widget-accent);">
                <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"></path>
              </svg>
              <span><span class="tt-badge-highlight">${tipsPct.toFixed(1)}%</span> of total earnings</span>
            </div>
          ` : `
            <div class="tt-badge" style="background: rgba(150, 150, 150, 0.1); border: 1px solid rgba(255,255,255,0.05);">Awaiting tips</div>
          `}
        </div>

        <!-- Ambient Particle Animation Layer -->
        <div class="tt-particle-layer">
          <svg class="tt-sparkle tt-sparkle-1" viewBox="0 0 24 24"><path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"></path></svg>
          <svg class="tt-sparkle tt-sparkle-2" viewBox="0 0 24 24"><path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"></path></svg>
          <svg class="tt-sparkle tt-sparkle-3" viewBox="0 0 24 24"><path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"></path></svg>
        </div>

      </div>
    `;
  },
  
  afterRender: (_el, _ctx) => {},
  destroy: (_el) => {},
};
