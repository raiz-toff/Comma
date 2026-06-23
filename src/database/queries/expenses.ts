import { db } from "../client";
import { expenses } from "../schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { Platform } from "react-native";

const isWeb = Platform.OS === "web";

export async function getExpensesByShift(shiftId: string): Promise<any[]> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_expenses");
    if (!existing) return [];
    const list = JSON.parse(existing);
    return list.filter((e: any) => e.shiftId === shiftId);
  }
  return await db.select().from(expenses).where(eq(expenses.shiftId, shiftId));
}

export async function getExpenseById(id: string): Promise<any | null> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_expenses");
    if (!existing) return null;
    const list = JSON.parse(existing);
    return list.find((e: any) => e.id === id) || null;
  }
  const result = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
  return result[0] || null;
}

export async function getExpensesByMonth(
  year: number
): Promise<{ monthKey: string; label: string; items: any[] }[]> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_expenses");
    if (!existing) return [];
    const list = JSON.parse(existing).filter(
      (e: any) => new Date(e.date).getFullYear() === year
    );
    const map: Record<string, any[]> = {};
    list.forEach((e: any) => {
      const dateObj = new Date(e.date);
      const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return Object.keys(map)
      .sort((a, b) => b.localeCompare(a))
      .map((key) => ({
        monthKey: key,
        label: new Date(key + "-01").toLocaleDateString(undefined, { month: "long", year: "numeric" }),
        items: map[key].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      }));
  }

  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

  const rows = await db
    .select()
    .from(expenses)
    .where(and(gte(expenses.date, startOfYear), lte(expenses.date, endOfYear)))
    .orderBy(desc(expenses.date));

  const map: Record<string, any[]> = {};
  rows.forEach((e: any) => {
    const dateObj = new Date(e.date);
    const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
    if (!map[key]) map[key] = [];
    map[key].push(e);
  });

  return Object.keys(map)
    .sort((a, b) => b.localeCompare(a))
    .map((key) => ({
      monthKey: key,
      label: new Date(key + "-01").toLocaleDateString(undefined, { month: "long", year: "numeric" }),
      items: map[key],
    }));
}

export async function getExpenseYTDSummary(): Promise<{ deductible: number; nonDeductible: number }> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_expenses");
    if (!existing) return { deductible: 0, nonDeductible: 0 };
    const list = JSON.parse(existing);
    const currentYear = new Date().getFullYear();
    const ytd = list.filter((e: any) => new Date(e.date).getFullYear() === currentYear);
    const deductible = ytd.filter((e: any) => e.isDeductible).reduce((sum: number, e: any) => sum + e.amount, 0);
    const nonDeductible = ytd.filter((e: any) => !e.isDeductible).reduce((sum: number, e: any) => sum + e.amount, 0);
    return { deductible, nonDeductible };
  }

  const results = await db.select().from(expenses);
  const currentYear = new Date().getFullYear();
  const ytd = results.filter((e: any) => new Date(e.date).getFullYear() === currentYear);
  const deductible = ytd.filter((e: any) => e.isDeductible).reduce((sum: number, e: any) => sum + e.amount, 0);
  const nonDeductible = ytd.filter((e: any) => !e.isDeductible).reduce((sum: number, e: any) => sum + e.amount, 0);
  return { deductible, nonDeductible };
}

export async function insertExpense(payload: typeof expenses.$inferInsert): Promise<void> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_expenses");
    const list = existing ? JSON.parse(existing) : [];
    list.push(payload);
    localStorage.setItem("comma_expenses", JSON.stringify(list));
    return;
  }
  await db.insert(expenses).values(payload);
}

export async function updateExpense(id: string, payload: Partial<typeof expenses.$inferInsert>): Promise<void> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_expenses");
    if (existing) {
      const list = JSON.parse(existing);
      const idx = list.findIndex((e: any) => e.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...payload };
        localStorage.setItem("comma_expenses", JSON.stringify(list));
      }
    }
    return;
  }
  await db.update(expenses).set(payload).where(eq(expenses.id, id));
}

export async function deleteExpense(id: string): Promise<void> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_expenses");
    if (existing) {
      const list = JSON.parse(existing);
      const filtered = list.filter((e: any) => e.id !== id);
      localStorage.setItem("comma_expenses", JSON.stringify(filtered));
    }
    return;
  }
  await db.delete(expenses).where(eq(expenses.id, id));
}
