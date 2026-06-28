import { type ProvinceDef } from "../../types";

export const DE: ProvinceDef = {
  id: "DE",
  label: "Delaware",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber","amazonflex"],
  withholdingPct: 27,
};
