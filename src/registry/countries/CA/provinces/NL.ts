import { type ProvinceDef } from "../../types";

export const NL: ProvinceDef = {
  id: "NL",
  label: "Newfoundland and Labrador",
  countryId: "CA",
  salesTaxRate: 0.15,
  isHarmonized: true,
  bannedPlatforms: ["foodora","instacart","amazonflex"],
  withholdingPct: 31,
};
