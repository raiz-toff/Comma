/**
 * Per-vehicle, per-tax-year mileage deduction profiles — web mirror of the mobile app's
 * `commaApp/src/database/queries/taxProfiles.ts`. Backed by the `vehicleTaxProfiles` Dexie
 * table (schema already existed for the mobile interop sync shape but was unwired — see
 * `core/db.js` STORES_V5).
 */

import { db } from '../../core/db.js';
import { newId } from '../../core/id.js';
import { getVehicleMileageEligibility } from '../../registry/countries/mileageRates.js';

/**
 * @param {string} vehicleId
 * @param {number} taxYear
 */
export async function getTaxProfileForVehicleYear(vehicleId, taxYear) {
  const rows = await db.vehicleTaxProfiles.where({ vehicleId }).toArray();
  return rows.find((r) => r.taxYear === taxYear && r.syncDeletedAt == null) ?? null;
}

/**
 * Upsert keyed by (vehicleId, taxYear) — matches regardless of tombstone status so a write
 * revives a soft-deleted profile instead of creating a duplicate.
 * @param {{ vehicleId: string, taxYear: number, deductionMethod: 'standard_mileage'|'actual_expenses', country: string, standardRatePrimary: number|null, standardRateSecondary: number|null, rateThreshold: number|null }} payload
 */
export async function upsertTaxProfile(payload) {
  const rows = await db.vehicleTaxProfiles.where({ vehicleId: payload.vehicleId }).toArray();
  const existing = rows.find((r) => r.taxYear === payload.taxYear);
  const ts = new Date().toISOString();

  if (existing) {
    await db.vehicleTaxProfiles.update(existing.id, {
      ...payload,
      updatedAt: ts,
      syncUpdatedAt: Date.now(),
      syncDeletedAt: null,
    });
    return existing.id;
  }

  const id = newId('taxprofile');
  await db.vehicleTaxProfiles.add({
    id,
    ...payload,
    createdAt: ts,
    updatedAt: ts,
    syncUpdatedAt: Date.now(),
    syncDeletedAt: null,
  });
  return id;
}

/**
 * Resolves the rate to actually use for a vehicle's write-off this tax year: a saved
 * vehicleTaxProfiles row always wins (an explicit user choice — including an explicit opt-out
 * via deductionMethod: "actual_expenses" — even if it disagrees with the registry default). Only
 * falls back to the registry default when no profile row exists yet, and only reports a
 * standard_mileage default when the vehicle type is actually eligible.
 * @param {string} vehicleId
 * @param {number} taxYear
 * @param {string} countryId
 * @param {string} vehicleType
 */
export async function getEffectiveMileageRate(vehicleId, taxYear, countryId, vehicleType) {
  const saved = await getTaxProfileForVehicleYear(vehicleId, taxYear);
  if (saved) {
    return {
      deductionMethod: saved.deductionMethod,
      ratePrimary: saved.standardRatePrimary,
      rateSecondary: saved.standardRateSecondary,
      rateThreshold: saved.rateThreshold,
      label: 'Custom rate',
      isUserOverride: true,
    };
  }

  const def = getVehicleMileageEligibility(countryId, vehicleType);
  return {
    deductionMethod: def.eligible ? 'standard_mileage' : 'actual_expenses',
    ratePrimary: def.ratePrimary,
    rateSecondary: def.rateSecondary,
    rateThreshold: def.rateThreshold,
    label: def.label,
    isUserOverride: false,
  };
}

/**
 * distance × tiered rate (ratePrimary up to rateThreshold, rateSecondary beyond it).
 * @param {number} distance
 * @param {{ deductionMethod: string, ratePrimary: number|null, rateSecondary: number|null, rateThreshold: number|null }} rate
 */
export function calculateMileageWriteOff(distance, rate) {
  if (rate.deductionMethod !== 'standard_mileage' || rate.ratePrimary == null || distance <= 0) return 0;
  if (rate.rateThreshold != null && rate.rateSecondary != null && distance > rate.rateThreshold) {
    return rate.rateThreshold * rate.ratePrimary + (distance - rate.rateThreshold) * rate.rateSecondary;
  }
  return distance * rate.ratePrimary;
}
