import { type ProvinceDef } from "../../types";

export const VT: ProvinceDef = {
  id: "VT",
  label: "Vermont",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber","instacart","amazonflex"],
  withholdingPct: 28,
};
