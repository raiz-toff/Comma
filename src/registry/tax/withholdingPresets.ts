/**
 * Withholding Presets — single source of truth for regional tax set-aside percentages.
 * Mirrors PWA: src/registry/tax/withholding-presets.js
 * Values are indicative planning percentages, not tax advice.
 */

/** Canada — all provinces and territories */
export const WITHHOLDING_PRESETS_CA: Readonly<Record<string, number>> = Object.freeze({
  AB: 26,
  BC: 28,
  MB: 30,
  NB: 30,
  NL: 31,
  NS: 32,
  NT: 30,
  NU: 28,
  ON: 29,
  PE: 31,
  QC: 33,
  SK: 29,
  YT: 28,
});

/** USA — all 50 states + DC */
export const WITHHOLDING_PRESETS_US: Readonly<Record<string, number>> = Object.freeze({
  AL: 24,
  AK: 22,
  AZ: 24,
  AR: 25,
  CA: 30,
  CO: 25,
  CT: 29,
  DE: 27,
  FL: 23,
  GA: 25,
  HI: 30,
  IA: 25,
  ID: 25,
  IL: 25,
  IN: 24,
  KS: 24,
  KY: 24,
  LA: 24,
  MA: 28,
  MD: 29,
  ME: 28,
  MI: 25,
  MN: 29,
  MO: 24,
  MS: 24,
  MT: 25,
  NC: 24,
  ND: 23,
  NE: 24,
  NH: 23,
  NJ: 30,
  NM: 24,
  NV: 23,
  NY: 31,
  OH: 25,
  OK: 24,
  OR: 30,
  PA: 24,
  RI: 28,
  SC: 24,
  SD: 23,
  TN: 23,
  TX: 23,
  UT: 24,
  VA: 25,
  VT: 28,
  WA: 23,
  WI: 25,
  WV: 24,
  WY: 22,
  DC: 31,
});

/** UK — regions */
export const WITHHOLDING_PRESETS_UK: Readonly<Record<string, number>> = Object.freeze({
  ENG: 20,
  SCT: 20,
  WLS: 20,
  NIR: 20,
});

/**
 * Get the withholding preset % for a given region.
 * @param regionPresetType "CA" | "US" | "UK" | "OTHER"
 * @param regionCode Province/state/region code (e.g. "ON", "TX", "ENG")
 * @returns Preset percentage or null if not found
 */
export function getWithholdingPresetPct(
  regionPresetType: string,
  regionCode: string | null | undefined
): number | null {
  const r = String(regionCode || "").trim().toUpperCase();
  if (!r) return null;
  if (regionPresetType === "CA") {
    const v = WITHHOLDING_PRESETS_CA[r];
    return Number.isFinite(v) ? v : null;
  }
  if (regionPresetType === "US") {
    const v = WITHHOLDING_PRESETS_US[r];
    return Number.isFinite(v) ? v : null;
  }
  if (regionPresetType === "UK" || regionPresetType === "OTHER") {
    const v = WITHHOLDING_PRESETS_UK[r];
    return Number.isFinite(v) ? v : null;
  }
  return null;
}

/** Sorted list of CA province codes */
export function listCaProvinceCodes(): string[] {
  return Object.keys(WITHHOLDING_PRESETS_CA).sort();
}

/** Sorted list of US state codes (50 + DC) */
export function listUsStateCodes(): string[] {
  return Object.keys(WITHHOLDING_PRESETS_US).sort();
}
