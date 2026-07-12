// Vehicle-type-aware standard mileage deduction rates.
//
// This file contains NO country-specific data and no country branching. Each country declares its
// own `mileage` table in its own definition file (see CountryDef.mileage), and this is a pure
// lookup into it. Adding a country means adding that one file — nothing here changes.
//
// It answers a tax question: is THIS vehicle type even eligible for a standard mileage deduction
// in THIS country, and at what rate? Real tax authorities gate eligibility on vehicle type — the
// IRS standard rate covers cars/vans/pickups but not motorcycles or bicycles; CRA's per-km
// automobile allowance is likewise motor-vehicles-only. A category a country does not list is NOT
// eligible: absence is a deliberate answer, never a blank to be filled in with a neighbouring
// country's number.

import { type MileageCategory, type MileageTable } from "./types";

export type VehicleTypeId = "gas" | "hybrid" | "ev" | "motorcycle" | "bicycle" | "ebike" | "scooter" | "walking";

export type MileageRateEntry = {
  eligible: boolean;
  ratePrimary: number | null;
  rateSecondary: number | null;
  rateThreshold: number | null; // distance at which ratePrimary switches to rateSecondary
  label: string;
};

/** gas/hybrid/ev are all "automobiles" for mileage-deduction purposes. */
function vehicleCategory(vehicleType: string): MileageCategory | "none" {
  if (vehicleType === "gas" || vehicleType === "hybrid" || vehicleType === "ev") return "car";
  if (vehicleType === "motorcycle") return "motorcycle";
  if (vehicleType === "bicycle" || vehicleType === "ebike" || vehicleType === "scooter") return "bicycle";
  return "none"; // "walking" or unknown
}

const notEligible = (authority: string): MileageRateEntry => ({
  eligible: false,
  ratePrimary: null,
  rateSecondary: null,
  rateThreshold: null,
  label: `Not eligible for ${authority} standard mileage rate — use actual expenses`,
});

/**
 * Resolves whether a vehicle type is eligible for a standard mileage deduction in a country, and
 * at what rate. This is the DEFAULT only — a saved vehicleTaxProfiles row (a user override, or an
 * explicit opt-out) always takes precedence over this lookup.
 */
export function getVehicleMileageEligibility(countryId: string, vehicleType: string): MileageRateEntry {
  // Lazy require: the country registry pulls in the per-country modules, which would otherwise
  // form an import cycle back through this file's consumers.
  const { getCountryDef } = require("./index");
  const def = getCountryDef(countryId);
  const table: MileageTable | null = def?.mileage ?? null;

  // The country has declared it has no researched rates. Say so; don't invent one.
  if (!table) return notEligible(String(countryId).toUpperCase());

  const category = vehicleCategory(vehicleType);
  if (category === "none") return notEligible(table.authority);

  const rate = table.rates[category];
  if (!rate) return notEligible(table.authority);

  return {
    eligible: true,
    ratePrimary: rate.ratePrimary,
    rateSecondary: rate.rateSecondary ?? null,
    rateThreshold: rate.rateThreshold ?? null,
    label: rate.label,
  };
}
