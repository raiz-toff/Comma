import { type ProvinceDef } from "../../types";

export const WI: ProvinceDef = {
  id: "WI",
  label: "Wisconsin",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber","amazonflex"],
  withholdingPct: 25,
};
