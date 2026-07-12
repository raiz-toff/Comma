import { type CountryDef, type TaxProfile, type ProvinceDef } from "./types";
import { CA, CA_PROVINCES } from "./CA";
// Written, type-checked, and deliberately UNREGISTERED — see COUNTRY_MAP below. Kept imported so
// they keep compiling against CountryDef and stay one line away from being switched on.
import { US, US_STATES } from "./US";
import { UK, UK_REGIONS } from "./UK";
import { NP, NP_PROVINCES } from "./NP";

void US; void US_STATES;
void UK; void UK_REGIONS;
void NP; void NP_PROVINCES;

// Re-export the types so callers can import them from here
export { type CountryDef, type TaxProfile, type ProvinceDef } from "./types";
export { type MileageTable, type MileageRate, type MileageCategory } from "./types";

/**
 * ── THE REGISTRY ─────────────────────────────────────────────────────────────
 * The one place that decides which countries this app ships.
 *
 * Canada only, for now. US / UK / NP definitions exist on disk, fully written, but are NOT
 * registered — the app must not offer a country whose tax rules haven't been signed off.
 *
 * TO ADD A COUNTRY:
 *   1. add it to COUNTRY_MAP below, and its regions to ALL_REGIONS
 *   2. make sure its definition declares `mileage` (a table, or null for "no researched rates")
 * That's it. Nothing else in the app branches on country: the mileage lookup, the withholding
 * lookup, onboarding, the reveal and the tax screens all read from the definition. There are no
 * `if (country === 'CA')` switches to hunt down.
 */
const COUNTRY_MAP: Record<string, CountryDef> = { CA };

/** The single place that decides which countries this app actually supports. */
export const SUPPORTED_COUNTRY_IDS: string[] = Object.keys(COUNTRY_MAP);

export function isSupportedCountry(countryId: string | null | undefined): boolean {
  return Boolean(COUNTRY_MAP[String(countryId ?? "").toUpperCase()]);
}

/**
 * Look up a country. Returns null when it isn't registered — callers on tax-bearing paths should
 * check, rather than be handed a different country's rules.
 */
export function findCountryDef(countryId: string | null | undefined): CountryDef | null {
  return COUNTRY_MAP[String(countryId ?? "").toUpperCase()] ?? null;
}

/**
 * Look up a country, falling back to CA so the UI can still render.
 *
 * The fallback is LOUD on purpose. It used to be silent, which meant an unregistered country (a
 * profile synced from a device that has it, say) was quietly served Canadian currency and a
 * Canadian tax rate — the app confidently showing a number that was simply wrong for that driver.
 * A missing country is now a reported bug, not a plausible-looking result. Use findCountryDef or
 * isSupportedCountry where a wrong answer is worse than no answer.
 */
export function getCountryDef(countryId: string): CountryDef {
  const found = findCountryDef(countryId);
  if (found) return found;

  console.error(
    `[registry] Unsupported country "${String(countryId).toUpperCase()}". Falling back to CA — ` +
      `currency, tax rate and mileage shown WILL BE WRONG for this driver. ` +
      `Register it in src/registry/countries/ (supported: ${SUPPORTED_COUNTRY_IDS.join(", ")}).`
  );
  return CA;
}

export function getCountryTaxProfile(countryId: string): TaxProfile {
  return getCountryDef(countryId).tax;
}

export function listCountries(): CountryDef[] {
  return Object.values(COUNTRY_MAP);
}

/**
 * Fails fast on a half-added country. Every registered country must carry the fields the app will
 * unconditionally read — including an explicit `mileage` decision (a table, or null for "not
 * researched"). Without this, a new country definition missing `mileage` would quietly produce
 * zero write-offs for every driver in it.
 */
export function assertCountryRegistryValid(): void {
  for (const def of Object.values(COUNTRY_MAP)) {
    const missing: string[] = [];
    for (const key of ["id", "label", "currency", "symbol", "distanceUnit"] as const) {
      if (def[key] == null || def[key] === "") missing.push(key);
    }
    if (!("mileage" in def)) missing.push("mileage (use null if no researched rates)");
    if (!def.tax) missing.push("tax");
    else if (typeof def.tax.defaultWithholdingPct !== "number") missing.push("tax.defaultWithholdingPct");

    if (missing.length) {
      throw new Error(
        `[registry] Country "${def.id ?? "?"}" is incomplete: missing ${missing.join(", ")}.`
      );
    }
  }
}

// ─── Province / Region Helpers ──────────────────────────────────────────────

// Regions of registered countries only — see COUNTRY_MAP. Add a country's regions here when you
// register it, or its region picker comes back empty.
const ALL_REGIONS: ProvinceDef[] = [
  ...CA_PROVINCES,
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
