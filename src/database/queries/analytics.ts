import { db } from "../client";
import { shifts, vehicles, settings, goals, expenses } from "../schema";
import { and, gte, lte, eq, sql, inArray, like, or, type SQL } from "drizzle-orm";
import { Platform } from "react-native";
import { getGoalsWithProgress } from "./goals";
import { notDeleted } from "../syncedWrites";

function matchesPlatformWeb(platformField: string | null | undefined, filterPlatform: string): boolean {
  if (!platformField) return false;
  const parts = filterPlatform.split(",");
  return parts.some((p) => platformField.includes(p));
}

// Always called with a non-empty platform string (call sites guard `platform && platform !== "all"`),
// so the result is always a defined SQL fragment. The `!` narrows `or()`'s `SQL | undefined` return
// so the conditions arrays stay `SQL[]` and compose cleanly into `and(...)`.
function getPlatformConditions(platform: string): SQL {
  const parts = platform.split(",");
  if (parts.length > 1) {
    return or(...parts.map((p) => like(shifts.platform, `%${p}%`)))!;
  }
  return like(shifts.platform, `%${platform}%`);
}


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

export async function getTodayStats(platform?: string): Promise<{ gross: number; tips: number; bonus: number; count: number; activeMileage: number; deadMileage: number }> {
  if (isWeb) {
    try {
      const existing = localStorage.getItem("comma_shifts");
      if (!existing) return { gross: 0, tips: 0, bonus: 0, count: 0, activeMileage: 0, deadMileage: 0 };
      let list = JSON.parse(existing);
      const { start, end } = getPeriodDates("daily");

      list = list.filter((s: any) => {
        const d = new Date(s.startTime);
        return d >= start && d <= end;
      });

      if (platform && platform !== "all") {
        list = list.filter((s: any) => matchesPlatformWeb(s.platform, platform));
      }

      let gross = 0, tips = 0, bonus = 0, activeMileage = 0, deadMileage = 0;
      list.forEach((s: any) => {
        gross += Number(s.grossRevenue || 0);
        tips += Number(s.tipsRevenue || 0);
        bonus += Number(s.bonusAmount || 0);
        activeMileage += Number(s.activeMileage || 0);
        deadMileage += Number(s.deadMileage || 0);
      });
      return { gross, tips, bonus, count: list.length, activeMileage, deadMileage };
    } catch {
      return { gross: 0, tips: 0, bonus: 0, count: 0, activeMileage: 0, deadMileage: 0 };
    }
  }

  const { start, end } = getPeriodDates("daily");
  const conditions = [notDeleted(shifts.syncDeletedAt), gte(shifts.startTime, start), lte(shifts.startTime, end)];
  if (platform && platform !== "all") {
    conditions.push(getPlatformConditions(platform));
  }

  const result = await db
    .select({
      gross: sql<number>`COALESCE(SUM(${shifts.grossRevenue}), 0)`,
      tips: sql<number>`COALESCE(SUM(${shifts.tipsRevenue}), 0)`,
      bonus: sql<number>`COALESCE(SUM(${shifts.bonusAmount}), 0)`,
      count: sql<number>`COUNT(${shifts.id})`,
      activeMileage: sql<number>`COALESCE(SUM(${shifts.activeMileage}), 0)`,
      deadMileage: sql<number>`COALESCE(SUM(${shifts.deadMileage}), 0)`,
    })
    .from(shifts)
    .where(and(...conditions));

  return result[0] || { gross: 0, tips: 0, bonus: 0, count: 0, activeMileage: 0, deadMileage: 0 };
}

export async function getWeekStats(platform?: string): Promise<{ gross: number; tips: number; bonus: number; count: number; activeMileage: number; deadMileage: number; durationSeconds: number }> {
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

    try {
      const existing = localStorage.getItem("comma_shifts");
      if (!existing) return { gross: 0, tips: 0, bonus: 0, count: 0, activeMileage: 0, deadMileage: 0, durationSeconds: 0 };
      let list = JSON.parse(existing);
      const { start, end } = getPeriodDates("weekly", weekStartDay);

      list = list.filter((s: any) => {
        const d = new Date(s.startTime);
        return d >= start && d <= end;
      });

      if (platform && platform !== "all") {
        list = list.filter((s: any) => matchesPlatformWeb(s.platform, platform));
      }

      let gross = 0, tips = 0, bonus = 0, activeMileage = 0, deadMileage = 0, durationSeconds = 0;
      list.forEach((s: any) => {
        gross += Number(s.grossRevenue || 0);
        tips += Number(s.tipsRevenue || 0);
        bonus += Number(s.bonusAmount || 0);
        activeMileage += Number(s.activeMileage || 0);
        deadMileage += Number(s.deadMileage || 0);
        durationSeconds += Number(s.durationSeconds || 0);
      });
      return { gross, tips, bonus, count: list.length, activeMileage, deadMileage, durationSeconds };
    } catch {
      return { gross: 0, tips: 0, bonus: 0, count: 0, activeMileage: 0, deadMileage: 0, durationSeconds: 0 };
    }
  }

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
  } catch {}

  const { start, end } = getPeriodDates("weekly", weekStartDay);
  const conditions = [notDeleted(shifts.syncDeletedAt), gte(shifts.startTime, start), lte(shifts.startTime, end)];
  if (platform && platform !== "all") {
    conditions.push(getPlatformConditions(platform));
  }

  const result = await db
    .select({
      gross: sql<number>`COALESCE(SUM(${shifts.grossRevenue}), 0)`,
      tips: sql<number>`COALESCE(SUM(${shifts.tipsRevenue}), 0)`,
      bonus: sql<number>`COALESCE(SUM(${shifts.bonusAmount}), 0)`,
      count: sql<number>`COUNT(${shifts.id})`,
      activeMileage: sql<number>`COALESCE(SUM(${shifts.activeMileage}), 0)`,
      deadMileage: sql<number>`COALESCE(SUM(${shifts.deadMileage}), 0)`,
      durationSeconds: sql<number>`COALESCE(SUM(${shifts.durationSeconds}), 0)`,
    })
    .from(shifts)
    .where(and(...conditions));

  return result[0] || { gross: 0, tips: 0, bonus: 0, count: 0, activeMileage: 0, deadMileage: 0, durationSeconds: 0 };
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
      .where(and(notDeleted(vehicles.syncDeletedAt), eq(vehicles.isActive, true)))
      .limit(1);
    return fallbackActiveRow[0] || null;
  }

  const vehicleRow = await db
    .select()
    .from(vehicles)
    .where(and(notDeleted(vehicles.syncDeletedAt), eq(vehicles.id, vehicleId)))
    .limit(1);

  return vehicleRow[0] || null;
}

