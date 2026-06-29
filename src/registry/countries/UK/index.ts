import { type CountryDef, type ProvinceDef } from "../types";
import { ENG } from "./provinces/ENG";
import { SCT } from "./provinces/SCT";
import { WLS } from "./provinces/WLS";
import { NIR } from "./provinces/NIR";

export const UK_REGIONS: ProvinceDef[] = [
  ENG,
  SCT,
  WLS,
  NIR
];

export const UK: CountryDef = {
  id: "UK",
  label: "United Kingdom",
  currency: "GBP",
  symbol: "£",
  distanceUnit: "mi",
  hasContractorEconomy: true,
  hasSelfAssessmentTax: true,
  hasMileageDeduction: true,
  mileageDeductionLabel: "HMRC AMAP Rate",
  cashEconomyPrimary: false,
  expenseProfile: "hmrc",
  taxInstallmentDates: [
    { month: 1, day: 31, label: "Self Assessment Filing Deadline" },
    { month: 1, day: 31, label: "First Payment on Account" },
    { month: 7, day: 31, label: "Second Payment on Account" },
  ],
  defaultAvailablePlatforms: ["ubereats", "doordash", "instacart", "amazonflex", "other"],
  tax: {
    intlLocaleTag: "en-GB",
    defaultWithholdingPct: 20,
    regionPresetType: "OTHER",
    fallbackCurrency: "GBP",
    hstOnboarding: false,
    hstRateWhenRegistered: 0.20,
    calcCpp: false,
    calcSeTax: false,
    calcNI: true,
    regionLabel: "region",
    secondaryEstimator: "none",
    footnote: "uk",
    defaultRegionCode: "ENG",
    taxInstallmentReminderDays: 14,
  },
  featureOverrides: {
    force_on: [],
    force_off: [],
  },
  vocabularyOverrides: {},
};
