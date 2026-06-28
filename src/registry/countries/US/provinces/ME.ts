import { type ProvinceDef } from "../../types";

export const ME: ProvinceDef = {
  id: "ME",
  label: "Maine",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber","amazonflex"],
  withholdingPct: 28,
};
