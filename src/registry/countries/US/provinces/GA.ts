import { type ProvinceDef } from "../../types";

export const GA: ProvinceDef = {
  id: "GA",
  label: "Georgia",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber"],
  withholdingPct: 25,
  incomeTaxRate: 0.055,
};
