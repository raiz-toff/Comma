import { type ProvinceDef } from "../../types";

export const AL: ProvinceDef = {
  id: "AL",
  label: "Alabama",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber"],
  withholdingPct: 24,
};
