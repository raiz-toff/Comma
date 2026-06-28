import { type ProvinceDef } from "../../types";

export const SCT: ProvinceDef = {
  id: "SCT",
  label: "Scotland",
  countryId: "UK",
  salesTaxRate: 0.2,
  isHarmonized: false,
  bannedPlatforms: ["deliveroo","stuart"],
  withholdingPct: 20,
};
