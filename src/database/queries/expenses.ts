import { db } from "../client";
import { expenses, merchants } from "../schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { Platform } from "react-native";
import { getExpenseCategories, type ExpenseCategory } from "@/src/registry/expenseCategories";
import { stampInsert, stampUpdate, softDeletePatch, notDeleted, isNotDeleted } from "../syncedWrites";

const isWeb = Platform.OS === "web";

export async function getExpensesByShift(shiftId: string): Promise<any[]> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_expenses");
    if (!existing) return [];
    const list = JSON.parse(existing);
    return list.filter((e: any) => e.shiftId === shiftId && isNotDeleted(e));
  }
  return await db.select().from(expenses).where(and(eq(expenses.shiftId, shiftId), notDeleted(expenses.syncDeletedAt)));
}

export async function getExpenseById(id: string): Promise<any | null> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_expenses");
    if (!existing) return null;
    const list = JSON.parse(existing);
    const found = list.find((e: any) => e.id === id);
    return found && isNotDeleted(found) ? found : null;
  }
  const result = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, id), notDeleted(expenses.syncDeletedAt)))
    .limit(1);
  return result[0] || null;
}

export async function getExpensesByMonth(
  year: number
): Promise<{ monthKey: string; label: string; items: any[] }[]> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_expenses");
    if (!existing) return [];
    const list = JSON.parse(existing).filter(
      (e: any) => new Date(e.date).getFullYear() === year && isNotDeleted(e)
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
    .where(and(gte(expenses.date, startOfYear), lte(expenses.date, endOfYear), notDeleted(expenses.syncDeletedAt)))
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
  const currentYear = new Date().getFullYear();

  if (isWeb) {
    const existing = localStorage.getItem("comma_expenses");
    if (!existing) return { deductible: 0, nonDeductible: 0 };
    const list: Array<{ date: string; amount: number; isDeductible: boolean; deductiblePct?: number; syncDeletedAt?: number | null }> = JSON.parse(existing);
    const ytd = list.filter((e) => new Date(e.date).getFullYear() === currentYear && isNotDeleted(e));
    const deductible = ytd
      .filter((e) => e.isDeductible)
      .reduce((sum, e) => sum + e.amount * ((e.deductiblePct ?? 100) / 100), 0);
    const nonDeductible = ytd
      .filter((e) => !e.isDeductible)
      .reduce((sum, e) => sum + e.amount, 0);
    return { deductible, nonDeductible };
  }

  const startOfYear = new Date(currentYear, 0, 1);
  const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59, 999);

  const rows = await db
    .select({
      deductible: sql<number>`COALESCE(SUM(CASE WHEN ${expenses.isDeductible} = 1 THEN ${expenses.amount} * ${expenses.deductiblePct} / 100.0 ELSE 0 END), 0)`,
      nonDeductible: sql<number>`COALESCE(SUM(CASE WHEN ${expenses.isDeductible} = 0 THEN ${expenses.amount} ELSE 0 END), 0)`,
    })
    .from(expenses)
    .where(and(gte(expenses.date, startOfYear), lte(expenses.date, endOfYear), notDeleted(expenses.syncDeletedAt)));

  return {
    deductible: rows[0]?.deductible ?? 0,
    nonDeductible: rows[0]?.nonDeductible ?? 0,
  };
}

export interface TaxCodeSummaryRow {
  taxCode: string;
  taxCodeLabel: string;
  totalSpend: number;
  totalDeductible: number;
  expenseCount: number;
}

export async function getExpensesByTaxCode(
  year: number,
  countryOrProfile: string,
  customCategories: Array<Partial<ExpenseCategory> & { id: string; label: string; icon: string }> = []
): Promise<TaxCodeSummaryRow[]> {
  const categories = getExpenseCategories(countryOrProfile, customCategories);
  const codeMap = new Map<string, { taxCode: string; taxCodeLabel: string }>();
  for (const cat of categories) {
    codeMap.set(cat.id, {
      taxCode: cat.taxCode ?? "Other",
      taxCodeLabel: cat.taxCodeLabel ?? "Other / Uncategorized",
    });
  }

  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

  let rows: Array<{ category: string; amount: number; deductiblePct: number; isDeductible: boolean }>;

  if (isWeb) {
    const existing = localStorage.getItem("comma_expenses");
    if (!existing) return [];
    rows = (JSON.parse(existing) as Array<any>)
      .filter((e) => new Date(e.date).getFullYear() === year && e.isDeductible && isNotDeleted(e))
      .map((e) => ({
        category: e.category as string,
        amount: e.amount as number,
        deductiblePct: (e.deductiblePct ?? 100) as number,
        isDeductible: !!e.isDeductible,
      }));
  } else {
    rows = await db
      .select({
        category: expenses.category,
        amount: expenses.amount,
        deductiblePct: expenses.deductiblePct,
        isDeductible: expenses.isDeductible,
      })
      .from(expenses)
      .where(and(gte(expenses.date, startOfYear), lte(expenses.date, endOfYear), eq(expenses.isDeductible, true), notDeleted(expenses.syncDeletedAt)));
  }

  const grouped = new Map<string, TaxCodeSummaryRow>();
  for (const row of rows) {
    const meta = codeMap.get(row.category) ?? { taxCode: "Other", taxCodeLabel: "Other / Uncategorized" };
    const key = meta.taxCode;
    const deductibleAmount = row.amount * (row.deductiblePct / 100);

    if (!grouped.has(key)) {
      grouped.set(key, { taxCode: meta.taxCode, taxCodeLabel: meta.taxCodeLabel, totalSpend: 0, totalDeductible: 0, expenseCount: 0 });
    }
    const entry = grouped.get(key)!;
    entry.totalSpend += row.amount;
    entry.totalDeductible += deductibleAmount;
    entry.expenseCount += 1;
  }

  return Array.from(grouped.values()).sort((a, b) => a.taxCode.localeCompare(b.taxCode));
}

