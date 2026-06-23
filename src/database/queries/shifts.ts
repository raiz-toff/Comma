import { db } from "../client";
import { shifts } from "../schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { Platform } from "react-native";

const isWeb = Platform.OS === "web";

export async function insertShift(payload: typeof shifts.$inferInsert): Promise<void> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_shifts");
    const list = existing ? JSON.parse(existing) : [];
    list.push(payload);
    localStorage.setItem("comma_shifts", JSON.stringify(list));
    return;
  }
  await db.insert(shifts).values(payload);
}

export async function updateShift(id: string, payload: Partial<typeof shifts.$inferInsert>): Promise<void> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_shifts");
    if (existing) {
      const list = JSON.parse(existing);
      const index = list.findIndex((s: any) => s.id === id);
      if (index !== -1) {
        list[index] = { ...list[index], ...payload };
        localStorage.setItem("comma_shifts", JSON.stringify(list));
      }
    }
    return;
  }
  await db.update(shifts).set(payload).where(eq(shifts.id, id));
}

export async function getShiftsPaginated(
  page: number, 
  filters?: { startDate?: Date; endDate?: Date; platforms?: string[] }
): Promise<any[]> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_shifts");
    if (!existing) return [];
    let list = JSON.parse(existing);
    
    // Sort descending by default
    list.sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    
    // Simple pagination
    const limit = 20;
    const offset = (page - 1) * limit;
    return list.slice(offset, offset + limit);
  }

  const limit = 20;
  const offset = (page - 1) * limit;

  let queryConditions = [];
  if (filters?.startDate) {
    queryConditions.push(gte(shifts.startTime, filters.startDate));
  }
  if (filters?.endDate) {
    queryConditions.push(lte(shifts.startTime, filters.endDate));
  }

  // Note: Drizzle has limited in-array/contains for lists but we can filter simply:
  const baseQuery = db
    .select()
    .from(shifts);

  const query = queryConditions.length > 0 
    ? baseQuery.where(and(...queryConditions)) 
    : baseQuery;

  const results = await query
    .orderBy(desc(shifts.startTime))
    .limit(limit)
    .offset(offset);

  if (filters?.platforms && filters.platforms.length > 0) {
    return results.filter((r: typeof shifts.$inferSelect) => filters.platforms!.includes(r.platform));
  }
  return results;
}

export async function deleteShift(id: string): Promise<void> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_shifts");
    if (existing) {
      const list = JSON.parse(existing);
      const filtered = list.filter((s: any) => s.id !== id);
      localStorage.setItem("comma_shifts", JSON.stringify(filtered));
    }
    return;
  }
  await db.delete(shifts).where(eq(shifts.id, id));
}

export async function insertManyShifts(
  rows: (typeof shifts.$inferInsert)[]
): Promise<{ successCount: number; skippedCount: number }> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_shifts");
    const list = existing ? JSON.parse(existing) : [];
    list.push(...rows);
    localStorage.setItem("comma_shifts", JSON.stringify(list));
    return { successCount: rows.length, skippedCount: 0 };
  }
  
  if (rows.length === 0) return { successCount: 0, skippedCount: 0 };
  
  let successCount = 0;
  let skippedCount = 0;
  
  for (const row of rows) {
    try {
      await db.insert(shifts).values(row);
      successCount++;
    } catch (e) {
      skippedCount++;
    }
  }
  
  return { successCount, skippedCount };
}
