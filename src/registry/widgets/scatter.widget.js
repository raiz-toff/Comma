import { formatCurrency } from '../../utils/formatters.js';
import { t } from '../../utils/strings.js';
import { esc } from './esc.js';

/**
 * Advanced Statistical Engine
 * Calculates linear regression (line of best fit) and Pearson correlation.
 * @param {Array<{x: number, y: number}>} data - The scatter plot data (x: hours, y: gross)
 * @returns {Object} Regression line points, slope, intercept, and correlation coefficient (r)
 */
function calculateStatistics(data) {
  if (!data || data.length < 2) return { m: 0, b: 0, r: 0, valid: false };

  const n = data.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const { x, y } = data[i];
    sumX += x;
    sumY += y;
    sumXY += (x * y);
    sumX2 += (x * x);
    sumY2 += (y * y);
  }

  // Calculate Slope (m) and Intercept (b) for y = mx + b
  const denominator = (n * sumX2) - (sumX * sumX);
  if (denominator === 0) return { m: 0, b: 0, r: 0, valid: false }; // Vertical line edge case

  const m = ((n * sumXY) - (sumX * sumY)) / denominator;
  const b = (sumY - (m * sumX)) / n;

  // Calculate Pearson Correlation Coefficient (r)
  const rNum = (n * sumXY) - (sumX * sumY);
  const rDenom = Math.sqrt(((n * sumX2) - (sumX * sumX)) * ((n * sumY2) - (sumY * sumY)));
  const r = rDenom === 0 ? 0 : rNum / rDenom;

  return { m, b, r, valid: true };
}

/**
 * Calculates the median of an array of numbers.
 * @param {number[]} values 
 * @returns {number}
 */
function getMedian(values) {
  if (values.length === 0) return 0;
  values.sort((a, b) => a - b);
  const half = Math.floor(values.length / 2);
  if (values.length % 2) return values[half];
  return (values[half - 1] + values[half]) / 2.0;
}

