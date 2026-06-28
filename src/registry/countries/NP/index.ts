import { type CountryDef, type ProvinceDef } from "../types";
import { P1 } from "./provinces/P1";
import { P2 } from "./provinces/P2";
import { P3 } from "./provinces/P3";
import { P4 } from "./provinces/P4";
import { P5 } from "./provinces/P5";
import { P6 } from "./provinces/P6";
import { P7 } from "./provinces/P7";

export const NP_PROVINCES: ProvinceDef[] = [
  P1,
  P2,
  P3,
  P4,
  P5,
  P6,
  P7
];

export const NP: CountryDef = {
  id: "NP",
  label: "Nepal",
  currency: "NPR",
  symbol: "₨",
  distanceUnit: "km",
  taxInstallmentDates: [],
  hasContractorEconomy: false,
  hasSelfAssessmentTax: false,
  hasMileageDeduction: false,
  cashEconomyPrimary: true,
  expenseProfile: "generic",
  defaultAvailablePlatforms: ["pathao", "pathao_food", "indriver", "foodmandu", "bhoj", "other"],
  tax: {
    intlLocaleTag: "ne-NP",
    defaultWithholdingPct: 0,
    regionPresetType: "OTHER",
    fallbackCurrency: "NPR",
    hstOnboarding: false,
    hstRateWhenRegistered: 0,
    calcCpp: false,
    calcSeTax: false,
    regionLabel: "province",
    secondaryEstimator: "none",
    footnote: "generic",
    defaultRegionCode: "P3",
    taxInstallmentReminderDays: 0,
  },
  featureOverrides: {
    force_on: [],
    force_off: ["tax_workspace", "mileage_log_export", "google_drive_backup"],
  },
  vocabularyOverrides: {
    active_miles: "active km",
    dead_miles: "dead km",
  },
};
