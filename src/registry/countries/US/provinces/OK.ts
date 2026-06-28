import { type ProvinceDef } from "../../types";

export const OK: ProvinceDef = {
  id: "OK",
  label: "Oklahoma",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber","amazonflex"],
  withholdingPct: 24,
};
