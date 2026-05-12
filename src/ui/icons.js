/**
 * Inline SVG icon registry (F7) — no icon fonts; safe for offline/PWA.
 * Named inner markup (paths) keyed in kebab-case; `getIcon` accepts kebab or camelCase.
 * The graphic for “export” is stored under the key `export` (see `exportIcon` named export).
 */

import { NAV_ICON_FILLED, NAV_ICON_INNER, NAV_ICON_VIEWBOX } from './nav-icons.js';

const NAV_FILLED_SET = new Set(NAV_ICON_FILLED);

/** @type {Record<string, string>} path/circle/line groups, kebab-case keys */
const ICON_INNER = {
  fuel: '<path d="M3 22h12M3 22V6a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v16M3 22H2M14 22h-1M14 11V6a2 2 0 0 1 2-2h1l3 3v6a2 2 0 0 1-2 2h-1"/><path d="M6 10h4"/>',
  maintenance:
    '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.35 6.35a2 2 0 0 1-2.83-2.83l6.35-6.35a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  bike: '<circle cx="18.5" cy="18.5" r="3.5"/><circle cx="5.5" cy="18.5" r="3.5"/><circle cx="12" cy="10" r="2"/><path d="M12 18V9l-3 4h6l-3-4"/>',
  bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  'trending-up': '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  'trending-down':
    '<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  fire: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  parking:
    '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>',
  receipt:
    '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8H8"/><path d="M16 12H8"/><path d="M10 16H8"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/>',
  filter:
    '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  'chart-bar':
    '<line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/>',
  'chart-line':
    '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>',
  'chart-donut':
    '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  x: '<line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/>',
  trash:
    '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  duplicate:
    '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  plus: '<line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/>',
  minus: '<line x1="5" x2="19" y1="12" y2="12"/>',
  'arrow-right': '<line x1="5" x2="19" y1="12" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  goal: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  badge:
    '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>',
  streak: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  warning:
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/>',
  dollar: '<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  percent:
    '<line x1="19" x2="5" y1="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  ...NAV_ICON_INNER,
};

ICON_INNER['export'] =
  '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>';

/** SVG inner markup for export (named export avoids reserved word `export` in bindings). */
export const exportIcon = ICON_INNER['export'];

/**
 * @param {string} name kebab-case (chart-bar) or camelCase (chartBar)
 * @param {number} [size=16]
 * @param {string} [className='']
 * @returns {string} full inline SVG HTML
 */
export function getIcon(name, size = 16, className = '') {
  const key = normalizeIconKey(name);
  const inner = ICON_INNER[key] ?? ICON_INNER.help ?? '';
  const safeSize = Number.isFinite(Number(size)) && Number(size) > 0 ? Number(size) : 16;
  const esc = className ? escapeHtmlAttr(String(className)) : '';
  const clsAttr = esc ? ` class="${esc}"` : '';
  const viewBox = NAV_ICON_VIEWBOX[key] ?? '0 0 24 24';
  const filled = NAV_FILLED_SET.has(key);
  const presentation = filled
    ? ' fill="none" stroke="none"'
    : ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${safeSize}" height="${safeSize}" viewBox="${viewBox}"${presentation}${clsAttr} role="img" aria-hidden="true">${inner}</svg>`;
}

/** @param {string} name */
function normalizeIconKey(name) {
  const s = String(name || '').trim();
  if (!s) return 'help';
  const kebab = s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
  if (ICON_INNER[kebab]) return kebab;
  const lower = s.toLowerCase();
  if (ICON_INNER[lower]) return lower;
  return kebab;
}

/** @param {string} v */
function escapeHtmlAttr(v) {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

ICON_INNER.help =
  '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" x2="12.01" y1="17" y2="17"/>';

Object.freeze(ICON_INNER);

/** Read-only map of icon key → inner SVG markup (same keys as `getIcon`, including `export`). */
export const iconInnerByName = ICON_INNER;
