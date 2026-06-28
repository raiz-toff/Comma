import { type ProvinceDef } from "../../types";

export const SK: ProvinceDef = {
  id: "SK",
  label: "Saskatchewan",
  countryId: "CA",
  salesTaxRate: 0.05,
  isHarmonized: false,
  bannedPlatforms: ["foodora","amazonflex"],
  withholdingPct: 29,
};
