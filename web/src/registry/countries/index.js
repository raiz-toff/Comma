/**
 * Country registry — one module per ISO-style market; locale helpers read from here.
 * @see docs/Registry_arch.md
 */

import CA from './CA.country.js';

/**
 * ── THE REGISTRY ─────────────────────────────────────────────────────────────
 * The one place that decides which countries this app ships. Mirror of the phone app's
 * COUNTRY_MAP — the two must agree (see scripts/check-country-parity.mjs).
 *
 * Canada only. Other countries (US, UK, NP, …) were removed pending accurate, signed-off tax
 * and mileage research — the app must not offer a country whose numbers haven't been verified.
 *
 * TO ADD A COUNTRY:
 *   1. add it to COUNTRIES below (and register its provinces in ../provinces/)
 *   2. make sure its definition declares `mileage` (a table, or null for "no researched rates")
 * That's it. Nothing else branches on country: the mileage lookup, the withholding lookup,
 * onboarding, the reveal and the tax screens all read from the definition. There are no
 * `if (country === 'CA')` switches to hunt down.
 */
const COUNTRIES = [CA];

/** @type {Map<string, typeof CA>} */
const byId = new Map(COUNTRIES.map((c) => [c.id, c]));

const FALLBACK_ID = 'CA';

function validateCountryDefinition(def) {
  const required = ['id', 'currency', 'symbol', 'distanceUnit'];
  const missing = required.filter((k) => def[k] == null || def[k] === '');
  // `mileage` must be PRESENT, but may be null — null is the honest "no researched rates here"
  // answer. Requiring the key forces a new country to make an explicit decision instead of
  // silently producing a zero write-off for every driver in it.
  if (!('mileage' in def)) missing.push('mileage (use null if no researched rates)');
  if (!def.tax || typeof def.tax.defaultWithholdingPct !== 'number') missing.push('tax.defaultWithholdingPct');
  if (missing.length) {
    throw new Error(`[registry] Country "${def.id ?? '?'}" is incomplete: missing ${missing.join(', ')}.`);
  }
  return true;
}

/** The single place that decides which countries this app actually supports. */
export const SUPPORTED_COUNTRY_IDS = COUNTRIES.map((c) => c.id);

/** @param {string | null | undefined} code */
export function isSupportedCountry(code) {
  return byId.has(String(code || '').toUpperCase());
}

/**
 * Look up a country, or null when it isn't registered. Callers on tax-bearing paths should use
 * this and handle the null, rather than be handed a different country's rules.
 * @param {string | null | undefined} code
 */
export function findCountryDef(code) {
  return byId.get(String(code || '').toUpperCase()) ?? null;
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
  /**
   * Falls back to CA so the UI can still render — but LOUDLY.
   *
   * This fallback used to be silent, which is how an unregistered country (an NP profile synced
   * from the phone, say) was quietly served Canadian currency and a Canadian tax rate: the app
   * confidently showing a number that was simply wrong for that driver. A missing country is now
   * a reported bug, not a plausible-looking result. Use findCountryDef / isSupportedCountry
   * wherever a wrong answer is worse than no answer.
   */
  getById: (code) => {
    const key = String(code || '').toUpperCase();
    const def = byId.get(key);
    if (def) return def;

    console.error(
      `[registry] Unsupported country "${key}". Falling back to ${FALLBACK_ID} — currency, tax ` +
        `rate and mileage shown WILL BE WRONG for this driver. Add ${key}.country.js ` +
        `(supported: ${SUPPORTED_COUNTRY_IDS.join(', ')}).`,
    );
    return byId.get(FALLBACK_ID) || CA;
  },

  /** @param {typeof CA} def */
  validate: (def) => validateCountryDefinition(def),
};

export function assertCountryRegistryValid() {
  for (const c of COUNTRIES) validateCountryDefinition(c);
}
