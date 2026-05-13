/**
 * Macadam — Chart.js wrappers (F8).
 *
 * Chart.js v4 is loaded from `src/libs/chart.min.js` (UMD, vendored — no CDN at runtime).
 * The UMD ships all default controllers/elements/scales pre-registered, so this module
 * only needs to (a) capture the Chart constructor exactly once, (b) apply Macadam
 * defaults (typography, tooltips, color tokens) once, and (c) expose typed wrappers
 * that always return the Chart instance so callers can teardown via `destroyChart`.
 *
 * All wrappers set `responsive: true` and `maintainAspectRatio: false` so the canvas
 * fills its container. Callers must give the canvas an explicitly sized parent.
 *
 * Per plan F8: `renderHeatmapStrip` and `renderGitHubHeatmap` are deliberately NOT
 * Chart.js — strip is a custom 2D canvas draw, GH-style heatmap is a pure CSS grid.
 *
 * Reduced motion: when `prefers-reduced-motion: reduce` matches, chart animations
 * are disabled. The default tooltip / typography matches the design tokens in
 * `src/css/tokens.css`.
 */

import ChartCtor from '../libs/chart.min.js';
import { t } from '../utils/strings.js';

/* The vendored chart.umd.js exports its constructor as either the CJS default
 * (esbuild interop) or attaches to `globalThis.Chart` (browser UMD fallback). */
const Chart =
  ChartCtor ||
  (typeof globalThis !== 'undefined' && /** @type {any} */ (globalThis).Chart) ||
  null;

let defaultsApplied = false;

function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Apply Macadam design tokens to Chart.js defaults. Idempotent: safe to call
 * from any wrapper before instantiation. Re-applies on first render only.
 */
function ensureDefaults() {
  if (defaultsApplied) return;
  if (!Chart || !Chart.defaults) return;

  const styles =
    typeof document !== 'undefined' ? getComputedStyle(document.documentElement) : null;
  const token = (name, fallback) => {
    if (!styles) return fallback;
    const v = styles.getPropertyValue(name);
    return v && v.trim().length > 0 ? v.trim() : fallback;
  };

  Chart.defaults.font = {
    ...Chart.defaults.font,
    family: token('--font-body', "'DM Sans', system-ui, sans-serif"),
    size: 12,
    weight: 500,
  };
  Chart.defaults.color = token('--color-text-secondary', '#6B6860');
  Chart.defaults.borderColor = token('--color-border', '#E5E2DA');

  if (Chart.defaults.plugins?.tooltip) {
    Object.assign(Chart.defaults.plugins.tooltip, {
      backgroundColor: token('--color-text-primary', '#1A1916'),
      titleColor: token('--color-bg', '#FAFAF8'),
      bodyColor: token('--color-bg', '#FAFAF8'),
      borderColor: 'transparent',
      borderWidth: 0,
      cornerRadius: 8,
      padding: 10,
      titleFont: { family: token('--font-body', "'DM Sans', system-ui, sans-serif"), weight: 600 },
      bodyFont: { family: token('--font-mono', "'DM Mono', 'Courier New', monospace") },
      boxPadding: 6,
    });
  }
  if (Chart.defaults.plugins?.legend) {
    Object.assign(Chart.defaults.plugins.legend, {
      labels: {
        ...(Chart.defaults.plugins.legend.labels || {}),
        usePointStyle: true,
        boxWidth: 8,
        boxHeight: 8,
        padding: 12,
        font: {
          family: token('--font-body', "'DM Sans', system-ui, sans-serif"),
          size: 12,
          weight: 600,
        },
      },
    });
  }

  if (prefersReducedMotion()) {
    Chart.defaults.animation = false;
    Chart.defaults.animations = { colors: false, x: false, y: false };
    Chart.defaults.transitions = {
      active: { animation: { duration: 0 } },
      resize: { animation: { duration: 0 } },
      show: { animations: { x: { from: 0 }, y: { from: 0 } } },
      hide: { animations: { x: { to: 0 }, y: { to: 0 } } },
    };
  }
  defaultsApplied = true;
}

/* Track instances by canvas so callers can teardown without a Chart reference. */
/** @type {WeakMap<HTMLCanvasElement, any>} */
const instanceByCanvas = new WeakMap();

/**
 * Destroy any Macadam-managed chart attached to a canvas.
 * @param {HTMLCanvasElement | null | undefined} canvas
 */
