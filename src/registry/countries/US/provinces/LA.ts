import { type ProvinceDef } from "../../types";

export const LA: ProvinceDef = {
  id: "LA",
  label: "Louisiana",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber","amazonflex"],
  withholdingPct: 24,
};
