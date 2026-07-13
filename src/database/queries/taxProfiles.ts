import { db } from "../client";
import { vehicleTaxProfiles } from "../schema";
import { eq, and } from "drizzle-orm";
import { Platform } from "react-native";
import { stampInsert, stampUpdate, softDeletePatch, notDeleted, isNotDeleted } from "../syncedWrites";
import { getVehicleMileageEligibility } from "../../registry/countries/mileageRates";
import { getVehicleById } from "./vehicles";

const isWeb = Platform.OS === "web";

export type EffectiveMileageRate = {
  deductionMethod: "standard_mileage" | "actual_expenses";
  ratePrimary: number | null;
  rateSecondary: number | null;
  rateThreshold: number | null;
  label: string;
  /** True when this came from a profile the user explicitly saved, false when it's a registry default. */
  isUserOverride: boolean;
};

/**
 * Resolves the rate to actually use for a vehicle's write-off this tax year: a saved
 * vehicleTaxProfiles row always wins (it represents an explicit user choice — including an
 * explicit opt-out via deductionMethod: "actual_expenses" — even if it disagrees with the
 * registry default). Only falls back to the registry default when no profile row exists yet,
 * and only reports a standard_mileage default when the vehicle type is actually eligible.
 */
export async function getEffectiveMileageRate(
  vehicleId: string,
  taxYear: number,
  countryId: string,
  vehicleType: string
): Promise<EffectiveMileageRate> {
  const saved = await getTaxProfileForVehicleYear(vehicleId, taxYear);
  if (saved) {
    return {
      deductionMethod: saved.deductionMethod,
      ratePrimary: saved.standardRatePrimary,
      rateSecondary: saved.standardRateSecondary,
      rateThreshold: saved.rateThreshold,
      label: "Custom rate",
      isUserOverride: true,
    };
  }

  const def = getVehicleMileageEligibility(countryId, vehicleType);
  return {
    deductionMethod: def.eligible ? "standard_mileage" : "actual_expenses",
    ratePrimary: def.ratePrimary,
    rateSecondary: def.rateSecondary,
    rateThreshold: def.rateThreshold,
    label: def.label,
    isUserOverride: false,
  };
}

/** amount × tiered rate (ratePrimary up to rateThreshold, rateSecondary beyond it). */
export function calculateMileageWriteOff(miles: number, rate: EffectiveMileageRate): number {
  if (rate.deductionMethod !== "standard_mileage" || rate.ratePrimary == null || miles <= 0) return 0;
  if (rate.rateThreshold != null && rate.rateSecondary != null && miles > rate.rateThreshold) {
    return rate.rateThreshold * rate.ratePrimary + (miles - rate.rateThreshold) * rate.rateSecondary;
  }
  return miles * rate.ratePrimary;
}

/**
 * Mileage write-off across possibly-several vehicles, each at ITS OWN rate — not one vehicle's
 * rate applied to everyone's total distance. `breakdown` is mileage already grouped by the
 * vehicle that actually drove it (one row per vehicle used in the period); a row with a null
 * vehicleId (a shift nobody assigned a vehicle to) still counts toward totalMileage for display
 * but contributes $0 to the write-off — eligibility can't be determined for an unknown vehicle,
 * and understating a tax write-off is the safe direction to be wrong in.
 */
export async function calculateMileageWriteOffForBreakdown(
  breakdown: { vehicleId: string | null; activeMileage: number; deadMileage: number }[],
  taxYear: number,
  countryId: string
): Promise<{ totalMileage: number; writeOff: number }> {
  let totalMileage = 0;
  let writeOff = 0;
  for (const row of breakdown) {
    const miles = row.activeMileage + row.deadMileage;
    totalMileage += miles;
    if (!row.vehicleId) continue;
    const vehicle = await getVehicleById(row.vehicleId);
    if (!vehicle) continue;
    const rate = await getEffectiveMileageRate(row.vehicleId, taxYear, countryId, vehicle.type);
    writeOff += calculateMileageWriteOff(miles, rate);
  }
  return { totalMileage, writeOff };
}

