import { desc, eq, and, gte, lte, isNull, sql } from "drizzle-orm";
import { getDb, scheduleDbSave } from "../index";
import { expenses } from "../schema";
import type { Expense } from "../schema";

export type { Expense };

export async function getExpensesPaginated(
  limit = 50,
  offset = 0,
  filters?: { category?: string; startDate?: Date; endDate?: Date }
): Promise<Expense[]> {
  const db = await getDb();
  const conditions = [isNull(expenses.syncDeletedAt)];
  if (filters?.category) conditions.push(eq(expenses.category, filters.category));
  if (filters?.startDate) conditions.push(gte(expenses.date, filters.startDate));
  if (filters?.endDate) conditions.push(lte(expenses.date, filters.endDate));

  return db
    .select()
    .from(expenses)
    .where(and(...conditions))
    .orderBy(desc(expenses.date))
    .limit(limit)
    .offset(offset);
}

export async function getExpenseById(id: string): Promise<Expense | null> {
  const db = await getDb();
  const rows = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function insertExpense(data: typeof expenses.$inferInsert): Promise<void> {
  const db = await getDb();
  await db.insert(expenses).values(data);
  scheduleDbSave();
}

export async function updateExpense(id: string, data: Partial<typeof expenses.$inferInsert>): Promise<void> {
  const db = await getDb();
  await db.update(expenses).set({ ...data, syncUpdatedAt: Date.now() }).where(eq(expenses.id, id));
  scheduleDbSave();
}

export async function softDeleteExpense(id: string): Promise<void> {
  const db = await getDb();
  await db.update(expenses).set({ syncDeletedAt: Date.now() }).where(eq(expenses.id, id));
  scheduleDbSave();
}

export async function getExpensesByMonth(year: number, month: number): Promise<Expense[]> {
  const db = await getDb();
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  return db
    .select()
    .from(expenses)
    .where(and(isNull(expenses.syncDeletedAt), gte(expenses.date, start), lte(expenses.date, end)))
    .orderBy(desc(expenses.date));
}

export async function getTotalExpenses(startDate?: Date, endDate?: Date): Promise<number> {
  const db = await getDb();
  const conditions = [isNull(expenses.syncDeletedAt)];
  if (startDate) conditions.push(gte(expenses.date, startDate));
  if (endDate) conditions.push(lte(expenses.date, endDate));

  const result = await db
    .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
    .from(expenses)
    .where(and(...conditions));
  return result[0]?.total ?? 0;
}
