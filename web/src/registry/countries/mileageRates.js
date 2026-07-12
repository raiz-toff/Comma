/**
 * Vehicle-type-aware standard mileage deduction rates — web mirror of the phone app's
 * `src/registry/countries/mileageRates.ts`. Keep the two in step.
 *
 * This file contains NO country-specific data and no country branching. Each country declares its
 * own `mileage` table in its own definition file (see CA.country.js), and this is a pure lookup
 * into it. Adding a country means adding that one file — nothing here changes.
 *
 * It answers a tax question: is THIS vehicle type even eligible for a standard mileage deduction
 * in THIS country, and at what rate? Real tax authorities gate eligibility on vehicle type — the
 * IRS standard rate covers cars/vans/pickups but not motorcycles or bicycles; CRA's per-km
 * automobile allowance is likewise motor-vehicles-only. A category a country does not list is NOT
 * eligible: absence is a deliberate answer, never a blank to be filled in with a neighbouring
 * country's number.
 */

import { findCountryDef } from './index.js';

const VEHICLE_TYPES_BY_CATEGORY = {
  car: new Set(['gas', 'hybrid', 'ev']),
  motorcycle: new Set(['motorcycle']),
  bicycle: new Set(['bicycle', 'ebike', 'scooter']),
};

/** @param {string} vehicleType */
function vehicleCategory(vehicleType) {
  if (VEHICLE_TYPES_BY_CATEGORY.car.has(vehicleType)) return 'car';
  if (VEHICLE_TYPES_BY_CATEGORY.motorcycle.has(vehicleType)) return 'motorcycle';
  if (VEHICLE_TYPES_BY_CATEGORY.bicycle.has(vehicleType)) return 'bicycle';
  return 'none'; // 'walking' or unknown
}

/** @param {string} authority */
function notEligible(authority) {
  return {
    eligible: false,
    ratePrimary: null,
    rateSecondary: null,
    rateThreshold: null,
    label: `Not eligible for ${authority} standard mileage rate — use actual expenses`,
  };
}

/**
 * Resolves whether a vehicle type is eligible for a standard mileage deduction in a country, and
 * at what rate. This is the DEFAULT only — a saved vehicleTaxProfiles row (a user override, or an
 * explicit opt-out) always takes precedence over this lookup.
 *
 * @param {string} countryId
 * @param {string} vehicleType
 */
export function getVehicleMileageEligibility(countryId, vehicleType) {
  const id = String(countryId || '').toUpperCase();
  // findCountryDef, NOT getById — an unregistered country must not be handed Canada's rates.
  const def = findCountryDef(id);
  const table = def?.mileage ?? null;

  // Either the country isn't registered, or it has declared it has no researched rates. Say so;
  // don't invent one.
  if (!table) return notEligible(id || 'this country');

  const category = vehicleCategory(vehicleType);
  if (category === 'none') return notEligible(table.authority);

  const rate = table.rates?.[category];
  if (!rate) return notEligible(table.authority);

  return {
    eligible: true,
    ratePrimary: rate.ratePrimary,
    rateSecondary: rate.rateSecondary ?? null,
    rateThreshold: rate.rateThreshold ?? null,
    label: rate.label,
  };
}
