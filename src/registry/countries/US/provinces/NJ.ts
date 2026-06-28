import { type ProvinceDef } from "../../types";

export const NJ: ProvinceDef = {
  id: "NJ",
  label: "New Jersey",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber"],
  withholdingPct: 30,
};
