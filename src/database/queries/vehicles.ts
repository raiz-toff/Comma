import { db } from "../client";
import { vehicles, shifts } from "../schema";
import { eq, sql, and } from "drizzle-orm";
import { Platform } from "react-native";
import { stampInsert, stampUpdate, softDeletePatch, notDeleted, isNotDeleted } from "../syncedWrites";

const isWeb = Platform.OS === "web";

export async function getVehicles(): Promise<any[]> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_vehicles");
    return existing ? JSON.parse(existing).filter(isNotDeleted) : [];
  }
  return await db.select().from(vehicles).where(notDeleted(vehicles.syncDeletedAt));
}

export async function getVehicleById(id: string): Promise<any | null> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_vehicles");
    if (!existing) return null;
    const list = JSON.parse(existing);
    const found = list.find((v: any) => v.id === id);
    return found && isNotDeleted(found) ? found : null;
  }
  const result = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.id, id), notDeleted(vehicles.syncDeletedAt)))
    .limit(1);
  return result[0] || null;
}

export async function getVehicleStats(vehicleId: string): Promise<{ totalShifts: number; totalActiveMileage: number }> {
  if (isWeb) {
    return { totalShifts: 0, totalActiveMileage: 0 };
  }
  
  const result = await db
    .select({
      totalShifts: sql<number>`COUNT(${shifts.id})`,
      totalActiveMileage: sql<number>`COALESCE(SUM(${shifts.activeMileage}), 0)`,
    })
    .from(shifts)
    .where(and(eq(shifts.vehicleId, vehicleId), notDeleted(shifts.syncDeletedAt)));

  return result[0] || { totalShifts: 0, totalActiveMileage: 0 };
}

export async function insertVehicle(payload: typeof vehicles.$inferInsert): Promise<void> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_vehicles");
    const list = existing ? JSON.parse(existing) : [];
    list.push(stampInsert(payload));
    localStorage.setItem("comma_vehicles", JSON.stringify(list));
    return;
  }
  await db.insert(vehicles).values(stampInsert(payload));
}

export async function updateVehicle(id: string, payload: Partial<typeof vehicles.$inferInsert>): Promise<void> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_vehicles");
    if (existing) {
      const list = JSON.parse(existing);
      const index = list.findIndex((v: any) => v.id === id);
      if (index !== -1) {
        list[index] = { ...list[index], ...stampUpdate(payload) };
        localStorage.setItem("comma_vehicles", JSON.stringify(list));
      }
    }
    return;
  }
  await db.update(vehicles).set(stampUpdate(payload)).where(eq(vehicles.id, id));
}

/**
 * Soft-delete (sync tombstone) — NOT a hard DELETE. Sets syncDeletedAt so the deletion
 * propagates to other devices; reads filter it out via notDeleted/isNotDeleted.
 */
export async function deleteVehicle(id: string): Promise<void> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_vehicles");
    if (existing) {
      const list = JSON.parse(existing);
      const index = list.findIndex((v: any) => v.id === id);
      if (index !== -1) {
        list[index] = { ...list[index], ...softDeletePatch() };
        localStorage.setItem("comma_vehicles", JSON.stringify(list));
      }
    }
    return;
  }
  await db.update(vehicles).set(softDeletePatch()).where(eq(vehicles.id, id));
}
