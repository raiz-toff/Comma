import { type ProvinceDef } from "../../types";

export const SD: ProvinceDef = {
  id: "SD",
  label: "South Dakota",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber","instacart","amazonflex"],
  withholdingPct: 23,
};
