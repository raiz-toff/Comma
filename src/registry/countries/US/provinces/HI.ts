import { type ProvinceDef } from "../../types";

export const HI: ProvinceDef = {
  id: "HI",
  label: "Hawaii",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber","amazonflex"],
  withholdingPct: 30,
};
