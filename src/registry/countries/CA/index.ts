import { type CountryDef, type ProvinceDef } from "../types";
import { AB } from "./provinces/AB";
import { BC } from "./provinces/BC";
import { MB } from "./provinces/MB";
import { NB } from "./provinces/NB";
import { NL } from "./provinces/NL";
import { NS } from "./provinces/NS";
import { NT } from "./provinces/NT";
import { NU } from "./provinces/NU";
import { ON } from "./provinces/ON";
import { PE } from "./provinces/PE";
import { QC } from "./provinces/QC";
import { SK } from "./provinces/SK";
import { YT } from "./provinces/YT";

export const CA_PROVINCES: ProvinceDef[] = [
  AB,
  BC,
  MB,
  NB,
  NL,
  NS,
  NT,
  NU,
  ON,
  PE,
  QC,
  SK,
  YT
];

export const CA: CountryDef = {
  id: "CA",
  label: "Canada",
  currency: "CAD",
  symbol: "$",
  distanceUnit: "km",
  hasContractorEconomy: true,
  hasSelfAssessmentTax: true,
  hasMileageDeduction: true,
  mileageDeductionLabel: "CRA Rate",
  // CRA 2026: 73¢/km for the first 5,000 km, 67¢/km after. Automobiles only — the per-km
  // allowance does not cover motorcycles or bicycles, so those categories are absent (= not
  // eligible), and the driver is told to use actual expenses instead.
  mileage: {
    authority: "CRA",
    rates: {
      car: {
        ratePrimary: 0.73,
        rateSecondary: 0.67,
        rateThreshold: 5000,
        label: "CRA Automobile Allowance Rate (2026)",
      },
    },
  },
  cashEconomyPrimary: false,
  expenseProfile: "cra",
  taxInstallmentDates: [
    { month: 3, day: 15, label: "Q1 Instalment" },
    { month: 6, day: 15, label: "Q2 Instalment" },
    { month: 9, day: 15, label: "Q3 Instalment" },
    { month: 12, day: 15, label: "Q4 Instalment" },
    { month: 6, day: 15, label: "Self-Employed Filing Deadline", followYear: true },
  ],
  hasCPP: true,
  hasHST: true,
  taxFormThresholds: {
    singleIssuer: 500,   // CRA T4A threshold ($500 CAD)
    paymentCard: null,   // Canada has no 1099-K equivalent
  },
  defaultAvailablePlatforms: ["doordash", "ubereats", "skip", "foodora", "instacart", "amazonflex"],
  tax: {
    intlLocaleTag: "en-CA",
    defaultWithholdingPct: 28,
    regionPresetType: "CA",
    fallbackCurrency: "CAD",
    hstOnboarding: true,
    hstRateWhenRegistered: 0.13,
    calcCpp: true,
    calcSeTax: false,
    calcNI: false,
    hasPensionVariants: true, // QC uses QPP instead of CPP
    regionLabel: "province",
    secondaryEstimator: "cpp",
    footnote: "canada",
    defaultRegionCode: "ON",
    taxInstallmentReminderDays: 10,
  },
  featureOverrides: {
    force_on: [],
    force_off: [],
  },
  vocabularyOverrides: {
    active_miles: "active km",
    dead_miles: "dead km",
  },
};
