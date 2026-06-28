import { type ProvinceDef } from "../../types";

export const CO: ProvinceDef = {
  id: "CO",
  label: "Colorado",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber"],
  withholdingPct: 25,
};