export async function getGoalProgress(period: string): Promise<any[]> {
  const allGoals = await getGoalsWithProgress();
  return allGoals
    .filter((g) => g.period === period)
    .map((g) => ({
      ...g,
      progressPct: Math.min(g.progressPct, 100),
    }));
}

// ─── Phase 5 Analytics Queries ─────────────────────────────────────────────

export async function getEarningsByPlatform(
  startDate: Date,
  endDate: Date,
  platform?: string | null
): Promise<{ platform: string; total: number; count: number; share: number }[]> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_shifts");
    if (!existing) return [];
    let list = JSON.parse(existing).filter(
      (s: any) => new Date(s.startTime) >= startDate && new Date(s.startTime) <= endDate
    );
    if (platform && platform !== "all") {
        list = list.filter((s: any) => matchesPlatformWeb(s.platform, platform));
      }
    const map: Record<string, { total: number; count: number }> = {};
    list.forEach((s: any) => {
      if (!map[s.platform]) map[s.platform] = { total: 0, count: 0 };
      map[s.platform].total += (s.grossRevenue || 0) + (s.tipsRevenue || 0) + (s.bonusAmount || 0);
      map[s.platform].count++;
    });
    const grandTotal = Object.values(map).reduce((sum, v) => sum + v.total, 0);
    return Object.entries(map).map(([platformName, v]) => ({
      platform: platformName,
      ...v,
      share: grandTotal > 0 ? (v.total / grandTotal) * 100 : 0,
    }));
  }

  const conditions = [notDeleted(shifts.syncDeletedAt), gte(shifts.startTime, startDate), lte(shifts.startTime, endDate)];
  if (platform && platform !== "all") {
    conditions.push(getPlatformConditions(platform));
  }

  const rows = await db
    .select({
      platform: shifts.platform,
      total: sql<number>`COALESCE(SUM(${shifts.grossRevenue} + ${shifts.tipsRevenue} + ${shifts.bonusAmount}), 0)`,
      count: sql<number>`COUNT(${shifts.id})`,
    })
    .from(shifts)
    .where(and(...conditions))
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
      map[dateKey] = (map[dateKey] || 0) + (s.grossRevenue || 0) + (s.tipsRevenue || 0) + (s.bonusAmount || 0);
    });
    return Object.entries(map)
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  const rows = await db
    .select({
      date: sql<string>`strftime('%Y-%m-%d', datetime(${shifts.startTime}, 'unixepoch', 'localtime'))`,
      total: sql<number>`COALESCE(SUM(${shifts.grossRevenue} + ${shifts.tipsRevenue} + ${shifts.bonusAmount}), 0)`,
    })
    .from(shifts)
    .where(and(notDeleted(shifts.syncDeletedAt), gte(shifts.startTime, startDate)))
    .groupBy(sql`strftime('%Y-%m-%d', datetime(${shifts.startTime}, 'unixepoch', 'localtime'))`)
    .orderBy(sql`1 ASC`);

  return rows;
}

export async function getEarningsByDayRange(
  startDate: Date,
  endDate: Date,
  platform?: string | null
): Promise<{ date: string; total: number }[]> {
  const result: { date: string; total: number }[] = [];
  
  // Create a map to zero-fill every day in the range
  const dateMap = new Map<string, number>();
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (current <= end) {
    // format as YYYY-MM-DD
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, "0");
    const dd = String(current.getDate()).padStart(2, "0");
    const dateKey = `${yyyy}-${mm}-${dd}`;
    dateMap.set(dateKey, 0);
    current.setDate(current.getDate() + 1);
  }

  if (isWeb) {
    const existing = localStorage.getItem("comma_shifts");
    if (existing) {
      let list = JSON.parse(existing).filter(
        (s: any) => new Date(s.startTime) >= startDate && new Date(s.startTime) <= endDate
      );
      if (platform && platform !== "all") {
        list = list.filter((s: any) => matchesPlatformWeb(s.platform, platform));
      }
      list.forEach((s: any) => {
        const d = new Date(s.startTime);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const dateKey = `${yyyy}-${mm}-${dd}`;
        
        if (dateMap.has(dateKey)) {
          dateMap.set(dateKey, dateMap.get(dateKey)! + (s.grossRevenue || 0) + (s.tipsRevenue || 0) + (s.bonusAmount || 0));
        }
      });
    }
  } else {
    const conditions = [notDeleted(shifts.syncDeletedAt), gte(shifts.startTime, startDate), lte(shifts.startTime, endDate)];
    if (platform && platform !== "all") {
    conditions.push(getPlatformConditions(platform));
  }

    const rows = await db
      .select({
        date: sql<string>`strftime('%Y-%m-%d', datetime(${shifts.startTime}, 'unixepoch', 'localtime'))`,
        total: sql<number>`COALESCE(SUM(${shifts.grossRevenue} + ${shifts.tipsRevenue} + ${shifts.bonusAmount}), 0)`,
      })
      .from(shifts)
      .where(and(...conditions))
      .groupBy(sql`strftime('%Y-%m-%d', datetime(${shifts.startTime}, 'unixepoch', 'localtime'))`)
      .orderBy(sql`1 ASC`);

    for (const r of rows) {
      if (dateMap.has(r.date)) {
        dateMap.set(r.date, r.total);
      }
    }
  }

  // Convert map back to sorted array
  dateMap.forEach((total, date) => {
    result.push({ date, total });
  });

  return result.sort((a, b) => a.date.localeCompare(b.date));
}

