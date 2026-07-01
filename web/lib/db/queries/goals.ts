import { eq, and, isNull } from "drizzle-orm";
import { getDb, scheduleDbSave } from "../index";
import { goals, shifts, expenses } from "../schema";
import type { Goal } from "../schema";
import { getStatsForRange } from "./analytics";

export type { Goal };

export async function getActiveGoals(): Promise<Goal[]> {
  const db = await getDb();
  return db
    .select()
    .from(goals)
    .where(and(eq(goals.isActive, true), isNull(goals.syncDeletedAt)));
}

export async function getAllGoals(): Promise<Goal[]> {
  const db = await getDb();
  return db.select().from(goals).where(isNull(goals.syncDeletedAt));
}

export async function insertGoal(data: typeof goals.$inferInsert): Promise<void> {
  const db = await getDb();
  await db.insert(goals).values(data);
  scheduleDbSave();
}

export async function updateGoal(id: string, data: Partial<typeof goals.$inferInsert>): Promise<void> {
  const db = await getDb();
  await db.update(goals).set({ ...data, syncUpdatedAt: Date.now() }).where(eq(goals.id, id));
  scheduleDbSave();
}

export async function softDeleteGoal(id: string): Promise<void> {
  const db = await getDb();
  await db.update(goals).set({ syncDeletedAt: Date.now() }).where(eq(goals.id, id));
  scheduleDbSave();
}

function getPeriodRange(period: string): { start: Date; end: Date } {
  const now = new Date();
  switch (period) {
    case "daily": {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { start, end: new Date(start.getTime() + 86400000) };
    }
    case "weekly": {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      return { start, end: new Date(start.getTime() + 7 * 86400000) };
    }
    case "monthly": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start, end: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
    }
    case "yearly": {
      const start = new Date(now.getFullYear(), 0, 1);
      return { start, end: new Date(now.getFullYear() + 1, 0, 1) };
    }
    default:
      return { start: new Date(0), end: new Date() };
  }
}

export async function getGoalProgress(goal: Goal): Promise<number> {
  const { start, end } = getPeriodRange(goal.period);
  const stats = await getStatsForRange(start, end);

  switch (goal.unit) {
    case "currency": return stats.totalEarnings;
    case "hours": return stats.totalHours;
    case "shifts": return stats.shiftCount;
    case "mileage": return stats.totalMileage;
    default: return 0;
  }
}
