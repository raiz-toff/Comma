/**
 * Country registry — one module per ISO-style market; locale helpers read from here.
 * @see docs/Registry_arch.md
 */

import CA from './CA.country.js';
import US from './US.country.js';
import UK from './UK.country.js';

const COUNTRIES = [CA, US, UK];

/** @type {Map<string, typeof CA>} */
const byId = new Map(COUNTRIES.map((c) => [c.id, c]));

const FALLBACK_ID = 'CA';

function validateCountryDefinition(def) {
  const required = ['id', 'currency', 'symbol', 'distanceUnit'];
  const missing = required.filter((k) => def[k] == null || def[k] === '');
  if (missing.length) throw new Error(`Country definition missing: ${missing.join(', ')}`);
  return true;
}

/**
 * Strip registry-only keys for consumers expecting legacy LocaleConfig shape.
 * @param {typeof CA} def
 */
export function countryDefToLocaleConfig(def) {
  const { id, labelKey, tax, defaultAvailablePlatforms, ...rest } = def;
  void id;
  void labelKey;
  void tax;
  void defaultAvailablePlatforms;
  return { ...rest };
}

/**
 * @param {string | null | undefined} code
 * @returns {NonNullable<typeof CA['tax']>}
 */
export function getCountryTaxProfile(code) {
  const def = CountryRegistry.getById(code);
  return def.tax;
}

export const CountryRegistry = {
  getAll: () => COUNTRIES,

  /**
   * @param {string | null | undefined} code
   * @returns {typeof CA}
   */
  getById: (code) => {
    const key = String(code || '').toUpperCase();
    return byId.get(key) || byId.get(FALLBACK_ID) || CA;
  },

  /** @param {typeof CA} def */
  validate: (def) => validateCountryDefinition(def),
};

export function assertCountryRegistryValid() {
  for (const c of COUNTRIES) validateCountryDefinition(c);
}
