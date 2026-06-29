import { getSalesTaxRate } from "@/src/registry/index";

// ─── CRA Rate Tables (Canada) ─────────────────────────────────────────────────

export interface CRARates {
  CPP_RATE: number;
  CPP_SELF_EMPLOYED_RATE: number;
  CPP_MAX_PENSIONABLE: number;       // YMPE — Year's Maximum Pensionable Earnings
  CPP2_MAX_PENSIONABLE: number;      // YAMPE — Year's Additional Maximum Pensionable Earnings
  CPP2_SELF_EMPLOYED_RATE: number;
  QPP_RATE: number;
  QPP_SELF_EMPLOYED_RATE: number;
  QPP_MAX_PENSIONABLE: number;
  QPP2_MAX_PENSIONABLE: number;
  QPP2_SELF_EMPLOYED_RATE: number;
  CPP_BASIC_EXEMPTION: number;
  KM_RATE_TIER1: number;
  KM_RATE_TIER2: number;
}

const CRA_RATES: Record<number, CRARates> = {
  2024: {
    CPP_RATE: 0.0595,
    CPP_SELF_EMPLOYED_RATE: 0.119,
    CPP_MAX_PENSIONABLE: 68500,
    CPP2_MAX_PENSIONABLE: 73200,
    CPP2_SELF_EMPLOYED_RATE: 0.08,
    QPP_RATE: 0.064,
    QPP_SELF_EMPLOYED_RATE: 0.128,
    QPP_MAX_PENSIONABLE: 68500,
    QPP2_MAX_PENSIONABLE: 73200,
    QPP2_SELF_EMPLOYED_RATE: 0.08,
    CPP_BASIC_EXEMPTION: 3500,
    KM_RATE_TIER1: 0.70,
    KM_RATE_TIER2: 0.64,
  },
  2025: {
    CPP_RATE: 0.0595,
    CPP_SELF_EMPLOYED_RATE: 0.119,
    CPP_MAX_PENSIONABLE: 71300,
    CPP2_MAX_PENSIONABLE: 81200,
    CPP2_SELF_EMPLOYED_RATE: 0.08,
    QPP_RATE: 0.064,
    QPP_SELF_EMPLOYED_RATE: 0.128,
    QPP_MAX_PENSIONABLE: 71300,
    QPP2_MAX_PENSIONABLE: 81200,
    QPP2_SELF_EMPLOYED_RATE: 0.08,
    CPP_BASIC_EXEMPTION: 3500,
    KM_RATE_TIER1: 0.72,
    KM_RATE_TIER2: 0.66,
  },
};

// Backward-compat export — callers that don't pass a year
export const CRA_2024 = CRA_RATES[2024]!;

export function getCRARates(year: number): CRARates {
  if (CRA_RATES[year]) return CRA_RATES[year]!;
  const years = Object.keys(CRA_RATES).map(Number).sort((a, b) => b - a);
  return CRA_RATES[years[0]!]!;
}

// ─── IRS Rate Tables (USA) ────────────────────────────────────────────────────

export interface IRSRates {
  SE_TAX_RATE: number;
  SE_NET_PROFIT_RATIO: number;
  MILE_RATE: number;
  SOCIAL_SECURITY_WAGE_BASE: number;
}

const IRS_RATES: Record<number, IRSRates> = {
  2024: {
    SE_TAX_RATE: 0.153,
    SE_NET_PROFIT_RATIO: 0.9235,
    MILE_RATE: 0.67,
    SOCIAL_SECURITY_WAGE_BASE: 168600,
  },
  2025: {
    SE_TAX_RATE: 0.153,
    SE_NET_PROFIT_RATIO: 0.9235,
    MILE_RATE: 0.70,
    SOCIAL_SECURITY_WAGE_BASE: 176100,
  },
};

export const IRS_2024 = IRS_RATES[2024]!;

export function getIRSRates(year: number): IRSRates {
  if (IRS_RATES[year]) return IRS_RATES[year]!;
  const years = Object.keys(IRS_RATES).map(Number).sort((a, b) => b - a);
  return IRS_RATES[years[0]!]!;
}

