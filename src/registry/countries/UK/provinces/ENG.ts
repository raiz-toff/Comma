import { type ProvinceDef } from "../../types";

export const ENG: ProvinceDef = {
  id: "ENG",
  label: "England",
  countryId: "UK",
  salesTaxRate: 0.2,
  isHarmonized: false,
  bannedPlatforms: ["deliveroo","stuart"],
  withholdingPct: 20,
};
