import { t } from '../../utils/strings.js';
import { esc } from './esc.js';

export default {
  id: 'totalHours',
  label: 'Total Hours',
  defaultSize: '1x1',
  defaultVisible: true,
  category: 'financial',
  
  /** @param {unknown} ctx */
  render: async (ctx) => {
    const c = /** @type {{ data?: { financial?: { hours?: number } } }} */ (ctx);
    const hrs = Number(c?.data?.financial?.hours) || 0;
    
    // Split the decimal for typographic styling (e.g., "42" and "50")
    const fixedHrs = hrs.toFixed(2);
    const [intPart, decPart] = fixedHrs.split('.');

    // Humanize the decimal into actual Hours & Minutes (e.g., 42h 30m)
    const exactHours = Math.floor(hrs);
    const exactMinutes = Math.round((hrs - exactHours) * 60);
    
    const labelText = t('views.dashboard.financial.totalHours') || 'Total Hours';
    const hrsSuffix = t('views.dashboard.financial.hoursSuffix') || 'hrs';

    const scopedStyles = `
      <style>
        /* Smooth infinite rotation for the abstract clock dials */
        @keyframes spinClockwise {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spinCounter {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes fadeUpIn {
          0% { opacity: 0; transform: translateY(5px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        .th-container { display: flex; flex-direction: column; height: 100%; justify-content: space-between; padding: 4px; position: relative; }
        
        .th-header { display: flex; align-items: center; gap: 10px; position: relative; z-index: 2; }
        .th-icon-wrap {
          display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; 
          border-radius: 8px; background: color-mix(in srgb, var(--widget-accent, #3b82f6) 15%, transparent); 
          color: var(--widget-accent, #3b82f6);
        }

        /* Typographic Odometer styling */
        .th-value-wrap { 
          margin-top: 8px; 
          display: flex; 
          align-items: baseline; 
          position: relative; 
          z-index: 2;
          animation: fadeUpIn 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .th-int { font-size: 2.5rem; font-weight: 800; line-height: 1; letter-spacing: -0.03em; color: var(--color-text-main); }
        .th-dec { font-size: 1.25rem; font-weight: 700; color: var(--color-text-muted, #888); margin-left: 1px; }
        .th-suffix { font-size: 0.8rem; font-weight: 700; color: var(--widget-accent); margin-left: 6px; text-transform: uppercase; letter-spacing: 0.05em; }

        /* The human-readable badge */
        .th-human-time {
          display: inline-flex; align-items: center; gap: 4px; margin-top: auto;
          font-size: 0.7rem; font-weight: 700; letter-spacing: 0.05em;
          color: var(--color-text-main); 
          background: var(--color-surface-raised, rgba(150, 150, 150, 0.15));
          padding: 4px 8px; border-radius: 6px;
          width: max-content;
          position: relative; z-index: 2;
        }
        .th-ht-highlight { color: var(--widget-accent); font-weight: 800; }

        /* Abstract Background Dials */
        .th-dial-svg {
          position: absolute;
          bottom: -15%;
          right: -10%;
          width: 65%;
          height: 65%;
          color: var(--widget-accent);
          opacity: 0.12; /* Subtle background presence */
          pointer-events: none;
          z-index: 1;
        }
        
        .th-ring-outer { transform-origin: 50px 50px; animation: spinClockwise 25s linear infinite; }
        .th-ring-inner { transform-origin: 50px 50px; animation: spinCounter 15s linear infinite; }
      </style>
    `;

    return `
      ${scopedStyles}
      <div class="th-container">
        
        <!-- Header -->
        <div class="th-header">
          <div class="th-icon-wrap">
            <!-- Stopwatch Icon -->
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
              <circle cx="12" cy="13" r="8"></circle>
              <path d="M12 9v4l2 2"></path>
              <path d="M10 2h4"></path>
            </svg>
          </div>
          <span class="stat-label">${esc(labelText)}</span>
        </div>

        <!-- Big Metric -->
        <div class="th-value-wrap">
          <span class="th-int">${esc(intPart)}</span>
          <span class="th-dec">.${esc(decPart)}</span>
          <span class="th-suffix">${esc(hrsSuffix)}</span>
        </div>

        <!-- Translated Hours & Minutes Badge -->
        <div class="th-human-time">
          <svg width="12" height="12" fill="none" stroke="var(--widget-accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
          </svg>
          <span class="th-ht-highlight">${exactHours}h</span>
          <span class="th-ht-highlight">${exactMinutes}m</span>
          <span>ACTIVE</span>
        </div>

        <!-- Abstract Motion Background -->
        <svg class="th-dial-svg" viewBox="0 0 100 100">
          <circle class="th-ring-outer" cx="50" cy="50" r="42" fill="none" stroke="currentColor" stroke-width="6" stroke-dasharray="14 10" stroke-linecap="round"></circle>
          <circle class="th-ring-inner" cx="50" cy="50" r="28" fill="none" stroke="currentColor" stroke-width="4" stroke-dasharray="6 8" stroke-linecap="round"></circle>
        </svg>

      </div>
    `;
  },
  
  afterRender: (_el, _ctx) => {},
  destroy: (_el) => {},
};