// ─── HMRC Rate Tables (UK) ────────────────────────────────────────────────────

export interface HMRCRates {
  MILE_RATE_TIER1: number;
  MILE_RATE_TIER2: number;
}

export interface HMRCNIRates {
  class2WeeklyRate: number;
  smallProfitsThreshold: number;
  class4Rate: number;
  class4UpperRate: number;
  class4LowerThreshold: number;
  class4UpperThreshold: number;
}

const HMRC_RATES: Record<number, HMRCRates> = {
  2024: { MILE_RATE_TIER1: 0.45, MILE_RATE_TIER2: 0.25 },
  2025: { MILE_RATE_TIER1: 0.45, MILE_RATE_TIER2: 0.25 },
};

const HMRC_NI_RATES: Record<number, HMRCNIRates> = {
  2024: {
    class2WeeklyRate: 3.45,
    smallProfitsThreshold: 6725,
    class4Rate: 0.09,        // Cut from 10.25% to 9% in April 2024
    class4UpperRate: 0.02,
    class4LowerThreshold: 12570,
    class4UpperThreshold: 50270,
  },
  2025: {
    class2WeeklyRate: 3.50,
    smallProfitsThreshold: 6845,
    class4Rate: 0.09,
    class4UpperRate: 0.02,
    class4LowerThreshold: 12570,
    class4UpperThreshold: 50270,
  },
};

export const HMRC_2024 = HMRC_RATES[2024]!;

export function getHMRCRates(year: number): HMRCRates {
  return HMRC_RATES[year] ?? HMRC_RATES[2024]!;
}

export function getHMRCNIRates(year: number): HMRCNIRates {
  return HMRC_NI_RATES[year] ?? HMRC_NI_RATES[2024]!;
}

// ─── CANADA — Pension Contributions (CPP / QPP) ───────────────────────────────

export interface PensionContribResult {
  cpp1Total: number;
  cpp2Total: number;
  total: number;
  planType: "CPP" | "QPP";
}

/**
 * Calculate CPP or QPP contributions for a self-employed person.
 * Self-employed pay both the employee and employer portions.
 * CPP2/QPP2 applies on the band between YMPE and YAMPE (introduced 2024).
 */
export function calculatePensionContributions(
  netIncome: number,
  province: string,
  year: number = new Date().getFullYear()
): PensionContribResult {
  const rates = getCRARates(year);
  const isQPP = province.toUpperCase() === "QC";
  const planType: "CPP" | "QPP" = isQPP ? "QPP" : "CPP";

  const selfRate = isQPP ? rates.QPP_SELF_EMPLOYED_RATE : rates.CPP_SELF_EMPLOYED_RATE;
  const maxPensionable = isQPP ? rates.QPP_MAX_PENSIONABLE : rates.CPP_MAX_PENSIONABLE;
  const max2Pensionable = isQPP ? rates.QPP2_MAX_PENSIONABLE : rates.CPP2_MAX_PENSIONABLE;
  const rate2 = isQPP ? rates.QPP2_SELF_EMPLOYED_RATE : rates.CPP2_SELF_EMPLOYED_RATE;

  // Band 1: (min(income, YMPE) − basicExemption) × selfRate
  const band1 = Math.max(0, Math.min(netIncome, maxPensionable) - rates.CPP_BASIC_EXEMPTION);
  const cpp1Total = band1 * selfRate;

  // Band 2: (min(income, YAMPE) − YMPE) × 8% — only if income > YMPE
  const band2 = Math.max(0, Math.min(netIncome, max2Pensionable) - maxPensionable);
  const cpp2Total = band2 * rate2;

  return { cpp1Total, cpp2Total, total: cpp1Total + cpp2Total, planType };
}

/** Backward-compatible shim — uses Ontario rates (CPP) for callers that don't pass a province */
export function calculateCPP(netIncome: number): {
  employeePortion: number;
  employerPortion: number;
  total: number;
} {
  const result = calculatePensionContributions(netIncome, "ON", new Date().getFullYear());
  const half = result.total / 2;
  return { employeePortion: half, employerPortion: half, total: result.total };
}

// ─── CANADA — HST / GST ───────────────────────────────────────────────────────

