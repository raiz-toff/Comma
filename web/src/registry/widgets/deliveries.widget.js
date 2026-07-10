import { formatLargeNumber } from '../../utils/formatters.js';
import { t } from '../../utils/strings.js';
import { esc } from './esc.js';

export default {
  id: 'deliveries',
  label: 'Deliveries',
  defaultSize: '1x1',
  defaultVisible: false,
  category: 'financial',

  /** @param {unknown} ctx */
  render: async (ctx) => {
    // Safely extract the orders data, defaulting to 0
    const c = /** @type {{ data?: { financial?: { orders?: number } } }} */ (ctx);
    const n = Math.round(Number(c?.data?.financial?.orders) || 0);
    
    // Formatting the number and grabbing translations
    const formattedDeliveries = formatLargeNumber(n);
    const labelText = t('views.dashboard.financial.deliveries') || 'Deliveries';

    const scopedStyles = `
      <style>
        /* Fade and slide up for the main number */
        @keyframes dlvFadeUp {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        /* The moving delivery dot animation */
        @keyframes dlvRouteDrive {
          0% { left: 0%; opacity: 0; transform: scale(0.5); }
          15% { opacity: 1; transform: scale(1); }
          85% { opacity: 1; transform: scale(1); }
          100% { left: calc(100% - 8px); opacity: 0; transform: scale(0.5); }
        }

        .dlv-container { 
          display: flex; 
          flex-direction: column; 
          height: 100%; 
          justify-content: space-between; 
          padding: 4px; 
        }
        
        .dlv-header { 
          display: flex; 
          align-items: center; 
          gap: 10px; 
        }
        
        .dlv-icon-wrapper {
          display: flex; 
          align-items: center; 
          justify-content: center; 
          width: 32px; 
          height: 32px; 
          border-radius: 8px; 
          background: color-mix(in srgb, var(--widget-accent, #3b82f6) 15%, transparent); 
          color: var(--widget-accent, #3b82f6);
        }

        .dlv-body { 
          margin-top: 12px; 
          animation: dlvFadeUp 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
        
        .dlv-main-value { 
          font-size: 2.25rem; 
          font-weight: 800; 
          line-height: 1.1; 
          letter-spacing: -0.03em; 
          color: var(--color-text-main); 
          font-variant-numeric: tabular-nums;
        }
        
        .dlv-subtext { 
          font-size: 0.7rem; 
          font-weight: 700; 
          color: var(--color-text-muted, #888); 
          margin-top: 6px; 
          text-transform: uppercase; 
          letter-spacing: 0.08em; 
          opacity: 0.8; 
        }

        /* Animated logistics visualizer */
        .dlv-route-wrap { 
          position: relative; 
          height: 16px; 
          display: flex; 
          align-items: center; 
          margin-top: auto; 
          padding-top: 16px; 
        }
        
        /* Dashed track background */
        .dlv-route-track { 
          width: 100%; 
          height: 2px; 
          background-image: linear-gradient(to right, var(--color-surface-raised, rgba(150, 150, 150, 0.3)) 50%, transparent 50%); 
          background-size: 8px 100%; 
          border-radius: 2px;
        }
        
        /* The moving delivery indicator */
        .dlv-route-dot { 
          position: absolute; 
          width: 8px; 
          height: 8px; 
          background: var(--widget-accent, #3b82f6); 
          border-radius: 50%; 
          top: 50%;
          margin-top: -4px; /* Centers dot vertically on the line */
          box-shadow: 0 0 8px color-mix(in srgb, var(--widget-accent, #3b82f6) 60%, transparent); 
          animation: dlvRouteDrive 3s infinite linear; 
        }
        
        /* Map pin markers at start and end */
        .dlv-route-pin {
          position: absolute;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--color-surface-raised, rgba(150, 150, 150, 0.8));
          top: 50%;
          margin-top: -2px;
        }
        .dlv-route-pin.start { left: 0; }
        .dlv-route-pin.end { right: 0; }
      </style>
    `;

    return `
      ${scopedStyles}
      <div class="dlv-container">
        
        <!-- Header -->
        <div class="dlv-header">
          <div class="dlv-icon-wrapper">
            <!-- Isometric Box / Package Icon -->
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
          </div>
          <span class="stat-label">${esc(labelText)}</span>
        </div>

        <!-- Typography -->
        <div class="dlv-body">
          <div class="dlv-main-value">
            ${esc(formattedDeliveries)}
          </div>
          <div class="dlv-subtext">
            Completed Orders
          </div>
        </div>

        <!-- Logistics Route Visualizer -->
        <div class="dlv-route-wrap">
          <div class="dlv-route-track"></div>
          <div class="dlv-route-pin start"></div>
          <div class="dlv-route-pin end"></div>
          <div class="dlv-route-dot"></div>
        </div>

      </div>
    `;
  },
  
  afterRender: (_el, _ctx) => {},
  destroy: (_el) => {},
};
