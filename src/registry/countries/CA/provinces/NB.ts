import { type ProvinceDef } from "../../types";

export const NB: ProvinceDef = {
  id: "NB",
  label: "New Brunswick",
  countryId: "CA",
  salesTaxRate: 0.15,
  isHarmonized: true,
  bannedPlatforms: ["foodora","instacart","amazonflex"],
  withholdingPct: 30,
};
