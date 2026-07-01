import { and, gte, lte, isNull, sql } from "drizzle-orm";
import { getDb } from "../index";
import { shifts, expenses } from "../schema";

export interface PeriodStats {
  grossRevenue: number;
  tipsRevenue: number;
  totalEarnings: number;
  totalExpenses: number;
  netEarnings: number;
  totalHours: number;
  totalMileage: number;
  shiftCount: number;
  avgHourlyRate: number;
}

export async function getStatsForRange(startDate: Date, endDate: Date): Promise<PeriodStats> {
  const db = await getDb();

  const shiftRows = await db
    .select({
      grossRevenue: sql<number>`COALESCE(SUM(gross_revenue), 0)`,
      tipsRevenue: sql<number>`COALESCE(SUM(tips_revenue), 0)`,
      totalSeconds: sql<number>`COALESCE(SUM(duration_seconds - paused_seconds), 0)`,
      totalMileage: sql<number>`COALESCE(SUM(active_mileage + dead_mileage), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(shifts)
    .where(
      and(
        isNull(shifts.syncDeletedAt),
        gte(shifts.startTime, startDate),
        lte(shifts.startTime, endDate)
      )
    );

  const expenseRows = await db
    .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
    .from(expenses)
    .where(
      and(
        isNull(expenses.syncDeletedAt),
        gte(expenses.date, startDate),
        lte(expenses.date, endDate)
      )
    );

  const gross = shiftRows[0]?.grossRevenue ?? 0;
  const tips = shiftRows[0]?.tipsRevenue ?? 0;
  const totalEarnings = gross + tips;
  const totalExpenses = expenseRows[0]?.total ?? 0;
  const totalHours = (shiftRows[0]?.totalSeconds ?? 0) / 3600;

  return {
    grossRevenue: gross,
    tipsRevenue: tips,
    totalEarnings,
    totalExpenses,
    netEarnings: totalEarnings - totalExpenses,
    totalHours,
    totalMileage: shiftRows[0]?.totalMileage ?? 0,
    shiftCount: shiftRows[0]?.count ?? 0,
    avgHourlyRate: totalHours > 0 ? totalEarnings / totalHours : 0,
  };
}

export interface DailyEarnings {
  date: string;
  gross: number;
  expenses: number;
  net: number;
  hours: number;
  rate: number;  // gross / hours, 0 if no hours
}

export async function getDailyEarnings(startDate: Date, endDate: Date): Promise<DailyEarnings[]> {
  const db = await getDb();

  const [shiftRows, expenseRows] = await Promise.all([
    db.select({
      date:    sql<string>`date(start_time / 1000, 'unixepoch')`,
      gross:   sql<number>`COALESCE(SUM(gross_revenue + tips_revenue), 0)`,
      seconds: sql<number>`COALESCE(SUM(duration_seconds - paused_seconds), 0)`,
    })
    .from(shifts)
    .where(and(isNull(shifts.syncDeletedAt), gte(shifts.startTime, startDate), lte(shifts.startTime, endDate)))
    .groupBy(sql`date(start_time / 1000, 'unixepoch')`)
    .orderBy(sql`date(start_time / 1000, 'unixepoch')`),

    db.select({
      date:  sql<string>`date(date / 1000, 'unixepoch')`,
      total: sql<number>`COALESCE(SUM(amount), 0)`,
    })
    .from(expenses)
    .where(and(isNull(expenses.syncDeletedAt), gte(expenses.date, startDate), lte(expenses.date, endDate)))
    .groupBy(sql`date(date / 1000, 'unixepoch')`),
  ]);

  const expByDate: Record<string, number> = {};
  for (const r of expenseRows) expByDate[r.date] = r.total;

  return shiftRows.map((r) => {
    const exp   = expByDate[r.date] ?? 0;
    const hours = r.seconds / 3600;
    return {
      date:     r.date,
      gross:    r.gross,
      expenses: exp,
      net:      r.gross - exp,
      hours,
      rate:     hours > 0 ? r.gross / hours : 0,
    };
  });
}

export async function getTodayStats(): Promise<PeriodStats> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return getStatsForRange(start, end);
}

export async function getWeekStats(): Promise<PeriodStats> {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - dayOfWeek);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return getStatsForRange(start, end);
}

export async function getMonthStats(): Promise<PeriodStats> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return getStatsForRange(start, end);
}
