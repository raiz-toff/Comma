import { type ProvinceDef } from "../../types";

export const NY: ProvinceDef = {
  id: "NY",
  label: "New York",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["uber"],
  withholdingPct: 31,
};
