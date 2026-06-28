import { type ProvinceDef } from "../../types";

export const NV: ProvinceDef = {
  id: "NV",
  label: "Nevada",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber"],
  withholdingPct: 23,
};
