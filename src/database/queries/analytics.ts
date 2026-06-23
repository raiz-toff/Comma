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

// ─── Phase 5 Analytics Queries ─────────────────────────────────────────────

export async function getEarningsByPlatform(
  startDate: Date,
  endDate: Date
): Promise<{ platform: string; total: number; count: number; share: number }[]> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_shifts");
    if (!existing) return [];
    const list = JSON.parse(existing).filter(
      (s: any) => new Date(s.startTime) >= startDate && new Date(s.startTime) <= endDate
    );
    const map: Record<string, { total: number; count: number }> = {};
    list.forEach((s: any) => {
      if (!map[s.platform]) map[s.platform] = { total: 0, count: 0 };
      map[s.platform].total += (s.grossRevenue || 0) + (s.tipsRevenue || 0);
      map[s.platform].count++;
    });
    const grandTotal = Object.values(map).reduce((sum, v) => sum + v.total, 0);
    return Object.entries(map).map(([platform, v]) => ({
      platform,
      ...v,
      share: grandTotal > 0 ? (v.total / grandTotal) * 100 : 0,
    }));
  }

  const rows = await db
    .select({
      platform: shifts.platform,
      total: sql<number>`COALESCE(SUM(${shifts.grossRevenue} + ${shifts.tipsRevenue}), 0)`,
      count: sql<number>`COUNT(${shifts.id})`,
    })
    .from(shifts)
    .where(and(gte(shifts.startTime, startDate), lte(shifts.startTime, endDate)))
    .groupBy(shifts.platform)
    .orderBy(sql`2 DESC`);

  const grandTotal = rows.reduce((sum: number, r: any) => sum + r.total, 0);
  return rows.map((r: any) => ({
    ...r,
    share: grandTotal > 0 ? (r.total / grandTotal) * 100 : 0,
  }));
}

export async function getEarningsByDay(
  weeks: number
): Promise<{ date: string; total: number }[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - weeks * 7);
  startDate.setHours(0, 0, 0, 0);

  if (isWeb) {
    const existing = localStorage.getItem("comma_shifts");
    if (!existing) return [];
    const list = JSON.parse(existing).filter(
      (s: any) => new Date(s.startTime) >= startDate
    );
    const map: Record<string, number> = {};
    list.forEach((s: any) => {
      const dateKey = new Date(s.startTime).toISOString().substring(0, 10);
      map[dateKey] = (map[dateKey] || 0) + (s.grossRevenue || 0) + (s.tipsRevenue || 0);
    });
    return Object.entries(map)
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  const rows = await db
    .select({
      date: sql<string>`strftime('%Y-%m-%d', datetime(${shifts.startTime} / 1000, 'unixepoch'))`,
      total: sql<number>`COALESCE(SUM(${shifts.grossRevenue} + ${shifts.tipsRevenue}), 0)`,
    })
    .from(shifts)
    .where(gte(shifts.startTime, startDate))
    .groupBy(sql`strftime('%Y-%m-%d', datetime(${shifts.startTime} / 1000, 'unixepoch'))`)
    .orderBy(sql`1 ASC`);

  return rows;
}

export async function getHourlyRate(startDate: Date, endDate: Date): Promise<number> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_shifts");
    if (!existing) return 0;
    const list = JSON.parse(existing).filter(
      (s: any) => new Date(s.startTime) >= startDate && new Date(s.startTime) <= endDate
    );
    const totalEarnings = list.reduce((sum: number, s: any) => sum + (s.grossRevenue || 0) + (s.tipsRevenue || 0), 0);
    const totalSecs = list.reduce((sum: number, s: any) => sum + (s.durationSeconds || 0), 0);
    return totalSecs > 0 ? totalEarnings / (totalSecs / 3600) : 0;
  }

  const result = await db
    .select({
      totalEarnings: sql<number>`COALESCE(SUM(${shifts.grossRevenue} + ${shifts.tipsRevenue}), 0)`,
      totalSecs: sql<number>`COALESCE(SUM(${shifts.durationSeconds}), 0)`,
    })
    .from(shifts)
    .where(and(gte(shifts.startTime, startDate), lte(shifts.startTime, endDate)));

  const { totalEarnings, totalSecs } = result[0] || { totalEarnings: 0, totalSecs: 0 };
  return totalSecs > 0 ? totalEarnings / (totalSecs / 3600) : 0;
}

