import { type ProvinceDef } from "../../types";

export const NE: ProvinceDef = {
  id: "NE",
  label: "Nebraska",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber","amazonflex"],
  withholdingPct: 24,
};
