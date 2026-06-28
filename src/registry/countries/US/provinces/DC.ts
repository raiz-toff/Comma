import { type ProvinceDef } from "../../types";

export const DC: ProvinceDef = {
  id: "DC",
  label: "Washington D.C.",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber"],
  withholdingPct: 31,
};