export async function insertExpense(payload: typeof expenses.$inferInsert): Promise<void> {
  const name = (payload.merchant || "").trim();
  const norm = name.toUpperCase();
  payload.merchant = name;
  payload.merchantNormalized = norm;

  if (name.length > 0) {
    if (isWeb) {
      const mStr = localStorage.getItem("comma_merchants");
      const mList = mStr ? JSON.parse(mStr) : [];
      if (!mList.some((m: any) => m.normalizedName === norm)) {
        mList.push(stampInsert({ id: `m_${Date.now()}`, name, normalizedName: norm }));
        localStorage.setItem("comma_merchants", JSON.stringify(mList));
      }
    } else {
      try {
        await db.insert(merchants).values(stampInsert({
          id: `m_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name,
          normalizedName: norm
        })).onConflictDoNothing();
      } catch (err) {
        // ignore unique constraints
      }
    }
  }

  if (isWeb) {
    const existing = localStorage.getItem("comma_expenses");
    const list = existing ? JSON.parse(existing) : [];
    list.push(stampInsert(payload));
    localStorage.setItem("comma_expenses", JSON.stringify(list));
    return;
  }
  await db.insert(expenses).values(stampInsert(payload));
}

export async function updateExpense(id: string, payload: Partial<typeof expenses.$inferInsert>): Promise<void> {
  if (payload.merchant !== undefined) {
    const name = (payload.merchant || "").trim();
    const norm = name.toUpperCase();
    payload.merchant = name;
    payload.merchantNormalized = norm;

    if (name.length > 0) {
      if (isWeb) {
        const mStr = localStorage.getItem("comma_merchants");
        const mList = mStr ? JSON.parse(mStr) : [];
        if (!mList.some((m: any) => m.normalizedName === norm)) {
          mList.push(stampInsert({ id: `m_${Date.now()}`, name, normalizedName: norm }));
          localStorage.setItem("comma_merchants", JSON.stringify(mList));
        }
      } else {
        try {
          await db.insert(merchants).values(stampInsert({
            id: `m_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name,
            normalizedName: norm
          })).onConflictDoNothing();
        } catch (err) {
          // ignore
        }
      }
    }
  }

  if (isWeb) {
    const existing = localStorage.getItem("comma_expenses");
    if (existing) {
      const list = JSON.parse(existing);
      const idx = list.findIndex((e: any) => e.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...stampUpdate(payload) };
        localStorage.setItem("comma_expenses", JSON.stringify(list));
      }
    }
    return;
  }
  await db.update(expenses).set(stampUpdate(payload)).where(eq(expenses.id, id));
}

/**
 * Soft-delete (sync tombstone) — NOT a hard DELETE. Sets syncDeletedAt so the deletion
 * propagates to other devices; reads filter it out via notDeleted/isNotDeleted.
 */
export async function deleteExpense(id: string): Promise<void> {
  if (isWeb) {
    const existing = localStorage.getItem("comma_expenses");
    if (existing) {
      const list = JSON.parse(existing);
      const index = list.findIndex((e: any) => e.id === id);
      if (index !== -1) {
        list[index] = { ...list[index], ...softDeletePatch() };
        localStorage.setItem("comma_expenses", JSON.stringify(list));
      }
    }
    return;
  }
  await db.update(expenses).set(softDeletePatch()).where(eq(expenses.id, id));
}

export async function getRecentMerchants(): Promise<string[]> {
  if (isWeb) {
    const mStr = localStorage.getItem("comma_merchants");
    if (mStr) {
      const list = JSON.parse(mStr).filter(isNotDeleted);
      return list.map((m: any) => m.name);
    }
    // Fallback from expenses
    const eStr = localStorage.getItem("comma_expenses");
    if (!eStr) return [];
    const list = JSON.parse(eStr).filter(isNotDeleted);
    const set = new Set<string>();
    list.forEach((e: any) => {
      if (e.merchant) set.add(e.merchant);
    });
    return Array.from(set);
  }

  const result = await db.select({ name: merchants.name }).from(merchants).where(notDeleted(merchants.syncDeletedAt));
  if (result.length > 0) {
    return result.map((r: { name: string }) => r.name);
  }

  const expResult = await db.select({ merchant: expenses.merchant }).from(expenses).where(notDeleted(expenses.syncDeletedAt));
  const set = new Set<string>();
  expResult.forEach((r: { merchant: string }) => {
    if (r.merchant) set.add(r.merchant);
  });
  return Array.from(set);
}
