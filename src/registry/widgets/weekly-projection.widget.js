import { formatCurrency } from '../../utils/formatters.js';
import { t } from '../../utils/strings.js';
import { esc } from './esc.js';

export default {
  id: 'weeklyProjection',
  label: 'Weekly Projection',
  defaultSize: '2x2',
  defaultVisible: false,
  category: 'analytics',

  /** @param {unknown} ctx */
  render: async (ctx) => {
    const c = /** @type {{ data?: { projection?: number, financial?: { gross?: number }, localeCountry?: string, currency?: string } }} */ (ctx);
    
    // Fallbacks and safe extraction
    const projected = Number(c?.data?.projection) || 0;
    const actual = Number(c?.data?.financial?.gross) || 0; 
    const country = String(c?.data?.localeCountry || 'US');
    const currency = String(c?.data?.currency || 'USD');

    // Math for the progress bar
    const rawPct = projected > 0 ? (actual / projected) * 100 : 0;
    const boundedPct = Math.min(100, Math.max(0, rawPct)); // Caps the CSS width at 100%
    const isGoalMet = rawPct >= 100;

    // Formatting values
    const fmtProjected = formatCurrency(projected, country, { currency });
    const fmtActual = formatCurrency(actual, country, { currency });
    const labelText = t('analytics.weeklyProjection') || 'Weekly Projection';

    const scopedStyles = `
      <style>
        /* Smooth filling animation */
        @keyframes fillProgress {
          0% { width: 0%; opacity: 0.5; }
          100% { width: ${boundedPct}%; opacity: 1; }
        }
        /* Glowing pulse for when the goal is met or exceeded */
        @keyframes successPulse {
          0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--widget-accent) 40%, transparent); }
          70% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--widget-accent) 0%, transparent); }
          100% { box-shadow: 0 0 0 0 transparent; }
        }

        .wp-container { display: flex; flex-direction: column; height: 100%; justify-content: space-between; padding: 4px; }
        
        .wp-header { display: flex; align-items: center; gap: 10px; }
        .wp-icon-wrapper {
          display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; 
          border-radius: 8px; background: color-mix(in srgb, var(--widget-accent, #f5a623) 15%, transparent); 
          color: var(--widget-accent, #f5a623);
        }

        .wp-main-value { font-size: 2.25rem; font-weight: 800; line-height: 1.1; letter-spacing: -0.03em; color: var(--color-text-main); margin-top: 12px; }
        
        .wp-progress-section { margin-top: auto; padding-top: 12px; }
        
        .wp-progress-meta { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 6px; font-size: 0.75rem; font-weight: 700; color: var(--color-text-muted, #888); }
        .wp-actual-val { color: var(--color-text-main); font-variant-numeric: tabular-nums; }
        .wp-pct-val { font-variant-numeric: tabular-nums; ${isGoalMet ? 'color: var(--widget-accent);' : ''} }
        
        .wp-bar-track { 
          height: 8px; 
          width: 100%; 
          background: var(--color-surface-raised, rgba(150, 150, 150, 0.15)); 
          border-radius: 999px; 
          overflow: hidden; 
          position: relative;
        }
        
        .wp-bar-fill {
          height: 100%; 
          background: var(--widget-accent, #f5a623); 
          border-radius: 999px; 
          width: 0%; /* Starting point for animation */
          animation: fillProgress 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
          position: absolute;
          left: 0;
          top: 0;
        }

        /* Apply pulse if they hit their target */
        .wp-bar-fill.success {
          animation: fillProgress 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards, successPulse 2s infinite 1.2s;
        }
      </style>
    `;

    return `
      ${scopedStyles}
      <div class="wp-container">
        
        <!-- Header -->
        <div class="wp-header">
          <div class="wp-icon-wrapper">
            <!-- Bullseye / Target Icon -->
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"></circle>
              <circle cx="12" cy="12" r="6"></circle>
              <circle cx="12" cy="12" r="2"></circle>
            </svg>
          </div>
          <span class="stat-label">${esc(labelText)}</span>
        </div>

        <!-- Big Projection Number -->
        <div class="wp-main-value">
          ${esc(fmtProjected)}
        </div>

        <!-- Progress Tracking -->
        <div class="wp-progress-section">
          <div class="wp-progress-meta">
            <span>Actual: <span class="wp-actual-val">${esc(fmtActual)}</span></span>
            <span class="wp-pct-val">${Math.round(rawPct)}%</span>
          </div>
          
          <div class="wp-bar-track">
            <div class="wp-bar-fill ${isGoalMet ? 'success' : ''}"></div>
          </div>
        </div>

      </div>
    `;
  },
  
  afterRender: (_el, _ctx) => {},
  destroy: (_el) => {},
};
