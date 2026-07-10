import { t } from '../../utils/strings.js';
import { esc } from './esc.js';

export default {
  id: 'bestHour',
  label: 'Best Hour',
  defaultSize: '1x1',
  defaultVisible: false,
  category: 'analytics',

  /** @param {unknown} ctx */
  render: async (ctx) => {
    // Safe extraction
    const c = /** @type {{ data?: { bestHour?: { hour?: number } } }} */ (ctx);
    const hour = Number(c?.data?.bestHour?.hour ?? -1);
    
    const isValid = hour >= 0 && hour <= 23;
    
    // Time Formatting Logic
    let primaryTime = '—';
    let ampm = '';
    let windowText = 'Awaiting data';

    if (isValid) {
      const isPM = hour >= 12;
      ampm = isPM ? 'PM' : 'AM';
      const displayHour = hour % 12 === 0 ? 12 : hour % 12;
      
      const nextHour = (hour + 1) % 24;
      const nextIsPM = nextHour >= 12;
      const nextAmpm = nextIsPM ? 'PM' : 'AM';
      const displayNextHour = nextHour % 12 === 0 ? 12 : nextHour % 12;

      primaryTime = `${displayHour}:00`;
      windowText = `${displayHour}:00 ${ampm} – ${displayNextHour}:00 ${nextAmpm}`;
    }

    const labelText = t('analytics.bestHour') || 'Peak Earning Hour';

    // Generate the 24 little bars for the timeline infographic
    let timelineHTML = '';
    for (let i = 0; i < 24; i++) {
      let barClass = 'bh-tick';
      let delay = i * 0.03; // Staggered animation delay
      
      if (isValid && i === hour) {
        barClass += ' bh-tick-active';
      } else if (isValid && (i === hour - 1 || i === hour + 1)) {
        // Create a slight visual "shoulder" around the peak hour
        barClass += ' bh-tick-shoulder';
      }
      
      timelineHTML += `<div class="${barClass}" style="animation-delay: ${delay}s;"></div>`;
    }

    const scopedStyles = `
      <style>
        /* Fade and slide in for the bars */
        @keyframes tickIntro {
          0% { transform: scaleY(0.1); opacity: 0; }
          100% { transform: scaleY(1); opacity: 1; }
        }
        
        /* Continuous subtle pulse for the peak hour */
        @keyframes peakPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px color-mix(in srgb, var(--widget-accent) 60%, transparent); }
          50% { opacity: 0.7; box-shadow: 0 0 2px color-mix(in srgb, var(--widget-accent) 20%, transparent); }
        }

        .bh-container { display: flex; flex-direction: column; height: 100%; justify-content: space-between; padding: 4px; }
        
        .bh-header { display: flex; align-items: center; gap: 10px; }
        .bh-icon-wrapper {
          display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; 
          border-radius: 8px; background: color-mix(in srgb, var(--widget-accent, #8b5cf6) 15%, transparent); 
          color: var(--widget-accent, #8b5cf6);
        }

        .bh-main-content { margin-top: 12px; display: flex; flex-direction: column; }
        
        .bh-time-wrapper { display: flex; align-items: baseline; gap: 6px; }
        .bh-main-time { font-size: 2.25rem; font-weight: 800; line-height: 1.1; letter-spacing: -0.03em; color: var(--color-text-main); }
        .bh-ampm { font-size: 1.1rem; font-weight: 800; color: var(--widget-accent, #8b5cf6); }
        
        .bh-window-text { font-size: 0.75rem; font-weight: 700; color: var(--color-text-muted, #888); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.05em; }

        /* Timeline Visualizer */
        .bh-timeline-wrap { margin-top: auto; padding-top: 16px; }
        .bh-timeline { display: flex; align-items: flex-end; justify-content: space-between; height: 28px; gap: 2px; }
        
        .bh-tick { 
          flex: 1; 
          background: var(--color-surface-raised, rgba(150, 150, 150, 0.2)); 
          border-radius: 2px; 
          height: 15%; 
          transform-origin: bottom;
          opacity: 0;
          animation: tickIntro 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
        
        .bh-tick-shoulder {
          height: 40%;
          background: color-mix(in srgb, var(--widget-accent, #8b5cf6) 40%, var(--color-surface-raised));
        }

        .bh-tick-active {
          height: 100%;
          background: var(--widget-accent, #8b5cf6);
          animation: tickIntro 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards, peakPulse 2s infinite 1s;
        }
      </style>
    `;

    return `
      ${scopedStyles}
      <div class="bh-container">
        
        <!-- Header -->
        <div class="bh-header">
          <div class="bh-icon-wrapper">
            <!-- Clock / Star icon indicating 'Best' time -->
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 10"></polyline>
              <path d="M19 4l-2 2"></path>
              <path d="M21 7l-2-1"></path>
            </svg>
          </div>
          <span class="stat-label">${esc(labelText)}</span>
        </div>

        <!-- Typography -->
        <div class="bh-main-content">
          <div class="bh-time-wrapper">
            <span class="bh-main-time">${esc(primaryTime)}</span>
            ${isValid ? `<span class="bh-ampm">${esc(ampm)}</span>` : ''}
          </div>
          <span class="bh-window-text">${esc(windowText)}</span>
        </div>

        <!-- 24-Hour Timeline Visualizer -->
        <div class="bh-timeline-wrap">
          <div class="bh-timeline">
            ${timelineHTML}
          </div>
        </div>

      </div>
    `;
  },
  
  afterRender: (_el, _ctx) => {},
  destroy: (_el) => {},
};