export async function getHourlyRate(startDate: Date, endDate: Date, platform?: string | null): Promise<number> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_shifts");
    if (!existing) return 0;
    let list = JSON.parse(existing).filter(
      (s: any) => new Date(s.startTime) >= startDate && new Date(s.startTime) <= endDate
    );
    if (platform && platform !== "all") {
        list = list.filter((s: any) => matchesPlatformWeb(s.platform, platform));
      }
    const totalEarnings = list.reduce((sum: number, s: any) => sum + (s.grossRevenue || 0) + (s.tipsRevenue || 0) + (s.bonusAmount || 0), 0);
    const totalSecs = list.reduce((sum: number, s: any) => sum + (s.durationSeconds || 0), 0);
    return totalSecs > 0 ? totalEarnings / (totalSecs / 3600) : 0;
  }

  const conditions = [notDeleted(shifts.syncDeletedAt), gte(shifts.startTime, startDate), lte(shifts.startTime, endDate)];
  if (platform && platform !== "all") {
    conditions.push(getPlatformConditions(platform));
  }

  const result = await db
    .select({
      totalEarnings: sql<number>`COALESCE(SUM(${shifts.grossRevenue} + ${shifts.tipsRevenue} + ${shifts.bonusAmount}), 0)`,
      totalSecs: sql<number>`COALESCE(SUM(${shifts.durationSeconds}), 0)`,
    })
    .from(shifts)
    .where(and(...conditions));

  const { totalEarnings, totalSecs } = result[0] || { totalEarnings: 0, totalSecs: 0 };
  return totalSecs > 0 ? totalEarnings / (totalSecs / 3600) : 0;
}

export async function getBestDayOfWeek(
  startDate: Date,
  endDate: Date,
  platform?: string | null
): Promise<{ day: number; label: string; avgEarnings: number }[]> {
  const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (isWeb) {
    const existing = localStorage.getItem("comma_shifts");
    if (!existing) return DAY_LABELS.map((label, day) => ({ day, label, avgEarnings: 0 }));
    let list = JSON.parse(existing).filter(
      (s: any) => new Date(s.startTime) >= startDate && new Date(s.startTime) <= endDate
    );
    if (platform && platform !== "all") {
        list = list.filter((s: any) => matchesPlatformWeb(s.platform, platform));
      }
    const map: Record<number, { total: number; count: number }> = {};
    list.forEach((s: any) => {
      const dow = new Date(s.startTime).getDay();
      if (!map[dow]) map[dow] = { total: 0, count: 0 };
      map[dow].total += (s.grossRevenue || 0) + (s.tipsRevenue || 0) + (s.bonusAmount || 0);
      map[dow].count++;
    });
    return DAY_LABELS.map((label, day) => ({
      day,
      label,
      avgEarnings: map[day] ? map[day].total / map[day].count : 0,
    }));
  }

  const conditions = [notDeleted(shifts.syncDeletedAt), gte(shifts.startTime, startDate), lte(shifts.startTime, endDate)];
  if (platform && platform !== "all") {
    conditions.push(getPlatformConditions(platform));
  }

  const rows = await db
    .select({
      day: sql<number>`CAST(strftime('%w', datetime(${shifts.startTime}, 'unixepoch', 'localtime')) AS INTEGER)`,
      avgEarnings: sql<number>`AVG(${shifts.grossRevenue} + ${shifts.tipsRevenue} + ${shifts.bonusAmount})`,
    })
    .from(shifts)
    .where(and(...conditions))
    .groupBy(sql`strftime('%w', datetime(${shifts.startTime}, 'unixepoch', 'localtime'))`);

  return DAY_LABELS.map((label, day) => {
    const found = rows.find((r: any) => r.day === day);
    return { day, label, avgEarnings: found?.avgEarnings || 0 };
  });
}

export async function getBestHourOfDay(
  startDate: Date,
  endDate: Date,
  platform?: string | null
): Promise<{ hour: number; avgEarnings: number }[]> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_shifts");
    if (!existing) return Array.from({ length: 24 }, (_, h) => ({ hour: h, avgEarnings: 0 }));
    let list = JSON.parse(existing).filter(
      (s: any) => new Date(s.startTime) >= startDate && new Date(s.startTime) <= endDate
    );
    if (platform && platform !== "all") {
        list = list.filter((s: any) => matchesPlatformWeb(s.platform, platform));
      }
    const map: Record<number, { total: number; count: number }> = {};
    list.forEach((s: any) => {
      const hour = new Date(s.startTime).getHours();
      if (!map[hour]) map[hour] = { total: 0, count: 0 };
      map[hour].total += (s.grossRevenue || 0) + (s.tipsRevenue || 0) + (s.bonusAmount || 0);
      map[hour].count++;
    });
    return Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      avgEarnings: map[h] ? map[h].total / map[h].count : 0,
    }));
  }

  const conditions = [notDeleted(shifts.syncDeletedAt), gte(shifts.startTime, startDate), lte(shifts.startTime, endDate)];
  if (platform && platform !== "all") {
    conditions.push(getPlatformConditions(platform));
  }

  const rows = await db
    .select({
      hour: sql<number>`CAST(strftime('%H', datetime(${shifts.startTime}, 'unixepoch', 'localtime')) AS INTEGER)`,
      avgEarnings: sql<number>`AVG(${shifts.grossRevenue} + ${shifts.tipsRevenue} + ${shifts.bonusAmount})`,
    })
    .from(shifts)
    .where(and(...conditions))
    .groupBy(sql`strftime('%H', datetime(${shifts.startTime}, 'unixepoch', 'localtime'))`);

  return Array.from({ length: 24 }, (_, h) => {
    const found = rows.find((r: any) => r.hour === h);
    return { hour: h, avgEarnings: found?.avgEarnings || 0 };
  });
}

