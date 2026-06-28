import { type ProvinceDef } from "../../types";

export const VA: ProvinceDef = {
  id: "VA",
  label: "Virginia",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber"],
  withholdingPct: 25,
};
