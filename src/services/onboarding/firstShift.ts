/**
 * First-shift reveal — the activation moment.
 *
 * Turns the four things we ask a new driver during onboarding (platform, hours, gross, distance)
 * into the numbers Comma exists to show them: what they *keep* after tax, what that works out to
 * per hour, and what their driving is worth as a write-off.
 *
 * Every formula here is the one the rest of the app already uses, so the reveal can't disagree
 * with the dashboard the user lands on ten seconds later:
 *   - tax set-aside  → gross × withholdingPct   (same as the Tax tab's taxJarTarget)
 *   - write-off      → calculateMileageWriteOff (same tiered registry rates)
 * Take-home and real hourly are *sequenced* from those two, not re-derived from new math.
 *
 * Deliberately DB-free: getVehicleMileageEligibility and calculateMileageWriteOff are both pure,
 * so this runs before a vehicle (or anything else) exists.
 */

import { getCountryDef } from "../../registry/countries/index";
import { getWithholdingPresetPct } from "../../registry/countries/tax/index";
import { getVehicleMileageEligibility } from "../../registry/countries/mileageRates";
import { calculateMileageWriteOff, type EffectiveMileageRate } from "../../database/queries/taxProfiles";

/** The vehicle we assume before the driver has told us otherwise. Disclosed in the reveal UI. */
export const ASSUMED_VEHICLE_TYPE = "gas";

export type FirstShiftInput = {
  country: string;
  taxRegion: string;
  /** Total earned for the shift, tips and bonuses included. */
  gross: number;
  hours: number;
  /** In the country's own unit — km for CA/NP, miles for US/UK. Zero is fine. */
  distance: number;
};

export type FirstShiftMath = {
  gross: number;
  hours: number;
  distance: number;
  /** What they'd tell you they make — gross ÷ hours. Matches the dashboard's hourly rate. */
  grossHourly: number;
  withholdingPct: number;
  taxSetAside: number;
  /** gross − taxSetAside. The money that's actually theirs. */
  takeHome: number;
  /** takeHome ÷ hours. The number the whole flow is built to deliver. */
  realHourly: number;
  /** Tax deduction their driving earned them. Not a cash cost — never subtracted from take-home. */
  mileageWriteOff: number;
  mileageRateLabel: string;
  /** False in NP (no mileage deduction) and for ineligible vehicle types — hide the write-off row. */
  hasMileageDeduction: boolean;
  currencySymbol: string;
  distanceUnit: string;
};

/** Resolve the withholding % from country + region, falling back to the country default. */
export function resolveWithholdingPct(country: string, taxRegion: string): number {
  const def = getCountryDef(country);
  return (
    getWithholdingPresetPct(def.tax.regionPresetType, taxRegion) ??
    def.tax.defaultWithholdingPct
  );
}

export function computeFirstShift(input: FirstShiftInput): FirstShiftMath {
  const def = getCountryDef(input.country);
  const gross = Math.max(0, input.gross);
  const hours = Math.max(0, input.hours);
  const distance = Math.max(0, input.distance);

  const withholdingPct = resolveWithholdingPct(input.country, input.taxRegion);
  const taxSetAside = gross * (withholdingPct / 100);
  const takeHome = gross - taxSetAside;

  const eligibility = getVehicleMileageEligibility(input.country, ASSUMED_VEHICLE_TYPE);
  const rate: EffectiveMileageRate = {
    deductionMethod: eligibility.eligible ? "standard_mileage" : "actual_expenses",
    ratePrimary: eligibility.ratePrimary,
    rateSecondary: eligibility.rateSecondary,
    rateThreshold: eligibility.rateThreshold,
    label: eligibility.label,
    isUserOverride: false,
  };

  return {
    gross,
    hours,
    distance,
    grossHourly: hours > 0 ? gross / hours : 0,
    withholdingPct,
    taxSetAside,
    takeHome,
    realHourly: hours > 0 ? takeHome / hours : 0,
    mileageWriteOff: calculateMileageWriteOff(distance, rate),
    mileageRateLabel: eligibility.label,
    hasMileageDeduction: eligibility.eligible,
    currencySymbol: def.symbol,
    distanceUnit: def.distanceUnit,
  };
}
