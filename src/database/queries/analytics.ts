import { db } from "../client";
import { shifts, vehicles, settings, goals } from "../schema";
import { and, gte, lte, eq, sql } from "drizzle-orm";
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

export async function getTodayStats(): Promise<{ gross: number; tips: number; count: number; activeMileage: number; deadMileage: number }> {
  if (isWeb) {
    return { gross: 0, tips: 0, count: 0, activeMileage: 0, deadMileage: 0 };
  }

  const { start, end } = getPeriodDates("daily");

  const result = await db
    .select({
      gross: sql<number>`COALESCE(SUM(${shifts.grossRevenue}), 0)`,
      tips: sql<number>`COALESCE(SUM(${shifts.tipsRevenue}), 0)`,
      count: sql<number>`COUNT(${shifts.id})`,
      activeMileage: sql<number>`COALESCE(SUM(${shifts.activeMileage}), 0)`,
      deadMileage: sql<number>`COALESCE(SUM(${shifts.deadMileage}), 0)`,
    })
    .from(shifts)
    .where(and(gte(shifts.startTime, start), lte(shifts.startTime, end)));

  return result[0] || { gross: 0, tips: 0, count: 0, activeMileage: 0, deadMileage: 0 };
}

export async function getWeekStats(): Promise<{ gross: number; tips: number; count: number; activeMileage: number; deadMileage: number; durationSeconds: number }> {
  if (isWeb) {
    return { gross: 0, tips: 0, count: 0, activeMileage: 0, deadMileage: 0, durationSeconds: 0 };
  }

  const { start, end } = getPeriodDates("weekly");

  const result = await db
    .select({
      gross: sql<number>`COALESCE(SUM(${shifts.grossRevenue}), 0)`,
      tips: sql<number>`COALESCE(SUM(${shifts.tipsRevenue}), 0)`,
      count: sql<number>`COUNT(${shifts.id})`,
      activeMileage: sql<number>`COALESCE(SUM(${shifts.activeMileage}), 0)`,
      deadMileage: sql<number>`COALESCE(SUM(${shifts.deadMileage}), 0)`,
      durationSeconds: sql<number>`COALESCE(SUM(${shifts.durationSeconds}), 0)`,
    })
    .from(shifts)
    .where(and(gte(shifts.startTime, start), lte(shifts.startTime, end)));

  return result[0] || { gross: 0, tips: 0, count: 0, activeMileage: 0, deadMileage: 0, durationSeconds: 0 };
}

export async function getActiveVehicle(): Promise<any> {
  if (isWeb) {
    return null;
  }

  const activeVehicleIdRow = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "active_vehicle_id"))
    .limit(1);

  const vehicleId = activeVehicleIdRow[0]?.value;

  if (!vehicleId) {
    const fallbackActiveRow = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.isActive, true))
      .limit(1);
    return fallbackActiveRow[0] || null;
  }

  const vehicleRow = await db
    .select()
    .from(vehicles)
    .where(eq(vehicles.id, vehicleId))
    .limit(1);

  return vehicleRow[0] || null;
}

export async function getGoalProgress(period: string): Promise<any[]> {
  if (isWeb) {
    return [];
  }

  const activeGoals = await db
    .select()
    .from(goals)
    .where(and(eq(goals.period, period), eq(goals.isActive, true)));

  const results = [];
  const { start, end } = getPeriodDates(period);

  for (const goal of activeGoals) {
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

    const progressPct = goal.targetValue > 0 ? (currentValue / goal.targetValue) * 100 : 0;
    
    results.push({
      ...goal,
      currentValue,
      progressPct: Math.min(progressPct, 100),
    });
  }

  return results;
}

// Shell functions for remaining analytics queries (to be implemented in Phase 5)
export async function getEarningsByPlatform(startDate: Date, endDate: Date): Promise<any[]> {
  return [];
}

export async function getEarningsByDay(weeks: number): Promise<any[]> {
  return [];
}

export async function getHourlyRate(startDate: Date, endDate: Date): Promise<number> {
  return 0;
}

export async function getBestDayOfWeek(startDate: Date, endDate: Date): Promise<number> {
  return 0;
}

export async function getBestHourOfDay(startDate: Date, endDate: Date): Promise<number> {
  return 0;
}

export async function getMileageSplit(startDate: Date, endDate: Date): Promise<{ active: number; dead: number; ratio: number }> {
  return { active: 0, dead: 0, ratio: 0 };
}

export async function getNetIncome(startDate: Date, endDate: Date): Promise<number> {
  return 0;
}
