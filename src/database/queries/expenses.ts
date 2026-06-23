import { db } from "../client";
import { expenses } from "../schema";
import { eq, and, desc } from "drizzle-orm";
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

export async function getExpensesByMonth(year: number): Promise<any[]> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_expenses");
    if (!existing) return [];
    const list = JSON.parse(existing);
    return list.filter((e: any) => new Date(e.date).getFullYear() === year);
  }
  // Simplified for all expenses for now
  return await db.select().from(expenses).orderBy(desc(expenses.date));
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
