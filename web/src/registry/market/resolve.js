/**
 * Country-first, province-override resolution for market-scoped catalog data.
 * @see docs/market_resolution.md
 */

import { CountryRegistry } from '../countries/index.js';
import { ProvinceRegistry } from '../provinces/index.js';
import { PlatformRegistry } from '../platforms/index.js';
import { resolveProvinceDef } from '../../utils/locale.js';

/**
 * @param {string | null | undefined} countryId
 * @param {string | null | undefined} provinceId
 */
export function getMarketContext(countryId, provinceId) {
  const country = String(countryId || 'CA').toUpperCase();
  const province = String(provinceId || '').trim().toUpperCase();
  const countryDef = CountryRegistry.getById(country);
  const provinceDef = resolveProvinceDef(country, province);
  return { countryId: country, provinceId: province, countryDef, provinceDef };
}

/**
 * Lowercased platform ids allowed for this market for onboarding / pickers.
 * Order: province `availablePlatforms` if non-empty, else country `defaultAvailablePlatforms`,
 * else union of all registered provinces for that country, else full bundled catalog.
 *
 * @param {string | null | undefined} countryId
 * @param {string | null | undefined} provinceId
 * @returns {string[]}
 */
export function resolveAvailablePlatformIds(countryId, provinceId) {
  const { countryDef, provinceDef } = getMarketContext(countryId, provinceId);
  const provList = provinceDef?.availablePlatforms;
  if (Array.isArray(provList) && provList.length > 0) {
    return provList.map((id) => String(id).toLowerCase());
  }
  const countryDefaults = /** @type {unknown} */ (countryDef).defaultAvailablePlatforms;
  if (Array.isArray(countryDefaults) && countryDefaults.length > 0) {
    return countryDefaults.map((id) => String(id).toLowerCase());
  }
  const provinces = ProvinceRegistry.getByCountry(String(countryId).toUpperCase());
  if (provinces.length) {
    const set = new Set();
    for (const p of provinces) {
      for (const id of p.availablePlatforms || []) set.add(String(id).toLowerCase());
    }
    if (set.size) return [...set];
  }
  return PlatformRegistry.getAll().map((p) => String(p.id).toLowerCase());
}
