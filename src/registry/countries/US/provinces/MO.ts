import { type ProvinceDef } from "../../types";

export const MO: ProvinceDef = {
  id: "MO",
  label: "Missouri",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber","amazonflex"],
  withholdingPct: 24,
};
