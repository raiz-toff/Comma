/**
 * Vehicle-type-aware standard mileage deduction rates — web mirror of the mobile app's
 * `commaApp/src/registry/countries/mileageRates.ts`.
 *
 * Answers a tax question: is THIS vehicle type even eligible for a standard mileage deduction in
 * THIS country, and at what rate? Real tax authorities gate eligibility on vehicle type — the IRS
 * standard mileage rate only covers cars/vans/pickups/panel trucks (not motorcycles or bicycles);
 * CRA's per-km automobile allowance is likewise for motor vehicles, not bicycles.
 *
 * Research current as of 2026:
 *   - IRS Notice 2026-10: 72.5 cents/mile for cars/vans, no published rate for motorcycles/bicycles
 *   - CRA 2026: 73 cents/km (first 5,000 km) / 67 cents/km after, for automobiles only
 *
 * Scope: only US and CA are researched/supported, matching this app's current country coverage
 * (CountryRegistry only has CA/US/UK). UK has no researched vehicle-type table here — an
 * ineligible/no-rate result rather than a fabricated number.
 */

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

const US_RATES = {
  car: {
    eligible: true,
    ratePrimary: 0.725,
    rateSecondary: null,
    rateThreshold: null,
    label: 'IRS Standard Mileage Rate (2026)',
  },
  motorcycle: notEligible('IRS'),
  bicycle: notEligible('IRS'),
  none: notEligible('IRS'),
};

const CA_RATES = {
  car: {
    eligible: true,
    ratePrimary: 0.73,
    rateSecondary: 0.67,
    rateThreshold: 5000,
    label: 'CRA Automobile Allowance Rate (2026)',
  },
  motorcycle: notEligible('CRA'),
  bicycle: notEligible('CRA'),
  none: notEligible('CRA'),
};

/**
 * Resolves whether a vehicle type is eligible for a standard mileage deduction in a country, and
 * at what rate. This is the DEFAULT only — a saved vehicleTaxProfiles row (user override or
 * opt-out) always takes precedence over this lookup.
 * @param {string} countryId
 * @param {string} vehicleType
 */
export function getVehicleMileageEligibility(countryId, vehicleType) {
  const category = vehicleCategory(vehicleType);
  const c = String(countryId || '').toUpperCase();

  if (c === 'US') return US_RATES[category];
  if (c === 'CA') return CA_RATES[category];

  // Out of researched scope (UK and others): report ineligible rather than fabricate a number.
  return {
    eligible: false,
    ratePrimary: null,
    rateSecondary: null,
    rateThreshold: null,
    label: `No researched mileage rate available for ${c}`,
  };
}
