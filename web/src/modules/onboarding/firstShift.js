/**
 * First-shift reveal — the activation moment.
 *
 * Mirror of the phone app's `src/services/onboarding/firstShift.ts`. Keep the two in step: a
 * driver who logs the same shift on both should be told the same thing, and the vault format
 * already lets them move between the apps.
 *
 * Turns the four things we ask a new driver (platform, hours, gross, distance) into the numbers
 * Comma exists to show them: what they *keep* after tax, what that works out to per hour, and
 * what their driving is worth as a write-off.
 *
 * Every formula here is one the rest of the app already uses, so the reveal can't disagree with
 * the dashboard the user lands on ten seconds later:
 *   - tax set-aside → gross × withholdingPct   (same as loadTaxSummary's taxSetAside)
 *   - write-off     → calculateMileageWriteOff (same tiered registry rates)
 * Take-home and real hourly are *sequenced* from those two, not re-derived from new math.
 */

import { CountryRegistry } from '../../registry/countries/index.js';
import { getWithholdingPresetPct } from '../../registry/tax/withholding-presets.js';
import { getVehicleMileageEligibility } from '../../registry/countries/mileageRates.js';
import { calculateMileageWriteOff } from '../vehicles/taxProfiles.js';

/** The vehicle we assume before the driver has told us otherwise. Disclosed in the reveal UI. */
export const ASSUMED_VEHICLE_TYPE = 'gas';

/** Resolve the withholding % from country + region, falling back to the country default. */
export function resolveWithholdingPct(country, region) {
  const def = CountryRegistry.getById(country);
  const preset = getWithholdingPresetPct(def.tax.regionPresetType, region);
  return typeof preset === 'number' ? preset : def.tax.defaultWithholdingPct;
}

/**
 * @param {{ country: string, region: string, gross: number, hours: number, distance: number }} input
 */
export function computeFirstShift(input) {
  const def = CountryRegistry.getById(input.country);
  const gross = Math.max(0, Number(input.gross) || 0);
  const hours = Math.max(0, Number(input.hours) || 0);
  const distance = Math.max(0, Number(input.distance) || 0);

  const withholdingPct = resolveWithholdingPct(input.country, input.region);
  const taxSetAside = gross * (withholdingPct / 100);
  const takeHome = gross - taxSetAside;

  const eligibility = getVehicleMileageEligibility(input.country, ASSUMED_VEHICLE_TYPE);
  const rate = {
    deductionMethod: eligibility.eligible ? 'standard_mileage' : 'actual_expenses',
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
    /** What they'd tell you they make — matches the dashboard's hourly rate. */
    grossHourly: hours > 0 ? gross / hours : 0,
    withholdingPct,
    taxSetAside,
    /** gross − taxSetAside. The money that's actually theirs. */
    takeHome,
    /** The number the whole flow is built to deliver. */
    realHourly: hours > 0 ? takeHome / hours : 0,
    /** Tax deduction their driving earned them. Not a cash cost — never subtracted from take-home. */
    mileageWriteOff: calculateMileageWriteOff(distance, rate),
    mileageRateLabel: eligibility.label,
    /** False in NP (no mileage deduction) — hide the write-off row entirely. */
    hasMileageDeduction: Boolean(eligibility.eligible),
    currencySymbol: def.symbol,
    distanceUnit: def.distanceUnit,
  };
}
