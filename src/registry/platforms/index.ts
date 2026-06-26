/**
 * Platform Registry — main entry point.
 *
 * Aggregates all platform definitions across all countries into a single
 * deduplicated map keyed by platform ID. Also exports a backward-compatible
 * `PLATFORMS` shim so existing code that only needs label/color/textColor
 * continues to work without changes.
 */

import { type PlatformDef } from "./types";
import { CA_PLATFORMS } from "./ca";
import { US_PLATFORMS } from "./us";
import { UK_PLATFORMS } from "./uk";
import { NP_PLATFORMS } from "./np";
import { GLOBAL_PLATFORMS } from "./global";

// ─── Aggregate all platforms (deduplicated by id) ────────────────────────────

const ALL_PLATFORM_LISTS: PlatformDef[] = [
  ...CA_PLATFORMS,
  ...US_PLATFORMS,
  ...UK_PLATFORMS,
  ...NP_PLATFORMS,
  ...GLOBAL_PLATFORMS,
];

/**
 * Full platform registry — keyed by platform ID (deduplicated, first-wins).
 * Use this when you need the complete PlatformDef.
 */
export const PLATFORM_REGISTRY: Record<string, PlatformDef> = {};
for (const p of ALL_PLATFORM_LISTS) {
  if (!PLATFORM_REGISTRY[p.id]) {
    PLATFORM_REGISTRY[p.id] = p;
  }
}

// ─── Public helpers ────────────────────────────────────────────────────────────

/** Get the full PlatformDef for a platform ID. Falls back to "other". */
export function getPlatformDef(platformId: string): PlatformDef {
  return PLATFORM_REGISTRY[platformId] ?? PLATFORM_REGISTRY["other"]!;
}

/** List all platforms available in a given country. */
export function getPlatformsByCountry(countryId: string): PlatformDef[] {
  const seen = new Set<string>();
  const result: PlatformDef[] = [];
  for (const p of ALL_PLATFORM_LISTS) {
    if (!seen.has(p.id) && p.availableInCountries.includes(countryId)) {
      seen.add(p.id);
      result.push(p);
    }
  }
  return result;
}

/** Get all platform IDs available in a country (+ optional region filter). */
export function resolveMarketPlatformIds(
  countryId: string,
  regionCode?: string
): string[] {
  return getPlatformsByCountry(countryId)
    .filter((p) => {
      if (!regionCode || !p.restrictedToRegions) return true;
      return p.restrictedToRegions.includes(regionCode);
    })
    .map((p) => p.id);
}

// ─── Backward-compatibility shim ─────────────────────────────────────────────
//
// The old `PLATFORMS` was: Record<string, { label, color, textColor }>
// Any file still importing `PLATFORMS` will keep working.

export const PLATFORMS: Record<string, { label: string; color: string; textColor: string }> =
  Object.fromEntries(
    Object.entries(PLATFORM_REGISTRY).map(([id, p]) => [
      id,
      { label: p.label, color: p.color, textColor: p.textColor },
    ])
  );

// Re-export the type so callers can do: import { type PlatformDef } from '@/src/registry/platforms'
export type { PlatformDef };

// PlatformKey type — union of all known platform IDs for type safety
export type PlatformKey = keyof typeof PLATFORM_REGISTRY;