export function destroyChart(canvas) {
  if (!canvas) return;
  const existing = instanceByCanvas.get(canvas);
  if (existing && typeof existing.destroy === 'function') {
    try {
      existing.destroy();
    } catch (err) {
      console.error('[macadam charts] destroy failed', err);
    }
    instanceByCanvas.delete(canvas);
  }
}

/**
 * @param {HTMLCanvasElement | null | undefined} canvas
 * @returns {canvas is HTMLCanvasElement}
 */
function isCanvas(canvas) {
  return canvas instanceof HTMLCanvasElement;
}

/**
 * @param {Record<string, unknown>} a
 * @param {Record<string, unknown>} b
 */
function mergeOptions(a, b) {
  /** @type {Record<string, unknown>} */
  const out = { ...a };
  for (const [k, v] of Object.entries(b || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object') {
      out[k] = mergeOptions(
        /** @type {Record<string, unknown>} */ (a[k]),
        /** @type {Record<string, unknown>} */ (v),
      );
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Chart.js canvas cannot paint CSS `var()` / `color-mix()` strings — resolve to computed RGB(A).
 * @param {unknown} value
 * @param {string} fallback
 * @param {'fill' | 'stroke'} kind
 */
function resolveCssPaintForCanvas(value, fallback, kind) {
  if (typeof document === 'undefined') return fallback;
  if (value == null) return fallback;
  if (Array.isArray(value)) {
    return value.map((v) => resolveCssPaintForCanvas(v, fallback, kind));
  }
  const s = String(value).trim();
  if (!s) return fallback;
  const lower = s.toLowerCase();
  if (!lower.includes('var(') && !lower.includes('color-mix(')) return s;

  const probe = document.createElement('div');
  probe.setAttribute('data-macadam-chart-color-probe', '');
  probe.style.cssText =
    'position:absolute;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;';
  if (kind === 'stroke') {
    probe.style.border = '2px solid';
    probe.style.setProperty('border-color', s, 'important');
  } else {
    probe.style.backgroundColor = s;
  }
  document.documentElement.appendChild(probe);
  const cs = getComputedStyle(probe);
  const resolved = kind === 'stroke' ? cs.borderColor : cs.backgroundColor;
  probe.remove();
  if (!resolved || resolved === 'rgba(0, 0, 0, 0)' || resolved === 'transparent') return fallback;
  return resolved;
}

/**
 * @param {unknown} dataset
 */
function resolveDatasetColors(dataset) {
  if (!dataset || typeof dataset !== 'object') return dataset;
  const d = /** @type {Record<string, unknown>} */ ({ ...dataset });
  const fillFb = '#94a3b8';
  const strokeFb = '#64748b';
  if ('backgroundColor' in d && d.backgroundColor != null) {
    d.backgroundColor = resolveCssPaintForCanvas(d.backgroundColor, fillFb, 'fill');
  }
  if ('borderColor' in d && d.borderColor != null) {
    d.borderColor = resolveCssPaintForCanvas(d.borderColor, strokeFb, 'stroke');
  }
  return d;
}

/**
 * @param {any} data Chart.js data object
 */
function resolveChartDataColors(data) {
  if (!data || !Array.isArray(data.datasets)) return data;
  return {
    ...data,
    datasets: data.datasets.map((ds) => resolveDatasetColors(ds)),
  };
}

function baseOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'bottom' },
      tooltip: { enabled: true },
    },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.06)' } },
    },
  };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {string} type
 * @param {{ data: any, options?: Record<string, unknown> }} cfg
 */
