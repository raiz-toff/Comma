/**
 * Country Registry — single source of truth for country-level configuration.
 * Mirrors PWA: src/registry/countries/
 */

import { type FeatureKey } from "../modules";
import { type VocabularyKey } from "../vocabulary";

export interface TaxProfile {
  intlLocaleTag: string;
  defaultWithholdingPct: number;
  regionPresetType: "CA" | "US" | "UK" | "OTHER";
  fallbackCurrency: string;
  hstOnboarding: boolean;
  hstRateWhenRegistered: number;
  calcCpp: boolean;
  calcSeTax: boolean;
  regionLabel: "province" | "state" | "region";
  secondaryEstimator: "cpp" | "se" | "none";
  footnote: "canada" | "us" | "uk" | "generic";
  defaultRegionCode: string;
  taxInstallmentReminderDays: number;
}

export interface CountryDef {
  id: string;
  label: string;
  currency: string;
  symbol: string;
  distanceUnit: "km" | "mi";
  taxInstallmentDates: Array<{
    month: number;
    day: number;
    label: string;
    followYear?: boolean;
  }>;
  hasCPP?: boolean;
  hasHST?: boolean;
  hasSETax?: boolean;
  mileageRateSource?: "IRS" | "CRA";
  defaultAvailablePlatforms: string[];
  tax: TaxProfile;

  // ── Extended market-context fields ─────────────────────────────────────────
  /** Whether formal independent contractor economy rules apply */
  hasContractorEconomy?: boolean;
  /** Whether workers file self-assessment tax returns */
  hasSelfAssessmentTax?: boolean;
  /** Whether mileage deduction against income is available */
  hasMileageDeduction?: boolean;
  /** Label for the mileage deduction source (e.g. "IRS Standard Rate") */
  mileageDeductionLabel?: string;
  /** Whether cash-based gig economy is the norm (shows cash tools prominently) */
  cashEconomyPrimary?: boolean;
  /** Expense category profile to use for deduction UI */
  expenseProfile?: "cra" | "irs" | "hmrc" | "generic";

  // ── Extended feature and vocabulary overrides ──────────────────────────────
  featureOverrides: {
    force_on: FeatureKey[];   // country hard-enables these (user cannot turn off)
    force_off: FeatureKey[];  // country hard-disables these (user cannot turn on)
  };
  vocabularyOverrides: Partial<Record<VocabularyKey, string>>;
}

const CA: CountryDef = {
  id: "CA",
  label: "Canada",
  currency: "CAD",
  symbol: "$",
  distanceUnit: "km",
  hasContractorEconomy: true,
  hasSelfAssessmentTax: true,
  hasMileageDeduction: true,
  mileageDeductionLabel: "CRA Rate",
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

const US: CountryDef = {
  id: "US",
  label: "United States",
  currency: "USD",
  symbol: "$",
  distanceUnit: "mi",
  hasContractorEconomy: true,
  hasSelfAssessmentTax: true,
  hasMileageDeduction: true,
  mileageDeductionLabel: "IRS Standard Rate",
  cashEconomyPrimary: false,
  expenseProfile: "irs",
  taxInstallmentDates: [
    { month: 4, day: 15, label: "Q1 Estimated Payment" },
    { month: 6, day: 15, label: "Q2 Estimated Payment" },
    { month: 9, day: 15, label: "Q3 Estimated Payment" },
    { month: 1, day: 15, label: "Q4 Estimated Payment", followYear: true },
    { month: 4, day: 15, label: "Federal Tax Return Filing", followYear: true },
  ],
  hasSETax: true,
  mileageRateSource: "IRS",
  defaultAvailablePlatforms: ["doordash", "ubereats", "instacart", "amazonflex", "lyft", "other"],
  tax: {
    intlLocaleTag: "en-US",
    defaultWithholdingPct: 25,
    regionPresetType: "US",
    fallbackCurrency: "USD",
    hstOnboarding: false,
    hstRateWhenRegistered: 0,
    calcCpp: false,
    calcSeTax: true,
    regionLabel: "state",
    secondaryEstimator: "se",
    footnote: "us",
    defaultRegionCode: "CA",
    taxInstallmentReminderDays: 10,
  },
  featureOverrides: {
    force_on: [],
    force_off: [],
  },
  vocabularyOverrides: {},
};

const UK: CountryDef = {
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
    regionLabel: "region",
    secondaryEstimator: "none",
    footnote: "uk",
    defaultRegionCode: "ENG",
    taxInstallmentReminderDays: 14,
  },
  featureOverrides: {
    force_on: [],
    force_off: ["tax_workspace"],
  },
  vocabularyOverrides: {},
};

// ─── Nepal ────────────────────────────────────────────────────────────────────

const NP: CountryDef = {
  id: "NP",
  label: "Nepal",
  currency: "NPR",
  symbol: "₨",
  distanceUnit: "km",
  taxInstallmentDates: [], // No formal instalment schedule
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
    defaultRegionCode: "P3",   // Bagmati Province (Kathmandu region)
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

const COUNTRY_MAP: Record<string, CountryDef> = { CA, US, UK, NP };

export function getCountryDef(countryId: string): CountryDef {
  return COUNTRY_MAP[String(countryId).toUpperCase()] ?? CA;
}

export function getCountryTaxProfile(countryId: string): TaxProfile {
  return getCountryDef(countryId).tax;
}

export function listCountries(): CountryDef[] {
  return Object.values(COUNTRY_MAP);
}
