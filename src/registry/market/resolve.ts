/**
 * Market Resolver — determines which platforms are available in a given country+region.
 * Mirrors PWA: src/registry/market/resolve.js
 */

import { getCountryDef } from "../countries/index";
import { resolveProvinceDef } from "../provinces/index";
import { PLATFORMS } from "../platforms";

export interface MarketContext {
  countryId: string;
  regionCode: string;
  availablePlatformIds: string[];
  currency: string;
  distanceUnit: "km" | "mi";
  intlLocaleTag: string;
}

/**
 * Resolve the platform IDs available in a given country+region.
 * Province-level list takes priority; falls back to country defaults.
 */
export function resolveAvailablePlatformIds(
  countryId: string,
  regionCode: string
): string[] {
  const province = resolveProvinceDef(countryId, regionCode);
  if (province && province.availablePlatforms.length > 0) {
    return province.availablePlatforms;
  }
  const country = getCountryDef(countryId);
  return country.defaultAvailablePlatforms;
}

/**
 * Build a full market context object from country + region.
 * This is the equivalent of `getMarketContext()` in the PWA store.
 */
export function getMarketContext(
  countryId: string,
  regionCode: string
): MarketContext {
  const country = getCountryDef(countryId);
  const availablePlatformIds = resolveAvailablePlatformIds(countryId, regionCode);

  return {
    countryId: country.id,
    regionCode: String(regionCode).toUpperCase(),
    availablePlatformIds,
    currency: country.currency,
    distanceUnit: country.distanceUnit,
    intlLocaleTag: country.tax.intlLocaleTag,
  };
}

/**
 * Filter the available platform keys down to those in the user's market.
 * Always includes "other".
 */
export function getMarketPlatforms(
  countryId: string,
  regionCode: string
): Array<{ id: string; label: string; color: string; textColor: string }> {
  const ids = resolveAvailablePlatformIds(countryId, regionCode);
  const allPlatforms = PLATFORMS as Record<string, { label: string; color: string; textColor: string }>;
  const result: Array<{ id: string; label: string; color: string; textColor: string }> = [];

  for (const id of ids) {
    if (allPlatforms[id]) {
      result.push({ id, ...allPlatforms[id] });
    }
  }

  // Always ensure "other" is available
  if (!result.find((p) => p.id === "other") && allPlatforms["other"]) {
    result.push({ id: "other", ...allPlatforms["other"] });
  }

  return result;
}
