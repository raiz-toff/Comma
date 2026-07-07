// Vehicle-type-aware standard mileage deduction rates. Unlike getMileagePresetRate() (a flat
// per-country rate used for platform pay-rate estimates), this answers a tax question: is THIS
// vehicle type even eligible for a standard mileage deduction in THIS country, and at what rate?
//
// Real tax authorities gate eligibility on vehicle type — the IRS standard mileage rate only
// covers cars/vans/pickups/panel trucks (not motorcycles or bicycles); CRA's per-km automobile
// allowance is likewise for motor vehicles, not bicycles. Research current as of 2026:
//   - IRS Notice 2026-10: 72.5 cents/mile for cars/vans, no published rate for motorcycles/bicycles
//   - CRA 2026: 73 cents/km (first 5,000 km) / 67 cents/km after, for automobiles only
//
// Scope: only US and CA are researched/supported per the app's current country coverage (see
// README). Other countries fall back to eligible=true using the flat country rate so existing
// UK/NP behavior is unchanged rather than silently regressed.

export type VehicleTypeId = "gas" | "hybrid" | "ev" | "motorcycle" | "bicycle" | "ebike" | "scooter" | "walking";

type MileageRateEntry = {
  eligible: boolean;
  ratePrimary: number | null;
  rateSecondary: number | null;
  rateThreshold: number | null; // distance at which ratePrimary switches to rateSecondary
  label: string;
};

// gas/hybrid/ev are all "automobiles" for mileage-deduction purposes.
function vehicleCategory(vehicleType: string): "car" | "motorcycle" | "bicycle" | "none" {
  if (vehicleType === "gas" || vehicleType === "hybrid" || vehicleType === "ev") return "car";
  if (vehicleType === "motorcycle") return "motorcycle";
  if (vehicleType === "bicycle" || vehicleType === "ebike" || vehicleType === "scooter") return "bicycle";
  return "none"; // "walking" or unknown
}

const NOT_ELIGIBLE = (authority: string): MileageRateEntry => ({
  eligible: false,
  ratePrimary: null,
  rateSecondary: null,
  rateThreshold: null,
  label: `Not eligible for ${authority} standard mileage rate — use actual expenses`,
});

const US_RATES: Record<"car" | "motorcycle" | "bicycle" | "none", MileageRateEntry> = {
  car: {
    eligible: true,
    ratePrimary: 0.725,
    rateSecondary: null,
    rateThreshold: null,
    label: "IRS Standard Mileage Rate (2026)",
  },
  motorcycle: NOT_ELIGIBLE("IRS"),
  bicycle: NOT_ELIGIBLE("IRS"),
  none: NOT_ELIGIBLE("IRS"),
};

const CA_RATES: Record<"car" | "motorcycle" | "bicycle" | "none", MileageRateEntry> = {
  car: {
    eligible: true,
    ratePrimary: 0.73,
    rateSecondary: 0.67,
    rateThreshold: 5000,
    label: "CRA Automobile Allowance Rate (2026)",
  },
  motorcycle: NOT_ELIGIBLE("CRA"),
  bicycle: NOT_ELIGIBLE("CRA"),
  none: NOT_ELIGIBLE("CRA"),
};

/**
 * Resolves whether a vehicle type is eligible for a standard mileage deduction in a country,
 * and at what rate. This is the DEFAULT only — a saved vehicleTaxProfiles row (user override or
 * opt-out) always takes precedence over this lookup.
 */
export function getVehicleMileageEligibility(countryId: string, vehicleType: string): MileageRateEntry {
  const category = vehicleCategory(vehicleType);
  const c = String(countryId).toUpperCase();

  if (c === "US") return US_RATES[category];
  if (c === "CA") return CA_RATES[category];

  // Out of researched scope (UK/NP): preserve prior behavior — flat rate, eligible whenever the
  // country has a mileage deduction at all — rather than newly restricting vehicle types we
  // haven't verified rules for.
  const { getCountryDef, getMileagePresetRate, getMileagePresetLabel } = require("./index");
  const countryHasDeduction = !!getCountryDef(countryId).hasMileageDeduction;
  const eligible = countryHasDeduction && category !== "none";
  return {
    eligible,
    ratePrimary: eligible ? parseFloat(getMileagePresetRate(countryId, "")) : null,
    rateSecondary: null,
    rateThreshold: null,
    label: eligible ? getMileagePresetLabel(countryId, "") : `No mileage deduction available in ${countryId}`,
  };
}
