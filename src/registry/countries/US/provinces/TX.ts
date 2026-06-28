import { type ProvinceDef } from "../../types";

export const TX: ProvinceDef = {
  id: "TX",
  label: "Texas",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber"],
  withholdingPct: 23,
};
