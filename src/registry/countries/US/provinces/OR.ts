import { type ProvinceDef } from "../../types";

export const OR: ProvinceDef = {
  id: "OR",
  label: "Oregon",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber"],
  withholdingPct: 30,
};