export async function getMileageSplit(
  startDate: Date,
  endDate: Date,
  platform?: string | null
): Promise<{ active: number; dead: number; ratio: number }> {
  if (isWeb) {
    return { active: 0, dead: 0, ratio: 0 };
  }

  const conditions = [notDeleted(shifts.syncDeletedAt), gte(shifts.startTime, startDate), lte(shifts.startTime, endDate)];
  if (platform && platform !== "all") {
    conditions.push(getPlatformConditions(platform));
  }

  const result = await db
    .select({
      active: sql<number>`COALESCE(SUM(${shifts.activeMileage}), 0)`,
      dead: sql<number>`COALESCE(SUM(${shifts.deadMileage}), 0)`,
    })
    .from(shifts)
    .where(and(...conditions));

  const { active, dead } = result[0] || { active: 0, dead: 0 };
  const total = active + dead;
  return { active, dead, ratio: total > 0 ? (dead / total) * 100 : 0 };
}

export async function getNetIncome(startDate: Date, endDate: Date, platform?: string | null): Promise<number> {
  if (isWeb) return 0;

  const conditions = [notDeleted(shifts.syncDeletedAt), gte(shifts.startTime, startDate), lte(shifts.startTime, endDate)];
  if (platform && platform !== "all") {
    conditions.push(getPlatformConditions(platform));
  }

  const earningsResult = await db
    .select({
      total: sql<number>`COALESCE(SUM(${shifts.grossRevenue} + ${shifts.tipsRevenue} + ${shifts.bonusAmount}), 0)`,
    })
    .from(shifts)
    .where(and(...conditions));

  const { expenses } = await import("../schema");
  
  let expensesResult;
  if (platform && platform !== "all") {
    const platformCond = getPlatformConditions(platform);
    expensesResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${expenses.amount} * ${expenses.deductiblePct} / 100.0), 0)`,
      })
      .from(expenses)
      .innerJoin(shifts, eq(expenses.shiftId, shifts.id))
      .where(
        and(
          notDeleted(expenses.syncDeletedAt),
          notDeleted(shifts.syncDeletedAt),
          eq(expenses.isDeductible, true),
          gte(expenses.date, startDate),
          lte(expenses.date, endDate),
          platformCond
        )
      );
  } else {
    expensesResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${expenses.amount} * ${expenses.deductiblePct} / 100.0), 0)`,
      })
      .from(expenses)
      .where(
        and(
          notDeleted(expenses.syncDeletedAt),
          eq(expenses.isDeductible, true),
          gte(expenses.date, startDate),
          lte(expenses.date, endDate)
        )
      );
  }

  return (earningsResult[0]?.total || 0) - (expensesResult[0]?.total || 0);
}

export async function getPeriodStats(
  startDate: Date,
  endDate: Date,
  platform?: string
): Promise<{ gross: number; tips: number; bonus: number; count: number; activeMileage: number; deadMileage: number; durationSeconds: number; pausedSeconds: number }> {
  if (isWeb) {
    try {
      const existing = localStorage.getItem("comma_shifts");
      if (!existing) return { gross: 0, tips: 0, bonus: 0, count: 0, activeMileage: 0, deadMileage: 0, durationSeconds: 0, pausedSeconds: 0 };
      let list = JSON.parse(existing).filter((s: any) => {
        const d = new Date(s.startTime);
        return d >= startDate && d <= endDate;
      });
      if (platform && platform !== "all") {
        list = list.filter((s: any) => matchesPlatformWeb(s.platform, platform));
      }
      let gross = 0, tips = 0, bonus = 0, activeMileage = 0, deadMileage = 0, durationSeconds = 0, pausedSeconds = 0;
      list.forEach((s: any) => {
        gross += Number(s.grossRevenue || 0);
        tips += Number(s.tipsRevenue || 0);
        bonus += Number(s.bonusAmount || 0);
        activeMileage += Number(s.activeMileage || 0);
        deadMileage += Number(s.deadMileage || 0);
        durationSeconds += Number(s.durationSeconds || 0);
        pausedSeconds += Number(s.pausedSeconds || 0);
      });
      return { gross, tips, bonus, count: list.length, activeMileage, deadMileage, durationSeconds, pausedSeconds };
    } catch {
      return { gross: 0, tips: 0, bonus: 0, count: 0, activeMileage: 0, deadMileage: 0, durationSeconds: 0, pausedSeconds: 0 };
    }
  }

  const conditions = [notDeleted(shifts.syncDeletedAt), gte(shifts.startTime, startDate), lte(shifts.startTime, endDate)];
  if (platform && platform !== "all") {
    conditions.push(getPlatformConditions(platform));
  }

  const result = await db
    .select({
      gross: sql<number>`COALESCE(SUM(${shifts.grossRevenue}), 0)`,
      tips: sql<number>`COALESCE(SUM(${shifts.tipsRevenue}), 0)`,
      bonus: sql<number>`COALESCE(SUM(${shifts.bonusAmount}), 0)`,
      count: sql<number>`COUNT(${shifts.id})`,
      activeMileage: sql<number>`COALESCE(SUM(${shifts.activeMileage}), 0)`,
      deadMileage: sql<number>`COALESCE(SUM(${shifts.deadMileage}), 0)`,
      durationSeconds: sql<number>`COALESCE(SUM(${shifts.durationSeconds}), 0)`,
      pausedSeconds: sql<number>`COALESCE(SUM(${shifts.pausedSeconds}), 0)`,
    })
    .from(shifts)
    .where(and(...conditions));

  return result[0] || { gross: 0, tips: 0, bonus: 0, count: 0, activeMileage: 0, deadMileage: 0, durationSeconds: 0, pausedSeconds: 0 };
}

