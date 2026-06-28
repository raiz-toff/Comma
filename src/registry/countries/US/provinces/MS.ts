import { type ProvinceDef } from "../../types";

export const MS: ProvinceDef = {
  id: "MS",
  label: "Mississippi",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber","amazonflex"],
  withholdingPct: 24,
};
