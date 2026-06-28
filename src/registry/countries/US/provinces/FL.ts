import { type ProvinceDef } from "../../types";

export const FL: ProvinceDef = {
  id: "FL",
  label: "Florida",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber"],
  withholdingPct: 23,
};
