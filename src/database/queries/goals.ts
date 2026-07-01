import { db } from "../client";
import { goals, shifts, settings } from "../schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { Platform } from "react-native";
import { stampInsert, stampUpdate, softDeletePatch, notDeleted, isNotDeleted } from "../syncedWrites";

const isWeb = Platform.OS === "web";

function getPeriodDates(period: string, weekStartDay: number = 0): { start: Date; end: Date } {
  const start = new Date();
  const end = new Date();

  if (period === "daily") {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (period === "weekly") {
    const day = start.getDay();
    const diff = start.getDate() - ((day - weekStartDay + 7) % 7);
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);

    end.setTime(start.getTime());
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else if (period === "monthly") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    end.setMonth(start.getMonth() + 1);
    end.setDate(0);
    end.setHours(23, 59, 59, 999);
  } else if (period === "yearly") {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);

    end.setMonth(11, 31);
    end.setHours(23, 59, 59, 999);
  }

  return { start, end };
}

export async function getGoalsWithProgress(): Promise<any[]> {
  let weekStartDay = 0;
  
  if (isWeb) {
    try {
      const rawProfile = localStorage.getItem("comma_profile");
      if (rawProfile) {
        const profile = JSON.parse(rawProfile);
        if (profile.locale?.weekStartDay !== undefined) {
          weekStartDay = parseInt(profile.locale.weekStartDay, 10);
        }
      }
    } catch {}
    
    const existingGoals = localStorage.getItem("comma_goals");
    if (!existingGoals) return [];
    const goalsList = JSON.parse(existingGoals)
      .filter(isNotDeleted)
      .filter((g: any) => g.isActive);

    const existingShifts = localStorage.getItem("comma_shifts");
    const shiftsList = existingShifts ? JSON.parse(existingShifts).filter(isNotDeleted) : [];

    const results = [];
    for (const goal of goalsList) {
      const { start, end } = getPeriodDates(goal.period, weekStartDay);
      const filteredShifts = shiftsList.filter(
        (s: any) => new Date(s.startTime) >= start && new Date(s.startTime) <= end
      );

      let currentValue = 0;
      if (goal.unit === "currency") {
        currentValue = filteredShifts.reduce(
          (sum: number, s: any) => sum + (s.grossRevenue || 0) + (s.tipsRevenue || 0),
          0
        );
      } else if (goal.unit === "hours") {
        currentValue = filteredShifts.reduce((sum: number, s: any) => sum + (s.durationSeconds || 0), 0) / 3600.0;
      } else if (goal.unit === "shifts") {
        currentValue = filteredShifts.length;
      } else if (goal.unit === "mileage") {
        currentValue = filteredShifts.reduce((sum: number, s: any) => sum + (s.activeMileage || 0), 0);
      }

      results.push({
        ...goal,
        currentValue,
        progressPct: goal.targetValue > 0 ? (currentValue / goal.targetValue) * 100 : 0,
      });
    }
    return results;
  }

  // SQLite execution
  try {
    const rows = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "profile"))
      .limit(1);
    if (rows[0]?.value) {
      const profile = JSON.parse(rows[0].value);
      if (profile.locale?.weekStartDay !== undefined) {
        weekStartDay = parseInt(profile.locale.weekStartDay, 10);
      }
    }
  } catch (e) {
    console.warn("Failed to load settings profile for weekStartDay in getGoalsWithProgress:", e);
  }

  const activeGoals = await db
    .select()
    .from(goals)
    .where(and(eq(goals.isActive, true), notDeleted(goals.syncDeletedAt)));
  const results = [];

  for (const goal of activeGoals) {
    const { start, end } = getPeriodDates(goal.period, weekStartDay);
    let currentValue = 0;

    if (goal.unit === "currency") {
      const agg = await db
        .select({ value: sql<number>`COALESCE(SUM(${shifts.grossRevenue} + ${shifts.tipsRevenue}), 0)` })
        .from(shifts)
        .where(and(gte(shifts.startTime, start), lte(shifts.startTime, end), notDeleted(shifts.syncDeletedAt)));
      currentValue = agg[0]?.value || 0;
    } else if (goal.unit === "hours") {
      const agg = await db
        .select({ value: sql<number>`COALESCE(SUM(${shifts.durationSeconds}), 0)` })
        .from(shifts)
        .where(and(gte(shifts.startTime, start), lte(shifts.startTime, end), notDeleted(shifts.syncDeletedAt)));
      currentValue = (agg[0]?.value || 0) / 3600.0;
    } else if (goal.unit === "shifts") {
      const agg = await db
        .select({ value: sql<number>`COUNT(${shifts.id})` })
        .from(shifts)
        .where(and(gte(shifts.startTime, start), lte(shifts.startTime, end), notDeleted(shifts.syncDeletedAt)));
      currentValue = agg[0]?.value || 0;
    } else if (goal.unit === "mileage") {
      const agg = await db
        .select({ value: sql<number>`COALESCE(SUM(${shifts.activeMileage}), 0)` })
        .from(shifts)
        .where(and(gte(shifts.startTime, start), lte(shifts.startTime, end), notDeleted(shifts.syncDeletedAt)));
      currentValue = agg[0]?.value || 0;
    }

    results.push({
      ...goal,
      currentValue,
      progressPct: goal.targetValue > 0 ? (currentValue / goal.targetValue) * 100 : 0,
    });
  }

  return results;
}

export async function insertGoal(payload: typeof goals.$inferInsert): Promise<void> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_goals");
    const list = existing ? JSON.parse(existing) : [];
    list.push(stampInsert(payload));
    localStorage.setItem("comma_goals", JSON.stringify(list));
    return;
  }
  await db.insert(goals).values(stampInsert(payload));
}

export async function updateGoal(id: string, patch: Partial<typeof goals.$inferInsert>): Promise<void> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_goals");
    if (existing) {
      const list = JSON.parse(existing);
      const index = list.findIndex((g: any) => g.id === id);
      if (index !== -1) {
        list[index] = { ...list[index], ...patch, syncUpdatedAt: Date.now() };
        localStorage.setItem("comma_goals", JSON.stringify(list));
      }
    }
    return;
  }
  await db.update(goals).set(stampUpdate(patch)).where(eq(goals.id, id));
}

/**
 * Soft-delete (sync tombstone) — NOT a hard DELETE. Sets syncDeletedAt so the deletion
 * propagates to other devices; reads filter it out via notDeleted/isNotDeleted.
 */
export async function deleteGoal(id: string): Promise<void> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_goals");
    if (existing) {
      const list = JSON.parse(existing);
      const index = list.findIndex((g: any) => g.id === id);
      if (index !== -1) {
        list[index] = { ...list[index], ...softDeletePatch() };
        localStorage.setItem("comma_goals", JSON.stringify(list));
      }
    }
    return;
  }
  await db.update(goals).set(softDeletePatch()).where(eq(goals.id, id));
}
