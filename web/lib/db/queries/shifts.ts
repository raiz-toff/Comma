import { desc, eq, and, gte, lte, isNull, sql } from "drizzle-orm";
import { getDb, scheduleDbSave } from "../index";
import { shifts, shiftPlatforms } from "../schema";
import type { Shift } from "../schema";

export type { Shift };

export async function getShiftsPaginated(
  limit = 30,
  offset = 0,
  filters?: { platform?: string; startDate?: Date; endDate?: Date }
): Promise<Shift[]> {
  const db = await getDb();
  const conditions = [isNull(shifts.syncDeletedAt)];
  if (filters?.platform) conditions.push(eq(shifts.platform, filters.platform));
  if (filters?.startDate) conditions.push(gte(shifts.startTime, filters.startDate));
  if (filters?.endDate) conditions.push(lte(shifts.startTime, filters.endDate));

  return db
    .select()
    .from(shifts)
    .where(and(...conditions))
    .orderBy(desc(shifts.startTime))
    .limit(limit)
    .offset(offset);
}

export async function getShiftById(id: string): Promise<Shift | null> {
  const db = await getDb();
  const rows = await db.select().from(shifts).where(eq(shifts.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function insertShift(data: typeof shifts.$inferInsert): Promise<void> {
  const db = await getDb();
  await db.insert(shifts).values(data);
  scheduleDbSave();
}

export async function updateShift(id: string, data: Partial<typeof shifts.$inferInsert>): Promise<void> {
  const db = await getDb();
  await db.update(shifts).set({ ...data, syncUpdatedAt: Date.now() }).where(eq(shifts.id, id));
  scheduleDbSave();
}

export async function softDeleteShift(id: string): Promise<void> {
  const db = await getDb();
  await db.update(shifts).set({ syncDeletedAt: Date.now() }).where(eq(shifts.id, id));
  scheduleDbSave();
}

export async function getShiftWithPlatforms(shiftId: string) {
  const db = await getDb();
  const shift = await getShiftById(shiftId);
  if (!shift) return null;
  const platforms = await db
    .select()
    .from(shiftPlatforms)
    .where(and(eq(shiftPlatforms.shiftId, shiftId), isNull(shiftPlatforms.syncDeletedAt)));
  return { ...shift, platforms };
}

export async function getTotalShiftsCount(): Promise<number> {
  const db = await getDb();
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(shifts)
    .where(isNull(shifts.syncDeletedAt));
  return result[0]?.count ?? 0;
}
