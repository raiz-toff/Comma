/**
 * Platform terminology + Dexie row sync (plan v3 F11 — lives with PlatformRegistry).
 * @see `PlatformRegistry` in `./index.js`
 */

import { PlatformRegistry } from './index.js';

/**
 * @typedef {{ driver?: string; delivery?: string; bonus?: string; surge?: string }} PlatformTerms
 * @typedef {{
 *   key: string;
 *   kind: 'number' | 'string' | 'object' | 'stringArray';
 *   min?: number;
 *   max?: number;
 *   labelKey?: string;
 * }} PlatformSpecificFieldDef
 * @typedef {{
 *   inputKey: string;
 *   min: number;
 *   max: number;
 *   below: number;
 *   alertType: string;
 *   payloadKey: string;
 * }} PlatformAlertCheckDef
 * @typedef {{
 *   id: string;
 *   name: string;
 *   color: string;
 *   terminology: PlatformTerms;
 *   logo: string;
 *   relevantFields: string[];
 *   helpUrl: string;
 *   specificSchema?: PlatformSpecificFieldDef[];
 *   payoutWeekday?: number;
 *   alertChecks?: PlatformAlertCheckDef[];
 *   analyticsModules?: Record<string, boolean>;
 * }} PlatformCatalogEntry
 */

const NEUTRAL_TERMS = {
  driver: 'Driver',
  delivery: 'Delivery',
  bonus: 'Bonus',
  surge: 'Surge pay',
};

/** @type {Record<string, Record<string, string>>} */
export const PLATFORM_TERMINOLOGY = {};

function titleishFallback(term) {
  const key = String(term ?? '');
  if (!key) return '';
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\s+/, '')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * @param {string} platformId
 * @returns {PlatformCatalogEntry}
 */
export function getPlatformConfig(platformId) {
  return PlatformRegistry.getById(platformId);
}

/**
 * @param {string} platformId
 * @param {string} module
 */
export function platformAnalyticsEnabled(platformId, module) {
  const mods = getPlatformConfig(platformId).analyticsModules;
  if (!mods || typeof mods !== 'object') return false;
  return Boolean(mods[module]);
}

/**
 * @param {unknown} rows Dexie `platforms` rows (active subset typical)
 */
export function syncPlatformTerminologyFromRows(rows) {
  for (const k of Object.keys(PLATFORM_TERMINOLOGY)) {
    delete PLATFORM_TERMINOLOGY[k];
  }
  if (!Array.isArray(rows)) return;
  for (const row of rows) {
    const id = row && typeof row.id === 'string' ? row.id : '';
    if (!id) continue;
    const base = getPlatformConfig(id).terminology || {};
    const rowTerms =
      row.terminology && typeof row.terminology === 'object' ? /** @type {Record<string, string>} */ (row.terminology) : {};
    PLATFORM_TERMINOLOGY[id] = { ...base, ...rowTerms };
  }
}

/**
 * @param {string | null | undefined} platformId
 * @param {string} term
 * @param {string[] | null | undefined} activePlatformIds ordered active ids
 * @returns {string}
 */
export function getTerminology(platformId, term, activePlatformIds) {
  const key = String(term ?? '');
  const ids = Array.isArray(activePlatformIds)
    ? activePlatformIds.map((x) => String(x || '').toLowerCase()).filter(Boolean)
    : [];

  if (ids.length > 1) {
    const n = NEUTRAL_TERMS[/** @type {keyof typeof NEUTRAL_TERMS} */ (key)];
    if (n) return n;
    return titleishFallback(key);
  }

  const effective =
    ids.length === 1 ? ids[0] : String(platformId || '').toLowerCase() || (ids[0] ?? 'other');
  const cfg = getPlatformConfig(effective);
  const v = cfg.terminology?.[/** @type {keyof PlatformTerms} */ (key)];
  if (typeof v === 'string' && v.length > 0) return v;
  const n = NEUTRAL_TERMS[/** @type {keyof typeof NEUTRAL_TERMS} */ (key)];
  if (n) return n;
  return titleishFallback(key);
}
