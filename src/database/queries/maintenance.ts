import { db } from "../client";
import { maintenanceLogs } from "../schema";
import { eq, desc } from "drizzle-orm";
import { Platform } from "react-native";

const isWeb = Platform.OS === "web";

export async function getMaintenanceLogs(vehicleId: string): Promise<any[]> {
  if (isWeb) {
    const existing = localStorage.getItem(`comma_maintenance_${vehicleId}`);
    return existing ? JSON.parse(existing) : [];
  }
  return await db
    .select()
    .from(maintenanceLogs)
    .where(eq(maintenanceLogs.vehicleId, vehicleId))
    .orderBy(desc(maintenanceLogs.date));
}

export async function insertMaintenanceLog(payload: typeof maintenanceLogs.$inferInsert): Promise<void> {
  if (isWeb) {
    const key = `comma_maintenance_${payload.vehicleId}`;
    const existing = localStorage.getItem(key);
    const list = existing ? JSON.parse(existing) : [];
    list.unshift(payload);
    localStorage.setItem(key, JSON.stringify(list));
    return;
  }
  await db.insert(maintenanceLogs).values(payload);
}

export async function deleteMaintenanceLog(id: string): Promise<void> {
  if (isWeb) {
    // Web implementation: scan all vehicle maintenance keys
    Object.keys(localStorage)
      .filter((k) => k.startsWith("comma_maintenance_"))
      .forEach((k) => {
        try {
          const list = JSON.parse(localStorage.getItem(k) || "[]");
          const filtered = list.filter((l: any) => l.id !== id);
          localStorage.setItem(k, JSON.stringify(filtered));
        } catch {}
      });
    return;
  }
  await db.delete(maintenanceLogs).where(eq(maintenanceLogs.id, id));
}
