import { type ProvinceDef } from "../../types";

export const TN: ProvinceDef = {
  id: "TN",
  label: "Tennessee",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber","amazonflex"],
  withholdingPct: 23,
};