export async function getFinancialOverviewForRange(
  startDate: Date,
  endDate: Date,
  platform?: string,
  weekStartDay: number = 0
): Promise<any> {
  const empty = {
    count: 0,
    gross: 0,
    tips: 0,
    bonus: 0,
    orders: 0,
    minutes: 0,
    hourlyRate: 0,
    expense: 0,
    outOfPocket: 0,
    netIncome: 0,
    hours: 0,
    activeHours: 0,
    onlineHours: 0,
    avgRateHr: 0,
    activeAvgRateHr: 0,
    onlineAvgRateHr: 0,
    effectivePerHr: 0,
    bestWeek: null,
    worstWeek: null,
  };
  
  if (!startDate || !endDate || startDate > endDate) return empty;

  let shiftList: any[] = [];
  if (isWeb) {
    try {
      const existing = localStorage.getItem("comma_shifts");
      if (existing) {
        shiftList = JSON.parse(existing).filter((s: any) => {
          const d = new Date(s.startTime);
          return d >= startDate && d <= endDate;
        });
        if (platform && platform !== "all") {
          const parts = platform.split(",");
          shiftList = shiftList.filter((s: any) => parts.includes(s.platform));
        }
      }
    } catch {}
  } else {
    const conditions = [notDeleted(shifts.syncDeletedAt), gte(shifts.startTime, startDate), lte(shifts.startTime, endDate)];
    if (platform && platform !== "all") {
    conditions.push(getPlatformConditions(platform));
  }
    shiftList = await db.select().from(shifts).where(and(...conditions));
  }

  if (shiftList.length === 0) return empty;

  let gross = 0;
  let tips = 0;
  let bonus = 0;
  let durationSeconds = 0;
  let pausedSeconds = 0;
  let activeMileage = 0;
  let deadMileage = 0;

  shiftList.forEach((s) => {
    gross += Number(s.grossRevenue || 0);
    tips += Number(s.tipsRevenue || 0);
    bonus += Number(s.bonusAmount || 0);
    durationSeconds += Number(s.durationSeconds || 0);
    pausedSeconds += Number(s.pausedSeconds || 0);
    activeMileage += Number(s.activeMileage || 0);
    deadMileage += Number(s.deadMileage || 0);
  });

  let expense = 0;
  if (isWeb) {
    try {
      const existing = localStorage.getItem("comma_expenses");
      if (existing) {
        let expList = JSON.parse(existing).filter((e: any) => {
          const d = new Date(e.date);
          return d >= startDate && d <= endDate && e.isDeductible;
        });
        if (platform && platform !== "all") {
          const platformShifts = shiftList.filter((s) => s.platform === platform);
          const shiftIds = new Set(platformShifts.map((s) => s.id));
          expList = expList.filter((e: any) => e.shiftId && shiftIds.has(e.shiftId));
        }
        expense = expList.reduce((sum: number, e: any) => sum + Number(e.amount || 0) * Number(e.deductiblePct ?? e.pct ?? 100) / 100, 0);
      }
    } catch {}
  } else {
    let expList: any[] = [];
    if (platform && platform !== "all") {
      const platformCond = getPlatformConditions(platform);
      expList = await db
        .select({ amount: expenses.amount, pct: expenses.deductiblePct })
        .from(expenses)
        .innerJoin(shifts, eq(expenses.shiftId, shifts.id))
        .where(
          and(
            notDeleted(expenses.syncDeletedAt),
            notDeleted(shifts.syncDeletedAt),
            eq(expenses.isDeductible, true),
            gte(expenses.date, startDate),
            lte(expenses.date, endDate),
            platformCond
          )
        );
    } else {
      expList = await db
        .select({ amount: expenses.amount, pct: expenses.deductiblePct })
        .from(expenses)
        .where(
          and(
            notDeleted(expenses.syncDeletedAt),
            eq(expenses.isDeductible, true),
            gte(expenses.date, startDate),
            lte(expenses.date, endDate)
          )
        );
    }
    expense = expList.reduce((sum, e) => sum + Number(e.amount || 0) * Number(e.deductiblePct ?? e.pct ?? 100) / 100, 0);
  }

  const totalEarnings = gross + tips + bonus;
  const netIncome = totalEarnings - expense;
  const hours = durationSeconds / 3600;
  const activeHours = Math.max(0, durationSeconds - pausedSeconds) / 3600;
  const onlineHours = durationSeconds / 3600;

  const avgRateHr = hours > 0 ? totalEarnings / hours : 0;
  const activeAvgRateHr = activeHours > 0 ? totalEarnings / activeHours : 0;
  const onlineAvgRateHr = onlineHours > 0 ? totalEarnings / onlineHours : 0;
  const effectivePerHr = hours > 0 ? netIncome / hours : 0;

  const weeksMap: Record<string, { gross: number; tips: number; bonus: number; expense: number; shifts: any[] }> = {};

  shiftList.forEach((s) => {
    const d = new Date(s.startTime);
    const startOfWeek = new Date(d);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 && weekStartDay === 1 ? -6 : weekStartDay);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);
    const weekKey = startOfWeek.toISOString().substring(0, 10);

    if (!weeksMap[weekKey]) {
      weeksMap[weekKey] = { gross: 0, tips: 0, bonus: 0, expense: 0, shifts: [] };
    }
    weeksMap[weekKey].gross += Number(s.grossRevenue || 0);
    weeksMap[weekKey].tips += Number(s.tipsRevenue || 0);
    weeksMap[weekKey].bonus += Number(s.bonusAmount || 0);
    weeksMap[weekKey].shifts.push(s);
  });

  const weekKeys = Object.keys(weeksMap);
  for (const weekKey of weekKeys) {
    const wStart = new Date(weekKey);
    const wEnd = new Date(wStart);
    wEnd.setDate(wStart.getDate() + 6);
    wEnd.setHours(23, 59, 59, 999);

    let wExpense = 0;
    if (isWeb) {
      try {
        const existing = localStorage.getItem("comma_expenses");
        if (existing) {
          let expList = JSON.parse(existing).filter((e: any) => {
            const d = new Date(e.date);
            return d >= wStart && d <= wEnd && e.isDeductible;
          });
          if (platform && platform !== "all") {
            const platformShifts = weeksMap[weekKey].shifts.filter((s) => s.platform === platform);
            const shiftIds = new Set(platformShifts.map((s) => s.id));
            expList = expList.filter((e: any) => e.shiftId && shiftIds.has(e.shiftId));
          }
          wExpense = expList.reduce((sum: number, e: any) => sum + Number(e.amount || 0) * Number(e.deductiblePct ?? e.pct ?? 100) / 100, 0);
        }
      } catch {}
    } else {
    let expList: any[] = [];
    if (platform && platform !== "all") {
      const platformCond = getPlatformConditions(platform);
      expList = await db
        .select({ amount: expenses.amount, pct: expenses.deductiblePct })
        .from(expenses)
        .innerJoin(shifts, eq(expenses.shiftId, shifts.id))
        .where(
          and(
            notDeleted(expenses.syncDeletedAt),
            notDeleted(shifts.syncDeletedAt),
            eq(expenses.isDeductible, true),
            gte(expenses.date, wStart),
            lte(expenses.date, wEnd),
            platformCond
          )
        );
    } else {
        expList = await db
          .select({ amount: expenses.amount, pct: expenses.deductiblePct })
          .from(expenses)
          .where(
            and(
              notDeleted(expenses.syncDeletedAt),
              eq(expenses.isDeductible, true),
              gte(expenses.date, wStart),
              lte(expenses.date, wEnd)
            )
          );
      }
      wExpense = expList.reduce((sum, e) => sum + Number(e.amount || 0) * Number(e.deductiblePct ?? e.pct ?? 100) / 100, 0);
    }
    weeksMap[weekKey].expense = wExpense;
  }

  let bestWeek: any = null;
  let worstWeek: any = null;

  weekKeys.forEach((weekKey) => {
    const info = weeksMap[weekKey];
    const net = (info.gross + info.tips + info.bonus) - info.expense;
    const start = weekKey;
    const wEnd = new Date(weekKey);
    wEnd.setDate(wEnd.getDate() + 6);
    const end = wEnd.toISOString().substring(0, 10);

    const weekItem = { start, end, net, gross: info.gross + info.tips + info.bonus };
    if (!bestWeek || net > bestWeek.net) bestWeek = weekItem;
    if (!worstWeek || net < worstWeek.net) worstWeek = weekItem;
  });

  return {
    count: shiftList.length,
    gross,
    tips,
    bonus,
    activeMileage,
    deadMileage,
    durationSeconds,
    pausedSeconds,
    expense,
    netIncome,
    hours,
    activeHours,
    onlineHours,
    avgRateHr,
    activeAvgRateHr,
    onlineAvgRateHr,
    effectivePerHr,
    bestWeek,
    worstWeek,
  };
}

