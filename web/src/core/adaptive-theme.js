import { store } from './store.js';
import { getPlatformConfig } from '../registry/platforms/terminology.js';
import { filterIds } from '../utils/filters.js';

/**
 * Converts hex to RGB components for use in CSS color-mix.
 * @param {string} hex
 * @returns {{r: number, g: number, b: number} | null}
 */
function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return null;
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) {
    h = h.split('').map(c => c + c).join('');
  }
  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Simple luminance check to determine if text should be light or dark.
 * @param {string} hex
 * @returns {'#ffffff' | '#1a1916'}
 */
function getContrastColor(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#1a1916';
  // Standard luminance formula
  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return brightness > 155 ? '#1a1916' : '#ffffff';
}

/**
 * Updates global CSS variables based on active platform and user settings.
 * @param {string | unknown} [hexOverride] Optional override for user accent color.
 */
export function updateAccentColor(hexOverride) {
  const user = store.get('user');
  // The filter may be a comma-joined subset. A single selected platform tints the app with its
  // brand colour; 'all' — or any multi-selection, which has no one brand colour — keeps the
  // user's own accent.
  const selectedIds = filterIds(store.get('activePlatformId'));
  const activeId = selectedIds.length === 1 ? selectedIds[0] : 'all';
  const platforms = store.get('platforms') || [];
  
  // Use hexOverride only if it looks like a hex color string
  const override = (typeof hexOverride === 'string' && hexOverride.startsWith('#')) ? hexOverride : null;
  
  // Default/User accent
  let targetHex = override || user?.accentColor || '#f97316';
  
  // Adaptive Logic:
  if (!override && platforms.length > 1 && activeId !== 'all') {
    const activePlatform = platforms.find(p => String(p.id) === activeId);
    const platformHex = activePlatform?.color || getPlatformConfig(activeId)?.color;
    
    if (platformHex && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(platformHex)) {
      targetHex = platformHex;
    }
  }

  const root = document.documentElement;
  root.style.setProperty('--color-brand', targetHex);
  root.style.setProperty('--color-brand-contrast', getContrastColor(targetHex));
  
  // Update RGB for components that use color-mix with opacity
  const rgb = hexToRgb(targetHex);
  if (rgb) {
    root.style.setProperty('--color-brand-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
  }
}

/**
 * Initialize listeners for adaptive accent color.
 */
export function initAdaptiveTheme() {
  store.subscribe('activePlatformId', updateAccentColor);
  store.subscribe('platforms', updateAccentColor);
  store.subscribe('user', updateAccentColor);
  store.subscribe('theme', updateAccentColor);
  
  // Initial run
  updateAccentColor();
}
