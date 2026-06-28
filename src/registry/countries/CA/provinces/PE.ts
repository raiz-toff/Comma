import { type ProvinceDef } from "../../types";

export const PE: ProvinceDef = {
  id: "PE",
  label: "Prince Edward Island",
  countryId: "CA",
  salesTaxRate: 0.15,
  isHarmonized: true,
  bannedPlatforms: ["foodora","instacart","amazonflex"],
  withholdingPct: 31,
};