export async function getFinancialMonthlyBreakdown(
  startDate: Date,
  endDate: Date,
  platform?: string
): Promise<{
  rows: { period: string; earnings: number; expenses: number; outOfPocket: number; net: number; hours: number; efficiency: number }[];
  totals: { earnings: number; expenses: number; outOfPocket: number; net: number; hours: number; avgPerHr: number; effectivePerHr: number };
}> {
  const emptyTotals = { earnings: 0, expenses: 0, outOfPocket: 0, net: 0, hours: 0, avgPerHr: 0, effectivePerHr: 0 };
  if (!startDate || !endDate || startDate > endDate) {
    return { rows: [], totals: emptyTotals };
  }

  let shiftList: any[] = [];
  if (isWeb) {
    try {
      const existing = localStorage.getItem("comma_shifts");
      if (existing) {
        shiftList = JSON.parse(existing).filter((s: any) => {
          const d = new Date(s.startTime);
          return d >= startDate && d <= endDate;
        });
        if (platform && platform !== "all") {
          shiftList = shiftList.filter((s: any) => s.platform === platform);
        }
      }
    } catch {}
  } else {
    const conditions = [notDeleted(shifts.syncDeletedAt), gte(shifts.startTime, startDate), lte(shifts.startTime, endDate)];
    if (platform && platform !== "all") {
      conditions.push(eq(shifts.platform, platform));
    }
    shiftList = await db.select().from(shifts).where(and(...conditions));
  }

  let expenseList: any[] = [];
  if (isWeb) {
    try {
      const existing = localStorage.getItem("comma_expenses");
      if (existing) {
        expenseList = JSON.parse(existing).filter((e: any) => {
          const d = new Date(e.date);
          return d >= startDate && d <= endDate;
        });
        if (platform && platform !== "all") {
          const shiftIds = new Set(shiftList.map((s) => s.id));
          expenseList = expenseList.filter((e: any) => e.shiftId && shiftIds.has(e.shiftId));
        }
      }
    } catch {}
  } else {
    if (platform && platform !== "all") {
      const platformCond = getPlatformConditions(platform);
      expenseList = await db
        .select({ amount: expenses.amount, date: expenses.date, isDeductible: expenses.isDeductible, pct: expenses.deductiblePct })
        .from(expenses)
        .innerJoin(shifts, eq(expenses.shiftId, shifts.id))
        .where(
          and(
            notDeleted(expenses.syncDeletedAt),
            notDeleted(shifts.syncDeletedAt),
            gte(expenses.date, startDate),
            lte(expenses.date, endDate),
            platformCond
          )
        );
    } else {
      expenseList = await db
        .select({ amount: expenses.amount, date: expenses.date, isDeductible: expenses.isDeductible, pct: expenses.deductiblePct })
        .from(expenses)
        .where(
          and(
            notDeleted(expenses.syncDeletedAt),
            gte(expenses.date, startDate),
            lte(expenses.date, endDate)
          )
        );
    }
  }

  const monthMap: Record<string, { earnings: number; expenses: number; outOfPocket: number; hours: number; count: number }> = {};
  
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  
  for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthMap[key] = { earnings: 0, expenses: 0, outOfPocket: 0, hours: 0, count: 0 };
  }

  shiftList.forEach((s) => {
    const d = new Date(s.startTime);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (monthMap[key]) {
      monthMap[key].earnings += Number(s.grossRevenue || 0) + Number(s.tipsRevenue || 0) + Number(s.bonusAmount || 0);
      monthMap[key].hours += Number(s.durationSeconds || 0) / 3600;
      monthMap[key].count++;
    }
  });

  expenseList.forEach((e) => {
    const d = new Date(e.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (monthMap[key]) {
      if (e.isDeductible) {
        monthMap[key].expenses += Number(e.amount || 0) * Number(e.deductiblePct ?? e.pct ?? 100) / 100;
      } else {
        monthMap[key].outOfPocket += Number(e.amount || 0);
      }
    }
  });

  const rows = Object.keys(monthMap)
    .sort((a, b) => b.localeCompare(a))
    .map((key) => {
      const info = monthMap[key];
      const net = info.earnings - info.expenses;
      const efficiency = info.hours > 0 ? net / info.hours : 0;
      
      const dObj = new Date(key + "-02T12:00:00");
      const label = dObj.toLocaleDateString(undefined, { month: "short", year: "numeric" });

      return {
        period: label,
        earnings: info.earnings,
        expenses: info.expenses,
        outOfPocket: info.outOfPocket,
        net,
        hours: info.hours,
        efficiency,
      };
    });

  let totalsEarnings = 0;
  let totalsExpenses = 0;
  let totalsOutOfPocket = 0;
  let totalsNet = 0;
  let totalsHours = 0;

  rows.forEach((r) => {
    totalsEarnings += r.earnings;
    totalsExpenses += r.expenses;
    totalsOutOfPocket += r.outOfPocket;
    totalsNet += r.net;
    totalsHours += r.hours;
  });

  return {
    rows,
    totals: {
      earnings: totalsEarnings,
      expenses: totalsExpenses,
      outOfPocket: totalsOutOfPocket,
      net: totalsNet,
      hours: totalsHours,
      avgPerHr: totalsHours > 0 ? totalsEarnings / totalsHours : 0,
      effectivePerHr: totalsHours > 0 ? totalsNet / totalsHours : 0,
    },
  };
}

