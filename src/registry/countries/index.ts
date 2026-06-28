import { type CountryDef, type TaxProfile, type ProvinceDef } from "./types";
import { CA, CA_PROVINCES } from "./CA";
import { US, US_STATES } from "./US";
import { UK, UK_REGIONS } from "./UK";
import { NP, NP_PROVINCES } from "./NP";

// Re-export the types so callers can import them from here
export { type CountryDef, type TaxProfile, type ProvinceDef } from "./types";

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

// ─── Province / Region Helpers ──────────────────────────────────────────────

const ALL_REGIONS: ProvinceDef[] = [
  ...CA_PROVINCES,
  ...US_STATES,
  ...UK_REGIONS,
  ...NP_PROVINCES,
];

export function resolveProvinceDef(
  countryId: string,
  regionCode: string
): ProvinceDef | null {
  const c = String(countryId).toUpperCase();
  const r = String(regionCode).toUpperCase();
  return ALL_REGIONS.find((p) => p.countryId === c && p.id === r) ?? null;
}

export function getRegionsByCountry(countryId: string): ProvinceDef[] {
  const c = String(countryId).toUpperCase();
  return ALL_REGIONS.filter((p) => p.countryId === c);
}

/** Get the HST/GST/sales tax rate for a region (falls back to country default) */
export function getSalesTaxRate(countryId: string, regionCode: string): number {
  const province = resolveProvinceDef(countryId, regionCode);
  if (province) return province.salesTaxRate;
  // Fallback
  if (countryId === "CA") return 0.13;
  if (countryId === "UK") return 0.20;
  return 0;
}

/** Get the regional/national mileage preset rate ($ per unit distance) */
export function getMileagePresetRate(countryId: string, regionCode: string): string {
  const c = String(countryId).toUpperCase();
  const r = String(regionCode).toUpperCase();
  if (c === "CA") {
    return "0.70"; // CRA rate
  }
  if (c === "US") {
    if (r === "CA") {
      return "0.35"; // California Prop 22 active mileage reimbursement
    }
    return "0.67"; // IRS Standard rate
  }
  if (c === "UK") {
    return "0.45"; // HMRC Standard rate
  }
  return "0.00";
}

/** Get the readable label for a region's standard mileage preset */
export function getMileagePresetLabel(countryId: string, regionCode: string): string {
  const c = String(countryId).toUpperCase();
  const r = String(regionCode).toUpperCase();
  if (c === "CA") return "CRA ($0.70/km)";
  if (c === "US") {
    if (r === "CA") return "California Prop 22 ($0.35/mi)";
    return "IRS Standard ($0.67/mi)";
  }
  if (c === "UK") return "HMRC (£0.45/mi)";
  return "None";
}