export async function getBestDayOfWeek(
  startDate: Date,
  endDate: Date
): Promise<{ day: number; label: string; avgEarnings: number }[]> {
  const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (isWeb) {
    const existing = localStorage.getItem("comma_shifts");
    if (!existing) return DAY_LABELS.map((label, day) => ({ day, label, avgEarnings: 0 }));
    const list = JSON.parse(existing).filter(
      (s: any) => new Date(s.startTime) >= startDate && new Date(s.startTime) <= endDate
    );
    const map: Record<number, { total: number; count: number }> = {};
    list.forEach((s: any) => {
      const dow = new Date(s.startTime).getDay();
      if (!map[dow]) map[dow] = { total: 0, count: 0 };
      map[dow].total += (s.grossRevenue || 0) + (s.tipsRevenue || 0);
      map[dow].count++;
    });
    return DAY_LABELS.map((label, day) => ({
      day,
      label,
      avgEarnings: map[day] ? map[day].total / map[day].count : 0,
    }));
  }

  const rows = await db
    .select({
      day: sql<number>`CAST(strftime('%w', datetime(${shifts.startTime} / 1000, 'unixepoch')) AS INTEGER)`,
      avgEarnings: sql<number>`AVG(${shifts.grossRevenue} + ${shifts.tipsRevenue})`,
    })
    .from(shifts)
    .where(and(gte(shifts.startTime, startDate), lte(shifts.startTime, endDate)))
    .groupBy(sql`strftime('%w', datetime(${shifts.startTime} / 1000, 'unixepoch'))`);

  return DAY_LABELS.map((label, day) => {
    const found = rows.find((r: any) => r.day === day);
    return { day, label, avgEarnings: found?.avgEarnings || 0 };
  });
}

export async function getBestHourOfDay(
  startDate: Date,
  endDate: Date
): Promise<{ hour: number; avgEarnings: number }[]> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_shifts");
    if (!existing) return Array.from({ length: 24 }, (_, h) => ({ hour: h, avgEarnings: 0 }));
    const list = JSON.parse(existing).filter(
      (s: any) => new Date(s.startTime) >= startDate && new Date(s.startTime) <= endDate
    );
    const map: Record<number, { total: number; count: number }> = {};
    list.forEach((s: any) => {
      const hour = new Date(s.startTime).getHours();
      if (!map[hour]) map[hour] = { total: 0, count: 0 };
      map[hour].total += (s.grossRevenue || 0) + (s.tipsRevenue || 0);
      map[hour].count++;
    });
    return Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      avgEarnings: map[h] ? map[h].total / map[h].count : 0,
    }));
  }

  const rows = await db
    .select({
      hour: sql<number>`CAST(strftime('%H', datetime(${shifts.startTime} / 1000, 'unixepoch')) AS INTEGER)`,
      avgEarnings: sql<number>`AVG(${shifts.grossRevenue} + ${shifts.tipsRevenue})`,
    })
    .from(shifts)
    .where(and(gte(shifts.startTime, startDate), lte(shifts.startTime, endDate)))
    .groupBy(sql`strftime('%H', datetime(${shifts.startTime} / 1000, 'unixepoch'))`);

  return Array.from({ length: 24 }, (_, h) => {
    const found = rows.find((r: any) => r.hour === h);
    return { hour: h, avgEarnings: found?.avgEarnings || 0 };
  });
}

export async function getMileageSplit(
  startDate: Date,
  endDate: Date
): Promise<{ active: number; dead: number; ratio: number }> {
  if (isWeb) {
    return { active: 0, dead: 0, ratio: 0 };
  }

  const result = await db
    .select({
      active: sql<number>`COALESCE(SUM(${shifts.activeMileage}), 0)`,
      dead: sql<number>`COALESCE(SUM(${shifts.deadMileage}), 0)`,
    })
    .from(shifts)
    .where(and(gte(shifts.startTime, startDate), lte(shifts.startTime, endDate)));

  const { active, dead } = result[0] || { active: 0, dead: 0 };
  const total = active + dead;
  return { active, dead, ratio: total > 0 ? (dead / total) * 100 : 0 };
}

export async function getNetIncome(startDate: Date, endDate: Date): Promise<number> {
  if (isWeb) return 0;

  const earningsResult = await db
    .select({
      total: sql<number>`COALESCE(SUM(${shifts.grossRevenue} + ${shifts.tipsRevenue}), 0)`,
    })
    .from(shifts)
    .where(and(gte(shifts.startTime, startDate), lte(shifts.startTime, endDate)));

  const { expenses } = await import("../schema");
  const expensesResult = await db
    .select({
      total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)`,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.isDeductible, true),
        gte(expenses.date, startDate),
        lte(expenses.date, endDate)
      )
    );

  return (earningsResult[0]?.total || 0) - (expensesResult[0]?.total || 0);
}

export async function getPeriodStats(
  startDate: Date,
  endDate: Date
): Promise<{ gross: number; tips: number; count: number; activeMileage: number; deadMileage: number; durationSeconds: number }> {
  if (isWeb) {
    return { gross: 0, tips: 0, count: 0, activeMileage: 0, deadMileage: 0, durationSeconds: 0 };
  }

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
    .where(and(gte(shifts.startTime, startDate), lte(shifts.startTime, endDate)));

  return result[0] || { gross: 0, tips: 0, count: 0, activeMileage: 0, deadMileage: 0, durationSeconds: 0 };
}