export async function getMonthlyStatsForYear(
  year: number
): Promise<{ monthIndex: number; gross: number; tips: number; bonus: number; count: number }[]> {
  if (isWeb) {
    try {
      const existing = localStorage.getItem("comma_shifts");
      if (!existing) return [];
      const list = JSON.parse(existing).filter((s: any) => {
        const d = new Date(s.startTime);
        return d.getFullYear() === year;
      });
      const map: Record<number, { gross: number; tips: number; bonus: number; count: number }> = {};
      list.forEach((s: any) => {
        const m = new Date(s.startTime).getMonth();
        if (!map[m]) map[m] = { gross: 0, tips: 0, bonus: 0, count: 0 };
        map[m].gross += Number(s.grossRevenue || 0);
        map[m].tips += Number(s.tipsRevenue || 0);
        map[m].bonus += Number(s.bonusAmount || 0);
        map[m].count++;
      });
      return Object.entries(map).map(([monthIndex, v]) => ({
        monthIndex: Number(monthIndex),
        ...v,
      }));
    } catch {
      return [];
    }
  }

  const yearStart = new Date(year, 0, 1, 0, 0, 0, 0);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

  const rows = await db
    .select({
      monthIndex: sql<number>`CAST(strftime('%m', datetime(${shifts.startTime}, 'unixepoch', 'localtime')) AS INTEGER) - 1`,
      gross: sql<number>`COALESCE(SUM(${shifts.grossRevenue}), 0)`,
      tips: sql<number>`COALESCE(SUM(${shifts.tipsRevenue}), 0)`,
      bonus: sql<number>`COALESCE(SUM(${shifts.bonusAmount}), 0)`,
      count: sql<number>`COUNT(${shifts.id})`,
    })
    .from(shifts)
    .where(and(notDeleted(shifts.syncDeletedAt), gte(shifts.startTime, yearStart), lte(shifts.startTime, yearEnd)))
    .groupBy(sql`strftime('%m', datetime(${shifts.startTime}, 'unixepoch', 'localtime'))`);

  return rows;
}

