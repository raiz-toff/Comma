import { useEffect, useState } from "react";
import { getDueRecurringExpense, type DueRecurringExpense } from "@/src/services/recurringExpenses";

// Module-level guard, mirrors web's `recurringBootPromptDone` (expenses.js) — the
// due-check runs once per app session (resets on relaunch), never on every re-render
// or screen focus, so the prompt can't nag on every reload.
let recurringCheckDone = false;

export function useDueRecurringExpense(enabled: boolean) {
  const [dueExpense, setDueExpense] = useState<DueRecurringExpense | null>(null);

  useEffect(() => {
    if (!enabled || recurringCheckDone) return;
    recurringCheckDone = true;
    let cancelled = false;
    getDueRecurringExpense()
      .then((due) => {
        if (!cancelled) setDueExpense(due);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const dismiss = () => setDueExpense(null);

  return { dueExpense, dismiss };
}
