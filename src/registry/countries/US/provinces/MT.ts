import { type ProvinceDef } from "../../types";

export const MT: ProvinceDef = {
  id: "MT",
  label: "Montana",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber","instacart","amazonflex"],
  withholdingPct: 25,
};
