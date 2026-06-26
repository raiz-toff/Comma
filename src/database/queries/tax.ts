import { db } from "../client";
import { shifts, expenses, taxHistory } from "../schema";
import { sql, eq, and, gte, lte, desc } from "drizzle-orm";
import { Platform } from "react-native";

const isWeb = Platform.OS === "web";

export async function getTaxYearSummary(
  year: number
): Promise<{ grossRevenue: number; totalExpenses: number; netIncome: number }> {
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

  const shiftsRes = await db
    .select({
      gross: sql<number>`COALESCE(SUM(${shifts.grossRevenue} + ${shifts.tipsRevenue}), 0)`,
    })
    .from(shifts)
    .where(
      and(
        gte(shifts.startTime, startOfYear),
        lte(shifts.startTime, endOfYear)
      )
    );

  const expensesRes = await db
    .select({
      deductible: sql<number>`COALESCE(SUM(${expenses.amount}), 0)`,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.isDeductible, true),
        gte(expenses.date, startOfYear),
        lte(expenses.date, endOfYear)
      )
    );

  const grossRevenue = Number(shiftsRes[0]?.gross || 0);
  const totalExpenses = Number(expensesRes[0]?.deductible || 0);
  const netIncome = Math.max(0, grossRevenue - totalExpenses);

  return { grossRevenue, totalExpenses, netIncome };
}

export type TaxHistoryEntry = {
  id: string;
  oldRegion: string | null;
  oldRate: number | null;
  newRegion: string;
  newRate: number;
  changedAt: Date;
};

export async function getTaxHistory(): Promise<TaxHistoryEntry[]> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_tax_history");
    if (!existing) return [];
    const list = JSON.parse(existing);
    return list.map((item: any) => ({
      ...item,
      changedAt: new Date(item.changedAt),
    })).sort((a: any, b: any) => b.changedAt.getTime() - a.changedAt.getTime());
  }
  const results = await db.select().from(taxHistory).orderBy(desc(taxHistory.changedAt));
  return results.map((r: any) => ({
    id: r.id,
    oldRegion: r.oldRegion,
    oldRate: r.oldRate ? Number(r.oldRate) : null,
    newRegion: r.newRegion,
    newRate: Number(r.newRate),
    changedAt: new Date(r.changedAt),
  }));
}

export async function insertTaxHistory(payload: {
  oldRegion: string | null;
  oldRate: number | null;
  newRegion: string;
  newRate: number;
}): Promise<void> {
  const entry = {
    id: "tax_hist_" + Date.now(),
    oldRegion: payload.oldRegion,
    oldRate: payload.oldRate,
    newRegion: payload.newRegion,
    newRate: payload.newRate,
    changedAt: new Date(),
  };

  if (isWeb) {
    const existing = localStorage.getItem("comma_tax_history");
    const list = existing ? JSON.parse(existing) : [];
    list.push({
      ...entry,
      changedAt: entry.changedAt.toISOString(),
    });
    localStorage.setItem("comma_tax_history", JSON.stringify(list));
    return;
  }

  await db.insert(taxHistory).values(entry);
}
