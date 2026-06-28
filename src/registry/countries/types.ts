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
  id: "US" | "CA" | "UK" | "NP";
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

export interface ProvinceDef {
  id: string;
  label: string;
  countryId: string;
  /** GST/HST/VAT rate for this region (0.05 = 5%) */
  salesTaxRate: number;
  /** Whether HST (harmonized) applies (vs GST only) */
  isHarmonized: boolean;
  /** Platforms banned in this region */
  bannedPlatforms?: string[];
  /** Standard withholding tax preset percentage */
  withholdingPct?: number;
}
