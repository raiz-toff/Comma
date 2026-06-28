import { type ProvinceDef } from "../../types";

export const MD: ProvinceDef = {
  id: "MD",
  label: "Maryland",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber"],
  withholdingPct: 29,
};
