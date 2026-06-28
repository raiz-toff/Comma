import { type ProvinceDef } from "../../types";

export const SC: ProvinceDef = {
  id: "SC",
  label: "South Carolina",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber","amazonflex"],
  withholdingPct: 24,
};