export default {
  id: 'scatter',
  label: 'Earnings vs Hours',
  defaultSize: '2x1', // Wide format to accommodate the beautiful chart
  defaultVisible: false,
  category: 'analytics',

  /** @param {unknown} ctx */
  render: async (ctx) => {
    // 1. Safe Extraction of Context and Data
    const c = /** @type {{ data?: { scatter?: { x:number, y:number }[] }; localeCountry?: string; currency?: string } }} */ (ctx);
    const rawData = c?.data?.scatter || [];
    
    // Filter out 0,0 points which often represent missing data
    const data = rawData.filter(d => d.x > 0 || d.y > 0);
    
    const country = String(c?.data?.localeCountry || 'US');
    const currency = String(c?.data?.currency || 'USD');

    // If we don't have enough data to draw a meaningful scatter plot
    if (data.length === 0) {
      return `
        <div style="display:flex; flex-direction:column; height:100%; justify-content:center; align-items:center; color:var(--color-text-muted);">
          <svg width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="margin-bottom:8px; opacity:0.5;">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 8v4l3 3"></path>
          </svg>
          <span style="font-size:0.8rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em;">Awaiting Shift Data</span>
        </div>
      `;
    }

    // Find boundaries for scaling the SVG
    // We add 10% padding to the max values so dots don't clip the edges
    const maxX = Math.max(...data.map(d => d.x)) * 1.1 || 10;
    const maxY = Math.max(...data.map(d => d.y)) * 1.1 || 100;
    
    const medX = getMedian(data.map(d => d.x));
    const medY = getMedian(data.map(d => d.y));

    // Run the Deep Analysis Engine
    const stats = calculateStatistics(data);
    let predictability = "Variable";
    let predictColor = "var(--color-warning, #f5a623)";
    
    if (stats.valid) {
      if (stats.r > 0.8) {
        predictability = "Highly Predictable";
        predictColor = "var(--color-success, #10b981)";
      } else if (stats.r > 0.5) {
        predictability = "Moderately Stable";
        predictColor = "var(--widget-accent, #8b5cf6)";
      }
    }

    // Calculate how many shifts landed in the "Golden Zone" (Above median pay, below median hours)
    let goldenShifts = 0;
    data.forEach(d => {
      if (d.x < medX && d.y > medY) goldenShifts++;
    });

    const labelText = t('analytics.scatter') || 'Efficiency Matrix';

    // SVG Canvas Dimensions
    const svgW = 400;
    const svgH = 160;

    // Generate the SVG Points
    const dotsHTML = data.map((d, index) => {
      const px = (d.x / maxX) * svgW;
      const py = svgH - ((d.y / maxY) * svgH); // Invert Y for SVG coordinates
      
      // We embed raw data into data-attributes for the custom hover interactions later
      return `<circle class="sc-dot" cx="${px}" cy="${py}" r="4.5" 
                data-x="${d.x}" data-y="${d.y}" 
                data-date="${d.date || ''}"
                data-platform="${d.platformId || ''}"
                style="animation-delay: ${index * 0.02}s"></circle>`;
    }).join('');

    // Generate the Regression Line (Trendline)
    let trendlineHTML = '';
    if (stats.valid && stats.m > 0) {
      // Point 1: At x = 0
      let y1 = stats.b;
      // Point 2: At x = maxX
      let y2 = (stats.m * maxX) + stats.b;

      // Convert to SVG Space
      let py1 = svgH - ((y1 / maxY) * svgH);
      let py2 = svgH - ((y2 / maxY) * svgH);

      trendlineHTML = `<line class="sc-trendline" x1="0" y1="${py1}" x2="${svgW}" y2="${py2}"></line>`;
    }

    // Quadrant Crosshairs (Medians)
    const pxMed = (medX / maxX) * svgW;
    const pyMed = svgH - ((medY / maxY) * svgH);

    const scopedStyles = `
      <style>
        /* Fluid entrance animations for statistical data */
        @keyframes scatterPop {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.4); }
          100% { transform: scale(1); opacity: 0.6; }
        }
        @keyframes drawLine {
          from { stroke-dashoffset: 1000; opacity: 0; }
          to { stroke-dashoffset: 0; opacity: 0.4; }
        }
        @keyframes fadePulse {
          0%, 100% { opacity: 0.05; }
          50% { opacity: 0.15; }
        }

        .sc-container { display: flex; flex-direction: column; height: 100%; justify-content: space-between; padding: 4px; position: relative; }
        
        .sc-header-row { display: flex; justify-content: space-between; align-items: flex-start; z-index: 2; position: relative; }
        
        .sc-title-group { display: flex; align-items: center; gap: 10px; }
        .sc-icon-wrap {
          display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; 
          border-radius: 8px; background: color-mix(in srgb, var(--widget-accent, #8b5cf6) 15%, transparent); 
          color: var(--widget-accent, #8b5cf6);
        }

        /* Statistical Header Metrics */
        .sc-stats-group { text-align: right; }
        .sc-stat-pill {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 0.65rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em;
          color: ${predictColor}; background: color-mix(in srgb, ${predictColor} 10%, transparent);
          padding: 4px 8px; border-radius: 999px;
          border: 1px solid color-mix(in srgb, ${predictColor} 30%, transparent);
        }
        .sc-stat-sub { font-size: 0.65rem; font-weight: 700; color: var(--color-text-muted, #888); margin-top: 4px; letter-spacing: 0.05em; }
        
        /* The SVg Chart Container */
        .sc-chart-wrap { margin-top: 16px; flex-grow: 1; position: relative; width: 100%; height: 100%; min-height: 120px; }
        .sc-svg { width: 100%; height: 100%; overflow: visible; }
        
        /* Quadrant Analytics */
        .sc-quadrant-bg { fill: var(--color-success, #10b981); opacity: 0; animation: fadePulse 4s infinite 1s; mix-blend-mode: screen; }
        .sc-axis-line { stroke: var(--color-text-muted); stroke-width: 1; opacity: 0.2; stroke-dasharray: 4 4; }
        
        /* Trendline Data */
        .sc-trendline {
          stroke: var(--widget-accent, #8b5cf6);
          stroke-width: 2;
          stroke-dasharray: 6 6, 1000;
          stroke-linecap: round;
          fill: none;
          animation: drawLine 2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }

        /* Laser Crosshair Guides */
        .sc-guide-line {
          stroke: var(--widget-accent, #8b5cf6);
          stroke-width: 1.2px;
          stroke-dasharray: 3 3;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.15s ease;
        }

        /* Data Points */
        .sc-dot {
          fill: var(--widget-accent, #8b5cf6);
          stroke: transparent;
          stroke-width: 8px; /* Large invisible hit area to prevent pixel-hunting */
          opacity: 0; /* Starting state for animation */
          transform-origin: center;
          transform-box: fill-box;
          animation: scatterPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          transition: r 0.15s ease, fill 0.15s ease, stroke 0.15s ease, stroke-width 0.15s ease, opacity 0.15s ease;
          cursor: crosshair;
        }
        
        /* Interactive Hover States */
        .sc-dot:hover {
          fill: #fff !important;
          stroke: var(--widget-accent, #8b5cf6) !important;
          stroke-width: 2.5px !important;
          opacity: 1 !important;
          r: 6.5;
        }

        /* Premium Glassmorphic Tooltip */
        .sc-tooltip {
          position: absolute; 
          pointer-events: none; 
          opacity: 0;
          background: rgba(18, 18, 18, 0.88);
          backdrop-filter: blur(12px) saturate(180%);
          -webkit-backdrop-filter: blur(12px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 12px 24px -4px rgba(0, 0, 0, 0.5), 
                      0 0 0 1px rgba(255, 255, 255, 0.02);
          padding: 10px 14px; 
          border-radius: 12px;
          transition: opacity 0.15s cubic-bezier(0.2, 0.8, 0.2, 1), 
                      transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1);
          z-index: 100;
          min-width: 155px;
        }
        .sc-tooltip-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; gap: 8px; }
        .sc-tooltip-date { font-size: 0.7rem; font-weight: 800; color: var(--color-text-main); }
        .sc-tooltip-plat { font-size: 0.6rem; font-weight: 900; letter-spacing: 0.05em; padding: 2px 5px; border-radius: 4px; background: rgba(255,255,255,0.06); }
        .sc-tooltip-val { font-size: 0.95rem; font-weight: 800; color: var(--color-text-main); font-variant-numeric: tabular-nums; }
        .sc-tooltip-lbl { font-size: 0.65rem; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em;}
        .sc-tooltip-row { display: flex; justify-content: space-between; gap: 16px; align-items: baseline; }
        .sc-tooltip-hr { height: 1px; background: rgba(255,255,255,0.08); margin: 6px 0; }
        
        /* Legends */
        .sc-legend { display: flex; justify-content: space-between; font-size: 0.6rem; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 8px; }
      </style>
    `;

    return `
      ${scopedStyles}
      <div class="sc-container" id="sc-container-${ctx?.id || 'main'}">
        
        <!-- Deep Analytical Header -->
        <div class="sc-header-row">
          <div class="sc-title-group">
            <div class="sc-icon-wrap">
              <!-- Target/Nodes Scatter Icon -->
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
            </div>
            <div style="display:flex; flex-direction:column;">
              <span class="stat-label">${esc(labelText)}</span>
              <span style="font-size:0.65rem; font-weight:700; color:var(--color-text-muted); margin-top:2px;">
                ${data.length} Shifts Analyzed
              </span>
            </div>
          </div>
 
          <!-- Intelligence Readout -->
          <div class="sc-stats-group">
            <div class="sc-stat-pill">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              ${esc(predictability)}
            </div>
            <div class="sc-stat-sub">${goldenShifts} in Golden Zone</div>
          </div>
        </div>

        <!-- The Bespoke Analytical Scatter Canvas -->
        <div class="sc-chart-wrap" id="sc-canvas-wrap-${ctx?.id || 'main'}">
          <!-- Dynamic Tooltip Mount -->
          <div class="sc-tooltip" id="sc-tooltip-${ctx?.id || 'main'}"></div>
          
          <svg class="sc-svg" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="none">
            
            <!-- Golden Quadrant (Top Left: High Pay, Low Hours) -->
            <rect class="sc-quadrant-bg" x="0" y="0" width="${pxMed}" height="${pyMed}"></rect>
            
            <!-- Median Crosshairs -->
            <line class="sc-axis-line" x1="${pxMed}" y1="0" x2="${pxMed}" y2="${svgH}"></line>
            <line class="sc-axis-line" x1="0" y1="${pyMed}" x2="${svgW}" y2="${pyMed}"></line>

            <!-- Dynamic Laser Guides -->
            <line class="sc-guide-line sc-guide-x" x1="0" y1="0" x2="0" y2="0"></line>
            <line class="sc-guide-line sc-guide-y" x1="0" y1="0" x2="0" y2="0"></line>

            <!-- Statistical Trendline -->
            ${trendlineHTML}

            <!-- Data Dots -->
            ${dotsHTML}
          </svg>
        </div>
        
        <!-- Contextual Legend -->
        <div class="sc-legend">
          <span>0 Hrs</span>
          <span style="color:var(--widget-accent); font-weight:800;">Avg: ${formatCurrency(stats.m, country, {currency})}/hr</span>
          <span>${maxX.toFixed(1)} Hrs</span>
        </div>

      </div>
    `;
  },
  
  /** 
   * @param {HTMLElement} el 
   * @param {unknown} ctx 
   */
  afterRender: (el, ctx) => {
    // Advanced Tooltip Logic without any external libraries
    const container = el.querySelector('.sc-container');
    const wrap = el.querySelector('.sc-chart-wrap');
    const tooltip = el.querySelector('.sc-tooltip');
    const dots = el.querySelectorAll('.sc-dot');
    const guideX = el.querySelector('.sc-guide-x');
    const guideY = el.querySelector('.sc-guide-y');
    
    if (!wrap || !tooltip || !container) return;

    // Cache the country/currency to format inside the hover state
    const c = /** @type {{ localeCountry?: string; currency?: string }} */ (ctx);
    const country = String(c?.localeCountry || 'US');
    const currency = String(c?.currency || 'USD');

    dots.forEach(dot => {
      // Mouse Enter: Calculate positions, inject data, and fade in
      dot.addEventListener('mouseenter', (e) => {
        const target = /** @type {SVGCircleElement} */ (e.target);
        
        // Extract the raw data stored in HTML attributes
        const xVal = parseFloat(target.getAttribute('data-x') || '0');
        const yVal = parseFloat(target.getAttribute('data-y') || '0');
        const dateStr = target.getAttribute('data-date') || '';
        const platform = target.getAttribute('data-platform') || '';
        
        // Format the hover data
        const fmtEarn = formatCurrency(yVal, country, { currency });
        const fmtHrs = `${xVal.toFixed(1)}h`;
        const effectiveRate = xVal > 0 ? formatCurrency(yVal / xVal, country, { currency }) : '$0.00';

        // Date formatting: e.g. "Sunday, May 17"
        let dateHtml = '';
        if (dateStr) {
          const dObj = new Date(`${dateStr}T00:00:00`);
          if (!Number.isNaN(dObj.getTime())) {
            const formattedDate = dObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' });
            dateHtml = `<div class="sc-tooltip-date">${formattedDate}</div>`;
          }
        }
        
        // Platform Badge
        let platformHtml = '';
        if (platform) {
          platformHtml = `<span class="sc-tooltip-plat" style="color: var(--color-${platform.toLowerCase()}, var(--widget-accent));">${platform.toUpperCase()}</span>`;
        }

        // Build the tooltip DOM
        tooltip.innerHTML = `
          ${dateHtml ? `<div class="sc-tooltip-header">${dateHtml} ${platformHtml}</div>` : ''}
          <div class="sc-tooltip-row">
            <span class="sc-tooltip-lbl">Earnings</span>
            <span class="sc-tooltip-val" style="color: var(--color-success, #10b981);">${fmtEarn}</span>
          </div>
          <div class="sc-tooltip-row">
            <span class="sc-tooltip-lbl">Hours</span>
            <span class="sc-tooltip-val">${fmtHrs}</span>
          </div>
          <div class="sc-tooltip-hr"></div>
          <div class="sc-tooltip-row">
            <span class="sc-tooltip-lbl">Rate</span>
            <span class="sc-tooltip-val" style="color: var(--widget-accent);">${effectiveRate}/h</span>
          </div>
        `;

        // Calculate absolute position inside the container relative to the SVG
        const wrapRect = wrap.getBoundingClientRect();
        const dotRect = target.getBoundingClientRect();
        
        // Compute relative X and Y
        let relX = dotRect.left - wrapRect.left + (dotRect.width / 2);
        let relY = dotRect.top - wrapRect.top;

        // Position Clamp to avoid overflow clipping
        const tooltipWidth = 160;
        const padding = 12;

        if (relY < 65) {
          // If too close to the top, render below the dot
          tooltip.style.transform = 'translate(-50%, 15px)';
        } else {
          // Otherwise render above the dot
          tooltip.style.transform = 'translate(-50%, -115%)';
        }

        // Clamp X so it doesn't leak off the left or right edges
        if (relX < (tooltipWidth / 2) + padding) {
          relX = (tooltipWidth / 2) + padding;
        } else if (relX > wrapRect.width - (tooltipWidth / 2) - padding) {
          relX = wrapRect.width - (tooltipWidth / 2) - padding;
        }

        // Apply positions and reveal
        tooltip.style.left = `${relX}px`;
        tooltip.style.top = `${relY}px`;
        tooltip.style.opacity = '1';

        // Laser Guide Crosshairs snap
        if (guideX && guideY) {
          const cx = target.getAttribute('cx');
          const cy = target.getAttribute('cy');
          
          guideX.setAttribute('x1', '0');
          guideX.setAttribute('y1', cy);
          guideX.setAttribute('x2', cx);
          guideX.setAttribute('y2', cy);
          guideX.style.opacity = '0.35';

          guideY.setAttribute('x1', cx);
          guideY.setAttribute('y1', cy);
          guideY.setAttribute('x2', cx);
          guideY.setAttribute('y2', '160'); // Height is 160
          guideY.style.opacity = '0.35';
        }

        // Dim other dots to create focus on the hovered one
        dots.forEach(d => { if (d !== target) d.style.opacity = '0.15'; });
      });

      // Mouse Leave: Hide tooltip and restore other dots
      dot.addEventListener('mouseleave', () => {
        tooltip.style.opacity = '0';
        dots.forEach(d => d.style.opacity = '0.65'); // Restore
        
        if (guideX && guideY) {
          guideX.style.opacity = '0';
          guideY.style.opacity = '0';
        }
      });
    });
  },
  
  destroy: (_el) => {},
};
