import { db } from "../client";
import { shifts, shiftPlatforms, settings, expenses } from "../schema";
import { and, gte, lte, eq, sql, inArray, like, or, isNull, type SQL } from "drizzle-orm";
import { Platform } from "react-native";
import { getGoalsWithProgress } from "./goals";
import { notDeleted, isNotDeleted } from "../syncedWrites";

function matchesPlatformWeb(platformField: string | null | undefined, filterPlatform: string): boolean {
  if (!platformField) return false;
  const parts = filterPlatform.split(",");
  return parts.some((p) => platformField.includes(p));
}

// shiftPlatforms.platform is a single exact value per row (unlike shifts.platform, which is a
// comma-joined list for multi-apping shifts), so filtering it is a plain equality/inArray match
// rather than the LIKE-based getPlatformConditions() used for the shifts table.
function getShiftPlatformCondition(platform: string): SQL {
  const parts = platform.split(",");
  return parts.length > 1 ? inArray(shiftPlatforms.platform, parts) : eq(shiftPlatforms.platform, platform);
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

function matchesVehicleWeb(vehicleId: string | null | undefined, filterVehicle: string): boolean {
  if (!vehicleId) return false;
  return filterVehicle.split(",").includes(vehicleId);
}

// The vehicle-filter equivalent of getPlatformConditions — shifts.vehicleId is a plain id
// column (not a comma-joined multi-select field like shifts.platform), so this is a direct
// equality/inArray match. Always called with a non-empty, non-"all" filter string.
function getVehicleFilterConditions(vehicleFilter: string): SQL {
  const parts = vehicleFilter.split(",");
  return parts.length > 1 ? inArray(shifts.vehicleId, parts) : eq(shifts.vehicleId, vehicleFilter);
}

// Scopes an expense query to the vehicle(s) actually used by the shifts being totaled, so a
// car expense (e.g. fuel, insurance) logged in the same date range doesn't get deducted from
// earnings from a different vehicle (e.g. a bike shift). General expenses with no vehicleId
// still count everywhere. Returns undefined when there's nothing to scope by (caller should
// omit the condition, not force a false match).
export function getVehicleExpenseCondition(vehicleIds: string[]): SQL | undefined {
  if (vehicleIds.length === 0) return undefined;
  return or(isNull(expenses.vehicleId), inArray(expenses.vehicleId, vehicleIds));
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

export async function getTodayStats(platform?: string, vehicleFilter?: string | null): Promise<{ gross: number; tips: number; bonus: number; count: number; activeMileage: number; deadMileage: number }> {
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
  if (vehicleFilter && vehicleFilter !== "all") {
    conditions.push(getVehicleFilterConditions(vehicleFilter));
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

export async function getWeekStats(platform?: string, vehicleFilter?: string | null): Promise<{ gross: number; tips: number; bonus: number; count: number; activeMileage: number; deadMileage: number; durationSeconds: number }> {
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
  if (vehicleFilter && vehicleFilter !== "all") {
    conditions.push(getVehicleFilterConditions(vehicleFilter));
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
  platform?: string | null,
  vehicleFilter?: string | null
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
  if (vehicleFilter && vehicleFilter !== "all") {
    conditions.push(getVehicleFilterConditions(vehicleFilter));
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

/**
 * Mileage grouped by the vehicle that actually drove it, for a mileage write-off calculation
 * that resolves each vehicle's own rate/eligibility instead of applying one vehicle's rate to
 * everyone's distance. One row per distinct vehicle used in range (a handful at most), not one
 * per shift — this is still SQL-side aggregation, just grouped instead of flat-summed.
 */
export async function getVehicleMileageBreakdown(
  startDate: Date,
  endDate: Date,
  platform?: string | null,
  vehicleFilter?: string | null
): Promise<{ vehicleId: string | null; activeMileage: number; deadMileage: number }[]> {
  if (isWeb) {
    try {
      const existing = localStorage.getItem("comma_shifts");
      if (!existing) return [];
      let list = JSON.parse(existing).filter((s: any) => {
        const d = new Date(s.startTime);
        return d >= startDate && d <= endDate && isNotDeleted(s);
      });
      if (platform && platform !== "all") {
        list = list.filter((s: any) => matchesPlatformWeb(s.platform, platform));
      }
      if (vehicleFilter && vehicleFilter !== "all") {
        list = list.filter((s: any) => matchesVehicleWeb(s.vehicleId, vehicleFilter));
      }
      const byVehicle = new Map<string | null, { activeMileage: number; deadMileage: number }>();
      list.forEach((s: any) => {
        const key = s.vehicleId ?? null;
        const row = byVehicle.get(key) ?? { activeMileage: 0, deadMileage: 0 };
        row.activeMileage += Number(s.activeMileage || 0);
        row.deadMileage += Number(s.deadMileage || 0);
        byVehicle.set(key, row);
      });
      return Array.from(byVehicle.entries()).map(([vehicleId, m]) => ({ vehicleId, ...m }));
    } catch {
      return [];
    }
  }

  const conditions = [notDeleted(shifts.syncDeletedAt), gte(shifts.startTime, startDate), lte(shifts.startTime, endDate)];
  if (platform && platform !== "all") {
    conditions.push(getPlatformConditions(platform));
  }
  if (vehicleFilter && vehicleFilter !== "all") {
    conditions.push(getVehicleFilterConditions(vehicleFilter));
  }

  const rows = await db
    .select({
      vehicleId: shifts.vehicleId,
      activeMileage: sql<number>`COALESCE(SUM(${shifts.activeMileage}), 0)`,
      deadMileage: sql<number>`COALESCE(SUM(${shifts.deadMileage}), 0)`,
    })
    .from(shifts)
    .where(and(...conditions))
    .groupBy(shifts.vehicleId);

  return rows;
}

/** Same as getVehicleMileageBreakdown, but for "this week" per the driver's own week-start-day setting. */
export async function getWeekVehicleMileageBreakdown(
  platform?: string | null,
  vehicleFilter?: string | null
): Promise<{ vehicleId: string | null; activeMileage: number; deadMileage: number }[]> {
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
  } else {
    try {
      const rows = await db.select().from(settings).where(eq(settings.key, "profile")).limit(1);
      if (rows[0]?.value) {
        const profile = JSON.parse(rows[0].value);
        if (profile.locale?.weekStartDay !== undefined) {
          weekStartDay = parseInt(profile.locale.weekStartDay, 10);
        }
      }
    } catch {}
  }

  const { start, end } = getPeriodDates("weekly", weekStartDay);
  return getVehicleMileageBreakdown(start, end, platform, vehicleFilter);
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

  // Only count a vehicle-tagged expense (fuel, insurance, ...) if that vehicle was actually
  // driven in this range — otherwise a car expense logged the same week as a bike-only shift
  // was silently deducted from the bike earnings. General expenses (no vehicleId) always count.
  const vehicleIdsUsed = await db.selectDistinct({ vehicleId: shifts.vehicleId }).from(shifts).where(and(...conditions));
  const vehicleCond = getVehicleExpenseCondition(
    vehicleIdsUsed.map((r: { vehicleId: string | null }) => r.vehicleId).filter((id: string | null): id is string => id != null)
  );

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
          platformCond,
          ...(vehicleCond ? [vehicleCond] : [])
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
          lte(expenses.date, endDate),
          ...(vehicleCond ? [vehicleCond] : [])
        )
      );
  }

  return (earningsResult[0]?.total || 0) - (expensesResult[0]?.total || 0);
}

export async function getPeriodStats(
  startDate: Date,
  endDate: Date,
  platform?: string,
  vehicleFilter?: string | null
): Promise<{ gross: number; tips: number; bonus: number; count: number; orders: number; activeMileage: number; deadMileage: number; durationSeconds: number; pausedSeconds: number }> {
  if (isWeb) {
    try {
      const existing = localStorage.getItem("comma_shifts");
      if (!existing) return { gross: 0, tips: 0, bonus: 0, count: 0, orders: 0, activeMileage: 0, deadMileage: 0, durationSeconds: 0, pausedSeconds: 0 };
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

      // Real delivery/order count: shiftPlatforms.tripsCount is what the user actually enters
      // per platform per shift, unlike `count` above (number of shifts logged).
      const shiftIdsInRange = new Set(list.map((s: any) => s.id));
      const spExisting = localStorage.getItem("comma_shift_platforms");
      const spList = spExisting ? JSON.parse(spExisting).filter(isNotDeleted) : [];
      let orders = 0;
      spList.forEach((sp: any) => {
        if (!shiftIdsInRange.has(sp.shiftId)) return;
        if (platform && platform !== "all" && !matchesPlatformWeb(sp.platform, platform)) return;
        orders += Number(sp.tripsCount || 0);
      });

      return { gross, tips, bonus, count: list.length, orders, activeMileage, deadMileage, durationSeconds, pausedSeconds };
    } catch {
      return { gross: 0, tips: 0, bonus: 0, count: 0, orders: 0, activeMileage: 0, deadMileage: 0, durationSeconds: 0, pausedSeconds: 0 };
    }
  }

  const conditions = [notDeleted(shifts.syncDeletedAt), gte(shifts.startTime, startDate), lte(shifts.startTime, endDate)];
  if (platform && platform !== "all") {
    conditions.push(getPlatformConditions(platform));
  }
  if (vehicleFilter && vehicleFilter !== "all") {
    conditions.push(getVehicleFilterConditions(vehicleFilter));
  }

  const ordersConditions = [notDeleted(shifts.syncDeletedAt), notDeleted(shiftPlatforms.syncDeletedAt), gte(shifts.startTime, startDate), lte(shifts.startTime, endDate)];
  if (platform && platform !== "all") {
    ordersConditions.push(getShiftPlatformCondition(platform));
  }
  if (vehicleFilter && vehicleFilter !== "all") {
    ordersConditions.push(getVehicleFilterConditions(vehicleFilter));
  }

  const [result, ordersResult] = await Promise.all([
    db
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
      .where(and(...conditions)),
    db
      .select({
        orders: sql<number>`COALESCE(SUM(${shiftPlatforms.tripsCount}), 0)`,
      })
      .from(shiftPlatforms)
      .innerJoin(shifts, eq(shiftPlatforms.shiftId, shifts.id))
      .where(and(...ordersConditions)),
  ]);

  return {
    ...(result[0] || { gross: 0, tips: 0, bonus: 0, count: 0, activeMileage: 0, deadMileage: 0, durationSeconds: 0, pausedSeconds: 0 }),
    orders: ordersResult[0]?.orders || 0,
  };
}

export async function getFinancialOverviewForRange(
  startDate: Date,
  endDate: Date,
  platform?: string,
  weekStartDay: number = 0,
  vehicleFilter?: string | null
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
    if (vehicleFilter && vehicleFilter !== "all") {
      conditions.push(getVehicleFilterConditions(vehicleFilter));
    }
    shiftList = await db.select().from(shifts).where(and(...conditions));
  }

  if (shiftList.length === 0) return empty;

  const vehicleIds = Array.from(new Set(shiftList.map((s: any) => s.vehicleId).filter(Boolean))) as string[];
  const vehicleCond = getVehicleExpenseCondition(vehicleIds);

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
        // Only count a vehicle-tagged expense if that vehicle was actually driven in range;
        // general expenses (no vehicleId) always count. Mirrors getVehicleExpenseCondition.
        expList = expList.filter((e: any) => !e.vehicleId || vehicleIds.includes(e.vehicleId));
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
            platformCond,
            ...(vehicleCond ? [vehicleCond] : [])
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
            lte(expenses.date, endDate),
            ...(vehicleCond ? [vehicleCond] : [])
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
