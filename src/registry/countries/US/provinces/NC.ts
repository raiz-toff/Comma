import { type ProvinceDef } from "../../types";

export const NC: ProvinceDef = {
  id: "NC",
  label: "North Carolina",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber"],
  withholdingPct: 24,
};
