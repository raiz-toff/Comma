import { type ProvinceDef } from "../../types";

export const AZ: ProvinceDef = {
  id: "AZ",
  label: "Arizona",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber"],
  withholdingPct: 24,
  incomeTaxRate: 0.025, // AZ flat rate 2.5%
};