function instantiate(canvas, type, cfg) {
  if (!Chart) {
    console.error('[macadam charts] Chart.js not available');
    return null;
  }
  ensureDefaults();
  destroyChart(canvas);
  const options = mergeOptions(baseOptions(), cfg.options || {});
  const data = resolveChartDataColors(cfg.data);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const instance = new Chart(ctx, { type, data, options });
  instanceByCanvas.set(canvas, instance);
  return instance;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {any} data Chart.js dataset shape
 * @param {Record<string, unknown>} [options]
 */
export function renderBarChart(canvas, data, options = {}) {
  if (!isCanvas(canvas)) return null;
  return instantiate(canvas, 'bar', { data, options });
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {any} data
 * @param {Record<string, unknown>} [options]
 */
export function renderLineChart(canvas, data, options = {}) {
  if (!isCanvas(canvas)) return null;
  const merged = mergeOptions(
    {
      elements: { line: { tension: 0.3, borderWidth: 2 }, point: { radius: 2, hoverRadius: 4 } },
    },
    options,
  );
  return instantiate(canvas, 'line', { data, options: merged });
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {any} data
 * @param {Record<string, unknown>} [options]
 */
export function renderDonutChart(canvas, data, options = {}) {
  if (!isCanvas(canvas)) return null;
  const merged = mergeOptions(
    {
      cutout: '62%',
      plugins: { legend: { position: 'right' } },
      scales: { x: { display: false }, y: { display: false } },
    },
    options,
  );
  return instantiate(canvas, 'doughnut', { data, options: merged });
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {any} data
 * @param {Record<string, unknown>} [options]
 */
export function renderScatterChart(canvas, data, options = {}) {
  if (!isCanvas(canvas)) return null;
  const merged = mergeOptions(
    {
      elements: { point: { radius: 4, hoverRadius: 6 } },
      scales: {
        x: { type: 'linear', position: 'bottom', grid: { color: 'rgba(0,0,0,0.06)' } },
      },
    },
    options,
  );
  return instantiate(canvas, 'scatter', { data, options: merged });
}

/**
 * Tiny doughnut configured as a progress ring (single value vs. remainder).
 * @param {HTMLCanvasElement} canvas
 * @param {number} value
 * @param {number} [max]
 * @param {string} [color]
 */
export function renderProgressRingChart(canvas, value, max = 100, color = 'var(--color-brand)') {
  if (!isCanvas(canvas)) return null;
  const safeMax = Math.max(1, Number(max) || 100);
  const safeValue = Math.max(0, Math.min(safeMax, Number(value) || 0));
  const data = {
    labels: [t('ui.progressRing.label'), ''],
    datasets: [
      {
        data: [safeValue, Math.max(0, safeMax - safeValue)],
        backgroundColor: [color, 'var(--color-surface-raised)'],
        borderWidth: 0,
      },
    ],
  };
  const options = {
    cutout: '78%',
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: { x: { display: false }, y: { display: false } },
  };
  return instantiate(canvas, 'doughnut', { data, options });
}

/* ------------------------------------------------------------------------- */
/* Custom (non-Chart.js) visualizations                                      */
/* ------------------------------------------------------------------------- */

/**
 * @typedef {Object} HeatmapStripPoint
 * @property {string} [label]
 * @property {number} value
 */

/**
 * Draw a horizontal heatmap strip directly to a 2D canvas — no Chart.js.
 * Used for hour-of-day / day-of-week density visualizations.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {HeatmapStripPoint[]} data
 * @param {{ minColor?: string, maxColor?: string, height?: number, gap?: number }} [opts]
 */
export function renderHeatmapStrip(canvas, data, opts = {}) {
  if (!isCanvas(canvas)) return null;
  const { minColor = 'var(--color-surface-raised)', maxColor = 'var(--color-brand)', gap = 2 } = opts;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  const cssWidth = canvas.clientWidth || Number(canvas.getAttribute('width')) || 200;
  const cssHeight = canvas.clientHeight || Number(canvas.getAttribute('height')) || 32;
  canvas.width = Math.max(1, Math.floor(cssWidth * dpr));
  canvas.height = Math.max(1, Math.floor(cssHeight * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const styles = typeof document !== 'undefined' ? getComputedStyle(document.documentElement) : null;
  const resolveColor = (c) => {
    if (!c || typeof c !== 'string') return '#000';
    const m = c.match(/^var\(([^)]+)\)$/);
    if (m && styles) {
      const v = styles.getPropertyValue(m[1].trim());
      if (v && v.trim()) return v.trim();
    }
    return c;
  };
  const a = resolveColor(minColor);
  const b = resolveColor(maxColor);

  const max = Math.max(1, ...data.map((d) => Number(d.value) || 0));
  const n = data.length || 1;
  const cellW = Math.max(2, (cssWidth - gap * (n - 1)) / n);

  for (let i = 0; i < n; i += 1) {
    const t = Math.max(0, Math.min(1, (Number(data[i].value) || 0) / max));
    ctx.fillStyle = lerpColor(a, b, t);
    ctx.fillRect(i * (cellW + gap), 0, cellW, cssHeight);
  }
  return { width: cssWidth, height: cssHeight };
}

/**
 * Linear-interpolate between two CSS hex colors (#RRGGBB). Falls back to `b`.
 * @param {string} a
 * @param {string} b
 * @param {number} tt 0..1
 */
function lerpColor(a, b, tt) {
  const pa = parseHex(a);
  const pb = parseHex(b);
  if (!pa || !pb) return b;
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * tt);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * tt);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * tt);
  return `rgb(${r},${g},${bl})`;
}

/** @param {string} hex */
function parseHex(hex) {
  const m = String(hex || '').match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) {
    const rgb = String(hex || '').match(/^rgba?\(([^)]+)\)$/i);
    if (rgb) {
      const parts = rgb[1].split(',').map((x) => Number(x.trim()));
      if (parts.length >= 3 && parts.every((n) => Number.isFinite(n))) {
        return [parts[0], parts[1], parts[2]];
      }
    }
    return null;
  }
  let v = m[1];
  if (v.length === 3) v = v.split('').map((c) => c + c).join('');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

/**
 * @typedef {Object} HeatmapDay
 * @property {string} date YYYY-MM-DD
 * @property {number} value
 */

/**
 * Render a GitHub-style contribution heatmap into a container element using a
 * pure CSS grid (no canvas, no Chart.js). 52 weeks × 7 days.
 *
 * Cells set their fill intensity via the `--cell-intensity` CSS custom property
 * (0..1) so styling lives entirely in `components.css`.
 *
 * @param {HTMLElement} container
 * @param {HeatmapDay[]} data
 * @param {{ weeks?: number, label?: string }} [opts]
 */
export function renderGitHubHeatmap(container, data, opts = {}) {
  if (!(container instanceof HTMLElement)) return null;
  const { weeks = 52, label = t('analytics.heatmap') } = opts;

  const sortedAsc = (data || [])
    .slice()
    .filter((d) => d && typeof d.date === 'string')
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const byDate = new Map(sortedAsc.map((d) => [d.date, Number(d.value) || 0]));
  const max = Math.max(0, ...sortedAsc.map((d) => Number(d.value) || 0)) || 1;

  const end = sortedAsc.length > 0 ? new Date(sortedAsc[sortedAsc.length - 1].date) : new Date();
  const endDay = end.getDay(); /* 0 = Sun */
  const endIdx = weeks * 7 - 1 - (6 - endDay);

  const totalCells = weeks * 7;
  const startMs = end.getTime() - (endIdx) * 86400000;

  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'macadam-heatmap';
  wrap.style.setProperty('--heatmap-weeks', String(weeks));
  wrap.setAttribute('role', 'img');
  wrap.setAttribute('aria-label', label);

  const grid = document.createElement('div');
  grid.className = 'macadam-heatmap-grid';

  for (let i = 0; i < totalCells; i += 1) {
    const ms = startMs + i * 86400000;
    const d = new Date(ms);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const iso = `${y}-${m}-${day}`;
    const v = byDate.get(iso) || 0;
    const intensity = max > 0 ? Math.max(0, Math.min(1, v / max)) : 0;
    const cell = document.createElement('span');
    cell.className = 'macadam-heatmap-cell';
    cell.style.setProperty('--cell-intensity', intensity.toFixed(3));
    cell.title = `${iso}: ${v}`;
    cell.setAttribute('data-date', iso);
    cell.setAttribute('data-value', String(v));
    grid.appendChild(cell);
  }
  wrap.appendChild(grid);
  container.appendChild(wrap);
  return wrap;
}

/**
 * Category D — Chart.js-backed renderer lookup (docs/feature_modularity.md).
 * Non-Chart.js helpers above stay separate; add new Chart types here when you add a wrapper.
 */
export const CHART_RENDERERS = {
  bar: renderBarChart,
  line: renderLineChart,
  doughnut: renderDonutChart,
  donut: renderDonutChart,
  scatter: renderScatterChart,
};

/**
 * @param {string} id
 * @returns {((canvas: HTMLCanvasElement, data: unknown, options?: Record<string, unknown>) => unknown) | null}
 */
export function getChartRenderer(id) {
  const key = String(id || '').toLowerCase();
  const fn = /** @type {Record<string, unknown>} */ (CHART_RENDERERS)[key];
  return typeof fn === 'function' ? /** @type {any} */ (fn) : null;
}
