import { type ProvinceDef } from "../../types";

export const OH: ProvinceDef = {
  id: "OH",
  label: "Ohio",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber"],
  withholdingPct: 25,
  incomeTaxRate: 0.04,
};
