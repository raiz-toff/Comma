import { db } from "../client";
import { vehicles, shifts } from "../schema";
import { eq, sql } from "drizzle-orm";
import { Platform } from "react-native";

const isWeb = Platform.OS === "web";

export async function getVehicles(): Promise<any[]> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_vehicles");
    return existing ? JSON.parse(existing) : [];
  }
  return await db.select().from(vehicles);
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
    .where(eq(shifts.vehicleId, vehicleId));
    
  return result[0] || { totalShifts: 0, totalActiveMileage: 0 };
}

export async function insertVehicle(payload: typeof vehicles.$inferInsert): Promise<void> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_vehicles");
    const list = existing ? JSON.parse(existing) : [];
    list.push(payload);
    localStorage.setItem("comma_vehicles", JSON.stringify(list));
    return;
  }
  await db.insert(vehicles).values(payload);
}

export async function updateVehicle(id: string, payload: Partial<typeof vehicles.$inferInsert>): Promise<void> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_vehicles");
    if (existing) {
      const list = JSON.parse(existing);
      const index = list.findIndex((v: any) => v.id === id);
      if (index !== -1) {
        list[index] = { ...list[index], ...payload };
        localStorage.setItem("comma_vehicles", JSON.stringify(list));
      }
    }
    return;
  }
  await db.update(vehicles).set(payload).where(eq(vehicles.id, id));
}

export async function deleteVehicle(id: string): Promise<void> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_vehicles");
    if (existing) {
      const list = JSON.parse(existing);
      const filtered = list.filter((v: any) => v.id !== id);
      localStorage.setItem("comma_vehicles", JSON.stringify(filtered));
    }
    return;
  }
  await db.delete(vehicles).where(eq(vehicles.id, id));
}
