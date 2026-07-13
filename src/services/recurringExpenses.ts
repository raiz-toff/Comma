/**
 * Recurring-expense reminders: mobile mirror of web's
 * `web/src/modules/expenses/expenses.js` (createRecurringOccurrenceAndAdvance /
 * runRecurringExpensePromptOnce). A recurring expense is a template row
 * (isRecurring=true) carrying recurringNextDate/recurringSnoozeUntil; when due,
 * the user confirms and a one-off occurrence row is inserted while the template
 * advances to the next date.
 */
import { db } from "../database/client";
import { expenses } from "../database/schema";
import { eq, and, or, lte, isNull, isNotNull, asc } from "drizzle-orm";
import { notDeleted } from "../database/syncedWrites";
import { insertExpense, updateExpense } from "../database/queries/expenses";
import { Platform } from "react-native";

const isWeb = Platform.OS === "web";

export type RecurringInterval = "weekly" | "monthly" | "yearly";

export function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function today(): string {
  return ymd(new Date());
}

/** Mirrors web's addInterval (expenses.js) — 'annual' accepted as a synonym so rows
 *  synced from web (which stores 'annual') still advance correctly on mobile. */
export function addRecurringInterval(dateStr: string, interval: string | null | undefined): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  if (interval === "weekly") d.setDate(d.getDate() + 7);
  else if (interval === "yearly" || interval === "annual") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return ymd(d);
}

export function addSnoozeDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + days);
  return ymd(d);
}

export type DueRecurringExpense = typeof expenses.$inferSelect;

/** Earliest-due recurring template, if any — never returns more than one, matching
 *  web's "prompt for a single occurrence at a time" behavior. */
export async function getDueRecurringExpense(): Promise<DueRecurringExpense | null> {
  const todayStr = today();
  if (isWeb) {
    const existing = localStorage.getItem("comma_expenses");
    if (!existing) return null;
    const list = JSON.parse(existing).filter(
      (e: any) =>
        e.isRecurring &&
        e.recurringNextDate &&
        e.recurringNextDate <= todayStr &&
        (!e.recurringSnoozeUntil || e.recurringSnoozeUntil <= todayStr) &&
        e.syncDeletedAt == null
    );
    if (list.length === 0) return null;
    list.sort((a: any, b: any) => String(a.recurringNextDate).localeCompare(String(b.recurringNextDate)));
    return list[0];
  }

  const result = await db
    .select()
    .from(expenses)
    .where(
      and(
        eq(expenses.isRecurring, true),
        isNotNull(expenses.recurringNextDate),
        lte(expenses.recurringNextDate, todayStr),
        or(isNull(expenses.recurringSnoozeUntil), lte(expenses.recurringSnoozeUntil, todayStr)),
        notDeleted(expenses.syncDeletedAt)
      )
    )
    .orderBy(asc(expenses.recurringNextDate))
    .limit(1);
  return result[0] || null;
}

/** Records one paid occurrence for a recurring template and advances its next date.
 *  Uses insertExpense/updateExpense (not a raw db.update) so both writes stamp
 *  syncUpdatedAt and sync correctly — the exact bug fixed on web's equivalent path. */
export async function materializeRecurringOccurrence(
  template: DueRecurringExpense,
  overrides: Partial<typeof expenses.$inferInsert> = {}
): Promise<void> {
  const nextDate = String(template.recurringNextDate);

  const occurrence: typeof expenses.$inferInsert = {
    id: `expense_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    category: template.category,
    amount: template.amount,
    date: new Date(`${nextDate}T00:00:00`),
    isDeductible: template.isDeductible,
    deductiblePct: template.deductiblePct,
    vehicleId: template.vehicleId,
    notes: template.notes,
    merchant: template.merchant,
    merchantNormalized: template.merchantNormalized,
    shiftId: null,
    isRecurring: false,
    recurringInterval: null,
    recurringNextDate: null,
    recurringSnoozeUntil: null,
    ...overrides,
  };

  const occurrenceDateStr = ymd(occurrence.date as Date);
  let hasExisting: boolean;
  if (isWeb) {
    const stored = localStorage.getItem("comma_expenses");
    const list = stored ? JSON.parse(stored) : [];
    hasExisting = list.some(
      (e: any) =>
        e.syncDeletedAt == null &&
        e.category === occurrence.category &&
        e.amount === occurrence.amount &&
        ymd(new Date(e.date)) === occurrenceDateStr
    );
  } else {
    const existing = await db
      .select()
      .from(expenses)
      .where(
        and(
          eq(expenses.category, occurrence.category as string),
          eq(expenses.amount, occurrence.amount as number),
          eq(expenses.date, occurrence.date as Date),
          notDeleted(expenses.syncDeletedAt)
        )
      )
      .limit(1);
    hasExisting = existing.length > 0;
  }

  if (!hasExisting) {
    await insertExpense(occurrence);
  }

  await advanceRecurringTemplate(template);
}

/** Moves a recurring template's next-due date forward by one interval. Exported
 *  separately so a screen that materializes its own occurrence row (e.g. the
 *  "Edit Amount" flow, which reuses the normal add-expense form) can advance the
 *  template afterward without duplicating this logic. */
export async function advanceRecurringTemplate(template: Pick<DueRecurringExpense, "id" | "recurringNextDate" | "recurringInterval">): Promise<void> {
  await updateExpense(template.id, {
    recurringNextDate: addRecurringInterval(String(template.recurringNextDate), template.recurringInterval),
    recurringSnoozeUntil: null,
  });
}

/** Suppresses the due-check for this template for a few days — mirrors web's "Skip
 *  for now" (3-day snooze, expenses.js). */
export async function snoozeRecurringExpense(templateId: string): Promise<void> {
  await updateExpense(templateId, {
    recurringSnoozeUntil: addSnoozeDays(today(), 3),
  });
}
