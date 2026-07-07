import { db } from "../client";
import { shifts, expenses, taxHistory, profile, settings } from "../schema";
import { sql, eq, and, gte, lte, desc } from "drizzle-orm";
import { Platform } from "react-native";
import { stampInsert, stampUpdate, notDeleted, isNotDeleted } from "../syncedWrites";

const isWeb = Platform.OS === "web";

export async function getTaxYearSummary(
  year: number
): Promise<{ grossRevenue: number; totalExpenses: number; netIncome: number }> {
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

  const shiftsRes = await db
    .select({
      gross: sql<number>`COALESCE(SUM(${shifts.grossRevenue} + ${shifts.tipsRevenue} + ${shifts.bonusAmount}), 0)`,
    })
    .from(shifts)
    .where(
      and(
        gte(shifts.startTime, startOfYear),
        lte(shifts.startTime, endOfYear),
        notDeleted(shifts.syncDeletedAt)
      )
    );

  const expensesRes = await db
    .select({
      // Use each expense's business-use percentage (deductible_pct, 0–100, default 100),
      // matching getExpenseYTDSummary / reportGenerator. Summing the full amount over-deducts
      // partially-deductible expenses and understates taxable net income.
      deductible: sql<number>`COALESCE(SUM(${expenses.amount} * ${expenses.deductiblePct} / 100.0), 0)`,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.isDeductible, true),
        gte(expenses.date, startOfYear),
        lte(expenses.date, endOfYear),
        notDeleted(expenses.syncDeletedAt)
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
    return list.filter(isNotDeleted).map((item: any) => ({
      ...item,
      changedAt: new Date(item.changedAt),
    })).sort((a: any, b: any) => b.changedAt.getTime() - a.changedAt.getTime());
  }
  const results = await db
    .select()
    .from(taxHistory)
    .where(notDeleted(taxHistory.syncDeletedAt))
    .orderBy(desc(taxHistory.changedAt));
  return results.map((r: any) => ({
    id: r.id,
    oldRegion: r.oldRegion,
    oldRate: r.oldRate ? Number(r.oldRate) : null,
    newRegion: r.newRegion,
    newRate: Number(r.newRate),
    changedAt: new Date(r.changedAt),
  }));
}

// ─── Tax Jar (Virtual Set-Aside Account) ────────────────────────────────────

/** Read the current Tax Jar balance for a given tax year */
// Tax Jar balance lives in the SYNCED `profile` KV table (one row per year, key
// `taxJar_{year}`) rather than the device-local `settings` table, so the amount you've set
// aside for taxes carries over between phone and web instead of tracking two separate
// balances per device. The generic push/pull change-log engine syncs every row in `profile`
// regardless of key, so this needs no changes to the sync engine or profileBridge's field
// map — that map only translates the legacy settings.profile JSON blob, it doesn't gate what
// can live in the table.
function taxJarKey(year: number): string {
  return `taxJar_${year}`;
}

/**
 * One-time upgrade path: balances saved before this table migration live under the OLD
 * device-local `settings` key (`tax_virtual_jar_{year}`). If the new synced row doesn't exist
 * yet, pull the legacy value in and write it to the synced location so it starts syncing and
 * this check becomes a no-op from then on. Returns 0 if there's nothing on either side.
 */
async function migrateLegacyJarBalance(year: number): Promise<number> {
  const legacyKey = `tax_virtual_jar_${year}`;
  let legacyValue: number | null = null;
  if (isWeb) {
    const raw = localStorage.getItem(`comma_setting_${legacyKey}`);
    if (raw != null) legacyValue = Number(raw) || 0;
  } else {
    const row = await db.select().from(settings).where(eq(settings.key, legacyKey)).limit(1);
    if (row[0]?.value != null) legacyValue = Number(row[0].value) || 0;
  }
  if (legacyValue == null) return 0;
  await setTaxJarBalance(year, legacyValue);
  return legacyValue;
}

export async function getTaxJarBalance(year: number): Promise<number> {
  const jarKey = taxJarKey(year);
  if (isWeb) {
    try {
      const raw = localStorage.getItem("comma_profile_sync");
      const rows: Array<{ key: string; value: string; syncDeletedAt?: number | null }> = raw ? JSON.parse(raw) : [];
      const row = rows.find((r) => r.key === jarKey && r.syncDeletedAt == null);
      if (row) return Number(JSON.parse(row.value)) || 0;
      return await migrateLegacyJarBalance(year);
    } catch {
      return 0;
    }
  }
  try {
    const row = await db
      .select()
      .from(profile)
      .where(and(eq(profile.key, jarKey), notDeleted(profile.syncDeletedAt)))
      .limit(1);
    if (row[0]?.value) return Number(JSON.parse(row[0].value)) || 0;
    return await migrateLegacyJarBalance(year);
  } catch {
    return 0;
  }
}

/** Persist the Tax Jar balance for a given tax year */
export async function setTaxJarBalance(year: number, amount: number): Promise<void> {
  const jarKey = taxJarKey(year);
  const value = JSON.stringify(Math.max(0, amount));
  if (isWeb) {
    const raw = localStorage.getItem("comma_profile_sync");
    const rows: Array<any> = raw ? JSON.parse(raw) : [];
    const idx = rows.findIndex((r) => r.key === jarKey);
    if (idx >= 0) rows[idx] = stampUpdate({ ...rows[idx], value, syncDeletedAt: null });
    else rows.push(stampInsert({ key: jarKey, value }));
    localStorage.setItem("comma_profile_sync", JSON.stringify(rows));
    return;
  }
  const existing = await db.select().from(profile).where(eq(profile.key, jarKey)).limit(1);
  if (existing[0]) {
    await db.update(profile).set(stampUpdate({ value, syncDeletedAt: null })).where(eq(profile.key, jarKey));
  } else {
    await db.insert(profile).values(stampInsert({ key: jarKey, value }));
  }
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
    list.push(stampInsert({
      ...entry,
      changedAt: entry.changedAt.toISOString(),
    }));
    localStorage.setItem("comma_tax_history", JSON.stringify(list));
    return;
  }

  await db.insert(taxHistory).values(stampInsert(entry));
}
