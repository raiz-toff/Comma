import { desc, eq, isNull } from "drizzle-orm";
import { getDb, scheduleDbSave } from "../index";
import { vehicles } from "../schema";
import type { Vehicle } from "../schema";

export type { Vehicle };

export async function getVehicles(): Promise<Vehicle[]> {
  const db = await getDb();
  return db
    .select()
    .from(vehicles)
    .where(isNull(vehicles.syncDeletedAt))
    .orderBy(desc(vehicles.createdAt));
}

export async function insertVehicle(data: typeof vehicles.$inferInsert): Promise<void> {
  const db = await getDb();
  await db.insert(vehicles).values(data);
  scheduleDbSave();
}

export async function updateVehicle(id: string, data: Partial<typeof vehicles.$inferInsert>): Promise<void> {
  const db = await getDb();
  await db.update(vehicles).set({ ...data, syncUpdatedAt: Date.now() }).where(eq(vehicles.id, id));
  scheduleDbSave();
}

export async function softDeleteVehicle(id: string): Promise<void> {
  const db = await getDb();
  await db.update(vehicles).set({ syncDeletedAt: Date.now() }).where(eq(vehicles.id, id));
  scheduleDbSave();
}

export async function setActiveVehicle(id: string): Promise<void> {
  const db = await getDb();
  await db
    .update(vehicles)
    .set({ isActive: false, syncUpdatedAt: Date.now() })
    .where(isNull(vehicles.syncDeletedAt));
  await db
    .update(vehicles)
    .set({ isActive: true, syncUpdatedAt: Date.now() })
    .where(eq(vehicles.id, id));
  scheduleDbSave();
}
