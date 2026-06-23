import { db } from "../client";
import { shifts, expenses } from "../schema";
import { sql, eq, and, gte, lte } from "drizzle-orm";

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
