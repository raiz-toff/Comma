import { type ProvinceDef } from "../../types";

export const CT: ProvinceDef = {
  id: "CT",
  label: "Connecticut",
  countryId: "US",
  salesTaxRate: 0,
  isHarmonized: false,
  bannedPlatforms: ["lyft","uber","amazonflex"],
  withholdingPct: 29,
};
