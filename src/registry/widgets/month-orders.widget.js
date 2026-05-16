import { formatLargeNumber } from '../../utils/formatters.js';
import { t }                 from '../../utils/strings.js';
import { esc }               from './esc.js';

// Premium, clean SVG isometric package/box icon
const _IC_PKG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`;

// Filled gradient abstract floating box for the background visual
const _getBgVisual = (start, end) => `<svg viewBox="0 0 24 24" fill="none" stroke="none"><defs><linearGradient id="mo-grad" x1="0%" y1="100%" x2="0%" y2="0%"><stop offset="0%" stop-color="${start}" /><stop offset="50%" stop-color="${end}" /><stop offset="100%" stop-color="${start}" /></linearGradient></defs><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" fill="url(#mo-grad)" opacity="0.1"/><polyline points="3.27 6.96 12 12.01 20.73 6.96" stroke="rgba(0,0,0,0.5)" stroke-width="1.5" opacity="0.4"/><line x1="12" y1="22.08" x2="12" y2="12" stroke="rgba(0,0,0,0.5)" stroke-width="1.5" opacity="0.4"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="url(#mo-grad)" stroke-width="1.5" opacity="0.3"/></svg>`;

export default {
  id: 'monthOrders',
  label: 'Monthly Orders',
  defaultSize: '1x1',
  defaultVisible: false,
  category: 'analytics',

  render: async (ctx) => {
    const c     = /** @type {any} */ (ctx);
    const n     = Math.round(Number(c?.data?.monthSummary?.orders) || 0);
    const month = new Date().toLocaleString('default', { month: 'short' });
    const daily = n > 0 ? (n / new Date().getDate()).toFixed(1) : null;

    // Intelligence tiers tailored for monthly order volume
    let tierClass = 'mo-tier-neutral';
    let gradStart = '#8a8f98';
    let gradEnd = '#4b5563';

    if (n >= 250) {
      tierClass = 'mo-tier-elite';
      gradStart = '#f43f5e'; // Rose
      gradEnd = '#f5a623';   // Amber
    } else if (n >= 150) {
      tierClass = 'mo-tier-pro';
      gradStart = '#f5a623'; // Amber
      gradEnd = '#fbbf24';   // Yellow
    } else if (n >= 50) {
      tierClass = 'mo-tier-active';
      gradStart = '#10b981'; // Emerald
      gradEnd = '#34d399';
    } else if (n > 0) {
      tierClass = 'mo-tier-started';
      gradStart = '#3b82f6'; // Blue
      gradEnd = '#60a5fa';
    }

    const labelText = t('analytics.orders') || 'Orders';

    const scopedStyles = `
      <style>
        @keyframes boxFloat {
          0%, 100% { transform: scale(1) translateY(0) rotate(0deg); opacity: 0.15; }
          50% { transform: scale(1.05) translateY(-4px) rotate(-3deg); opacity: 0.25; }
        }
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .mo-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          justify-content: space-between;
          padding: 6px;
          position: relative;
          overflow: hidden;
        }

        .mo-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 2;
        }

        .mo-icon-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: color-mix(in srgb, ${gradStart} 15%, transparent);
          color: ${gradStart};
        }

        .mo-badge {
          font-size: 0.65rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 3px 8px;
          border-radius: 6px;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.1);
        }
        .mo-tier-elite   { color: #f43f5e; background: color-mix(in srgb, #f43f5e 15%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, #f43f5e 30%, transparent); }
        .mo-tier-pro     { color: #f5a623; background: color-mix(in srgb, #f5a623 15%, transparent); }
        .mo-tier-active  { color: #10b981; background: color-mix(in srgb, #10b981 15%, transparent); }
        .mo-tier-started { color: #3b82f6; background: color-mix(in srgb, #3b82f6 15%, transparent); }
        .mo-tier-neutral { color: var(--color-text-muted, #8a8f98); background: var(--color-surface-raised, rgba(255,255,255,0.05)); }

        .mo-body {
          display: flex;
          flex-direction: column;
          z-index: 2;
          animation: slideUpFade 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .mo-val-wrapper {
          display: flex;
          align-items: baseline;
          gap: 6px;
        }

        .mo-val {
          font-size: 2.5rem;
          font-weight: 900;
          line-height: 1;
          letter-spacing: -0.04em;
          font-variant-numeric: tabular-nums;
          background: linear-gradient(135deg, ${gradStart} 0%, ${gradEnd} 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .mo-sub {
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--color-text-muted, #8a8f98);
          margin-top: 4px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .mo-bg-visual {
          position: absolute;
          right: -10%;
          bottom: -15%;
          width: 120px;
          height: 120px;
          z-index: 0;
          pointer-events: none;
          animation: boxFloat 6s ease-in-out infinite;
        }
      </style>
    `;

    return `
      ${scopedStyles}
      <div class="mo-container">
        
        <div class="mo-header">
          <div class="mo-icon-wrap">
            ${_IC_PKG}
          </div>
          <div class="mo-badge ${tierClass}">
            ${esc(month)}
          </div>
        </div>

        <div class="mo-body">
          <div class="mo-val-wrapper">
            <span class="mo-val" data-target="${n}">0</span>
          </div>
          <span class="mo-sub">${daily ? `≈ ${esc(daily)} / day avg` : 'This Month\'s Deliveries'}</span>
        </div>

        <!-- Abstract floating background visual -->
        <div class="mo-bg-visual">
          ${n > 0 ? _getBgVisual(gradStart, gradEnd) : ''}
        </div>

      </div>
    `;
  },

  afterRender: (el, _ctx) => {
    // Elegant number counting animation
    const valEl = el.querySelector('.mo-val');
    if (!valEl) return;

    const target = parseInt(valEl.getAttribute('data-target') || '0', 10);
    if (target === 0) return;

    const duration = 1500; // 1.5 seconds
    const start = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - start;
      const progress = Math.min(elapsed / duration, 1);
      
      // easeOutQuart for a snappy start and slow settle
      const ease = 1 - Math.pow(1 - progress, 4);
      const currentVal = Math.floor(target * ease);
      
      valEl.textContent = formatLargeNumber(currentVal);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Ensure exact final value is hit
        valEl.textContent = formatLargeNumber(target);
      }
    };

    requestAnimationFrame(animate);
  },
  
  destroy: (_el) => {},
};
