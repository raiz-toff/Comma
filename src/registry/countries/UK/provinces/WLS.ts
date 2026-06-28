import { type ProvinceDef } from "../../types";

export const WLS: ProvinceDef = {
  id: "WLS",
  label: "Wales",
  countryId: "UK",
  salesTaxRate: 0.2,
  isHarmonized: false,
  bannedPlatforms: ["deliveroo","stuart"],
  withholdingPct: 20,
};
