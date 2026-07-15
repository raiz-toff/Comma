/**
 * Single source of truth for regional **tax set-aside / withholding %** hints (plan foundation).
 * Used by onboarding (`applyTaxPreset`) and the tax module UI (`buildRegionOptions`, presets).
 *
 * Values are indicative planning percentages, not tax advice.
 */

/** @type {Readonly<Record<string, number>>} */
export const WITHHOLDING_PRESETS_CA = Object.freeze({
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

/**
 * @param {'CA'|null|string} regionPresetType from `getCountryTaxProfile(...).regionPresetType`
 * @param {string | null | undefined} regionCode province/state code
 * @returns {number | null} preset % or null if no table row
 */
export function getWithholdingPresetPct(regionPresetType, regionCode) {
  const r = String(regionCode || '').trim().toUpperCase();
  if (!r) return null;
  // Canada is the only registered country; other presets were removed pending research.
  if (regionPresetType === 'CA') {
    const v = WITHHOLDING_PRESETS_CA[r];
    return Number.isFinite(v) ? v : null;
  }
  return null;
}
