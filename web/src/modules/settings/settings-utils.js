/** Shared HTML escape + live theme tweaks for Settings → appearance. */

export function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeHex(hex) {
  const h = String(hex || '').trim();
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(h)) return null;
  if (h.length === 4) {
    const [, r, g, b] = h;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return h;
}

/** @param {unknown} h @returns {string} lowercase `#rrggbb` or '' */
export function normalizeAccentHex(h) {
  const n = normalizeHex(h);
  return n ? n.toLowerCase() : '';
}

function darkenBrand(hex) {
  const n = normalizeHex(hex);
  if (!n) return '#d4891c';
  const r = parseInt(n.slice(1, 3), 16);
  const g = parseInt(n.slice(3, 5), 16);
  const b = parseInt(n.slice(5, 7), 16);
  const f = 0.88;
  const rr = Math.round(r * f)
    .toString(16)
    .padStart(2, '0');
  const gg = Math.round(g * f)
    .toString(16)
    .padStart(2, '0');
  const bb = Math.round(b * f)
    .toString(16)
    .padStart(2, '0');
  return `#${rr}${gg}${bb}`;
}

/** Apply accent to CSS variables (null clears override back to stylesheet defaults). */
export function applyAccent(hex) {
  // We no longer manually set properties here. 
  // adaptive-theme.js listens to the store and handles it globally and correctly.
}

const FONT_SIZES = new Set(['small', 'medium', 'large', 'xl']);

/** Hint for global typography (optional CSS hooks on `html[data-uifont]`). */
export function applyFontSize(size) {
  const s = FONT_SIZES.has(String(size)) ? String(size) : 'medium';
  document.documentElement.dataset.uifont = s;
  const map = { small: '12px', medium: '15px', large: '18px', xl: '22px' };
  document.documentElement.style.setProperty('--text-base', map[s] || map.medium);
}

const DENSITIES = new Set(['comfortable', 'compact']);

/** Hint for layout density (optional CSS hooks on `html[data-uidensity]`). */
export function applyDensity(d) {
  const v = DENSITIES.has(String(d)) ? String(d) : 'comfortable';
  document.documentElement.dataset.uidensity = v;
}
