import { db } from "../client";
import { maintenanceLogs } from "../schema";
import { eq, and, desc } from "drizzle-orm";
import { Platform } from "react-native";
import { stampInsert, softDeletePatch, notDeleted, isNotDeleted } from "../syncedWrites";

const isWeb = Platform.OS === "web";

export async function getMaintenanceLogs(vehicleId: string): Promise<any[]> {
  if (isWeb) {
    const existing = localStorage.getItem(`comma_maintenance_${vehicleId}`);
    return existing ? JSON.parse(existing).filter(isNotDeleted) : [];
  }
  return await db
    .select()
    .from(maintenanceLogs)
    .where(and(eq(maintenanceLogs.vehicleId, vehicleId), notDeleted(maintenanceLogs.syncDeletedAt)))
    .orderBy(desc(maintenanceLogs.date));
}

export async function insertMaintenanceLog(payload: typeof maintenanceLogs.$inferInsert): Promise<void> {
  if (isWeb) {
    const key = `comma_maintenance_${payload.vehicleId}`;
    const existing = localStorage.getItem(key);
    const list = existing ? JSON.parse(existing) : [];
    list.unshift(stampInsert(payload));
    localStorage.setItem(key, JSON.stringify(list));
    return;
  }
  await db.insert(maintenanceLogs).values(stampInsert(payload));
}

/**
 * Soft-delete (sync tombstone) — NOT a hard DELETE. Sets syncDeletedAt so the deletion
 * propagates to other devices; reads filter it out via notDeleted/isNotDeleted.
 */
export async function deleteMaintenanceLog(id: string): Promise<void> {
  if (isWeb) {
    // Web implementation: scan all vehicle maintenance keys, soft-delete the matching row.
    Object.keys(localStorage)
      .filter((k) => k.startsWith("comma_maintenance_"))
      .forEach((k) => {
        try {
          const list = JSON.parse(localStorage.getItem(k) || "[]");
          const index = list.findIndex((l: any) => l.id === id);
          if (index !== -1) {
            list[index] = { ...list[index], ...softDeletePatch() };
            localStorage.setItem(k, JSON.stringify(list));
          }
        } catch {}
      });
    return;
  }
  await db.update(maintenanceLogs).set(softDeletePatch()).where(eq(maintenanceLogs.id, id));
}
