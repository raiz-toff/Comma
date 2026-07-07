import { t } from '../../utils/strings.js';
import { esc } from './esc.js';

/**
 * Smooths a polyline by drawing a straight line to the midpoint of each
 * segment, then a quadratic curve (using the real point as control) into the
 * next midpoint. Rounds off the sharp joints without the overshoot a
 * Catmull-Rom spline produces on a handful of points.
 * @param {[number, number][]} pts
 */
function toSmoothPath(pts) {
  if (pts.length < 2) return '';
  if (pts.length === 2) {
    return `M ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)} L ${pts[1][0].toFixed(1)},${pts[1][1].toFixed(1)}`;
  }

  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let d = `M ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const m = mid(pts[i], pts[i + 1]);
    d += ` Q ${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)} ${m[0].toFixed(1)},${m[1].toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last[0].toFixed(1)},${last[1].toFixed(1)}`;
  return d;
}

export default {
  id: 'stabilityScore',
  label: 'Income Stability',
  defaultSize: '1x1',
  defaultVisible: false,
  category: 'analytics',

  /** @param {unknown} ctx */
  render: async (ctx) => {
    const c = /** @type {{ data?: { stabilityScore?: { stabilityScore: number, weeklyGross?: number[] } } }} */ (ctx);
    
    // Safety boundaries for the score
    const score = Math.max(0, Math.min(100, Math.round(c?.data?.stabilityScore?.stabilityScore ?? 0)));
    const grossData = c?.data?.stabilityScore?.weeklyGross?.length 
      ? c.data.stabilityScore.weeklyGross 
      : [0, 0, 0, 0]; // Fallback flatline if no data

    let healthColor = 'var(--color-danger, #f43f5e)';
    let healthText = 'Highly Volatile';
    
    if (score >= 75) {
      healthColor = 'var(--color-success, #10b981)';
      healthText = 'Highly Stable';
    } else if (score >= 45) {
      healthColor = 'var(--color-warning, #f5a623)';
      healthText = 'Moderate Variance';
    }

    // Map the weekly gross data to X/Y coordinates for our SVG canvas (100x40)
    const svgWidth = 100;
    const svgHeight = 40;
    const maxVal = Math.max(...grossData) * 1.05 || 1; // 5% top padding
    const minVal = Math.min(...grossData) * 0.95; // 5% bottom padding
    const range = maxVal - minVal || 1; // Prevent div by zero

    const points = grossData.map((val, i) => {
      const x = (i / (grossData.length - 1)) * svgWidth;
      const y = svgHeight - ((val - minVal) / range) * svgHeight;
      return [x, y];
    });

    const pathString = toSmoothPath(points);
    const [lastX, lastY] = points[points.length - 1];

    const scopedStyles = `
      <style>
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .ss-container { display: flex; flex-direction: column; height: 100%; justify-content: space-between; padding: 4px; }
        
        .ss-header { display: flex; align-items: center; gap: 10px; }
        .ss-icon-wrap {
          display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; 
          border-radius: 8px; background: color-mix(in srgb, var(--widget-accent, #8b5cf6) 15%, transparent); 
          color: var(--widget-accent, #8b5cf6);
        }

        .ss-body { margin-top: 12px; }
        
        .ss-score-row { display: flex; align-items: baseline; gap: 6px; }
        .ss-score-val { font-size: 2.25rem; font-weight: 800; line-height: 1; letter-spacing: -0.03em; color: ${healthColor}; transition: color 0.3s ease; }
        .ss-score-max { font-size: 0.85rem; font-weight: 700; color: var(--color-text-muted, #888); }

        .ss-qualitative {
          display: inline-flex; align-items: center; gap: 6px; margin-top: 6px;
          font-size: 0.65rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em;
          color: ${healthColor}; background: color-mix(in srgb, ${healthColor} 10%, transparent);
          padding: 4px 8px; border-radius: 999px;
        }

        /* Pure SVG Sparkline styling */
        .ss-chart-wrap { margin-top: auto; padding-top: 12px; height: 45px; position: relative; }
        .ss-svg { width: 100%; height: 100%; overflow: visible; }
        
        .ss-path-line {
          fill: none;
          stroke: ${healthColor};
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
          animation: fadeIn 0.4s ease-out forwards;
        }

        .ss-end-dot {
          fill: ${healthColor};
        }
      </style>
    `;

    const labelText = t('analytics.stabilityScore') || 'Income Stability';

    return `
      ${scopedStyles}
      <div class="ss-container">
        
        <!-- Header -->
        <div class="ss-header">
          <div class="ss-icon-wrap">
            <!-- Balance / Metronome Icon -->
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
          </div>
          <span class="stat-label">${esc(labelText)}</span>
        </div>

        <!-- Typography & Health Grade -->
        <div class="ss-body">
          <div class="ss-score-row">
            <span class="ss-score-val">${score}</span>
            <span class="ss-score-max">/ 100</span>
          </div>
          <div class="ss-qualitative">
            ${esc(healthText)}
          </div>
        </div>

        <!-- Dynamic SVG Sparkline Visualizer -->
        <div class="ss-chart-wrap">
          <svg class="ss-svg" viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="none">
            <path class="ss-path-line" d="${pathString}"></path>
            
            <!-- Live Indicator Dot at the end of the trend -->
            <circle class="ss-end-dot" cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="2"></circle>
          </svg>
        </div>

      </div>
    `;
  },
  
  // Chart.js completely removed! This runs purely on the DOM now.
  afterRender: (_el, _ctx) => {},
  destroy: (_el) => {},
};
