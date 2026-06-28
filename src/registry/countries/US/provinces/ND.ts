import { type ProvinceDef } from "../../types";

export const ND: ProvinceDef = {
  id: "ND",
  label: "North Dakota",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber","instacart","amazonflex"],
  withholdingPct: 23,
};
