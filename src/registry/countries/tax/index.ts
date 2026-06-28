import { resolveProvinceDef, getRegionsByCountry } from "../index";
import { WITHHOLDING_PRESETS_CA } from "../CA/tax/index";
import { WITHHOLDING_PRESETS_US } from "../US/tax/index";
import { WITHHOLDING_PRESETS_UK } from "../UK/tax/index";

export { WITHHOLDING_PRESETS_CA } from "../CA/tax/index";
export { WITHHOLDING_PRESETS_US } from "../US/tax/index";
export { WITHHOLDING_PRESETS_UK } from "../UK/tax/index";

export function getWithholdingPresetPct(
  regionPresetType: string,
  regionCode: string | null | undefined
): number | null {
  const r = String(regionCode || "").trim().toUpperCase();
  if (!r) return null;

  let countryId = "CA";
  if (regionPresetType === "US") countryId = "US";
  else if (regionPresetType === "UK" || regionPresetType === "OTHER") countryId = "UK";

  const province = resolveProvinceDef(countryId, r);
  return province && typeof province.withholdingPct === "number" ? province.withholdingPct : null;
}

export function listCaProvinceCodes(): string[] {
  return getRegionsByCountry("CA").map((p) => p.id).sort();
}

export function listUsStateCodes(): string[] {
  return getRegionsByCountry("US").map((p) => p.id).sort();
}
