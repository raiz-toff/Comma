import { formatCurrency } from '../../utils/formatters.js';
import { t }              from '../../utils/strings.js';
import { esc }            from './esc.js';

// Premium, clean SVG card icon
const _IC_CARD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`;

// Filled gradient abstract floating credit card for the background visual
const _getBgVisual = (start, end) => `<svg viewBox="0 0 24 24" stroke="none"><defs><linearGradient id="oop-grad" x1="0%" y1="100%" x2="0%" y2="0%"><stop offset="0%" stop-color="${start}" /><stop offset="50%" stop-color="${end}" /><stop offset="100%" stop-color="${start}" /></linearGradient></defs><rect x="1" y="4" width="22" height="16" rx="2" fill="url(#oop-grad)" opacity="0.15"/><rect x="1" y="4" width="22" height="16" rx="2" stroke="url(#oop-grad)" stroke-width="1.5" fill="none" opacity="0.3"/><line x1="1" y1="10" x2="23" y2="10" stroke="rgba(0,0,0,0.5)" stroke-width="1.5" opacity="0.4"/></svg>`;

export default {
  id: 'outOfPocket',
  label: 'Out of Pocket',
  defaultSize: '1x1',
  defaultVisible: false,
  category: 'financial',

  render: async (ctx) => {
    const c        = /** @type {any} */ (ctx);
    const val      = Number(c?.data?.financial?.outOfPocket) || 0;
    const gross    = Number(c?.data?.financial?.gross)       || 0;
    const country  = String(c?.data?.localeCountry || 'US');
    const currency = String(c?.data?.currency      || 'USD');
    
    const pct      = gross > 0 ? (val / gross) * 100 : null;
    const safePct  = pct !== null ? Math.min(100, Math.max(0, pct)) : 0;

    // Intelligence tiers tailored for expenses (lower is better)
    let tierClass = 'oop-tier-neutral';
    let gradStart = '#8a8f98';
    let gradEnd   = '#4b5563';

    if (pct !== null) {
      if (pct <= 10) {
        tierClass = 'oop-tier-elite';
        gradStart = '#10b981'; // Emerald (Excellent, low costs)
        gradEnd   = '#34d399';
      } else if (pct <= 20) {
        tierClass = 'oop-tier-pro';
        gradStart = '#3b82f6'; // Blue (Good, manageable)
        gradEnd   = '#60a5fa';
      } else if (pct <= 30) {
        tierClass = 'oop-tier-active';
        gradStart = '#f5a623'; // Amber (Getting high)
        gradEnd   = '#fbbf24';
      } else {
        tierClass = 'oop-tier-warning';
        gradStart = '#f43f5e'; // Rose (Warning, high out of pocket)
        gradEnd   = '#fb7185';
      }
    }

    const labelText = t('views.dashboard.financial.outOfPocket') || 'Out of Pocket';

    const scopedStyles = `
      <style>
        @keyframes cardFloat {
          0%, 100% { transform: scale(1) translateY(0) rotate(-5deg); opacity: 0.15; }
          50% { transform: scale(1.05) translateY(-4px) rotate(-8deg); opacity: 0.25; }
        }
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes barGrow {
          from { width: 0%; opacity: 0; }
          to { opacity: 1; }
        }

        .oop-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          justify-content: space-between;
          padding: 6px;
          position: relative;
          overflow: hidden;
        }

        .oop-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 2;
        }

        .oop-icon-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: color-mix(in srgb, ${gradStart} 15%, transparent);
          color: ${gradStart};
        }

        .oop-badge {
          font-size: 0.65rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 3px 8px;
          border-radius: 6px;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.1);
        }
        .oop-tier-elite   { color: #10b981; background: color-mix(in srgb, #10b981 15%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, #10b981 30%, transparent); }
        .oop-tier-pro     { color: #3b82f6; background: color-mix(in srgb, #3b82f6 15%, transparent); }
        .oop-tier-active  { color: #f5a623; background: color-mix(in srgb, #f5a623 15%, transparent); }
        .oop-tier-warning { color: #f43f5e; background: color-mix(in srgb, #f43f5e 15%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, #f43f5e 30%, transparent); }
        .oop-tier-neutral { color: var(--color-text-muted, #8a8f98); background: var(--color-surface-raised, rgba(255,255,255,0.05)); }

        .oop-body {
          display: flex;
          flex-direction: column;
          z-index: 2;
          animation: slideUpFade 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
          margin-top: auto;
        }

        .oop-val-wrapper {
          display: flex;
          align-items: baseline;
          gap: 6px;
        }

        .oop-val {
          font-size: 2.3rem;
          font-weight: 900;
          line-height: 1;
          letter-spacing: -0.04em;
          font-variant-numeric: tabular-nums;
          background: linear-gradient(135deg, ${gradStart} 0%, ${gradEnd} 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .oop-progress-track {
          width: 100%;
          height: 4px;
          background: var(--color-surface-raised, rgba(255,255,255,0.05));
          border-radius: 2px;
          margin-top: 10px;
          margin-bottom: 6px;
          overflow: hidden;
        }

        .oop-progress-fill {
          height: 100%;
          border-radius: 2px;
          background: linear-gradient(90deg, ${gradStart}, ${gradEnd});
          animation: barGrow 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }

        .oop-sub {
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--color-text-muted, #8a8f98);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .oop-bg-visual {
          position: absolute;
          right: -10%;
          bottom: -15%;
          width: 120px;
          height: 120px;
          z-index: 0;
          pointer-events: none;
          animation: cardFloat 6s ease-in-out infinite;
          transform: rotate(-5deg);
        }
      </style>
    `;

    return `
      ${scopedStyles}
      <div class="oop-container">
        
        <div class="oop-header">
          <div class="oop-icon-wrap">
            ${_IC_CARD}
          </div>
          ${pct !== null ? `<div class="oop-badge ${tierClass}">${pct.toFixed(1)}% of Gross</div>` : `<div class="oop-badge ${tierClass}">No Data</div>`}
        </div>

        <div class="oop-body">
          <div class="oop-val-wrapper">
            <span class="oop-val" 
                  data-target="${val}" 
                  data-country="${esc(country)}" 
                  data-currency="${esc(currency)}">
              &minus;${esc(formatCurrency(0, country, { currency }))}
            </span>
          </div>
          
          ${pct !== null ? `
          <div class="oop-progress-track">
            <div class="ni-progress-fill" style="width: ${safePct}%;"></div>
          </div>
          <span class="oop-sub">Real Out-of-Pocket Costs</span>
          ` : '<span class="oop-sub">Out of Pocket</span>'}
        </div>

        <!-- Abstract floating background visual -->
        <div class="oop-bg-visual">
          ${val > 0 || gross > 0 ? _getBgVisual(gradStart, gradEnd) : ''}
        </div>

      </div>
    `;
  },

  afterRender: (el, _ctx) => {
    // Elegant currency counting animation
    const valEl = el.querySelector('.oop-val');
    if (!valEl) return;

    const target = parseFloat(valEl.getAttribute('data-target') || '0');
    if (target === 0) {
      const country = valEl.getAttribute('data-country') || 'US';
      const currency = valEl.getAttribute('data-currency') || 'USD';
      valEl.innerHTML = `&minus;${formatCurrency(0, country, { currency })}`;
      return;
    }

    const country = valEl.getAttribute('data-country') || 'US';
    const currency = valEl.getAttribute('data-currency') || 'USD';

    const duration = 1500; // 1.5 seconds
    const start = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - start;
      const progress = Math.min(elapsed / duration, 1);
      
      // easeOutQuart for a snappy start and slow settle
      const ease = 1 - Math.pow(1 - progress, 4);
      const currentVal = target * ease;
      
      // Prepend the minus sign dynamically during animation
      valEl.innerHTML = `&minus;${formatCurrency(currentVal, country, { currency })}`;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Ensure exact final exact value is set
        valEl.innerHTML = `&minus;${formatCurrency(target, country, { currency })}`;
      }
    };

    requestAnimationFrame(animate);
  },
  
  destroy: (_el) => {},
};
