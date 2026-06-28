import { type ProvinceDef } from "../../types";

export const NS: ProvinceDef = {
  id: "NS",
  label: "Nova Scotia",
  countryId: "CA",
  salesTaxRate: 0.15,
  isHarmonized: true,
  bannedPlatforms: ["foodora","instacart","amazonflex"],
  withholdingPct: 32,
};
