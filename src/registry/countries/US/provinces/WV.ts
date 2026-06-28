import { type ProvinceDef } from "../../types";

export const WV: ProvinceDef = {
  id: "WV",
  label: "West Virginia",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber","instacart","amazonflex"],
  withholdingPct: 24,
};
