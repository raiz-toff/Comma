/**
 * Province / State Registry
 * Mirrors PWA: src/registry/provinces/
 * Contains HST rates, available platforms, and region metadata per province/state.
 */

export interface ProvinceDef {
  id: string;
  label: string;
  countryId: string;
  /** GST/HST/VAT rate for this region (0.05 = 5%) */
  salesTaxRate: number;
  /** Whether HST (harmonized) applies (vs GST only) */
  isHarmonized: boolean;
  /** Platforms available in this market */
  availablePlatforms: string[];
}

// ─── CANADA ───────────────────────────────────────────────────────────────────

const CA_PROVINCES: ProvinceDef[] = [
  {
    id: "AB", label: "Alberta", countryId: "CA",
    salesTaxRate: 0.05, isHarmonized: false,
    availablePlatforms: ["doordash", "ubereats", "skip", "instacart", "amazonflex"],
  },
  {
    id: "BC", label: "British Columbia", countryId: "CA",
    salesTaxRate: 0.05, isHarmonized: false,
    availablePlatforms: ["doordash", "ubereats", "skip", "foodora", "instacart", "amazonflex"],
  },
  {
    id: "MB", label: "Manitoba", countryId: "CA",
    salesTaxRate: 0.05, isHarmonized: false,
    availablePlatforms: ["doordash", "ubereats", "skip", "instacart"],
  },
  {
    id: "NB", label: "New Brunswick", countryId: "CA",
    salesTaxRate: 0.15, isHarmonized: true,
    availablePlatforms: ["doordash", "ubereats", "skip"],
  },
  {
    id: "NL", label: "Newfoundland and Labrador", countryId: "CA",
    salesTaxRate: 0.15, isHarmonized: true,
    availablePlatforms: ["doordash", "ubereats", "skip"],
  },
  {
    id: "NS", label: "Nova Scotia", countryId: "CA",
    salesTaxRate: 0.15, isHarmonized: true,
    availablePlatforms: ["doordash", "ubereats", "skip"],
  },
  {
    id: "NT", label: "Northwest Territories", countryId: "CA",
    salesTaxRate: 0.05, isHarmonized: false,
    availablePlatforms: ["doordash", "ubereats"],
  },
  {
    id: "NU", label: "Nunavut", countryId: "CA",
    salesTaxRate: 0.05, isHarmonized: false,
    availablePlatforms: ["doordash", "ubereats"],
  },
  {
    id: "ON", label: "Ontario", countryId: "CA",
    salesTaxRate: 0.13, isHarmonized: true,
    availablePlatforms: ["doordash", "ubereats", "skip", "foodora", "instacart", "amazonflex"],
  },
  {
    id: "PE", label: "Prince Edward Island", countryId: "CA",
    salesTaxRate: 0.15, isHarmonized: true,
    availablePlatforms: ["doordash", "ubereats", "skip"],
  },
  {
    id: "QC", label: "Quebec", countryId: "CA",
    salesTaxRate: 0.05, isHarmonized: false,
    availablePlatforms: ["doordash", "ubereats", "skip", "foodora", "instacart"],
  },
  {
    id: "SK", label: "Saskatchewan", countryId: "CA",
    salesTaxRate: 0.05, isHarmonized: false,
    availablePlatforms: ["doordash", "ubereats", "skip", "instacart"],
  },
  {
    id: "YT", label: "Yukon", countryId: "CA",
    salesTaxRate: 0.05, isHarmonized: false,
    availablePlatforms: ["doordash", "ubereats"],
  },
];

// ─── UNITED STATES ───────────────────────────────────────────────────────────