export interface HSTCalculation {
  /** HST/GST collected on direct (non-platform) revenue only */
  hstOnDirectRevenue: number;
  /** Rate applied */
  hstRate: number;
  /** Estimated ITC from deductible expenses */
  itcEstimate: number;
  /** Net remittable: hstOnDirectRevenue − itcEstimate (floored at 0) */
  netRemittable: number;
  /**
   * Explanation note — non-empty when platform revenue was excluded.
   * Gig platforms (DoorDash, UberEats, Skip) are deemed digital platform operators
   * under Canada's Dec 2021 rules and remit HST themselves.
   * Drivers receive their net cut — no driver-collected HST on that income stream.
   */
  platformNote: string;
}

/**
 * Calculate HST obligation for a CA-registered driver.
 *
 * IMPORTANT: gig platform revenue is NOT subject to driver-collected HST under
 * the Digital Platform Operator rules in force since Dec 2021. Pass directRevenue
 * for any non-platform income (e.g. private clients, catering contracts).
 *
 * @param directRevenue      Revenue from non-platform sources (HST collected by driver)
 * @param platformRevenue    Revenue via digital platforms (HST remitted by platform, $0 driver liability)
 * @param deductibleExpenses Total YTD deductible expenses (for ITC estimate)
 * @param province           Province code for rate lookup
 * @param year               Tax year
 */
export function calculateHSTOwing(
  directRevenue: number,
  platformRevenue: number,
  deductibleExpenses: number,
  province: string,
  year: number = new Date().getFullYear()
): HSTCalculation {
  const hstRate = getSalesTaxRate("CA", province);

  const hstOnDirectRevenue = directRevenue * hstRate;

  // ITC: recover the HST/GST embedded in deductible business expenses
  // Formula: expenseTotal × (hstRate / (1 + hstRate)) extracts the tax portion
  const itcEstimate = deductibleExpenses * (hstRate / (1 + hstRate));

  const netRemittable = Math.max(0, hstOnDirectRevenue - itcEstimate);

  const platformNote =
    platformRevenue > 0
      ? "Platform revenue excluded from HST calculation. DoorDash, UberEats, Skip, and other digital platform operators remit HST on your behalf under Canada's Digital Platform Operator rules (effective Dec 2021)."
      : "";

  return { hstOnDirectRevenue, hstRate, itcEstimate, netRemittable, platformNote };
}

export function calculateCRAMileageDeduction(
  km: number,
  year: number = new Date().getFullYear()
): number {
  const rates = getCRARates(year);
  if (km <= 5000) return km * rates.KM_RATE_TIER1;
  return 5000 * rates.KM_RATE_TIER1 + (km - 5000) * rates.KM_RATE_TIER2;
}

// ─── CANADA — Quarterly Installments ─────────────────────────────────────────

/**
 * @deprecated The tab screen reads installment dates from countryDef.taxInstallmentDates.
 * Use projectQuarterlyInstallment() for forward-looking amount estimates.
 */
export function calculateQuarterlyInstallments(annualTaxEstimate: number): {
  Q1: Date; Q2: Date; Q3: Date; Q4: Date; amount: number;
} {
  const y = new Date().getFullYear();
  return {
    Q1: new Date(y, 2, 15),
    Q2: new Date(y, 5, 15),
    Q3: new Date(y, 8, 15),
    Q4: new Date(y, 11, 15),
    amount: annualTaxEstimate / 4,
  };
}

// ─── USA (IRS) ───────────────────────────────────────────────────────────────

export function calculateSelfEmploymentTax(
  netIncome: number,
  year: number = new Date().getFullYear()
): number {
  const rates = getIRSRates(year);
  return netIncome * rates.SE_NET_PROFIT_RATIO * rates.SE_TAX_RATE;
}

export function calculateScheduleC(grossIncome: number, totalExpenses: number): number {
  return Math.max(0, grossIncome - totalExpenses);
}

export function calculateIRSMileageDeduction(
  miles: number,
  year: number = new Date().getFullYear()
): number {
  return miles * getIRSRates(year).MILE_RATE;
}

