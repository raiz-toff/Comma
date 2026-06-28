import { type ProvinceDef } from "../../types";

export const IA: ProvinceDef = {
  id: "IA",
  label: "Iowa",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber","amazonflex"],
  withholdingPct: 25,
};
