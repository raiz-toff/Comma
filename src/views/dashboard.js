import {
  bus,
  DATA_IMPORTED,
  EXPENSE_SAVED,
  NAVIGATION,
  PLATFORM_CHANGED,
  SHIFT_DELETED,
  SHIFT_SAVED,
} from '../core/events.js';
import { store } from '../core/store.js';
import { getFinancialOverviewForRange, getFinancialMonthlyBreakdown } from '../modules/analytics/analytics.js';
import { getIcon } from '../ui/icons.js';
import { formatCurrency } from '../utils/formatters.js';
import { renderSkeleton } from '../ui/components.js';
import { defaultRangeForPreset } from '../utils/date-range-presets.js';
import { t } from '../utils/strings.js';
import { getDemoAnalyticsAnchorDate } from '../modules/demo/sample-year.js';
import { getOrderedDashboardWidgetIds, renderWidgetCellsInnerHtml, WidgetRegistry } from '../registry/widgets/index.js';
import { buildWidgetDataContext } from '../modules/analytics/widget-data.js';
import { afterRenderWidgets } from '../registry/widgets/after-render.js';
import { getCountryTaxProfile } from '../registry/countries/index.js';
import { calcTaxSetAside } from '../utils/calculations.js';

const DASHBOARD_RANGE_KEY = 'comma-dashboard-range-v1';
const DASHBOARD_FILTER_EXPANDED_KEY = 'comma-dashboard-filter-expanded-v1';
const MONTHLY_ROWS_PER_PAGE = 15;
const MONTHLY_PAGE_STORAGE_KEY = 'comma-dashboard-monthly-page-v1';

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** @returns {{ start: string; end: string; preset: string } | null} */
function loadDashboardRange() {
  try {
    const raw = sessionStorage.getItem(DASHBOARD_RANGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p.start === 'string' && typeof p.end === 'string' && typeof p.preset === 'string') {
        return p;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** @param {{ start: string; end: string; preset: string }} s */
function saveDashboardRange(s) {
  try {
    sessionStorage.setItem(DASHBOARD_RANGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

let _dashFilterExpanded = false;
let _dashShortcutsExpanded = false;

function loadDashboardFilterExpanded() {
  return _dashFilterExpanded;
}

function saveDashboardFilterExpanded(expanded) {
  _dashFilterExpanded = expanded;
}

function loadDashboardShortcutsExpanded() {
  return _dashShortcutsExpanded;
}

function saveDashboardShortcutsExpanded(expanded) {
  _dashShortcutsExpanded = expanded;
}

/** @param {string} start @param {string} end */
function loadMonthlyTablePage(start, end) {
  try {
    const raw = sessionStorage.getItem(MONTHLY_PAGE_STORAGE_KEY);
    if (!raw) return 0;
    const p = JSON.parse(raw);
    if (p && p.start === start && p.end === end && typeof p.page === 'number' && Number.isFinite(p.page) && p.page >= 0) {
      return Math.floor(p.page);
    }
  } catch {
    /* ignore */
  }
  return 0;
}

/** @param {string} start @param {string} end @param {number} page */
function saveMonthlyTablePage(start, end, page) {
  try {
    sessionStorage.setItem(MONTHLY_PAGE_STORAGE_KEY, JSON.stringify({ start, end, page }));
  } catch {
    /* ignore */
  }
}

/** @type {WeakMap<HTMLElement, () => void>} */
const teardownByRoot = new WeakMap();

/**
 * @param {HTMLElement} root
 * @param {Record<string, unknown>} ctx
 */
async function paintDashboard(root, ctx) {
  void ctx;

  const now = store.get('demoMode') ? getDemoAnalyticsAnchorDate() : new Date();
  const user = store.get('user');
  const weekStartDay = Number(user?.locale?.weekStartDay ?? 0);
  const platformFilter = String(store.get('activePlatformId') ?? 'all');
  let range = loadDashboardRange();
  if (!range) range = defaultRangeForPreset('month', now, weekStartDay);
  if (String(range.start) > String(range.end)) {
    const t0 = range.start;
    range = { ...range, start: range.end, end: t0 };
  }

  root.innerHTML = `
    <section class="dashboard-view dashboard-view--financial">
      <header class="financial-dash-header" style="margin-bottom: var(--space-6);">
        <div class="financial-dash-header-text">
          <h1 class="financial-dash-title">${esc(t('views.dashboard.financial.title'))}</h1>
          <p class="financial-dash-subtitle">${esc(t('views.dashboard.financial.subtitle'))}</p>
        </div>
      </header>
      <div class="kpi-hero-strip" style="margin-bottom: var(--space-6); display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-3);">
        ${renderSkeleton('stat')}
        ${renderSkeleton('stat')}
        ${renderSkeleton('stat')}
        ${renderSkeleton('stat')}
        ${renderSkeleton('stat')}
        ${renderSkeleton('stat')}
      </div>
      <div style="margin-bottom: var(--space-6);">
        ${renderSkeleton('chart')}
      </div>
      <div class="bento-grid" style="margin-bottom: var(--space-6);">
        ${renderSkeleton('card')}
        ${renderSkeleton('card')}
        ${renderSkeleton('card')}
      </div>
    </section>
  `;

  const [fin, monthly] = await Promise.all([
    getFinancialOverviewForRange(range.start, range.end, platformFilter, weekStartDay),
    getFinancialMonthlyBreakdown(range.start, range.end, platformFilter),
  ]);

  // 1. Data Context for Widgets
  const widgetCtx = await buildWidgetDataContext({ start: range.start, end: range.end }, platformFilter, weekStartDay);
  widgetCtx.data.financial = fin; // Inject pre-fetched financial data

  // 2. Render Widgets from Registry
  const currentWidgets = getOrderedDashboardWidgetIds(user, widgetCtx).filter(id => ![
    'earnings',
    'expenses',
    'netIncome',
    'taxJar'
  ].includes(id));

  // 0. FILTER OUT PERMANENT WIDGETS
  const dashboardWidgets = currentWidgets.filter(wObj => {
    const id = typeof wObj === 'string' ? wObj : wObj?.id;
    return id !== 'totalHours';
  });

  const widgetCells = await Promise.all(dashboardWidgets.map(async (wObj) => {
    try {
      const id = typeof wObj === 'string' ? wObj : wObj?.id;
      const def = WidgetRegistry.getById(id);
      if (!def) return null;

      // Find custom size if it exists in user settings
      const config = Array.isArray(user?.dashboardWidgets)
        ? user.dashboardWidgets.find((w) => (typeof w === 'string' ? w : w?.id) === id)
        : null;
      const size = (typeof config === 'object' ? config?.size : null) || def.defaultSize || '1x1';

      return { id, size, html: await def.render(widgetCtx) };
    } catch (err) {
      console.error('Widget render failed:', err);
      return null;
    }
  }));

  const widgetCardsHtml = widgetCells
    .filter(Boolean)
    .map(
      (cell) => `
        <article class="card bento-cell-${cell.size}" data-widget-id="${esc(cell.id)}">
          ${cell.html}
        </article>`,
    )
    .join('');
  const localeCountry = user?.locale?.country || 'US';
  const currency = user?.locale?.currency || 'USD';

  const fmt = (v) => esc(formatCurrency(Number(v) || 0, localeCountry, { currency }));
  const fmtNum = (v, frac = 2) => esc(Number(v || 0).toFixed(frac));
  const hoursVal = Number(fin.hours) || 0;
  const hoursInt = Math.floor(hoursVal);
  const hoursDec = (hoursVal % 1).toFixed(2).slice(1); // .77
  const exactHours = Math.floor(hoursVal);
  const exactMinutes = Math.round((hoursVal - exactHours) * 60);
  const hoursStr = `${fmtNum(hoursVal, 2)} ${esc(t('views.dashboard.financial.hoursSuffix'))}`;
 
  // --- Visuals for KPI Blocks (Matching Widgets) ---
  const taxProfile = getCountryTaxProfile(localeCountry);
  const taxRatePct = num(user?.taxWithholdingPct, taxProfile.defaultWithholdingPct);
  const taxSetAside = calcTaxSetAside(fin.gross, taxRatePct);
  const takeHomePay = fin.netIncome - taxSetAside;

  const rollingPoints = widgetCtx.data.rollingTrend?.points?.slice(-14).map(p => Number(p.y) || 0) || [0,0,0,0,0,0,0];
  const maxP = Math.max(...rollingPoints, 1);
  const minP = Math.min(...rollingPoints);
  const rangeP = (maxP - minP) || 1;
  const svgW = 100, svgH = 30;
  const getSparkPath = (pts, height = 30) => {
    if (!pts || pts.length < 2) return "0,30 100,30";
    const max = Math.max(...pts, 1);
    const min = Math.min(...pts);
    const rng = (max - min) || 1;
    return pts.map((p, i) => {
      const x = (i / (pts.length - 1)) * 100;
      const y = height - ((p - min) / rng) * height;
      return `${x},${y}`;
    }).join(' L ');
  };

  const getSparkPathStep = (pts, height = 30) => {
    if (!pts || pts.length < 2) return "0,30 100,30";
    const max = Math.max(...pts, 1);
    const min = Math.min(...pts);
    const rng = (max - min) || 1;
    let path = "";
    pts.forEach((p, i) => {
      const x = (i / (pts.length - 1)) * 100;
      const y = height - ((p - min) / rng) * height;
      if (i === 0) path += `${x},${y}`;
      else {
        const prevX = ((i - 1) / (pts.length - 1)) * 100;
        path += ` L ${x},${path.split(',').pop().split(' ').pop()} L ${x},${y}`;
      }
    });
    return path;
  };

  const getSparkPathCurve = (pts, height = 30) => {
    if (!pts || pts.length < 2) return "0,30 100,30";
    const max = Math.max(...pts, 1);
    const min = Math.min(...pts);
    const rng = (max - min) || 1;
    return pts.reduce((acc, p, i) => {
      const x = (i / (pts.length - 1)) * 100;
      const y = height - ((p - min) / rng) * height;
      if (i === 0) return `${x},${y}`;
      const prevX = ((i - 1) / (pts.length - 1)) * 100;
      const cpX = prevX + (x - prevX) / 2;
      return `${acc} C ${cpX},${acc.split(',').pop().split(' ').pop()} ${cpX},${y} ${x},${y}`;
    }, "");
  };

  const sparkPathGross   = getSparkPath(rollingPoints);
  const sparkPathStep    = getSparkPathStep(rollingPoints.map((p, i) => p * (0.2 + (i % 3) * 0.05))); 
  const sparkPathCurve   = getSparkPathCurve(rollingPoints.map((p, i) => p * (0.6 + (i % 2) * 0.02)));

  const hoursSparkBars = rollingPoints.map((p, i) => {
    const h = Math.max(4, (p / maxP) * 16);
    return `<div style="flex: 1; height: ${h}px; background: currentColor; border-radius: 1px;"></div>`;
  }).join('');

  const burnRatio = fin.gross > 0 ? Math.min(100, (fin.expense / fin.gross) * 100) : 0;
  const netMargin = fin.gross > 0 ? Math.min(100, (takeHomePay / fin.gross) * 100) : 0;
  
  if (fin.avgRateHr == null) {
    fin.avgRateHr = fin.hours > 0 ? fin.gross / fin.hours : 0;
  }

  const sparkPathRate = getSparkPath(rollingPoints.map((p, i) => {
    const h = (p / (maxP || 1)) * 40; // Mock variation based on gross trend
    return h;
  }));
  const taxJarRatio = fin.gross > 0 ? Math.min(100, (taxSetAside / (fin.gross * 0.3)) * 100) : 0; 
  const hoursRatio = Math.min(100, (hoursVal / 40) * 100);

  const wc = widgetCtx.data.weekCompare;
  const isUp = (wc?.delta || 0) >= 0;
  const deltaPct = wc?.lastGross > 0 ? ((wc.delta / wc.lastGross) * 100).toFixed(1) : '0.0';

  // ---------------------------------------------------------------------------
  // Helper: build SVG arc path for circular progress (cx=cy=18, r=14)
  // ---------------------------------------------------------------------------
  const arc = (pct) => {
    const r = 14, cx = 18, cy = 18;
    const angle = Math.min(pct / 100, 0.9999) * 2 * Math.PI;
    const x = cx + r * Math.sin(angle);
    const y = cy - r * Math.cos(angle);
    const large = angle > Math.PI ? 1 : 0;
    return `M ${cx} ${cy - r} A ${r} ${r} 0 ${large} 1 ${x} ${y}`;
  };

  const kpiBlocksHtml = `
    <style>
      @keyframes kpi-fade-up {
        from { opacity: 0; transform: translateY(18px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes kpi-bar-grow {
        from { width: 0%; }
      }
      @keyframes kpi-spark-draw {
        from { stroke-dashoffset: 400; }
        to   { stroke-dashoffset: 0; }
      }
      @keyframes kpi-arc-draw {
        from { stroke-dasharray: 0 200; }
      }
      @keyframes kpi-number-pop {
        0%   { transform: scale(0.85); opacity: 0; }
        60%  { transform: scale(1.04); }
        100% { transform: scale(1); opacity: 1; }
      }
      @keyframes kpi-pulse-ring {
        0%   { transform: scale(1); opacity: 0.5; }
        100% { transform: scale(1.55); opacity: 0; }
      }
      @keyframes kpi-gradient-shift {
        0%   { background-position: 0% 50%; }
        50%  { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      @keyframes th-spin-cw { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @keyframes th-spin-ccw { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }

      .kpi-hero-strip {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1px;
        background: var(--color-border);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        overflow: hidden;
        margin-bottom: var(--space-6);
        position: relative;
      }
      @media (min-width: 900px) {
        .kpi-hero-strip { grid-template-columns: repeat(5, 1fr); }
      }

      .kpi-hero-strip::before {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg,
          color-mix(in srgb, var(--color-brand) 6%, transparent),
          transparent 40%,
          color-mix(in srgb, var(--color-success) 5%, transparent) 80%,
          transparent
        );
        pointer-events: none;
        z-index: 0;
      }

      .kpi-card {
        position: relative;
        z-index: 1;
        background: var(--color-surface);
        padding: var(--space-4) var(--space-4) var(--space-3);
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        overflow: hidden;
        animation: kpi-fade-up 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
        transition: background 0.2s;
        min-height: 140px;
      }
      .kpi-card:hover { background: var(--color-surface-raised); }
      .kpi-card:nth-child(1) { animation-delay: 0.05s; }
      .kpi-card:nth-child(2) { animation-delay: 0.12s; }
      .kpi-card:nth-child(3) { animation-delay: 0.19s; }
      .kpi-card:nth-child(4) { animation-delay: 0.26s; }
      .kpi-card:nth-child(5) { animation-delay: 0.33s; }

      .kpi-card-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--space-2);
      }

      .kpi-label-group { flex: 1; min-width: 0; }

      .kpi-label {
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-text-secondary);
        margin-bottom: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .kpi-badge {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.02em;
        padding: 2px 6px;
        border-radius: 999px;
        white-space: nowrap;
      }
      .kpi-badge--up   { background: color-mix(in srgb, var(--color-success) 18%, var(--color-surface)); color: var(--color-success); }
      .kpi-badge--down { background: color-mix(in srgb, var(--color-danger)  18%, var(--color-surface)); color: var(--color-danger); }
      .kpi-badge--neutral { background: color-mix(in srgb, var(--color-text-secondary) 12%, var(--color-surface)); color: var(--color-text-secondary); }

      /* Arc viz (circular mini-gauge) */
      .kpi-arc-wrap {
        flex-shrink: 0;
        width: 38px;
        height: 38px;
        position: relative;
      }
      .kpi-arc-wrap svg { display: block; overflow: visible; }
      .kpi-arc-bg   { fill: none; stroke: var(--color-border); stroke-width: 2.5; opacity: 0.4; }
      .kpi-arc-fill {
        fill: none;
        stroke: var(--kpi-accent);
        stroke-width: 2.5;
        stroke-linecap: round;
        animation: kpi-arc-draw 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.4s both;
        stroke-dasharray: var(--arc-len, 88) 200;
      }
      .kpi-arc-pct {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 8.5px;
        font-weight: 800;
        color: var(--kpi-accent);
        letter-spacing: -0.02em;
      }

      /* Main value */
      .kpi-value {
        font-size: 1.6rem;
        font-weight: 900;
        letter-spacing: -0.03em;
        color: var(--color-text-primary);
        font-variant-numeric: tabular-nums;
        line-height: 1;
        animation: kpi-number-pop 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.25s both;
      }

      /* Spark line */
      .kpi-spark {
        width: 100%;
        height: 30px;
        overflow: visible;
      }
      .kpi-spark-path {
        fill: none;
        stroke: var(--kpi-accent);
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-dasharray: 400;
        stroke-dashoffset: 0;
        animation: kpi-spark-draw 1.1s cubic-bezier(0.22, 1, 0.36, 1) 0.35s both;
      }
      .kpi-spark-area {
        fill: var(--kpi-accent);
        opacity: 0.08;
      }

      /* Bar track */
      .kpi-bar-track {
        height: 10px;
        border-radius: 20px;
        background: color-mix(in srgb, var(--kpi-accent) 8%, var(--color-border));
        overflow: hidden;
        margin-top: auto;
        position: relative;
      }
      .kpi-bar-fill {
        height: 100%;
        border-radius: 20px;
        background: linear-gradient(to right, color-mix(in srgb, var(--kpi-accent) 60%, white), var(--kpi-accent));
        animation: kpi-bar-grow 1s cubic-bezier(0.22, 1, 0.36, 1) 0.4s both;
        position: relative;
      }

      /* Pulse dot (gross card only) */
      .kpi-pulse-wrap {
        position: absolute;
        top: var(--space-4);
        right: var(--space-4);
        width: 8px;
        height: 8px;
      }
      .kpi-pulse-dot {
        width: 8px; height: 8px;
        border-radius: 50%;
        background: var(--kpi-accent);
        position: absolute;
      }
      .kpi-pulse-ring {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        border: 1.5px solid var(--kpi-accent);
        animation: kpi-pulse-ring 1.5s ease-out 0.6s infinite;
      }

      /* Subtle noise texture overlay per card */
      .kpi-card-noise {
        position: absolute;
        inset: 0;
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
        background-size: 100px 100px;
        opacity: 0.018;
        pointer-events: none;
        mix-blend-mode: overlay;
        z-index: 0;
      }

      /* Container Layout — Responsive Grid for 6 cards */
      .kpi-hero-strip {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: var(--space-3);
        margin-bottom: var(--space-6);
        animation: kpi-fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1);
      }
      @media (min-width: 768px) {
        .kpi-hero-strip {
          grid-template-columns: repeat(3, 1fr);
        }
      }
      @media (min-width: 1200px) {
        .kpi-hero-strip {
          grid-template-columns: repeat(6, 1fr);
        }
      }

      @keyframes kpi-fade-up {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
    </style>

    <div class="kpi-hero-strip" role="list" aria-label="Financial KPIs">

      <!-- ① GROSS EARNINGS - Classic Sparkline -->
      <div class="kpi-card" style="--kpi-accent: #14b8a6;" role="listitem">
        <div class="kpi-card-noise"></div>
        <div class="kpi-card-top">
          <div class="kpi-label-group">
            <div class="kpi-label">${esc(t('views.dashboard.financial.kpiGross')) || 'Gross Earnings'}</div>
          </div>
          <div class="kpi-pulse-wrap">
            <div class="kpi-pulse-dot"></div>
            <div class="kpi-pulse-ring"></div>
          </div>
        </div>
        <div class="kpi-value">${fmt(fin.gross)}</div>
        
        <svg class="kpi-spark" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="none" style="margin-bottom: var(--space-2); height: 45px;">
          <path class="kpi-spark-area" d="M 0,${svgH} L ${sparkPathGross} L ${svgW},${svgH} Z" style="fill: var(--kpi-accent); opacity: 0.12;" />
          <path class="kpi-spark-path" d="M ${sparkPathGross}" style="stroke: var(--kpi-accent); stroke-width: 2.5; opacity: 1;" />
        </svg>

        <div style="margin-top: auto; display: flex;">
           <div style="background: var(--color-surface-raised); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; color: var(--color-text-main); display: flex; gap: 6px; align-items: center; border: 1px solid var(--color-border);">
              <span class="${isUp ? 'kpi-badge--up' : 'kpi-badge--down'}" style="background:none; padding:0; font-size: 11px;">${isUp ? '↑' : '↓'} ${deltaPct}%</span> 
              <span style="opacity: 0.7; font-size: 9px;">VS LAST</span>
           </div>
        </div>
      </div>

      <!-- ② AVG RATE - Sloping Peak -->
      <div class="kpi-card" style="--kpi-accent: #f59e0b;" role="listitem">
        <div class="kpi-card-noise"></div>
        <div class="kpi-card-top">
          <div class="kpi-label-group">
            <div class="kpi-label">${esc(t('views.dashboard.financial.avgRateHr')) || 'Avg $/hr'}</div>
          </div>
        </div>
        <div class="kpi-value" style="display: flex; align-items: baseline; gap: 4px;">
           <span>${fmt(fin.avgRateHr || 0)}</span><span style="font-size: 0.5em; opacity: 0.7; font-weight: 800;">/hr</span>
        </div>

        <svg class="kpi-spark" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="none" style="margin-bottom: var(--space-2); height: 45px;">
          <path class="kpi-spark-area" d="M 0,${svgH} L ${sparkPathRate} L ${svgW},${svgH} Z" style="fill: var(--kpi-accent); opacity: 0.12;" />
          <path fill="none" stroke="var(--kpi-accent)" stroke-width="2.5" d="M ${sparkPathRate}" style="opacity: 1;" />
        </svg>

        <div style="margin-top: auto; display: flex;">
           <div style="background: var(--color-surface-raised); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; color: var(--color-text-main); display: flex; gap: 6px; align-items: center; border: 1px solid var(--color-border);">
              <span style="color: #f59e0b;">${(fin.avgRateHr || 0) >= 35 ? 'ELITE' : (fin.avgRateHr || 0) >= 25 ? 'PRO' : 'ACTIVE'}</span> 
              <span style="opacity: 0.7; font-size: 9px;">EFFICIENCY</span>
           </div>
        </div>
      </div>

      <!-- ③ EXPENSES - Step Chart -->
      <div class="kpi-card" style="--kpi-accent: #06b6d4;" role="listitem">
        <div class="kpi-card-noise"></div>
        <div class="kpi-card-top">
          <div class="kpi-label-group">
            <div class="kpi-label">${esc(t('views.dashboard.financial.kpiExpenses')) || 'Expenses'}</div>
          </div>
        </div>
        <div class="kpi-value">${fmt(fin.expense)}</div>

        <svg class="kpi-spark" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="none" style="margin-bottom: var(--space-2); height: 45px;">
          <path class="kpi-spark-area" d="M 0,${svgH} L ${sparkPathStep} L ${svgW},${svgH} Z" style="fill: var(--kpi-accent); opacity: 0.1;" />
          <path fill="none" stroke="var(--kpi-accent)" stroke-width="2.5" d="M ${sparkPathStep}" style="opacity: 0.8;" />
        </svg>

        <div style="margin-top: auto; display: flex;">
           <div style="background: var(--color-surface-raised); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; color: var(--color-text-main); display: flex; gap: 6px; align-items: center; border: 1px solid var(--color-border);">
              <span style="color: #06b6d4;">${burnRatio.toFixed(1)}%</span> 
              <span style="opacity: 0.7; font-size: 9px;">OF GROSS</span>
           </div>
        </div>
      </div>

      <!-- ④ TAX SET-ASIDE - Dot Matrix -->
      <div class="kpi-card" style="--kpi-accent: #0ea5e9;" role="listitem">
        <div class="kpi-card-noise"></div>
        <div class="kpi-card-top">
          <div class="kpi-label-group">
            <div class="kpi-label">${esc(t('views.dashboard.financial.kpiTax')) || 'Tax Set-Aside'}</div>
          </div>
        </div>
        <div class="kpi-value">${fmt(taxSetAside)}</div>

        <div style="display: flex; gap: 3px; height: 35px; align-items: flex-end; margin-bottom: 12px; color: var(--kpi-accent);">
           ${Array.from({ length: 14 }).map((_, i) => `<div style="width: 4px; height: 4px; border-radius: 1px; background: currentColor; opacity: ${0.4 + (i / 14) * 0.6}"></div>`).join('')}
        </div>

        <div style="margin-top: auto; display: flex;">
           <div style="background: var(--color-surface-raised); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; color: var(--color-text-main); display: flex; gap: 6px; align-items: center; border: 1px solid var(--color-border);">
              <span style="color: #0ea5e9;">${taxRatePct}%</span> 
              <span style="opacity: 0.7; font-size: 9px;">TAX RATE</span>
           </div>
        </div>
      </div>

      <!-- ⑤ NET TAKE-HOME - Curved Wave -->
      <div class="kpi-card" style="--kpi-accent: #3b82f6;" role="listitem">
        <div class="kpi-card-noise"></div>
        <div class="kpi-card-top">
          <div class="kpi-label-group">
            <div class="kpi-label">${esc(t('views.dashboard.financial.kpiNet')) || 'Net Take-Home'}</div>
          </div>
        </div>
        <div class="kpi-value">${fmt(takeHomePay)}</div>

        <svg class="kpi-spark" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="none" style="margin-bottom: var(--space-2); height: 45px;">
          <path class="kpi-spark-area" d="M 0,${svgH} L ${sparkPathCurve} L ${svgW},${svgH} Z" style="fill: var(--kpi-accent); opacity: 0.12;" />
          <path fill="none" stroke="var(--kpi-accent)" stroke-width="2.5" d="M ${sparkPathCurve}" style="opacity: 1;" />
        </svg>

        <div style="margin-top: auto; display: flex;">
           <div style="background: var(--color-surface-raised); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; color: var(--color-text-main); display: flex; gap: 6px; align-items: center; border: 1px solid var(--color-border);">
              <span style="color: #3b82f6;">${netMargin.toFixed(1)}%</span> 
              <span style="opacity: 0.7; font-size: 9px;">MARGIN</span>
           </div>
        </div>
      </div>

      <!-- ⑥ TOTAL HOURS - Activity Pillars -->
      <div class="kpi-card" style="--kpi-accent: #6366f1;" role="listitem">
        <div class="kpi-card-noise"></div>
        
        <div class="kpi-card-top" style="margin-bottom: var(--space-1);">
          <div class="kpi-label-group">
             <div class="kpi-label" style="margin-bottom: 0;">${esc(t('views.dashboard.financial.totalHours'))}</div>
          </div>
        </div>

        <div class="kpi-value" style="display: flex; align-items: baseline; gap: 4px; margin-top: 2px;">
           <span style="font-weight: 900;">${hoursInt}</span><span style="font-size: 0.6em; font-weight: 800; opacity: 0.7;">${hoursDec}</span>
           <span style="font-size: 0.45em; font-weight: 900; margin-left: 6px; color: #3b82f6; letter-spacing: 0.05em;">HRS</span>
        </div>

        <div style="display: flex; height: 35px; align-items: flex-end; gap: 2px; margin-top: 10px; margin-bottom: 8px; color: var(--kpi-accent);">
           ${hoursSparkBars.replace(/opacity: 0.15/g, 'opacity: 0.6')}
        </div>

        <div style="margin-top: auto; display: flex;">
           <div style="background: var(--color-surface-raised); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; color: var(--color-text-main); display: flex; gap: 6px; align-items: center; border: 1px solid var(--color-border);">
              <span style="color: #3b82f6;">${exactHours}h ${exactMinutes}m</span> <span style="opacity: 0.7; font-size: 9px;">ACTIVE</span>
           </div>
        </div>
      </div>

    </div>
  `;

  const presetActive = (p) => (range.preset === p ? ' is-active' : '');

  const best = fin.bestWeek;
  const worst = fin.worstWeek;
  const bestLine = best
    ? `${esc(t('views.dashboard.financial.weekN').replace('{n}', String(best.index)))} (${fmt(best.net)}) ${esc(t('views.dashboard.financial.netProfit'))}`
    : esc(t('views.dashboard.financial.noWeekData'));
  const worstLine = worst
    ? `${esc(t('views.dashboard.financial.weekN').replace('{n}', String(worst.index)))} (${fmt(worst.net)}) ${esc(t('views.dashboard.financial.netProfit'))}`
    : esc(t('views.dashboard.financial.noWeekData'));

  const monthlyAllRows = monthly.rows;
  const monthlyRowCount = monthlyAllRows.length;
  const monthlyTotalPages = monthlyRowCount > 0 ? Math.ceil(monthlyRowCount / MONTHLY_ROWS_PER_PAGE) : 1;
  let monthlyPageIndex =
    monthlyRowCount > MONTHLY_ROWS_PER_PAGE ? loadMonthlyTablePage(range.start, range.end) : 0;
  if (monthlyPageIndex >= monthlyTotalPages) monthlyPageIndex = Math.max(0, monthlyTotalPages - 1);
  if (monthlyPageIndex < 0) monthlyPageIndex = 0;
  if (monthlyRowCount > MONTHLY_ROWS_PER_PAGE) {
    saveMonthlyTablePage(range.start, range.end, monthlyPageIndex);
  }

  const monthlyPageRows = monthlyRowCount
    ? monthlyAllRows.slice(
        monthlyPageIndex * MONTHLY_ROWS_PER_PAGE,
        monthlyPageIndex * MONTHLY_ROWS_PER_PAGE + MONTHLY_ROWS_PER_PAGE,
      )
    : [];

  const monthlyRowsHtml = monthlyRowCount
    ? monthlyPageRows
        .map(
          (r) => `
        <tr>
          <td>${esc(r.period)}</td>
          <td class="financial-monthly-num">${fmt(r.earnings)}</td>
          <td class="financial-monthly-num">${fmt(r.expenses)}</td>
          <td class="financial-monthly-num">${fmt(r.outOfPocket)}</td>
          <td class="financial-monthly-num financial-monthly-net${r.net >= 0 ? ' financial-monthly-net--pos' : ' financial-monthly-net--neg'}">${fmt(r.net)}</td>
          <td class="financial-monthly-num">${fmtNum(r.hours, 2)}</td>
          <td class="financial-monthly-num">${fmtNum(r.efficiency, 2)}</td>
        </tr>`,
        )
        .join('')
    : `<tr><td colspan="7" class="financial-monthly-empty">${esc(t('views.dashboard.financial.monthlyEmpty'))}</td></tr>`;

  const monthlyPagerPagesHtml =
    monthlyRowCount > MONTHLY_ROWS_PER_PAGE && monthlyTotalPages <= 20
      ? `<div class="financial-monthly-pager-pages">${Array.from({ length: monthlyTotalPages }, (_, i) => {
          const active = i === monthlyPageIndex;
          return `<button type="button" class="btn btn-ghost btn-sm financial-monthly-page-num${active ? ' is-active' : ''}" data-dashboard-monthly-goto="${i}"${active ? ' aria-current="page"' : ''}>${esc(String(i + 1))}</button>`;
        }).join('')}</div>`
      : '';

  const monthlyPagerHtml =
    monthlyRowCount > MONTHLY_ROWS_PER_PAGE
      ? `<nav class="financial-monthly-pager" role="navigation" aria-label="${esc(t('views.dashboard.financial.monthlyPagerAria'))}">
          <button type="button" class="btn btn-secondary btn-sm financial-monthly-pager-prev" data-dashboard-monthly-page="prev"${monthlyPageIndex === 0 ? ' disabled' : ''}>${esc(t('views.dashboard.financial.monthlyPagePrev'))}</button>
          <div class="financial-monthly-pager-mid">
            <span class="financial-monthly-pager-status">${esc(
              t('views.dashboard.financial.monthlyPageStatus')
                .replace('{current}', String(monthlyPageIndex + 1))
                .replace('{total}', String(monthlyTotalPages)),
            )}</span>
            ${monthlyPagerPagesHtml}
          </div>
          <button type="button" class="btn btn-secondary btn-sm financial-monthly-pager-next" data-dashboard-monthly-page="next"${monthlyPageIndex >= monthlyTotalPages - 1 ? ' disabled' : ''}>${esc(t('views.dashboard.financial.monthlyPageNext'))}</button>
        </nav>`
      : '';

  const mt = monthly.totals;
  const monthlyFootHtml = `
    <tr class="financial-monthly-foot-row">
      <td class="financial-monthly-foot-cell financial-monthly-foot-spacer" aria-hidden="true"></td>
      <td class="financial-monthly-foot-cell">
        <span class="financial-monthly-foot-label">${esc(t('views.dashboard.financial.monthlyFootYtdEarnings'))}</span>
        <span class="financial-monthly-foot-value">${fmt(mt.earnings)}</span>
      </td>
      <td class="financial-monthly-foot-cell">
        <span class="financial-monthly-foot-label">${esc(t('views.dashboard.financial.monthlyFootYtdExpenses'))}</span>
        <span class="financial-monthly-foot-value">${fmt(mt.expenses)}</span>
      </td>
      <td class="financial-monthly-foot-cell">
        <span class="financial-monthly-foot-label">${esc(t('views.dashboard.financial.monthlyFootOop'))}</span>
        <span class="financial-monthly-foot-value">${fmt(mt.outOfPocket)}</span>
      </td>
      <td class="financial-monthly-foot-cell">
        <span class="financial-monthly-foot-label">${esc(t('views.dashboard.financial.monthlyFootYtdNet'))}</span>
        <span class="financial-monthly-foot-value financial-monthly-net${mt.net >= 0 ? ' financial-monthly-net--pos' : ' financial-monthly-net--neg'}">${fmt(mt.net)}</span>
      </td>
      <td class="financial-monthly-foot-cell">
        <span class="financial-monthly-foot-label">${esc(t('views.dashboard.financial.monthlyFootAvgPerHr'))}</span>
        <span class="financial-monthly-foot-value">${fmtNum(mt.avgPerHr, 2)}</span>
      </td>
      <td class="financial-monthly-foot-cell">
        <span class="financial-monthly-foot-label">${esc(t('views.dashboard.financial.monthlyFootEffectivePerHr'))}</span>
        <span class="financial-monthly-foot-value financial-monthly-eff">${fmtNum(mt.effectivePerHr, 2)}</span>
      </td>
    </tr>`;

  root.innerHTML = `
    <section class="dashboard-view dashboard-view--financial">
      <header class="financial-dash-header">
        <div class="financial-dash-header-text">
          <h1 class="financial-dash-title">${esc(t('views.dashboard.financial.title'))}</h1>
          <p class="financial-dash-subtitle">${esc(t('views.dashboard.financial.subtitle'))}</p>
        </div>
      </header>

      <div class="financial-filter-container card" style="margin-bottom: var(--space-4); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); overflow: hidden; padding: 0;">
        <button type="button" class="financial-dash-filter-summary" data-dashboard-toggle-shortcuts aria-expanded="${loadDashboardShortcutsExpanded()}" style="display: flex; justify-content: space-between; align-items: center; width: 100%; padding: var(--space-3) var(--space-4); background: transparent; border: none; cursor: pointer; color: inherit; text-align: left;">
          <span class="financial-dash-summary-left" style="display: flex; align-items: center; gap: var(--space-2); font-weight: 600;">
            <span class="financial-dash-summary-icon" style="color: var(--color-brand, #10b981);">${getIcon('calendar', 18)}</span>
            <span class="financial-dash-summary-text">${range.start} &ndash; ${range.end}</span>
          </span>
          <span class="financial-dash-summary-right" style="display: flex; align-items: center; gap: var(--space-2);">
            <span class="financial-dash-summary-preset badge badge--secondary" style="text-transform: capitalize;">${esc(range.preset === 'custom' ? t('views.dashboard.financial.presetCustom') : t(`views.dashboard.financial.preset${range.preset.charAt(0).toUpperCase() + range.preset.slice(1)}`))}</span>
            <span class="financial-dash-summary-chevron" style="display: flex; align-items: center; transition: transform 0.2s ease;">${getIcon(loadDashboardShortcutsExpanded() ? 'chevron-up' : 'chevron-down', 18)}</span>
          </span>
        </button>

        <div class="financial-filter-body" style="display: ${loadDashboardShortcutsExpanded() ? 'block' : 'none'}; border-top: 1px solid var(--color-border); padding: var(--space-3) var(--space-4); background: var(--color-surface-raised);">
          <div class="filter-shortcut-bar" style="display: flex; gap: var(--space-3); align-items: center; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none;">
            <div class="financial-dash-presets">
              <button type="button" class="btn financial-dash-preset ${range.preset === 'day' ? 'is-active' : ''}" data-dashboard-preset="day">${esc(t('views.dashboard.financial.presetDay'))}</button>
              <button type="button" class="btn financial-dash-preset ${range.preset === 'week' ? 'is-active' : ''}" data-dashboard-preset="week">${esc(t('views.dashboard.financial.presetWeek'))}</button>
              <button type="button" class="btn financial-dash-preset ${range.preset === 'month' ? 'is-active' : ''}" data-dashboard-preset="month">${esc(t('views.dashboard.financial.presetMonth'))}</button>
              <button type="button" class="btn financial-dash-preset ${range.preset === 'q1' ? 'is-active' : ''}" data-dashboard-preset="q1">${esc(t('views.dashboard.financial.presetQ1'))}</button>
              <button type="button" class="btn financial-dash-preset ${range.preset === 'q2' ? 'is-active' : ''}" data-dashboard-preset="q2">${esc(t('views.dashboard.financial.presetQ2'))}</button>
              <button type="button" class="btn financial-dash-preset ${range.preset === 'q3' ? 'is-active' : ''}" data-dashboard-preset="q3">${esc(t('views.dashboard.financial.presetQ3'))}</button>
              <button type="button" class="btn financial-dash-preset ${range.preset === 'q4' ? 'is-active' : ''}" data-dashboard-preset="q4">${esc(t('views.dashboard.financial.presetQ4'))}</button>
              <button type="button" class="btn financial-dash-preset ${range.preset === 'year' ? 'is-active' : ''}" data-dashboard-preset="year">${esc(t('views.dashboard.financial.presetYear'))}</button>
              <button type="button" class="btn financial-dash-preset ${range.preset === 'ytd' ? 'is-active' : ''}" data-dashboard-preset="ytd">${esc(t('views.dashboard.financial.presetYtd'))}</button>
            </div>
            <button type="button" class="btn ${loadDashboardFilterExpanded() ? 'btn-primary' : 'btn-ghost'} btn-sm" data-dashboard-toggle-filter style="white-space:nowrap;">${esc(t('views.dashboard.financial.presetCustom'))} ${getIcon(loadDashboardFilterExpanded() ? 'chevron-up' : 'chevron-down', 14)}</button>
          </div>

          <div class="financial-dash-filter" data-dashboard-filter style="display: ${loadDashboardFilterExpanded() ? 'block' : 'none'}; margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px dashed var(--color-border);">
            <div class="financial-dash-filter-content" style="padding: 0;">
              <div class="financial-dash-filter-bar" style="flex-wrap: wrap;">
                <div class="financial-dash-filter-left">
                  <span class="financial-dash-filter-label">${esc(t('views.dashboard.financial.dateRange'))}</span>
                  <div class="financial-dash-dates" style="display: flex; gap: var(--space-2); align-items: center;">
                    <div class="input-with-icon" style="position: relative;">
                      <input type="text" class="input financial-dash-date-start" id="dashboard-filter-start" placeholder="Start date" readonly style="width: 130px; padding-left: 32px; cursor: pointer;" value="${range.start}" />
                      <span style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); color: var(--color-primary, #10b981); pointer-events: none;">${getIcon('calendar', 16)}</span>
                    </div>
                    <span style="color: var(--color-text-muted, #a1a1aa); font-weight: 600;">&ndash;</span>
                    <div class="input-with-icon" style="position: relative;">
                      <input type="text" class="input financial-dash-date-end" id="dashboard-filter-end" placeholder="End date" readonly style="width: 130px; padding-left: 32px; cursor: pointer;" value="${range.end}" />
                      <span style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); color: var(--color-primary, #10b981); pointer-events: none;">${getIcon('calendar', 16)}</span>
                    </div>
                  </div>
                </div>
                <div class="financial-dash-filter-right">
                  <button type="button" class="btn btn-primary btn-sm financial-dash-apply" data-dashboard-apply>${getIcon('filter', 16)} ${esc(t('views.dashboard.financial.apply'))}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      ${kpiBlocksHtml}

      <article class="card financial-monthly-card" style="margin-bottom: var(--space-6);">
        <div class="financial-monthly-head">
          <h2 class="financial-monthly-title">${getIcon('calendar', 20, 'financial-monthly-title-icon')} ${esc(t('views.dashboard.financial.monthlyBreakdownTitle'))}</h2>
          <div class="financial-monthly-actions" role="group" aria-label="${esc(t('views.dashboard.financial.monthlyBreakdownTitle'))}">
            <a class="btn btn-secondary btn-sm financial-monthly-action" href="#/analytics/week">${getIcon('export', 16, 'financial-monthly-action-icon')}${esc(t('views.dashboard.financial.monthlyBtnWeekly'))}</a>
            <a class="btn btn-secondary btn-sm financial-monthly-action" href="#/expenses">${getIcon('export', 16, 'financial-monthly-action-icon')}${esc(t('views.dashboard.financial.monthlyBtnExpenses'))}</a>
            <a class="btn btn-secondary btn-sm financial-monthly-action" href="#/reports">${getIcon('export', 16, 'financial-monthly-action-icon')}${esc(t('views.dashboard.financial.monthlyBtnSummary'))}</a>
          </div>
        </div>
        <div class="financial-monthly-table-wrap">
          <table class="financial-monthly-table">
            <thead>
              <tr>
                <th scope="col">${esc(t('views.dashboard.financial.monthlyColPeriod'))}</th>
                <th scope="col">${esc(t('views.dashboard.financial.monthlyColEarnings'))}</th>
                <th scope="col">${esc(t('views.dashboard.financial.monthlyColExpenses'))}</th>
                <th scope="col">${esc(t('views.dashboard.financial.monthlyColOop'))}</th>
                <th scope="col">${esc(t('views.dashboard.financial.monthlyColNet'))}</th>
                <th scope="col">${esc(t('views.dashboard.financial.monthlyColHours'))}</th>
                <th scope="col">${esc(t('views.dashboard.financial.monthlyColEfficiency'))}</th>
              </tr>
            </thead>
            <tbody>
              ${monthlyRowsHtml}
            </tbody>
            <tfoot>
              ${monthlyFootHtml}
            </tfoot>
          </table>
        </div>
        ${monthlyPagerHtml}
      </article>

      <div class="dashboard-section-header">
        <span class="dashboard-section-label">${esc(t('views.dashboard.financial.sections.insights')) || 'Further Insights'}</span>
        <div class="dashboard-section-line"></div>
      </div>

      ${widgetCardsHtml ? `
        <div class="bento-grid bento-layout-${user?.bentoLayout || 'balanced'}" style="margin-bottom: var(--space-6);">
          ${widgetCardsHtml}
        </div>
      ` : `
        <div class="dashboard-empty-state">
          <div class="empty-state-icon">${getIcon('layout-grid', 48)}</div>
          <h3>Your dashboard is empty</h3>
          <p>Add some insights from the analytics page to start tracking your performance.</p>
          <a href="#/analytics" class="btn btn-primary btn-sm">
            ${getIcon('trending-up', 18)} Browse Analytics
          </a>
        </div>
      `}

      <div class="financial-dash-highlights">
        <article class="financial-highlight financial-highlight--best">
          <div class="financial-highlight-icon" aria-hidden="true">${getIcon('trophy', 22)}</div>
          <div class="financial-highlight-body">
            <h2 class="financial-highlight-title">${esc(t('views.dashboard.financial.bestPerformance'))}</h2>
            <p class="financial-highlight-metric">${bestLine}</p>
            <p class="financial-highlight-hint">${esc(t('views.dashboard.financial.bestHint'))}</p>
          </div>
        </article>
        <article class="financial-highlight financial-highlight--worst">
          <div class="financial-highlight-icon" aria-hidden="true">${getIcon('warning', 22)}</div>
          <div class="financial-highlight-body">
            <h2 class="financial-highlight-title">${esc(t('views.dashboard.financial.needsImprovement'))}</h2>
            <p class="financial-highlight-metric">${worstLine}</p>
            <p class="financial-highlight-hint">${esc(t('views.dashboard.financial.worstHint'))}</p>
          </div>
        </article>
      </div>

      <!-- Physical Spacer for Mobile Clearance -->
      <div class="dashboard-mobile-spacer"></div>
    </section>
  `;

  const startInput = /** @type {HTMLInputElement | null} */ (root.querySelector('#dashboard-filter-start'));
  const endInput = /** @type {HTMLInputElement | null} */ (root.querySelector('#dashboard-filter-end'));
  if (startInput && window.flatpickr) {
    if (!startInput._fp) {
      startInput._fp = window.flatpickr(startInput, {
        dateFormat: 'Y-m-d',
        defaultDate: range.start,
        locale: { firstDayOfWeek: weekStartDay },
        onChange: function(selectedDates) {
          if (selectedDates.length === 1) {
            const s = window.flatpickr.formatDate(selectedDates[0], "Y-m-d");
            saveDashboardRange({ start: s, end: range.end, preset: 'custom' });
            void paintDashboard(root, ctx);
          }
        }
      });
    } else {
      startInput._fp.setDate(range.start, false);
    }
  }
  if (endInput && window.flatpickr) {
    if (!endInput._fp) {
      endInput._fp = window.flatpickr(endInput, {
        dateFormat: 'Y-m-d',
        defaultDate: range.end,
        locale: { firstDayOfWeek: weekStartDay },
        onChange: function(selectedDates) {
          if (selectedDates.length === 1) {
            const e = window.flatpickr.formatDate(selectedDates[0], "Y-m-d");
            saveDashboardRange({ start: range.start, end: e, preset: 'custom' });
            void paintDashboard(root, ctx);
          }
        }
      });
    } else {
      endInput._fp.setDate(range.end, false);
    }
  }

  root.onclick = async (ev) => {
    const el = /** @type {HTMLElement | null} */ (
      ev.target &&
      /** @type {HTMLElement} */ (ev.target).closest(
        '[data-dashboard-preset],[data-dashboard-apply],[data-dashboard-monthly-page],[data-dashboard-monthly-goto],[data-dashboard-toggle-filter],[data-dashboard-toggle-shortcuts]',
      )
    );
    if (!el || !root.contains(el)) return;

    if (el.hasAttribute('data-dashboard-toggle-shortcuts')) {
      const isExp = loadDashboardShortcutsExpanded();
      saveDashboardShortcutsExpanded(!isExp);
      if (isExp) saveDashboardFilterExpanded(false);
      void paintDashboard(root, ctx);
      return;
    }

    if (el.hasAttribute('data-dashboard-toggle-filter')) {
      const isExpanded = loadDashboardFilterExpanded();
      saveDashboardFilterExpanded(!isExpanded);
      void paintDashboard(root, ctx);
      return;
    }

    if (el.hasAttribute('data-dashboard-apply')) {
      saveDashboardShortcutsExpanded(false);
      saveDashboardFilterExpanded(false);
      void paintDashboard(root, ctx);
      return;
    }

    const gotoStr = el.getAttribute('data-dashboard-monthly-goto');
    if (gotoStr != null && gotoStr !== '') {
      const idx = parseInt(gotoStr, 10);
      const rowCount = monthly.rows.length;
      const totalPages = rowCount > 0 ? Math.ceil(rowCount / MONTHLY_ROWS_PER_PAGE) : 1;
      if (Number.isFinite(idx) && idx >= 0 && idx < totalPages) {
        saveMonthlyTablePage(range.start, range.end, idx);
        void paintDashboard(root, ctx);
      }
      return;
    }

    const monthlyNav = el.getAttribute('data-dashboard-monthly-page');
    if (monthlyNav === 'prev' || monthlyNav === 'next') {
      if (/** @type {HTMLButtonElement} */ (el).disabled) return;
      const rowCount = monthly.rows.length;
      const totalPages = rowCount > 0 ? Math.ceil(rowCount / MONTHLY_ROWS_PER_PAGE) : 1;
      let page = rowCount > MONTHLY_ROWS_PER_PAGE ? loadMonthlyTablePage(range.start, range.end) : 0;
      if (page >= totalPages) page = Math.max(0, totalPages - 1);
      if (monthlyNav === 'prev') page = Math.max(0, page - 1);
      else page = Math.min(totalPages - 1, page + 1);
      saveMonthlyTablePage(range.start, range.end, page);
      void paintDashboard(root, ctx);
      return;
    }

    const preset = el.getAttribute('data-dashboard-preset');
    if (preset) {
      const anchorDate = store.get('demoMode') ? getDemoAnalyticsAnchorDate() : new Date();
      // @ts-ignore
      const r = defaultRangeForPreset(preset, anchorDate, weekStartDay);
      saveDashboardRange(r);
      saveDashboardShortcutsExpanded(false);
      saveDashboardFilterExpanded(false);
      void paintDashboard(root, ctx);
    }
  };

  // After-render for all widgets
  afterRenderWidgets(root, widgetCtx);
}

/** @param {HTMLElement} root @param {Record<string, unknown>} ctx */
export async function render(root, ctx) {
  const prev = teardownByRoot.get(root);
  if (typeof prev === 'function') prev();

  let disposed = false;
  const rerender = () => {
    if (disposed) return;
    void paintDashboard(root, ctx);
  };

  /** @type {(() => void)[]} */
  const unsubs = [];

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    root.onclick = null;
    while (unsubs.length) {
      const u = unsubs.pop();
      try {
        if (typeof u === 'function') u();
      } catch {
        /* ignore */
      }
    }
    teardownByRoot.delete(root);
  };

  unsubs.push(bus.on(PLATFORM_CHANGED, rerender));
  unsubs.push(bus.on(SHIFT_SAVED, rerender));
  unsubs.push(bus.on(SHIFT_DELETED, rerender));
  unsubs.push(bus.on(EXPENSE_SAVED, rerender));
  unsubs.push(bus.on(DATA_IMPORTED, rerender));
  unsubs.push(bus.on('dashboard:updated', rerender));
  unsubs.push(
    bus.on(NAVIGATION, (payload) => {
      const h =
        payload && typeof payload === 'object' && payload && 'hash' in payload
          ? String(/** @type {{ hash?: string }} */ (payload).hash)
          : '';
      if (h === '#/dashboard') return;
      cleanup();
    }),
  );

  teardownByRoot.set(root, cleanup);

  await paintDashboard(root, ctx);

  return cleanup;
}