export async function getTaxProfilesForVehicle(vehicleId: string): Promise<any[]> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_vehicle_tax_profiles");
    if (!existing) return [];
    const list = JSON.parse(existing);
    return list.filter((p: any) => p.vehicleId === vehicleId && isNotDeleted(p));
  }
  return await db
    .select()
    .from(vehicleTaxProfiles)
    .where(and(eq(vehicleTaxProfiles.vehicleId, vehicleId), notDeleted(vehicleTaxProfiles.syncDeletedAt)));
}

export async function getTaxProfileForVehicleYear(vehicleId: string, year: number): Promise<any | null> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_vehicle_tax_profiles");
    if (!existing) return null;
    const list = JSON.parse(existing);
    const found = list.find((p: any) => p.vehicleId === vehicleId && p.taxYear === year);
    return found && isNotDeleted(found) ? found : null;
  }
  const result = await db
    .select()
    .from(vehicleTaxProfiles)
    .where(
      and(
        eq(vehicleTaxProfiles.vehicleId, vehicleId),
        eq(vehicleTaxProfiles.taxYear, year),
        notDeleted(vehicleTaxProfiles.syncDeletedAt)
      )
    )
    .limit(1);
  return result[0] || null;
}

export async function upsertTaxProfile(payload: typeof vehicleTaxProfiles.$inferInsert): Promise<void> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_vehicle_tax_profiles");
    const list = existing ? JSON.parse(existing) : [];
    // Match the existing (vehicleId, taxYear) row regardless of tombstone status so an
    // upsert revives a soft-deleted profile instead of creating a duplicate.
    const idx = list.findIndex((p: any) => p.vehicleId === payload.vehicleId && p.taxYear === payload.taxYear);
    if (idx !== -1) {
      // Update (and clear any tombstone — revive). syncDeletedAt: null wins on merge
      // because stampUpdate bumps syncUpdatedAt to now.
      list[idx] = { ...list[idx], ...stampUpdate({ ...payload, syncDeletedAt: null }) };
    } else {
      list.push(stampInsert(payload));
    }
    localStorage.setItem("comma_vehicle_tax_profiles", JSON.stringify(list));
    return;
  }

  // Look up regardless of tombstone status so we revive a soft-deleted profile rather
  // than inserting a duplicate (vehicleId + taxYear is logically unique).
  const existing = await db
    .select({ id: vehicleTaxProfiles.id })
    .from(vehicleTaxProfiles)
    .where(and(eq(vehicleTaxProfiles.vehicleId, payload.vehicleId), eq(vehicleTaxProfiles.taxYear, payload.taxYear)))
    .limit(1);

  if (existing.length > 0) {
    // Clear the tombstone on write so a previously soft-deleted profile is revived.
    await db
      .update(vehicleTaxProfiles)
      .set(stampUpdate({ ...payload, syncDeletedAt: null }))
      .where(eq(vehicleTaxProfiles.id, existing[0].id));
  } else {
    await db.insert(vehicleTaxProfiles).values(stampInsert(payload));
  }
}

/**
 * Soft-delete (sync tombstone) — NOT a hard DELETE. Sets syncDeletedAt so the deletion
 * propagates to other devices; reads filter it out via notDeleted/isNotDeleted.
 */
export async function deleteTaxProfile(id: string): Promise<void> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_vehicle_tax_profiles");
    if (existing) {
      const list = JSON.parse(existing);
      const index = list.findIndex((p: any) => p.id === id);
      if (index !== -1) {
        list[index] = { ...list[index], ...softDeletePatch() };
        localStorage.setItem("comma_vehicle_tax_profiles", JSON.stringify(list));
      }
    }
    return;
  }
  await db.update(vehicleTaxProfiles).set(softDeletePatch()).where(eq(vehicleTaxProfiles.id, id));
}
