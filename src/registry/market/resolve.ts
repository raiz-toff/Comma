/**
 * Market Resolver — determines which platforms are available in a given country+region.
 *
 * Resolution priority:
 * 1. Platform-level `restrictedToRegions` (e.g. Prop 22 CA only)
 * 2. Platform-level `availableInCountries` (new modular registry)
 * 3. Province-level `availablePlatforms` (legacy fine-grained override)
 * 4. Country-level `defaultAvailablePlatforms` (final fallback)
 */

import { getCountryDef, resolveProvinceDef } from "../countries/index";
import { PLATFORM_REGISTRY, getPlatformsByCountry } from "../platforms/index";

export interface MarketContext {
  countryId: string;
  regionCode: string;
  availablePlatformIds: string[];
  currency: string;
  distanceUnit: "km" | "mi";
  intlLocaleTag: string;
  /** Whether cash economy is primary in this market */
  cashEconomyPrimary: boolean;
}

/**
 * Resolve the platform IDs available in a given country+region.
 * Uses the new modular PlatformDef.availableInCountries as the primary source.
 * Falls back to province / country legacy lists for unmatched regions.
 */
export function resolveAvailablePlatformIds(
  countryId: string,
  regionCode: string
): string[] {
  const c = String(countryId).toUpperCase();
  const r = String(regionCode).toUpperCase();

  // Primary: platforms registered for this country via the modular registry
  const marketPlatforms = getPlatformsByCountry(c);
  const province = resolveProvinceDef(c, r);
  const banned = province?.bannedPlatforms || [];

  if (marketPlatforms.length > 0) {
    return marketPlatforms
      .filter((p) => {
        // 1. If platform is banned in this province, filter it out
        if (banned.includes(p.id)) {
          return false;
        }
        // 2. If platform restricts to specific regions, enforce that
        if (p.restrictedToRegions && p.restrictedToRegions.length > 0) {
          return p.restrictedToRegions.includes(r);
        }
        return true;
      })
      .map((p) => p.id);
  }

  // Fallback: country default list
  const country = getCountryDef(c);
  return country.defaultAvailablePlatforms.filter((id) => !banned.includes(id));
}

/**
 * Build a full market context object from country + region.
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
    cashEconomyPrimary: country.cashEconomyPrimary ?? false,
  };
}

/**
 * Get available platform entries (id + display metadata) for a market.
 * Always ensures "other" is included.
 */
export function getMarketPlatforms(
  countryId: string,
  regionCode: string
): Array<{ id: string; label: string; color: string; textColor: string }> {
  const ids = resolveAvailablePlatformIds(countryId, regionCode);
  const result: Array<{ id: string; label: string; color: string; textColor: string }> = [];

  for (const id of ids) {
    const p = PLATFORM_REGISTRY[id];
    if (p) {
      result.push({ id: p.id, label: p.label, color: p.color, textColor: p.textColor });
    }
  }

  // Always ensure "other" is available
  if (!result.find((p) => p.id === "other") && PLATFORM_REGISTRY["other"]) {
    const o = PLATFORM_REGISTRY["other"];
    result.push({ id: o.id, label: o.label, color: o.color, textColor: o.textColor });
  }

  return result;
}

