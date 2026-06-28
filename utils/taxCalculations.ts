// 2024 Tax Rates for Canada (CRA) and USA (IRS)
export const CRA_2024 = {
  CPP_RATE: 0.0595, // Employee rate (5.95%)
  CPP_SELF_EMPLOYED_RATE: 0.119, // Both portions (11.9%)
  CPP_MAX_PENSIONABLE: 68500,
  CPP_BASIC_EXEMPTION: 3500,
  KM_RATE_TIER1: 0.70, // First 5000 km
  KM_RATE_TIER2: 0.64, // Thereafter
} as const;

export const IRS_2024 = {
  SE_TAX_RATE: 0.153, // Self-employment tax rate (15.3%)
  SE_NET_PROFIT_RATIO: 0.9235, // SE tax applies to 92.35% of net profit
  MILE_RATE: 0.67, // Standard mileage rate (67 cents per mile)
} as const;

export const PROVINCIAL_HST_RATES: Record<string, number> = {
  ON: 0.13, // Ontario HST
  BC: 0.05, // British Columbia GST (no provincial HST)
  AB: 0.05, // Alberta GST
  SK: 0.05, // Saskatchewan GST
  MB: 0.05, // Manitoba GST
  QC: 0.05, // Quebec GST
  NS: 0.15, // Nova Scotia HST
  NB: 0.15, // New Brunswick HST
  PE: 0.15, // Prince Edward Island HST
  NL: 0.15, // Newfoundland and Labrador HST
  YT: 0.05, // Yukon GST
  NT: 0.05, // Northwest Territories GST
  NU: 0.05, // Nunavut GST
};

// ─── CANADA (CRA) ────────────────────────────────────────────────────────────

export function calculateCPP(netIncome: number): {
  employeePortion: number;
  employerPortion: number;
  total: number;
} {
  const pensionableEarnings = Math.max(
    0,
    Math.min(netIncome, CRA_2024.CPP_MAX_PENSIONABLE) - CRA_2024.CPP_BASIC_EXEMPTION
  );
  const total = pensionableEarnings * CRA_2024.CPP_SELF_EMPLOYED_RATE;
  const portion = total / 2;
  return {
    employeePortion: portion,
    employerPortion: portion,
    total,
  };
}

export function calculateHSTOwing(grossRevenue: number, province: string): number {
  const rate = PROVINCIAL_HST_RATES[province.toUpperCase()] ?? 0.13; // default to Ontario HST 13%
  return grossRevenue * rate;
}

export function calculateCRAMileageDeduction(km: number): number {
  if (km <= 5000) {
    return km * CRA_2024.KM_RATE_TIER1;
  }
  return 5000 * CRA_2024.KM_RATE_TIER1 + (km - 5000) * CRA_2024.KM_RATE_TIER2;
}

export function calculateQuarterlyInstallments(annualTaxEstimate: number): {
  Q1: Date;
  Q2: Date;
  Q3: Date;
  Q4: Date;
  amount: number;
} {
  const currentYear = new Date().getFullYear();
  return {
    Q1: new Date(currentYear, 2, 15), // March 15
    Q2: new Date(currentYear, 5, 15), // June 15
    Q3: new Date(currentYear, 8, 15), // September 15
    Q4: new Date(currentYear, 11, 15), // December 15
    amount: annualTaxEstimate / 4,
  };
}

// ─── USA (IRS) ───────────────────────────────────────────────────────────────

export function calculateSelfEmploymentTax(netIncome: number): number {
  const taxableNetIncome = netIncome * IRS_2024.SE_NET_PROFIT_RATIO;
  return taxableNetIncome * IRS_2024.SE_TAX_RATE;
}

export function calculateScheduleC(grossIncome: number, totalExpenses: number): number {
  return Math.max(0, grossIncome - totalExpenses);
}

export function calculateIRSMileageDeduction(miles: number): number {
  return miles * IRS_2024.MILE_RATE;
}

// ─── UNITED KINGDOM (HMRC) ───────────────────────────────────────────────────

export const HMRC_2024 = {
  MILE_RATE_TIER1: 0.45, // First 10,000 miles
  MILE_RATE_TIER2: 0.25, // Thereafter
} as const;

export function calculateHMRCMileageDeduction(miles: number): number {
  if (miles <= 10000) {
    return miles * HMRC_2024.MILE_RATE_TIER1;
  }
  return 10000 * HMRC_2024.MILE_RATE_TIER1 + (miles - 10000) * HMRC_2024.MILE_RATE_TIER2;
}
