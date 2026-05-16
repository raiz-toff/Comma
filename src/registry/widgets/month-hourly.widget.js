import { formatCurrency } from '../../utils/formatters.js';
import { t }              from '../../utils/strings.js';
import { esc }            from './esc.js';

// Premium, clean SVG clock icon
const _IC_CLOCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

// Filled gradient abstract clock/timer for the background visual
const _getBgVisual = (start, end) => `<svg viewBox="0 0 24 24" stroke="none"><defs><linearGradient id="mh-grad" x1="0%" y1="100%" x2="0%" y2="0%"><stop offset="0%" stop-color="${start}" /><stop offset="50%" stop-color="${end}" /><stop offset="100%" stop-color="${start}" /></linearGradient></defs><circle cx="12" cy="12" r="10" fill="url(#mh-grad)" opacity="0.1" /><circle cx="12" cy="12" r="10" stroke="url(#mh-grad)" stroke-width="1.5" stroke-dasharray="4 4" fill="none" opacity="0.3"/><polyline points="12 6 12 12 16 14" stroke="rgba(0,0,0,0.5)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.5"/></svg>`;

export default {
  id: 'monthHourly',
  label: 'Monthly $/hr',
  defaultSize: '1x1',
  defaultVisible: false,
  category: 'analytics',

  render: async (ctx) => {
    const c        = /** @type {any} */ (ctx);
    const val      = Number(c?.data?.monthSummary?.hourlyRate) || 0;
    const country  = String(c?.data?.localeCountry || 'US');
    const currency = String(c?.data?.currency      || 'USD');
    const month    = new Date().toLocaleString('default', { month: 'short' });

    // Intelligence tiers tailored for hourly earnings volume
    let tierClass = 'mh-tier-neutral';
    let gradStart = '#8a8f98';
    let gradEnd = '#4b5563';

    if (val >= 35) {
      tierClass = 'mh-tier-elite';
      gradStart = '#f43f5e'; // Rose
      gradEnd = '#f5a623';   // Amber
    } else if (val >= 25) {
      tierClass = 'mh-tier-pro';
      gradStart = '#f5a623'; // Amber
      gradEnd = '#fbbf24';   // Yellow
    } else if (val >= 18) {
      tierClass = 'mh-tier-active';
      gradStart = '#10b981'; // Emerald
      gradEnd = '#34d399';
    } else if (val > 0) {
      tierClass = 'mh-tier-started';
      gradStart = '#3b82f6'; // Blue
      gradEnd = '#60a5fa';
    }

    const labelText = t('analytics.hourlyRate') || 'Monthly $/hr';

    const scopedStyles = `
      <style>
        @keyframes clockBreatheAndSpin {
          0% { transform: scale(1) rotate(0deg); opacity: 0.15; }
          50% { transform: scale(1.05) rotate(5deg); opacity: 0.25; }
          100% { transform: scale(1) rotate(0deg); opacity: 0.15; }
        }
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .mh-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          justify-content: space-between;
          padding: 6px;
          position: relative;
          overflow: hidden;
        }

        .mh-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 2;
        }

        .mh-icon-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: color-mix(in srgb, ${gradStart} 15%, transparent);
          color: ${gradStart};
        }

        .mh-badge {
          font-size: 0.65rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 3px 8px;
          border-radius: 6px;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.1);
        }
        .mh-tier-elite   { color: #f43f5e; background: color-mix(in srgb, #f43f5e 15%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, #f43f5e 30%, transparent); }
        .mh-tier-pro     { color: #f5a623; background: color-mix(in srgb, #f5a623 15%, transparent); }
        .mh-tier-active  { color: #10b981; background: color-mix(in srgb, #10b981 15%, transparent); }
        .mh-tier-started { color: #3b82f6; background: color-mix(in srgb, #3b82f6 15%, transparent); }
        .mh-tier-neutral { color: var(--color-text-muted, #8a8f98); background: var(--color-surface-raised, rgba(255,255,255,0.05)); }

        .mh-body {
          display: flex;
          flex-direction: column;
          z-index: 2;
          animation: slideUpFade 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .mh-val-wrapper {
          display: flex;
          align-items: baseline;
          gap: 4px;
        }

        .mh-val {
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
        
        .mh-unit {
          font-size: 0.9rem;
          font-weight: 800;
          color: ${gradStart};
          opacity: 0.9;
        }

        .mh-sub {
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--color-text-muted, #8a8f98);
          margin-top: 4px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .mh-bg-visual {
          position: absolute;
          right: -10%;
          bottom: -15%;
          width: 120px;
          height: 120px;
          z-index: 0;
          pointer-events: none;
          animation: clockBreatheAndSpin 8s ease-in-out infinite;
        }
      </style>
    `;

    return `
      ${scopedStyles}
      <div class="mh-container">
        
        <div class="mh-header">
          <div class="mh-icon-wrap">
            ${_IC_CLOCK}
          </div>
          <div class="mh-badge ${tierClass}">
            ${esc(month)}
          </div>
        </div>

        <div class="mh-body">
          <div class="mh-val-wrapper">
            <span class="mh-val" 
                  data-target="${val}" 
                  data-country="${esc(country)}" 
                  data-currency="${esc(currency)}">
              ${esc(formatCurrency(0, country, { currency }))}
            </span>
            <span class="mh-unit">/hr</span>
          </div>
          <span class="mh-sub">Hourly Rate Avg</span>
        </div>

        <!-- Abstract floating background visual -->
        <div class="mh-bg-visual">
          ${val > 0 ? _getBgVisual(gradStart, gradEnd) : ''}
        </div>

      </div>
    `;
  },

  afterRender: (el, _ctx) => {
    // Elegant currency counting animation
    const valEl = el.querySelector('.mh-val');
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