// ─── UNITED KINGDOM (HMRC) ───────────────────────────────────────────────────

export function calculateHMRCMileageDeduction(
  miles: number,
  year: number = new Date().getFullYear()
): number {
  const rates = getHMRCRates(year);
  if (miles <= 10000) return miles * rates.MILE_RATE_TIER1;
  return 10000 * rates.MILE_RATE_TIER1 + (miles - 10000) * rates.MILE_RATE_TIER2;
}

export interface UKNIResult {
  class2Annual: number;
  class4: number;
  total: number;
  isExemptClass2: boolean;
}

/**
 * Calculate Class 2 and Class 4 National Insurance for a UK self-employed person.
 * Class 2: flat weekly charge if profit > Small Profits Threshold.
 * Class 4: 9% on profits between lower and upper thresholds, 2% above.
 */
export function calculateUKNationalInsurance(
  profit: number,
  year: number = new Date().getFullYear()
): UKNIResult {
  const rates = getHMRCNIRates(year);

  const isExemptClass2 = profit <= rates.smallProfitsThreshold;
  const class2Annual = isExemptClass2 ? 0 : rates.class2WeeklyRate * 52;

  const band1 = Math.max(0, Math.min(profit, rates.class4UpperThreshold) - rates.class4LowerThreshold);
  const band2 = Math.max(0, profit - rates.class4UpperThreshold);
  const class4 = band1 * rates.class4Rate + band2 * rates.class4UpperRate;

  return { class2Annual, class4, total: class2Annual + class4, isExemptClass2 };
}

// ─── Quarterly Projection ─────────────────────────────────────────────────────

export interface QuarterlyProjection {
  currentQuarter: 1 | 2 | 3 | 4;
  dayOfYear: number;
  projectedAnnualGross: number;
  projectedAnnualNet: number;
  projectedAnnualTax: number;
  nextInstallmentAmount: number;
  nextInstallmentLabel: string;
  isLimitedData: boolean;
}

/**
 * Extrapolate YTD earnings to a full-year estimate and suggest a quarterly installment.
 * Call after fetching ytdGross and ytdDeductibleExpenses.
 */
export function projectQuarterlyInstallment(
  ytdGross: number,
  ytdDeductibleExpenses: number,
  taxWithholdingPct: number
): QuarterlyProjection {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.max(
    1,
    Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24))
  );
  const year = now.getFullYear();
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInYear = isLeapYear ? 366 : 365;

  const projectedAnnualGross = (ytdGross / dayOfYear) * daysInYear;
  const projectedAnnualExpenses = (ytdDeductibleExpenses / dayOfYear) * daysInYear;
  const projectedAnnualNet = Math.max(0, projectedAnnualGross - projectedAnnualExpenses);
  const projectedAnnualTax = projectedAnnualNet * (taxWithholdingPct / 100);

  const month = now.getMonth() + 1;
  const currentQuarter = (month <= 3 ? 1 : month <= 6 ? 2 : month <= 9 ? 3 : 4) as 1 | 2 | 3 | 4;
  const nextQ = (currentQuarter < 4 ? currentQuarter + 1 : 1) as 1 | 2 | 3 | 4;

  return {
    currentQuarter,
    dayOfYear,
    projectedAnnualGross,
    projectedAnnualNet,
    projectedAnnualTax,
    nextInstallmentAmount: projectedAnnualTax / 4,
    nextInstallmentLabel: nextQ === 1 ? "Q1 (Next Year)" : `Q${nextQ}`,
    isLimitedData: dayOfYear < 60,
  };
}

// ─── Expense Deductibility Helpers ────────────────────────────────────────────

export function computeDeductibleAmount(
  amount: number,
  deductiblePct: number,
  isDeductible: boolean
): number {
  if (!isDeductible) return 0;
  return amount * (deductiblePct / 100);
}

export function sumDeductibleAmounts(
  expenseList: ReadonlyArray<{ amount: number; deductiblePct: number; isDeductible: boolean }>
): number {
  return expenseList.reduce(
    (sum, e) => sum + computeDeductibleAmount(e.amount, e.deductiblePct, e.isDeductible),
    0
  );
}
