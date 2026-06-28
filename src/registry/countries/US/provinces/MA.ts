import { type ProvinceDef } from "../../types";

export const MA: ProvinceDef = {
  id: "MA",
  label: "Massachusetts",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber"],
  withholdingPct: 28,
};
