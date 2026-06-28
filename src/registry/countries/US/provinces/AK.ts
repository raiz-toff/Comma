import { type ProvinceDef } from "../../types";

export const AK: ProvinceDef = {
  id: "AK",
  label: "Alaska",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber","amazonflex"],
  withholdingPct: 22,
};
