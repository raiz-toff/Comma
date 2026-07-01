"use client";
import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { getShiftsPaginated } from "@/lib/db/queries/shifts";
import { getExpensesPaginated } from "@/lib/db/queries/expenses";
import { getStatsForRange } from "@/lib/db/queries/analytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency, formatDate, formatTime, formatDuration } from "@/lib/utils";
import { Download, FileText } from "lucide-react";
import type { Shift, Expense } from "@/lib/db/schema";
import type { PeriodStats } from "@/lib/db/queries/analytics";

function StatRow({ label, value, primary }: { label: string; value: string; primary?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold uppercase tracking-wide text-content-muted">{label}</span>
      <span className={`text-sm font-bold ${primary ? "text-content-primary" : "text-content-secondary"}`}>{value}</span>
    </div>
  );
}

export default function ReportsPage() {
  const { isDbReady } = useAppStore();
  const now = new Date();
  const [startDate, setStartDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [stats, setStats] = useState<PeriodStats | null>(null);

  async function generate() {
    if (!isDbReady) return;
    setLoading(true);
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1);
    const [s, e, st] = await Promise.all([
      getShiftsPaginated(500, 0, { startDate: start, endDate: end }),
      getExpensesPaginated(500, 0, { startDate: start, endDate: end }),
      getStatsForRange(start, end),
    ]);
    setShifts(s); setExpenses(e); setStats(st);
    setLoading(false);
  }

  function downloadCSV() {
    const rows = [
      ["Date", "Platform", "Start", "End", "Gross ($)", "Tips ($)", "Total ($)", "Distance (km)", "Duration"],
      ...shifts.map((s) => [
        formatDate(s.startTime), s.platform, formatTime(s.startTime), formatTime(s.endTime),
        s.grossRevenue.toFixed(2), s.tipsRevenue.toFixed(2), (s.grossRevenue + s.tipsRevenue).toFixed(2),
        (s.activeMileage + s.deadMileage).toFixed(1), formatDuration(s.durationSeconds - s.pausedSeconds),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `comma-shifts-${startDate}-to-${endDate}.csv`;
    a.click();
  }

  function downloadExpensesCSV() {
    const rows = [
      ["Date", "Category", "Merchant", "Amount ($)", "Deductible", "Notes"],
      ...expenses.map((e) => [
        formatDate(e.date), e.category, e.merchant || "", e.amount.toFixed(2), e.isDeductible ? "Yes" : "No", e.notes || "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `comma-expenses-${startDate}-to-${endDate}.csv`;
    a.click();
  }

  const primary = "hsl(var(--primary))";
  const card = { backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" };

  return (
    <div className="space-y-5 max-w-3xl">

      {/* Date range picker */}
      <div className="rounded-2xl p-5" style={card}>
        <p className="text-[11px] font-bold uppercase tracking-widest text-content-muted mb-4">Date Range</p>
        <div className="flex flex-wrap items-end gap-3">
          <Input label="From" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
          <Input label="To"   type="date" value={endDate}   onChange={(e) => setEndDate(e.target.value)}   className="w-40" />
          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ backgroundColor: primary, color: "hsl(var(--primary-foreground))" }}
          >
            {loading ? <Spinner size="sm" /> : <FileText size={14} strokeWidth={2.5} />}
            Generate
          </button>
        </div>
      </div>

      {loading && <div className="flex justify-center py-12"><Spinner size="lg" /></div>}

      {stats && !loading && (
        <>
          {/* Summary bento */}
          <div className="rounded-2xl p-5" style={card}>
            <p className="text-[11px] font-bold uppercase tracking-widest text-content-muted mb-4">Summary</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <StatRow label="Gross Revenue"  value={formatCurrency(stats.grossRevenue)} primary />
              <StatRow label="Tips"           value={formatCurrency(stats.tipsRevenue)} />
              <StatRow label="Total Earnings" value={formatCurrency(stats.totalEarnings)} primary />
              <StatRow label="Expenses"       value={formatCurrency(stats.totalExpenses)} />
              <StatRow label="Net Earnings"   value={formatCurrency(stats.netEarnings)} primary />
              <StatRow label="Hours Worked"   value={`${stats.totalHours.toFixed(1)}h`} />
              <StatRow label="Shifts"         value={String(stats.shiftCount)} />
              <StatRow label="Avg Rate / hr"  value={formatCurrency(stats.avgHourlyRate)} />
              <StatRow label="Distance"       value={`${stats.totalMileage.toFixed(1)} km`} />
            </div>
          </div>

          {/* Export actions */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={downloadCSV}
              disabled={shifts.length === 0}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-30"
              style={{ backgroundColor: "hsl(var(--accent))", color: "hsl(var(--foreground))" }}
            >
              <Download size={14} /> Shifts CSV <span className="text-content-muted">({shifts.length})</span>
            </button>
            <button
              onClick={downloadExpensesCSV}
              disabled={expenses.length === 0}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-30"
              style={{ backgroundColor: "hsl(var(--accent))", color: "hsl(var(--foreground))" }}
            >
              <Download size={14} /> Expenses CSV <span className="text-content-muted">({expenses.length})</span>
            </button>
          </div>

          {/* Shift preview table */}
          {shifts.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={card}>
              <p className="text-[11px] font-bold uppercase tracking-widest text-content-muted px-5 pt-4 pb-3">
                Shifts ({shifts.length})
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                      {["Date", "Platform", "Earned", "Hours", "km"].map((h) => (
                        <th key={h} className="text-left pb-2.5 pt-1 px-5 text-[10px] font-bold uppercase tracking-wide text-content-muted">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.slice(0, 20).map((s, i) => (
                      <tr key={s.id} style={{ borderBottom: i < Math.min(19, shifts.length - 1) ? "1px solid hsl(var(--border))" : "none" }}>
                        <td className="py-3 px-5 text-content-secondary text-xs">{formatDate(s.startTime)}</td>
                        <td className="py-3 px-5 capitalize text-content-primary font-medium text-xs">{s.platform}</td>
                        <td className="py-3 px-5 font-bold text-content-primary text-xs">{formatCurrency(s.grossRevenue + s.tipsRevenue)}</td>
                        <td className="py-3 px-5 text-content-secondary text-xs">{((s.durationSeconds - s.pausedSeconds) / 3600).toFixed(1)}h</td>
                        <td className="py-3 px-5 text-content-secondary text-xs">{(s.activeMileage + s.deadMileage).toFixed(1)}</td>
                      </tr>
                    ))}
                    {shifts.length > 20 && (
                      <tr><td colSpan={5} className="py-3 px-5 text-xs text-content-muted">…and {shifts.length - 20} more rows. Download CSV for the full list.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
