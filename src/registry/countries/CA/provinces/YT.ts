import { type ProvinceDef } from "../../types";

export const YT: ProvinceDef = {
  id: "YT",
  label: "Yukon",
  countryId: "CA",
  salesTaxRate: 0.05,
  isHarmonized: false,
  bannedPlatforms: ["skip","foodora","instacart","amazonflex"],
  withholdingPct: 28,
};
