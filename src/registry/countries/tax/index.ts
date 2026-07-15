import { resolveProvinceDef, getRegionsByCountry } from "../index";
import { WITHHOLDING_PRESETS_CA } from "../CA/tax/index";

export { WITHHOLDING_PRESETS_CA } from "../CA/tax/index";

export function getWithholdingPresetPct(
  regionPresetType: string,
  regionCode: string | null | undefined
): number | null {
  const r = String(regionCode || "").trim().toUpperCase();
  if (!r) return null;

  // Canada is the only registered country; other presets were removed pending research.
  void regionPresetType;
  const province = resolveProvinceDef("CA", r);
  return province && typeof province.withholdingPct === "number" ? province.withholdingPct : null;
}

export function listCaProvinceCodes(): string[] {
  return getRegionsByCountry("CA").map((p) => p.id).sort();
}
