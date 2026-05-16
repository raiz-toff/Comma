import { formatCurrency } from '../../utils/formatters.js';
import { t }              from '../../utils/strings.js';
import { esc }            from './esc.js';

// Premium, clean SVG trend-up icon
const _IC_TREND_UP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`;

// Filled gradient abstract area chart for the background visual
const _getBgVisual = (start, end) => `<svg viewBox="0 0 24 24" stroke="none"><defs><linearGradient id="ni-grad" x1="0%" y1="100%" x2="0%" y2="0%"><stop offset="0%" stop-color="${start}" /><stop offset="50%" stop-color="${end}" /><stop offset="100%" stop-color="${start}" /></linearGradient></defs><path d="M1 18l7.5-7.5L13.5 15.5 23 6v18H1z" fill="url(#ni-grad)" opacity="0.1"/><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" fill="none" stroke="url(#ni-grad)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.4"/></svg>`;

export default {
  id: 'netIncome',
  label: 'Net Income',
  defaultSize: '1x1',
  defaultVisible: true,
  category: 'financial',

  render: async (ctx) => {
    const c        = /** @type {any} */ (ctx);
    const net      = Number(c?.data?.financial?.netIncome) || 0;
    const gross    = Number(c?.data?.financial?.gross)     || 0;
    const country  = String(c?.data?.localeCountry || 'US');
    const currency = String(c?.data?.currency      || 'USD');

    // Calculate profit margin percentage
    const margin   = gross > 0 ? Math.round((net / gross) * 100) : null;
    const pct      = margin !== null ? Math.min(100, Math.max(0, margin)) : 0;

    let tierClass = 'ni-tier-neutral';
    let gradStart = '#8a8f98';
    let gradEnd   = '#4b5563';

    if (margin >= 75) {
      tierClass = 'ni-tier-elite';
      gradStart = '#10b981'; // Emerald
      gradEnd   = '#34d399';
    } else if (margin >= 50) {
      tierClass = 'ni-tier-pro';
      gradStart = '#3b82f6'; // Blue
      gradEnd   = '#60a5fa';
    } else if (margin >= 25) {
      tierClass = 'ni-tier-active';
      gradStart = '#f5a623'; // Amber
      gradEnd   = '#fbbf24';
    } else if (margin !== null) {
      tierClass = 'ni-tier-warning';
      gradStart = '#f43f5e'; // Rose
      gradEnd   = '#f5a623'; // Amber
    }

    const labelText = t('views.dashboard.financial.netIncome') || 'Net Income';

    const scopedStyles = `
      <style>
        @keyframes chartBreathe {
          0%, 100% { transform: scale(1) translateY(0); opacity: 0.15; }
          50% { transform: scale(1.05) translateY(-2px); opacity: 0.25; }
        }
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes barGrow {
          from { width: 0%; opacity: 0; }
          to { opacity: 1; }
        }

        .ni-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          justify-content: space-between;
          padding: 6px;
          position: relative;
          overflow: hidden;
        }

        .ni-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 2;
        }

        .ni-icon-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: color-mix(in srgb, ${gradStart} 15%, transparent);
          color: ${gradStart};
        }

        .ni-badge {
          font-size: 0.65rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 3px 8px;
          border-radius: 6px;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.1);
        }
        .ni-tier-elite   { color: #10b981; background: color-mix(in srgb, #10b981 15%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, #10b981 30%, transparent); }
        .ni-tier-pro     { color: #3b82f6; background: color-mix(in srgb, #3b82f6 15%, transparent); }
        .ni-tier-active  { color: #f5a623; background: color-mix(in srgb, #f5a623 15%, transparent); }
        .ni-tier-warning { color: #f43f5e; background: color-mix(in srgb, #f43f5e 15%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, #f43f5e 30%, transparent); }
        .ni-tier-neutral { color: var(--color-text-muted, #8a8f98); background: var(--color-surface-raised, rgba(255,255,255,0.05)); }

        .ni-body {
          display: flex;
          flex-direction: column;
          z-index: 2;
          animation: slideUpFade 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
          margin-top: auto;
        }

        .ni-val-wrapper {
          display: flex;
          align-items: baseline;
          gap: 6px;
        }

        .ni-val {
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

        .ni-progress-track {
          width: 100%;
          height: 4px;
          background: var(--color-surface-raised, rgba(255,255,255,0.05));
          border-radius: 2px;
          margin-top: 10px;
          margin-bottom: 6px;
          overflow: hidden;
        }

        .ni-progress-fill {
          height: 100%;
          border-radius: 2px;
          background: linear-gradient(90deg, ${gradStart}, ${gradEnd});
          animation: barGrow 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }

        .ni-sub {
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--color-text-muted, #8a8f98);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .ni-bg-visual {
          position: absolute;
          right: -10%;
          bottom: -15%;
          width: 120px;
          height: 120px;
          z-index: 0;
          pointer-events: none;
          animation: chartBreathe 6s ease-in-out infinite;
        }
      </style>
    `;

    return `
      ${scopedStyles}
      <div class="ni-container">
        
        <div class="ni-header">
          <div class="ni-icon-wrap">
            ${_IC_TREND_UP}
          </div>
          ${margin !== null ? `<div class="ni-badge ${tierClass}">${margin}% Margin</div>` : `<div class="ni-badge ${tierClass}">No Data</div>`}
        </div>

        <div class="ni-body">
          <div class="ni-val-wrapper">
            <span class="ni-val" 
                  data-target="${net}" 
                  data-country="${esc(country)}" 
                  data-currency="${esc(currency)}">
              ${esc(formatCurrency(0, country, { currency }))}
            </span>
          </div>
          
          ${margin !== null ? `
          <div class="ni-progress-track">
            <div class="ni-progress-fill" style="width: ${pct}%;"></div>
          </div>
          <span class="ni-sub">of ${esc(formatCurrency(gross, country, { currency }))} Gross</span>
          ` : '<span class="ni-sub">Net Income</span>'}
        </div>

        <!-- Abstract floating background visual -->
        <div class="ni-bg-visual">
          ${net > 0 || gross > 0 ? _getBgVisual(gradStart, gradEnd) : ''}
        </div>

      </div>
    `;
  },

  afterRender: (el, _ctx) => {
    // Elegant currency counting animation
    const valEl = el.querySelector('.ni-val');
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
        // Ensure exact final exact value is set
        valEl.textContent = formatCurrency(target, country, { currency });
      }
    };

    requestAnimationFrame(animate);
  },
  
  destroy: (_el) => {},
};