export async function getRolling30DayTrend(platform?: string): Promise<any> {
  const points: { x: number; y: number }[] = [];
  const activeRatePoints: { x: number; y: number }[] = [];
  const onlineRatePoints: { x: number; y: number }[] = [];
  const activeHoursPoints: { x: number; y: number }[] = [];
  const onlineHoursPoints: { x: number; y: number }[] = [];

  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 29);
  start.setHours(0, 0, 0, 0);

  let shiftList: any[] = [];
  if (isWeb) {
    try {
      const existing = localStorage.getItem("comma_shifts");
      if (existing) {
        shiftList = JSON.parse(existing).filter((s: any) => {
          const d = new Date(s.startTime);
          return d >= start && d <= today;
        });
        if (platform && platform !== "all") {
          const parts = platform.split(",");
          shiftList = shiftList.filter((s: any) => parts.includes(s.platform));
        }
      }
    } catch {}
  } else {
    const conditions = [notDeleted(shifts.syncDeletedAt), gte(shifts.startTime, start), lte(shifts.startTime, today)];
    if (platform && platform !== "all") {
    conditions.push(getPlatformConditions(platform));
  }
    shiftList = await db.select().from(shifts).where(and(...conditions));
  }

  const dailyData: Record<string, { gross: number; activeSeconds: number; totalSeconds: number }> = {};
  for (let i = 0; i < 30; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().substring(0, 10);
    dailyData[key] = { gross: 0, activeSeconds: 0, totalSeconds: 0 };
  }

  shiftList.forEach((s) => {
    const d = new Date(s.startTime);
    const key = d.toISOString().substring(0, 10);
    if (dailyData[key]) {
      dailyData[key].gross += Number(s.grossRevenue || 0) + Number(s.tipsRevenue || 0) + Number(s.bonusAmount || 0);
      dailyData[key].totalSeconds += Number(s.durationSeconds || 0);
      dailyData[key].activeSeconds += Math.max(0, Number(s.durationSeconds || 0) - Number(s.pausedSeconds || 0));
    }
  });

  let lastActiveRate = 25;
  let lastOnlineRate = 18;
  let lastActiveHours = 4.0;
  let lastOnlineHours = 5.5;

  for (let i = 0; i < 30; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().substring(0, 10);
    const info = dailyData[key];

    const aHrs = info.activeSeconds / 3600;
    const oHrs = info.totalSeconds / 3600;

    let aRate = aHrs > 0 ? info.gross / aHrs : 0;
    let oRate = oHrs > 0 ? info.gross / oHrs : 0;

    if (aRate > 0) lastActiveRate = aRate;
    else aRate = lastActiveRate * (0.9 + (i % 3) * 0.1);

    if (oRate > 0) lastOnlineRate = oRate;
    else oRate = lastOnlineRate * (0.8 + (i % 4) * 0.1);

    const activeH = aHrs > 0 ? aHrs : lastActiveHours * (0.5 + (i % 3) * 0.2);
    const onlineH = oHrs > 0 ? oHrs : lastOnlineHours * (0.6 + (i % 4) * 0.15);

    points.push({ x: i, y: info.gross });
    activeRatePoints.push({ x: i, y: aRate });
    onlineRatePoints.push({ x: i, y: oRate });
    activeHoursPoints.push({ x: i, y: activeH });
    onlineHoursPoints.push({ x: i, y: onlineH });
  }

  return {
    points,
    activeRatePoints,
    onlineRatePoints,
    activeHoursPoints,
    onlineHoursPoints,
  };
}

// ─── Workstream 6 (mobile widget parity) ───────────────────────────────────

/**
 * One {hours, gross} point per shift in range — feeds the "Earnings vs Hours" scatter
 * widget's regression/correlation math (computed client-side in the widget component).
 */
export async function getEarningsVsHoursScatter(
  startDate: Date,
  endDate: Date,
  platform?: string
): Promise<{ x: number; y: number }[]> {
  if (isWeb) {
    try {
      const existing = localStorage.getItem("comma_shifts");
      if (!existing) return [];
      let list = JSON.parse(existing).filter((s: any) => {
        const d = new Date(s.startTime);
        return d >= startDate && d <= endDate;
      });
      if (platform && platform !== "all") {
        list = list.filter((s: any) => matchesPlatformWeb(s.platform, platform));
      }
      return list.map((s: any) => ({
        x: Number(s.durationSeconds || 0) / 3600,
        y: Number(s.grossRevenue || 0) + Number(s.tipsRevenue || 0) + Number(s.bonusAmount || 0),
      }));
    } catch {
      return [];
    }
  }

  const conditions = [notDeleted(shifts.syncDeletedAt), gte(shifts.startTime, startDate), lte(shifts.startTime, endDate)];
  if (platform && platform !== "all") {
    conditions.push(getPlatformConditions(platform));
  }

  const rows = await db
    .select({
      durationSeconds: shifts.durationSeconds,
      grossRevenue: shifts.grossRevenue,
      tipsRevenue: shifts.tipsRevenue,
      bonusAmount: shifts.bonusAmount,
    })
    .from(shifts)
    .where(and(...conditions));

  return rows.map((r: any) => ({
    x: Number(r.durationSeconds || 0) / 3600,
    y: Number(r.grossRevenue || 0) + Number(r.tipsRevenue || 0) + Number(r.bonusAmount || 0),
  }));
}

function getMondayWeekKey(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().substring(0, 10);
}

/**
 * Income stability score (0-100) from the coefficient of variation of weekly gross
 * earnings across ALL shifts ever recorded (not scoped to the screen's selected period).
 */
export async function getIncomeStabilityScore(
  platform?: string
): Promise<{ weeklyGross: number[]; stabilityScore: number }> {
  let shiftList: any[] = [];

  if (isWeb) {
    try {
      const existing = localStorage.getItem("comma_shifts");
      if (existing) {
        shiftList = JSON.parse(existing);
        if (platform && platform !== "all") {
          shiftList = shiftList.filter((s: any) => matchesPlatformWeb(s.platform, platform));
        }
      }
    } catch {
      shiftList = [];
    }
  } else {
    const conditions = [notDeleted(shifts.syncDeletedAt)];
    if (platform && platform !== "all") {
      conditions.push(getPlatformConditions(platform));
    }
    shiftList = await db
      .select({ startTime: shifts.startTime, grossRevenue: shifts.grossRevenue, tipsRevenue: shifts.tipsRevenue, bonusAmount: shifts.bonusAmount })
      .from(shifts)
      .where(and(...conditions));
  }

  const weekMap = new Map<string, number>();
  shiftList.forEach((s) => {
    const key = getMondayWeekKey(new Date(s.startTime));
    const total = Number(s.grossRevenue || 0) + Number(s.tipsRevenue || 0) + Number(s.bonusAmount || 0);
    weekMap.set(key, (weekMap.get(key) || 0) + total);
  });

  const weeklyGross = Array.from(weekMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, total]) => total);

  if (weeklyGross.length === 0) {
    return { weeklyGross: [], stabilityScore: 0 };
  }

  const avg = weeklyGross.reduce((sum, v) => sum + v, 0) / weeklyGross.length;
  const variance = weeklyGross.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / weeklyGross.length;
  const sd = Math.sqrt(variance);
  const cv = avg > 0 ? sd / avg : 1;
  const stabilityScore = Math.max(0, Math.min(100, (1 - cv) * 100));

  return { weeklyGross, stabilityScore };
}
