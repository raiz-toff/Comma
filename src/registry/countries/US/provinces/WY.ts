import { type ProvinceDef } from "../../types";

export const WY: ProvinceDef = {
  id: "WY",
  label: "Wyoming",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber","instacart","amazonflex"],
  withholdingPct: 22,
};
