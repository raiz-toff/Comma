import { type ProvinceDef } from "../../types";

export const MI: ProvinceDef = {
  id: "MI",
  label: "Michigan",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber"],
  withholdingPct: 25,
};
