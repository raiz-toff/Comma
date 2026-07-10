import { formatCurrency } from '../../utils/formatters.js';
import { t } from '../../utils/strings.js';
import { esc } from './esc.js';

/**
 * Calculates linear regression to determine the trend slope over the 30 days.
 * @param {Array<{x: number, y: number}>} points 
 */
function getTrendStats(points) {
  if (!points || points.length < 2) return { m: 0, b: 0, isUp: false };
  const n = points.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  
  for (let i = 0; i < n; i++) {
    const { x, y } = points[i];
    sumX += x; sumY += y;
    sumXY += (x * y); sumX2 += (x * x);
  }
  
  const m = ((n * sumXY) - (sumX * sumY)) / ((n * sumX2) - (sumX * sumX));
  const b = (sumY - m * sumX) / n;
  
  return { m, b, isUp: m > 0 };
}

export default {
  id: 'rollingTrend',
  label: '30-Day Trend',
  defaultSize: '2x1',
  defaultVisible: false,
  category: 'analytics',

  /** @param {unknown} ctx */
  render: async (ctx) => {
    const c = /** @type {{ data?: { rollingTrend?: { points: {x:number, y:number}[] }; localeCountry?: string; currency?: string } }} */ (ctx);
    const rawPoints = c?.data?.rollingTrend?.points || [];
    
    const country = String(c?.data?.localeCountry || 'US');
    const currency = String(c?.data?.currency || 'USD');

    const labelText = t('analytics.trends') || '30-Day Trend';

    // Empty State Fallback
    if (rawPoints.length < 2) {
      return `
        <div style="display:flex; flex-direction:column; height:100%; justify-content:center; align-items:center; color:var(--color-text-muted);">
          <svg width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="margin-bottom:8px; opacity:0.5;">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
          </svg>
          <span style="font-size:0.8rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em;">Awaiting Trend Data</span>
        </div>
      `;
    }

    // --- Statistical Analysis ---
    const values = rawPoints.map(p => p.y);
    const maxY = Math.max(...values);
    const minY = Math.min(...values);
    const avgY = values.reduce((a, b) => a + b, 0) / values.length;
    
    // Add 10% padding to top and bottom for visual breathing room in the SVG
    const range = (maxY - minY) || 1; 
    const svgMaxY = maxY + (range * 0.1);
    const svgMinY = Math.max(0, minY - (range * 0.1)); 
    const svgRange = svgMaxY - svgMinY;

    const trend = getTrendStats(rawPoints);
    const trendLabel = trend.isUp ? 'Trending Up' : 'Cooling Down';
    const trendColor = trend.isUp ? 'var(--color-success, #10b981)' : 'var(--color-danger, #f43f5e)';
    const trendIcon = trend.isUp 
      ? `<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline>`
      : `<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline>`;

    // --- SVG Canvas Setup (800x200 for crisp 2x1 grid scaling) ---
    const svgW = 800;
    const svgH = 200;

    // Generate Path Data for the Trendline
    const pointsMapped = rawPoints.map((p, i) => {
      const x = (i / (rawPoints.length - 1)) * svgW;
      const y = svgH - ((p.y - svgMinY) / svgRange) * svgH;
      return { x, y, rawX: p.x, rawY: p.y };
    });

    const pathData = `M ${pointsMapped.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')}`;
    // Close the path for the area gradient underneath
    const areaData = `${pathData} L ${svgW},${svgH} L 0,${svgH} Z`;

    // Map the Average Line
    const avgYMapped = svgH - ((avgY - svgMinY) / svgRange) * svgH;

    // Generate Interaction Hitboxes for the Tooltip Scrubber
    const hitboxesHTML = pointsMapped.map((p, i) => {
      // Create vertical bands across the width of the chart
      const width = svgW / (pointsMapped.length - 1 || 1);
      const startX = p.x - (width / 2);
      return `<rect class="rt-hitbox" x="${startX}" y="0" width="${width}" height="${svgH}" 
                data-idx="${i}" data-cx="${p.x}" data-cy="${p.y}" 
                data-rawx="${p.rawX + 1}" data-rawy="${p.rawY}"></rect>`;
    }).join('');

    const scopedStyles = `
      <style>
        @keyframes drawLine {
          from { stroke-dashoffset: 1500; opacity: 0; }
          to { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes fadeArea {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .rt-container { display: flex; flex-direction: column; height: 100%; position: relative; padding: 4px; }
        
        .rt-header-row { display: flex; justify-content: space-between; align-items: flex-start; z-index: 2; position: relative; }
        
        .rt-title-group { display: flex; align-items: center; gap: 10px; }
        .rt-icon-wrap {
          display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; 
          border-radius: 8px; background: color-mix(in srgb, var(--widget-accent, #8b5cf6) 15%, transparent); 
          color: var(--widget-accent, #8b5cf6);
        }

        .rt-stats-group { text-align: right; }
        .rt-stat-pill {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 0.65rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em;
          color: ${trendColor}; background: color-mix(in srgb, ${trendColor} 10%, transparent);
          padding: 4px 8px; border-radius: 999px;
          border: 1px solid color-mix(in srgb, ${trendColor} 30%, transparent);
        }
        .rt-stat-sub { font-size: 0.65rem; font-weight: 700; color: var(--color-text-muted, #888); margin-top: 4px; letter-spacing: 0.05em; display: flex; justify-content: flex-end; gap: 8px;}
        .rt-highlight { color: var(--color-text-main); font-weight: 800; font-variant-numeric: tabular-nums;}

        /* Canvas / SVG Wrapping */
        .rt-chart-wrap { flex-grow: 1; position: relative; width: 100%; min-height: 100px; margin-top: 16px; overflow: hidden; }
        .rt-svg { width: 100%; height: 100%; overflow: visible; display: block; }
        
        /* Grid and Averages */
        .rt-grid-line { stroke: var(--color-text-muted); opacity: 0.15; stroke-width: 1; stroke-dasharray: 4 4; }
        .rt-avg-text { fill: var(--color-text-muted); font-size: 12px; font-weight: 700; opacity: 0.6; }
        
        /* Trend Paths */
        .rt-area { fill: url(#rt-grad); opacity: 0; animation: fadeArea 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) 0.3s forwards; }
        .rt-line { 
          fill: none; stroke: var(--widget-accent, #8b5cf6); stroke-width: 3; stroke-linejoin: round; stroke-linecap: round;
          stroke-dasharray: 1500; stroke-dashoffset: 1500;
          animation: drawLine 1.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }

        /* Interaction Elements */
        .rt-hitbox { fill: transparent; cursor: crosshair; }
        .rt-hover-line { stroke: var(--color-text-muted); stroke-width: 1; opacity: 0; stroke-dasharray: 4 4; pointer-events: none; transition: opacity 0.1s; }
        .rt-hover-dot { fill: var(--color-surface-main, #fff); stroke: var(--widget-accent); stroke-width: 3; r: 5; opacity: 0; pointer-events: none; transition: opacity 0.1s, cx 0.05s, cy 0.05s; filter: drop-shadow(0 0 4px var(--widget-accent)); }
        
        /* Dynamic CSS Tooltip */
        .rt-tooltip {
          position: absolute; pointer-events: none; opacity: 0;
          background: var(--color-surface-raised, #222);
          border: 1px solid color-mix(in srgb, var(--widget-accent) 40%, transparent);
          box-shadow: 0 8px 16px rgba(0,0,0,0.4);
          padding: 6px 12px; border-radius: 8px;
          transform: translate(-50%, -130%);
          transition: opacity 0.15s, top 0.05s, left 0.05s;
          z-index: 100; backdrop-filter: blur(8px);
          display: flex; flex-direction: column; gap: 2px; align-items: center;
        }
        .rt-tt-val { font-size: 1.1rem; font-weight: 800; color: var(--widget-accent); font-variant-numeric: tabular-nums; }
        .rt-tt-day { font-size: 0.65rem; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
      </style>
    `;

    return `
      ${scopedStyles}
      <div class="rt-container" id="rt-container-${ctx?.id || 'main'}">
        
        <!-- Header & Stats -->
        <div class="rt-header-row">
          <div class="rt-title-group">
            <div class="rt-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
              </svg>
            </div>
            <div style="display:flex; flex-direction:column;">
              <span class="stat-label">${esc(labelText)}</span>
              <span style="font-size:0.65rem; font-weight:700; color:var(--color-text-muted); margin-top:2px;">
                Rolling Timeline
              </span>
            </div>
          </div>

          <!-- Computed Intelligence Insights -->
          <div class="rt-stats-group">
            <div class="rt-stat-pill">
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
                ${trendIcon}
              </svg>
              ${esc(trendLabel)}
            </div>
            <div class="rt-stat-sub">
              <span>Avg: <span class="rt-highlight">${formatCurrency(avgY, country, {currency})}</span></span>
              <span>Peak: <span class="rt-highlight">${formatCurrency(maxY, country, {currency})}</span></span>
            </div>
          </div>
        </div>

        <!-- The SVG Data Visualizer -->
        <div class="rt-chart-wrap" id="rt-wrap-${ctx?.id || 'main'}">
          <!-- Floating Tooltip -->
          <div class="rt-tooltip" id="rt-tt-${ctx?.id || 'main'}"></div>

          <svg class="rt-svg" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="none">
            <defs>
              <linearGradient id="rt-grad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stop-color="var(--widget-accent)" stop-opacity="0.3"/>
                <stop offset="100%" stop-color="var(--widget-accent)" stop-opacity="0.0"/>
              </linearGradient>
            </defs>

            <!-- Base Grid & Average Line -->
            <line class="rt-grid-line" x1="0" y1="${svgH}" x2="${svgW}" y2="${svgH}"></line>
            <line class="rt-grid-line" x1="0" y1="${avgYMapped}" x2="${svgW}" y2="${avgYMapped}"></line>
            
            <!-- Trend Data -->
            <path class="rt-area" d="${areaData}"></path>
            <path class="rt-line" d="${pathData}"></path>

            <!-- Hover Interaction Overlay Elements -->
            <line class="rt-hover-line" id="rt-hline-${ctx?.id || 'main'}" x1="0" y1="0" x2="0" y2="${svgH}"></line>
            <circle class="rt-hover-dot" id="rt-hdot-${ctx?.id || 'main'}" cx="0" cy="0"></circle>

            <!-- Invisible Hitboxes for accurate mouse tracking -->
            ${hitboxesHTML}
          </svg>
        </div>

      </div>
    `;
  },
  
  /** 
   * @param {HTMLElement} el 
   * @param {unknown} ctx 
   */
  afterRender: (el, ctx) => {
    const wrap = el.querySelector('.rt-chart-wrap');
    const tooltip = /** @type {HTMLElement} */ (el.querySelector('.rt-tooltip'));
    const hoverLine = el.querySelector('.rt-hover-line');
    const hoverDot = el.querySelector('.rt-hover-dot');
    const hitboxes = el.querySelectorAll('.rt-hitbox');
    
    if (!wrap || !tooltip || !hoverLine || !hoverDot) return;

    const c = /** @type {{ localeCountry?: string; currency?: string }} */ (ctx);
    const country = String(c?.localeCountry || 'US');
    const currency = String(c?.currency || 'USD');

    hitboxes.forEach(box => {
      box.addEventListener('mouseenter', (e) => {
        const target = /** @type {SVGRectElement} */ (e.target);
        
        // Extract data
        const cx = target.getAttribute('data-cx');
        const cy = target.getAttribute('data-cy');
        const rawY = parseFloat(target.getAttribute('data-rawy') || '0');
        const rawX = target.getAttribute('data-rawx'); // Day X

        // Format tooltip
        tooltip.innerHTML = `
          <span class="rt-tt-val">${formatCurrency(rawY, country, {currency})}</span>
          <span class="rt-tt-day">Day ${rawX}</span>
        `;

        // Move SVG Indicator elements
        hoverDot.setAttribute('cx', cx || '0');
        hoverDot.setAttribute('cy', cy || '0');
        /** @type {HTMLElement} */ (hoverDot).style.opacity = '1';

        hoverLine.setAttribute('x1', cx || '0');
        hoverLine.setAttribute('x2', cx || '0');
        /** @type {HTMLElement} */ (hoverLine).style.opacity = '1';

        // Calculate HTML Tooltip position relative to wrapper container
        const wrapRect = wrap.getBoundingClientRect();
        
        // Convert SVG coordinates to physical pixel coordinates 
        // (because SVG is preserveAspectRatio="none", cx is a percentage of 800)
        const percentX = parseFloat(cx || '0') / 800;
        const percentY = parseFloat(cy || '0') / 200;
        
        const pxX = percentX * wrapRect.width;
        const pxY = percentY * wrapRect.height;

        tooltip.style.left = `${pxX}px`;
        tooltip.style.top = `${pxY}px`;
        tooltip.style.opacity = '1';
      });

      // Hide elements when mouse leaves a specific bounding box 
      // (usually handed off seamlessly to the next box, but handles exiting chart)
      box.addEventListener('mouseleave', () => {
        tooltip.style.opacity = '0';
        /** @type {HTMLElement} */ (hoverDot).style.opacity = '0';
        /** @type {HTMLElement} */ (hoverLine).style.opacity = '0';
      });
    });
  },
  
  destroy: (_el) => {},
};