const US_STATES: ProvinceDef[] = [
  { id: "AL", label: "Alabama", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart", "amazonflex"] },
  { id: "AK", label: "Alaska", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart"] },
  { id: "AZ", label: "Arizona", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart", "amazonflex"] },
  { id: "AR", label: "Arkansas", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart"] },
  { id: "CA", label: "California", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart", "amazonflex", "lyft"] },
  { id: "CO", label: "Colorado", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart", "amazonflex"] },
  { id: "CT", label: "Connecticut", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart"] },
  { id: "DE", label: "Delaware", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart"] },
  { id: "DC", label: "Washington D.C.", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart", "amazonflex"] },
  { id: "FL", label: "Florida", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart", "amazonflex"] },
  { id: "GA", label: "Georgia", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart", "amazonflex"] },
  { id: "HI", label: "Hawaii", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart"] },
  { id: "ID", label: "Idaho", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart"] },
  { id: "IL", label: "Illinois", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart", "amazonflex"] },
  { id: "IN", label: "Indiana", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart"] },
  { id: "IA", label: "Iowa", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart"] },
  { id: "KS", label: "Kansas", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart"] },
  { id: "KY", label: "Kentucky", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart"] },
  { id: "LA", label: "Louisiana", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart"] },
  { id: "ME", label: "Maine", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart"] },
  { id: "MD", label: "Maryland", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart", "amazonflex"] },
  { id: "MA", label: "Massachusetts", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart", "amazonflex"] },
  { id: "MI", label: "Michigan", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart", "amazonflex"] },
  { id: "MN", label: "Minnesota", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart"] },
  { id: "MS", label: "Mississippi", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart"] },
  { id: "MO", label: "Missouri", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart"] },
  { id: "MT", label: "Montana", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats"] },
  { id: "NE", label: "Nebraska", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart"] },
  { id: "NV", label: "Nevada", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart", "amazonflex"] },
  { id: "NH", label: "New Hampshire", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart"] },
  { id: "NJ", label: "New Jersey", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart", "amazonflex"] },
  { id: "NM", label: "New Mexico", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart"] },
  { id: "NY", label: "New York", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart", "amazonflex", "lyft"] },
  { id: "NC", label: "North Carolina", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart", "amazonflex"] },
  { id: "ND", label: "North Dakota", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats"] },
  { id: "OH", label: "Ohio", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart", "amazonflex"] },
  { id: "OK", label: "Oklahoma", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart"] },
  { id: "OR", label: "Oregon", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart", "amazonflex"] },
  { id: "PA", label: "Pennsylvania", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart", "amazonflex"] },
  { id: "RI", label: "Rhode Island", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart"] },
  { id: "SC", label: "South Carolina", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart"] },
  { id: "SD", label: "South Dakota", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats"] },
  { id: "TN", label: "Tennessee", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart"] },
  { id: "TX", label: "Texas", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart", "amazonflex"] },
  { id: "UT", label: "Utah", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart"] },
  { id: "VT", label: "Vermont", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats"] },
  { id: "VA", label: "Virginia", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart", "amazonflex"] },
  { id: "WA", label: "Washington", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart", "amazonflex"] },
  { id: "WV", label: "West Virginia", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats"] },
  { id: "WI", label: "Wisconsin", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats", "instacart"] },
  { id: "WY", label: "Wyoming", countryId: "US", salesTaxRate: 0, isHarmonized: false, availablePlatforms: ["doordash", "ubereats"] },
];

// ─── UNITED KINGDOM ──────────────────────────────────────────────────────────

const UK_REGIONS: ProvinceDef[] = [
  { id: "ENG", label: "England", countryId: "UK", salesTaxRate: 0.20, isHarmonized: false, availablePlatforms: ["ubereats", "doordash", "instacart", "amazonflex", "other"] },
  { id: "SCT", label: "Scotland", countryId: "UK", salesTaxRate: 0.20, isHarmonized: false, availablePlatforms: ["ubereats", "doordash", "instacart", "amazonflex", "other"] },
  { id: "WLS", label: "Wales", countryId: "UK", salesTaxRate: 0.20, isHarmonized: false, availablePlatforms: ["ubereats", "doordash", "instacart", "amazonflex", "other"] },
  { id: "NIR", label: "Northern Ireland", countryId: "UK", salesTaxRate: 0.20, isHarmonized: false, availablePlatforms: ["ubereats", "doordash", "instacart", "amazonflex", "other"] },
];

// ─── Lookup helpers ────────────────────────────────────────────────────────────

const ALL_REGIONS: ProvinceDef[] = [...CA_PROVINCES, ...US_STATES, ...UK_REGIONS];

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
  // Fallback: if CA, default to ON 13%; if US, 0%
  return countryId === "CA" ? 0.13 : 0;
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
  return "0.62";
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
  return "Standard";
}
