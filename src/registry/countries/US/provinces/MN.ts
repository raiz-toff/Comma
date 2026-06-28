import { type ProvinceDef } from "../../types";

export const MN: ProvinceDef = {
  id: "MN",
  label: "Minnesota",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber","amazonflex"],
  withholdingPct: 29,
};
