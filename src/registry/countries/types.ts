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
  /** Whether to calculate National Insurance contributions (UK only) */
  calcNI?: boolean;
  /** Whether this country has pension plan variants per province (e.g. QPP in QC) */
  hasPensionVariants?: boolean;
  regionLabel: "province" | "state" | "region";
  secondaryEstimator: "cpp" | "se" | "none";
  footnote: "canada" | "us" | "uk" | "generic";
  defaultRegionCode: string;
  taxInstallmentReminderDays: number;
}

/** Tax authorities gate mileage eligibility on vehicle type, so rates are keyed by category. */
export type MileageCategory = "car" | "motorcycle" | "bicycle";

export interface MileageRate {
  /** Rate per distance unit (per km or per mile — the country's own distanceUnit). */
  ratePrimary: number;
  /** Rate beyond rateThreshold, for tiered schemes (e.g. CRA's 5,000 km step-down). */
  rateSecondary?: number | null;
  /** Distance at which ratePrimary gives way to rateSecondary. */
  rateThreshold?: number | null;
  /** Shown to the driver, so name the actual scheme (e.g. "CRA Automobile Allowance Rate (2026)"). */
  label: string;
}

export interface MileageTable {
  /** The tax authority these rates come from — used in "not eligible" copy. */
  authority: string;
  /** Categories omitted here are NOT eligible. Absence is meaningful — don't fill in blanks. */
  rates: Partial<Record<MileageCategory, MileageRate>>;
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
  /**
   * This country's standard mileage deduction rules — DATA, owned by the country.
   *
   * Required (not optional) on purpose: adding a new country forces an explicit decision about
   * its mileage rules instead of silently inheriting another country's. `null` is a valid, honest
   * answer meaning "we have not researched rates here" — the app then reports ineligible rather
   * than inventing a number. See getVehicleMileageEligibility, which is a pure lookup into this.
   */
  mileage: MileageTable | null;
  /** Whether cash-based gig economy is the norm (shows cash tools prominently) */
  cashEconomyPrimary?: boolean;
  /** Expense category profile to use for deduction UI */
  expenseProfile?: "cra" | "irs" | "hmrc" | "generic";

  // ── Tax form reporting thresholds ─────────────────────────────────────────
  /** Thresholds above which platforms issue tax forms (T4A, 1099-NEC, 1099-K) */
  taxFormThresholds?: {
    /** Per-platform single-issuer threshold (T4A $500 CA, 1099-NEC $600 US) */
    singleIssuer: number;
    /** Payment-card/payment-network threshold (1099-K $5000 US, null if not applicable) */
    paymentCard: number | null;
  };

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
  /** Secondary provincial sales tax rate where applicable (e.g. QST 9.975% for QC) */
  secondarySalesTaxRate?: number;
  /** Whether HST (harmonized) applies (vs GST only) */
  isHarmonized: boolean;
  /** Platforms banned in this region */
  bannedPlatforms?: string[];
  /** Standard withholding tax preset percentage */
  withholdingPct?: number;
  /** Which pension plan applies — defaults to CPP; QPP in Quebec */
  usesPensionPlan?: "CPP" | "QPP";
  /** Approximate effective state/provincial income tax rate for self-employed (0.093 = 9.3%) */
  incomeTaxRate?: number;
}
