import { type ProvinceDef } from "../../types";

export const KY: ProvinceDef = {
  id: "KY",
  label: "Kentucky",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber","amazonflex"],
  withholdingPct: 24,
};
