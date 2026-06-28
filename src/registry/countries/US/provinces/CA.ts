import { type ProvinceDef } from "../../types";

export const CA: ProvinceDef = {
  id: "CA",
  label: "California",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["uber"],
  withholdingPct: 30,
};
