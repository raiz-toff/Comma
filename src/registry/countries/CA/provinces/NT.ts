import { type ProvinceDef } from "../../types";

export const NT: ProvinceDef = {
  id: "NT",
  label: "Northwest Territories",
  countryId: "CA",
  salesTaxRate: 0.05,
  isHarmonized: false,
  bannedPlatforms: ["skip","foodora","instacart","amazonflex"],
  withholdingPct: 30,
};
