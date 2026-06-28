import { type ProvinceDef } from "../../types";

export const UT: ProvinceDef = {
  id: "UT",
  label: "Utah",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber","amazonflex"],
  withholdingPct: 24,
};
