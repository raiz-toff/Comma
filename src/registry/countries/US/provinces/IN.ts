import { type ProvinceDef } from "../../types";

export const IN: ProvinceDef = {
  id: "IN",
  label: "Indiana",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber","amazonflex"],
  withholdingPct: 24,
};
