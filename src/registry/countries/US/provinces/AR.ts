import { type ProvinceDef } from "../../types";

export const AR: ProvinceDef = {
  id: "AR",
  label: "Arkansas",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber","amazonflex"],
  withholdingPct: 25,
};
