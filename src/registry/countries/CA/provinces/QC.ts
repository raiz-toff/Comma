import { type ProvinceDef } from "../../types";

export const QC: ProvinceDef = {
  id: "QC",
  label: "Quebec",
  countryId: "CA",
  salesTaxRate: 0.05,
  isHarmonized: false,
  bannedPlatforms: ["amazonflex"],
  withholdingPct: 33,
};
