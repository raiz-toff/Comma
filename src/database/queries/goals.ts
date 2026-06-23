import { db } from "../client";
import { goals, shifts } from "../schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { Platform } from "react-native";

const isWeb = Platform.OS === "web";

function getPeriodDates(period: string): { start: Date; end: Date } {
  const start = new Date();
  const end = new Date();

  if (period === "daily") {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (period === "weekly") {
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
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
  if (isWeb) {
    const existingGoals = localStorage.getItem("comma_goals");
    if (!existingGoals) return [];
    const goalsList = JSON.parse(existingGoals).filter((g: any) => g.isActive);

    const existingShifts = localStorage.getItem("comma_shifts");
    const shiftsList = existingShifts ? JSON.parse(existingShifts) : [];

    const results = [];
    for (const goal of goalsList) {
      const { start, end } = getPeriodDates(goal.period);
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
  const activeGoals = await db.select().from(goals).where(eq(goals.isActive, true));
  const results = [];

  for (const goal of activeGoals) {
    const { start, end } = getPeriodDates(goal.period);
    let currentValue = 0;

    if (goal.unit === "currency") {
      const agg = await db
        .select({ value: sql<number>`COALESCE(SUM(${shifts.grossRevenue} + ${shifts.tipsRevenue}), 0)` })
        .from(shifts)
        .where(and(gte(shifts.startTime, start), lte(shifts.startTime, end)));
      currentValue = agg[0]?.value || 0;
    } else if (goal.unit === "hours") {
      const agg = await db
        .select({ value: sql<number>`COALESCE(SUM(${shifts.durationSeconds}), 0)` })
        .from(shifts)
        .where(and(gte(shifts.startTime, start), lte(shifts.startTime, end)));
      currentValue = (agg[0]?.value || 0) / 3600.0;
    } else if (goal.unit === "shifts") {
      const agg = await db
        .select({ value: sql<number>`COUNT(${shifts.id})` })
        .from(shifts)
        .where(and(gte(shifts.startTime, start), lte(shifts.startTime, end)));
      currentValue = agg[0]?.value || 0;
    } else if (goal.unit === "mileage") {
      const agg = await db
        .select({ value: sql<number>`COALESCE(SUM(${shifts.activeMileage}), 0)` })
        .from(shifts)
        .where(and(gte(shifts.startTime, start), lte(shifts.startTime, end)));
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
    list.push(payload);
    localStorage.setItem("comma_goals", JSON.stringify(list));
    return;
  }
  await db.insert(goals).values(payload);
}

export async function deleteGoal(id: string): Promise<void> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_goals");
    if (existing) {
      const list = JSON.parse(existing);
      const filtered = list.filter((g: any) => g.id !== id);
      localStorage.setItem("comma_goals", JSON.stringify(filtered));
    }
    return;
  }
  await db.delete(goals).where(eq(goals.id, id));
}
