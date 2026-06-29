import { type ProvinceDef } from "../../types";

export const WA: ProvinceDef = {
  id: "WA",
  label: "Washington",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber"],
  withholdingPct: 23,
  incomeTaxRate: 0, // No state income tax
};
