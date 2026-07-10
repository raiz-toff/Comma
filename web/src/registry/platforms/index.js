/**
 * Platform registry — one module per platform; engine imports this instead of scattered defs.
 * @see docs/Registry_arch.md
 */

/** @typedef {import('../types.js').PlatformCatalogEntry} PlatformCatalogEntry */

import doordash from './doordash.platform.js';
import ubereats from './ubereats.platform.js';
import foodora from './foodora.platform.js';
import skip from './skip.platform.js';
import instacart from './instacart.platform.js';
import amazonflex from './amazonflex.platform.js';
import other from './other.platform.js';

/** @type {PlatformCatalogEntry[]} */
const PLATFORMS = [doordash, ubereats, foodora, skip, instacart, amazonflex, other];

/** @type {Map<string, PlatformCatalogEntry>} */
const byId = new Map(PLATFORMS.map((p) => [p.id, p]));

function validatePlatformDefinition(def) {
  const required = ['id', 'name', 'color', 'terminology', 'logo'];
  const missing = required.filter((k) => def[k] == null);
  if (missing.length) throw new Error(`Platform definition missing: ${missing.join(', ')}`);
  if (typeof def.logo !== 'string' || !def.logo.trim()) {
    throw new Error(`Platform ${def.id} missing non-empty logo (inline SVG string)`);
  }
  const t = def.terminology;
  if (!t || typeof t.driver !== 'string' || !t.driver || typeof t.delivery !== 'string' || !t.delivery) {
    throw new Error(`Platform ${def.id} missing terminology.driver or terminology.delivery`);
  }
  if (def.id !== 'other' && Array.isArray(def.specificSchema)) {
    for (const row of def.specificSchema) {
      if (!row || typeof row.key !== 'string' || !row.kind) {
        throw new Error(`Platform ${def.id} has invalid specificSchema entry`);
      }
    }
  }
  if (Array.isArray(def.alertChecks)) {
    for (const row of def.alertChecks) {
      if (!row || typeof row.inputKey !== 'string' || typeof row.alertType !== 'string' || typeof row.payloadKey !== 'string') {
        throw new Error(`Platform ${def.id} has invalid alertChecks entry`);
      }
    }
  }
  return true;
}

export const PlatformRegistry = {
  /** @returns {readonly PlatformCatalogEntry[]} */
  getAll: () => PLATFORMS,

  /**
   * @param {string | null | undefined} id
   * @returns {PlatformCatalogEntry}
   */
  getById: (id) => {
    const key = String(id || '').toLowerCase();
    return byId.get(key) || other;
  },

  /**
   * @param {string[]} ids
   * @returns {PlatformCatalogEntry[]}
   */
  getActive: (ids) => {
    if (!Array.isArray(ids)) return [];
    return ids.map((raw) => PlatformRegistry.getById(String(raw || '')));
  },

  /** @param {PlatformCatalogEntry} def */
  validate: (def) => validatePlatformDefinition(def),
};

/** Dev-only: assert all bundled definitions are valid. */
export function assertPlatformRegistryValid() {
  for (const p of PLATFORMS) validatePlatformDefinition(p);
}

/**
 * First non-`other` catalog id — safe default for samples, synthetic rows, and fallbacks (Category A).
 * @returns {string}
 */
export function getDefaultSamplePlatformId() {
  const first = PLATFORMS.find((p) => p && p.id !== 'other');
  return first?.id ?? 'other';
}
