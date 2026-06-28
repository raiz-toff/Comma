import { type ProvinceDef } from "../../types";

export const KS: ProvinceDef = {
  id: "KS",
  label: "Kansas",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber","amazonflex"],
  withholdingPct: 24,
};
