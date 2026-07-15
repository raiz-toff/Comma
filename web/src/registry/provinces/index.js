/**
 * Province / territory registry (plan F9).
 * Layout: `{ISO}/*.province.js` under this folder (CA, …). Skip `_*.province.js`.
 * Run `npm run rebuild:provinces` to regenerate this file from the folders.
 */

import ON from './CA/ON.province.js';

/** @type {typeof ON[]} */
const PROVINCES = [ON];

/** @type {Map<string, typeof ON>} */
const byId = new Map(PROVINCES.map((p) => [p.id, p]));

const FALLBACK_ID = 'ON';

function validateProvinceDefinition(def) {
  const required = ['id', 'countryId', 'availablePlatforms', 'expenseCategories'];
  const missing = required.filter((k) => def[k] == null);
  if (missing.length) throw new Error(`Province definition missing: ${missing.join(', ')}`);
  if (!Array.isArray(def.availablePlatforms) || def.availablePlatforms.length === 0) {
    throw new Error(`Province ${def.id} needs availablePlatforms`);
  }
  return true;
}

export const ProvinceRegistry = {
  /** @returns {readonly typeof ON[]} */
  getAll: () => PROVINCES,

  /**
   * @param {string | null | undefined} id
   * @returns {typeof ON}
   */
  getById: (id) => {
    const key = String(id || '').toUpperCase();
    return byId.get(key) || byId.get(FALLBACK_ID) || ON;
  },

  /**
   * @param {string} countryId
   * @returns {typeof ON[]}
   */
  getByCountry: (countryId) => {
    const c = String(countryId || '').toUpperCase();
    return PROVINCES.filter((p) => String(p.countryId).toUpperCase() === c);
  },

  /** @param {typeof ON} def */
  validate: (def) => validateProvinceDefinition(def),
};

export function assertProvinceRegistryValid() {
  for (const p of PROVINCES) validateProvinceDefinition(p);
}
