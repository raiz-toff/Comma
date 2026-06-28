import { type ProvinceDef } from "../../types";

export const MB: ProvinceDef = {
  id: "MB",
  label: "Manitoba",
  countryId: "CA",
  salesTaxRate: 0.05,
  isHarmonized: false,
  bannedPlatforms: ["foodora","amazonflex"],
  withholdingPct: 30,
};
