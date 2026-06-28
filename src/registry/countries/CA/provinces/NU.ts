import { type ProvinceDef } from "../../types";

export const NU: ProvinceDef = {
  id: "NU",
  label: "Nunavut",
  countryId: "CA",
  salesTaxRate: 0.05,
  isHarmonized: false,
  bannedPlatforms: ["skip","foodora","instacart","amazonflex"],
  withholdingPct: 28,
};
