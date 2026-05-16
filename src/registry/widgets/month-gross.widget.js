import { formatCurrency } from '../../utils/formatters.js';
import { t }              from '../../utils/strings.js';
import { esc }            from './esc.js';

// Premium, clean SVG dollar icon
const _IC_DOLLAR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`;

// Filled gradient abstract coin for the background visual
const _getBgVisual = (start, end) => `<svg viewBox="0 0 24 24" fill="url(#mg-grad)" opacity="0.15" stroke="none"><defs><linearGradient id="mg-grad" x1="0%" y1="100%" x2="0%" y2="0%"><stop offset="0%" stop-color="${start}" /><stop offset="50%" stop-color="${end}" /><stop offset="100%" stop-color="${start}" /></linearGradient></defs><circle cx="12" cy="12" r="10"/><path stroke="rgba(0,0,0,0.5)" stroke-width="1.5" stroke-linecap="round" d="M12 6v12m-3-9a3 3 0 013-3h.5a3 3 0 010 6H11a3 3 0 000 6h1.5a3 3 0 003-3"/></svg>`;

export default {
  id: 'monthGross',
  label: 'Monthly Earnings',
  defaultSize: '1x1',
  defaultVisible: false,
  category: 'analytics',

  render: async (ctx) => {
    const c        = /** @type {any} */ (ctx);
    const val      = Number(c?.data?.monthSummary?.gross)  || 0;
    const country  = String(c?.data?.localeCountry || 'US');
    const currency = String(c?.data?.currency      || 'USD');
    const month    = new Date().toLocaleString('default', { month: 'short' });

    // Intelligence tiers for earnings volume
    let tierClass = 'mg-tier-neutral';
    let gradStart = '#8a8f98';
    let gradEnd = '#4b5563';

    if (val >= 4000) {
      tierClass = 'mg-tier-elite';
      gradStart = '#f43f5e'; // Rose
      gradEnd = '#f5a623';   // Amber
    } else if (val >= 2000) {
      tierClass = 'mg-tier-pro';
      gradStart = '#f5a623'; // Amber
      gradEnd = '#fbbf24';   // Yellow
    } else if (val >= 500) {
      tierClass = 'mg-tier-active';
      gradStart = '#10b981'; // Emerald
      gradEnd = '#34d399';
    } else if (val > 0) {
      tierClass = 'mg-tier-started';
      gradStart = '#3b82f6'; // Blue
      gradEnd = '#60a5fa';
    }

    const labelText = t('analytics.earnings') || 'Earnings';

    const scopedStyles = `
      <style>
        @keyframes coinBreathe {
          0%, 100% { transform: scale(1) translateY(0); opacity: 0.15; }
          50% { transform: scale(1.05) translateY(-2px); opacity: 0.25; }
        }
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .mg-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          justify-content: space-between;
          padding: 6px;
          position: relative;
          overflow: hidden;
        }

        .mg-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 2;
        }

        .mg-icon-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: color-mix(in srgb, ${gradStart} 15%, transparent);
          color: ${gradStart};
        }

        .mg-badge {
          font-size: 0.65rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 3px 8px;
          border-radius: 6px;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.1);
        }
        .mg-tier-elite   { color: #f43f5e; background: color-mix(in srgb, #f43f5e 15%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, #f43f5e 30%, transparent); }
        .mg-tier-pro     { color: #f5a623; background: color-mix(in srgb, #f5a623 15%, transparent); }
        .mg-tier-active  { color: #10b981; background: color-mix(in srgb, #10b981 15%, transparent); }
        .mg-tier-started { color: #3b82f6; background: color-mix(in srgb, #3b82f6 15%, transparent); }
        .mg-tier-neutral { color: var(--color-text-muted, #8a8f98); background: var(--color-surface-raised, rgba(255,255,255,0.05)); }

        .mg-body {
          display: flex;
          flex-direction: column;
          z-index: 2;
          animation: slideUpFade 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .mg-val-wrapper {
          display: flex;
          align-items: baseline;
          gap: 6px;
        }

        .mg-val {
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

        .mg-sub {
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--color-text-muted, #8a8f98);
          margin-top: 4px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .mg-bg-visual {
          position: absolute;
          right: -10%;
          bottom: -15%;
          width: 120px;
          height: 120px;
          z-index: 0;
          pointer-events: none;
          animation: coinBreathe 5s ease-in-out infinite;
        }
      </style>
    `;

    return `
      ${scopedStyles}
      <div class="mg-container">
        
        <div class="mg-header">
          <div class="mg-icon-wrap">
            ${_IC_DOLLAR}
          </div>
          <div class="mg-badge ${tierClass}">
            ${esc(month)}
          </div>
        </div>

        <div class="mg-body">
          <div class="mg-val-wrapper">
            <span class="mg-val" 
                  data-target="${val}" 
                  data-country="${esc(country)}" 
                  data-currency="${esc(currency)}">
              ${esc(formatCurrency(0, country, { currency }))}
            </span>
          </div>
          <span class="mg-sub">This Month's Gross</span>
        </div>

        <!-- Abstract floating background visual -->
        <div class="mg-bg-visual">
          ${val > 0 ? _getBgVisual(gradStart, gradEnd) : ''}
        </div>

      </div>
    `;
  },

  afterRender: (el, _ctx) => {
    // Elegant currency counting animation
    const valEl = el.querySelector('.mg-val');
    if (!valEl) return;

    const target = parseFloat(valEl.getAttribute('data-target') || '0');
    if (target === 0) return;

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
      
      valEl.textContent = formatCurrency(currentVal, country, { currency });

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Ensure final exact value is set
        valEl.textContent = formatCurrency(target, country, { currency });
      }
    };

    requestAnimationFrame(animate);
  },
  
  destroy: (_el) => {},
};
