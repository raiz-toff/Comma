import { formatLargeNumber } from '../../utils/formatters.js';
import { t }                 from '../../utils/strings.js';
import { esc }               from './esc.js';

// Premium, clean SVG flame (replacing the emoji)
const _IC_FLAME = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`;

// Filled gradient flame for the background visual
const _IC_FLAME_FILLED = `<svg viewBox="0 0 24 24" fill="url(#flame-grad)" opacity="0.15" stroke="none"><defs><linearGradient id="flame-grad" x1="0%" y1="100%" x2="0%" y2="0%"><stop offset="0%" stop-color="#f43f5e" /><stop offset="50%" stop-color="#f5a623" /><stop offset="100%" stop-color="#fbbf24" /></linearGradient></defs><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`;

export default {
  id: 'streak',
  label: 'Streak',
  defaultSize: '1x1',
  defaultVisible: false,
  category: 'stats',

  render: async (ctx) => {
    const c = /** @type {any} */ (ctx);
    const n = Number(c?.data?.streakCount) || 0;
    
    // Abstracting intelligence tiers without using emojis
    let tierText = 'Inactive';
    let tierClass = 'str-tier-neutral';
    let gradStart = '#8a8f98';
    let gradEnd = '#4b5563';

    if (n >= 30) {
      tierText = 'Unstoppable';
      tierClass = 'str-tier-elite';
      gradStart = '#f43f5e'; // Rose
      gradEnd = '#f5a623';   // Amber
    } else if (n >= 7) {
      tierText = 'Hot Streak';
      tierClass = 'str-tier-pro';
      gradStart = '#f5a623'; // Amber
      gradEnd = '#fbbf24';   // Yellow
    } else if (n >= 3) {
      tierText = 'Building';
      tierClass = 'str-tier-active';
      gradStart = '#10b981'; // Emerald
      gradEnd = '#34d399';
    } else if (n > 0) {
      tierText = 'Started';
      tierClass = 'str-tier-started';
      gradStart = '#3b82f6'; // Blue
      gradEnd = '#60a5fa';
    }

    const unit = n === 1 ? 'Day' : 'Days';
    const labelText = t('analytics.streak') || 'Streak';

    const scopedStyles = `
      <style>
        @keyframes flameBreathe {
          0%, 100% { transform: scale(1) translateY(0); opacity: 0.15; }
          50% { transform: scale(1.05) translateY(-2px); opacity: 0.25; }
        }
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .str-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          justify-content: space-between;
          padding: 6px;
          position: relative;
          overflow: hidden;
        }

        .str-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 2;
        }

        .str-icon-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: color-mix(in srgb, ${gradStart} 15%, transparent);
          color: ${gradStart};
        }

        .str-badge {
          font-size: 0.65rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 3px 8px;
          border-radius: 6px;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.1);
        }
        .str-tier-elite   { color: #f43f5e; background: color-mix(in srgb, #f43f5e 15%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, #f43f5e 30%, transparent); }
        .str-tier-pro     { color: #f5a623; background: color-mix(in srgb, #f5a623 15%, transparent); }
        .str-tier-active  { color: #10b981; background: color-mix(in srgb, #10b981 15%, transparent); }
        .str-tier-started { color: #3b82f6; background: color-mix(in srgb, #3b82f6 15%, transparent); }
        .str-tier-neutral { color: var(--color-text-muted, #8a8f98); background: var(--color-surface-raised, rgba(255,255,255,0.05)); }

        .str-body {
          display: flex;
          flex-direction: column;
          z-index: 2;
          animation: slideUpFade 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .str-val-wrapper {
          display: flex;
          align-items: baseline;
          gap: 6px;
        }

        .str-val {
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

        .str-unit {
          font-size: 0.85rem;
          font-weight: 800;
          color: ${gradStart};
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .str-sub {
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--color-text-muted, #8a8f98);
          margin-top: 4px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .str-bg-visual {
          position: absolute;
          right: -10%;
          bottom: -15%;
          width: 120px;
          height: 120px;
          z-index: 0;
          pointer-events: none;
          animation: flameBreathe 4s ease-in-out infinite;
        }
      </style>
    `;

    return `
      ${scopedStyles}
      <div class="str-container">
        
        <div class="str-header">
          <div class="str-icon-wrap">
            ${_IC_FLAME}
          </div>
          <div class="str-badge ${tierClass}">
            ${esc(tierText)}
          </div>
        </div>

        <div class="str-body">
          <div class="str-val-wrapper">
            <span class="str-val" data-target="${n}">0</span>
            <span class="str-unit">${esc(unit)}</span>
          </div>
          <span class="str-sub">Consecutive Momentum</span>
        </div>

        <!-- Abstract floating background flame instead of emoji -->
        <div class="str-bg-visual">
          ${n > 0 ? _IC_FLAME_FILLED : ''}
        </div>

      </div>
    `;
  },

  afterRender: (el, _ctx) => {
    // Elegant number counting animation
    const valEl = el.querySelector('.str-val');
    if (!valEl) return;

    const target = parseInt(valEl.getAttribute('data-target') || '0', 10);
    if (target === 0) return;

    const duration = 1500; // 1.5 seconds
    const start = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - start;
      const progress = Math.min(elapsed / duration, 1);
      
      // easeOutQuart
      const ease = 1 - Math.pow(1 - progress, 4);
      const currentVal = Math.floor(target * ease);
      
      valEl.textContent = formatLargeNumber(currentVal);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        valEl.textContent = formatLargeNumber(target);
      }
    };

    requestAnimationFrame(animate);
  },
  
  destroy: (_el) => {},
};
