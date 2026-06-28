import { type ProvinceDef } from "../../types";

export const RI: ProvinceDef = {
  id: "RI",
  label: "Rhode Island",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber","amazonflex"],
  withholdingPct: 28,
};
