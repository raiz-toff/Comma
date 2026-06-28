import { type ProvinceDef } from "../../types";

export const IL: ProvinceDef = {
  id: "IL",
  label: "Illinois",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber"],
  withholdingPct: 25,
};
