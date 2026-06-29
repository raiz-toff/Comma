import { type ProvinceDef } from "../../types";

export const QC: ProvinceDef = {
  id: "QC",
  label: "Quebec",
  countryId: "CA",
  salesTaxRate: 0.05,
  secondarySalesTaxRate: 0.09975, // QST — administered by Revenu Québec separately from federal GST
  isHarmonized: false,
  usesPensionPlan: "QPP", // Quebec uses QPP (12.8%) instead of CPP (11.9%)
  bannedPlatforms: ["amazonflex"],
  withholdingPct: 33,
};
