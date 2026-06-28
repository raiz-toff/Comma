import { type ProvinceDef } from "../../types";

export const PA: ProvinceDef = {
  id: "PA",
  label: "Pennsylvania",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber"],
  withholdingPct: 24,
};
