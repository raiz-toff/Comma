import { db } from "../client";
import { vehicleTaxProfiles } from "../schema";
import { eq, and } from "drizzle-orm";
import { Platform } from "react-native";

const isWeb = Platform.OS === "web";

export async function getTaxProfilesForVehicle(vehicleId: string): Promise<any[]> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_vehicle_tax_profiles");
    if (!existing) return [];
    const list = JSON.parse(existing);
    return list.filter((p: any) => p.vehicleId === vehicleId);
  }
  return await db.select().from(vehicleTaxProfiles).where(eq(vehicleTaxProfiles.vehicleId, vehicleId));
}

export async function getTaxProfileForVehicleYear(vehicleId: string, year: number): Promise<any | null> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_vehicle_tax_profiles");
    if (!existing) return null;
    const list = JSON.parse(existing);
    return list.find((p: any) => p.vehicleId === vehicleId && p.taxYear === year) || null;
  }
  const result = await db
    .select()
    .from(vehicleTaxProfiles)
    .where(and(eq(vehicleTaxProfiles.vehicleId, vehicleId), eq(vehicleTaxProfiles.taxYear, year)))
    .limit(1);
  return result[0] || null;
}

export async function upsertTaxProfile(payload: typeof vehicleTaxProfiles.$inferInsert): Promise<void> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_vehicle_tax_profiles");
    const list = existing ? JSON.parse(existing) : [];
    const idx = list.findIndex((p: any) => p.vehicleId === payload.vehicleId && p.taxYear === payload.taxYear);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...payload };
    } else {
      list.push(payload);
    }
    localStorage.setItem("comma_vehicle_tax_profiles", JSON.stringify(list));
    return;
  }
  
  const existing = await db
    .select({ id: vehicleTaxProfiles.id })
    .from(vehicleTaxProfiles)
    .where(and(eq(vehicleTaxProfiles.vehicleId, payload.vehicleId), eq(vehicleTaxProfiles.taxYear, payload.taxYear)))
    .limit(1);
    
  if (existing.length > 0) {
    await db.update(vehicleTaxProfiles).set(payload).where(eq(vehicleTaxProfiles.id, existing[0].id));
  } else {
    await db.insert(vehicleTaxProfiles).values(payload);
  }
}

export async function deleteTaxProfile(id: string): Promise<void> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_vehicle_tax_profiles");
    if (existing) {
      const list = JSON.parse(existing);
      const filtered = list.filter((p: any) => p.id !== id);
      localStorage.setItem("comma_vehicle_tax_profiles", JSON.stringify(filtered));
    }
    return;
  }
  await db.delete(vehicleTaxProfiles).where(eq(vehicleTaxProfiles.id, id));
}
