import { type ProvinceDef } from "../../types";

export const NM: ProvinceDef = {
  id: "NM",
  label: "New Mexico",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber","amazonflex"],
  withholdingPct: 24,
};
