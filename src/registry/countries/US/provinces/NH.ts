import { type ProvinceDef } from "../../types";

export const NH: ProvinceDef = {
  id: "NH",
  label: "New Hampshire",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber","amazonflex"],
  withholdingPct: 23,
};
