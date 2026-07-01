"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getShiftWithPlatforms } from "@/lib/db/queries/shifts";
import { getExpensesPaginated } from "@/lib/db/queries/expenses";
import { Card, CardHeader, CardTitle, CardValue, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency, formatDate, formatTime, formatDuration, formatDistance } from "@/lib/utils";
import { ArrowLeft, Clock, DollarSign, MapPin, Receipt } from "lucide-react";
import type { Shift, Expense } from "@/lib/db/schema";

export default function ShiftDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [shift, setShift] = useState<(Shift & { platforms: any[] }) | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      getShiftWithPlatforms(id),
      getExpensesPaginated(50, 0, {}),
    ]).then(([s, exps]) => {
      setShift(s);
      setExpenses(exps.filter((e) => e.shiftId === id));
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex h-48 items-center justify-center"><Spinner size="lg" /></div>;
  if (!shift) return (
    <div className="text-center py-16">
      <p className="text-content-muted">Shift not found.</p>
      <Button variant="ghost" className="mt-4" onClick={() => router.back()}>Go back</Button>
    </div>
  );

  const earnings = shift.grossRevenue + shift.tipsRevenue;
  const activeSeconds = shift.durationSeconds - shift.pausedSeconds;
  const expensesTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="max-w-2xl space-y-5">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-content-muted hover:text-content-secondary">
        <ArrowLeft size={14} /> Shifts
      </button>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div>
          <h1 className="text-xl font-bold text-content-primary capitalize">{shift.platform}</h1>
          <p className="text-sm text-content-muted mt-0.5">{formatDate(shift.startTime)}</p>
        </div>
        <Badge className="ml-auto" variant={shift.reconciliationStatus === "reconciled" ? "success" : "warning"}>
          {shift.reconciliationStatus}
        </Badge>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Earned</CardTitle>
            <CardValue className="text-primary">{formatCurrency(earnings)}</CardValue>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Gross</CardTitle>
            <CardValue>{formatCurrency(shift.grossRevenue)}</CardValue>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tips</CardTitle>
            <CardValue>{formatCurrency(shift.tipsRevenue)}</CardValue>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Net</CardTitle>
            <CardValue className={earnings - expensesTotal >= 0 ? "text-primary" : "text-destructive"}>
              {formatCurrency(earnings - expensesTotal)}
            </CardValue>
          </CardHeader>
        </Card>
      </div>

      {/* Details */}
      <Card>
        <CardContent className="pt-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-line-subtle">
              <div className="flex items-center gap-2 text-sm text-content-secondary">
                <Clock size={14} /> Duration
              </div>
              <span className="text-sm font-medium text-content-primary">{formatDuration(activeSeconds)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-line-subtle">
              <div className="flex items-center gap-2 text-sm text-content-secondary">
                <Clock size={14} /> Start / End
              </div>
              <span className="text-sm font-medium text-content-primary">
                {formatTime(shift.startTime)} – {formatTime(shift.endTime)}
              </span>
            </div>
            {(shift.activeMileage > 0 || shift.deadMileage > 0) && (
              <div className="flex items-center justify-between py-2 border-b border-line-subtle">
                <div className="flex items-center gap-2 text-sm text-content-secondary">
                  <MapPin size={14} /> Distance
                </div>
                <span className="text-sm font-medium text-content-primary">
                  {formatDistance(shift.activeMileage + shift.deadMileage)}
                </span>
              </div>
            )}
            {activeSeconds > 0 && earnings > 0 && (
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2 text-sm text-content-secondary">
                  <DollarSign size={14} /> Hourly rate
                </div>
                <span className="text-sm font-medium text-content-primary">
                  {formatCurrency(earnings / (activeSeconds / 3600))}/hr
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {shift.notes && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-content-muted mb-2">Notes</p>
            <p className="text-sm text-content-secondary">{shift.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Linked Expenses */}
      {expenses.length > 0 && (
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-content-muted mb-2">
            <Receipt size={12} className="inline mr-1" /> Linked Expenses ({expenses.length})
          </p>
          <Card>
            <div className="divide-y divide-line-subtle">
              {expenses.map((e) => (
                <div key={e.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-content-primary capitalize">{e.category}</p>
                    <p className="text-xs text-content-muted">{formatDate(e.date)}{e.merchant ? ` · ${e.merchant}` : ""}</p>
                  </div>
                  <p className="text-sm font-bold text-destructive">{formatCurrency(e.amount)}</p>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}
