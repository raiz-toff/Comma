import { db } from "../client";
import { vehicleTaxProfiles } from "../schema";
import { eq, and } from "drizzle-orm";
import { Platform } from "react-native";
import { stampInsert, stampUpdate, softDeletePatch, notDeleted, isNotDeleted } from "../syncedWrites";

const isWeb = Platform.OS === "web";

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
