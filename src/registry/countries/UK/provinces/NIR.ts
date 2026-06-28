import { type ProvinceDef } from "../../types";

export const NIR: ProvinceDef = {
  id: "NIR",
  label: "Northern Ireland",
  countryId: "UK",
  salesTaxRate: 0.2,
  isHarmonized: false,
  bannedPlatforms: ["deliveroo","stuart"],
  withholdingPct: 20,
};
