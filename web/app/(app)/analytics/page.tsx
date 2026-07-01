"use client";
import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { getStatsForRange, getDailyEarnings, type PeriodStats, type DailyEarnings } from "@/lib/db/queries/analytics";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency, formatDuration } from "@/lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, Clock, DollarSign, Receipt, Zap, Activity } from "lucide-react";

type Period = "week" | "month" | "year";

const PRESETS: { key: Period; label: string }[] = [
  { key: "week",  label: "This Week"  },
  { key: "month", label: "This Month" },
  { key: "year",  label: "This Year"  },
];

function getPeriodRange(p: Period) {
  const now = new Date();
  if (p === "week") {
    const start = new Date(now); start.setDate(now.getDate() - now.getDay()); start.setHours(0, 0, 0, 0);
    return { start, end: new Date(start.getTime() + 7 * 86400000) };
  }
  if (p === "month") {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
  }
  return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear() + 1, 0, 1) };
}

function StatCard({ label, value, sub, icon, accentColor }: { label: string; value: string; sub?: string; icon: React.ReactNode; accentColor: string }) {
  return (
    <div className="flex flex-col gap-2.5 p-4 rounded-2xl" style={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${accentColor}18` }}>{icon}</div>
        <span className="text-[11px] font-bold uppercase tracking-wide text-content-muted">{label}</span>
      </div>
      <p className="text-2xl font-extrabold text-content-primary" style={{ letterSpacing: "-0.5px" }}>{value}</p>
      {sub && <p className="text-xs text-content-muted">{sub}</p>}
    </div>
  );
}

export default function AnalyticsPage() {
  const { isDbReady } = useAppStore();
  const [period, setPeriod] = useState<Period>("month");
  const [stats, setStats] = useState<PeriodStats | null>(null);
  const [chart, setChart] = useState<DailyEarnings[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isDbReady) return;
    const { start, end } = getPeriodRange(period);
    setLoading(true);
    Promise.all([getStatsForRange(start, end), getDailyEarnings(start, end)])
      .then(([s, c]) => { setStats(s); setChart(c); })
      .finally(() => setLoading(false));
  }, [isDbReady, period]);

  const primaryColor = "hsl(var(--primary))";
  const gridColor = "hsl(var(--border))";
  const mutedColor = "hsl(var(--muted-foreground))";

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Period preset tabs */}
      <div className="flex items-center gap-2 p-1 rounded-2xl w-fit" style={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
        {PRESETS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className="rounded-xl px-4 py-2 text-sm font-semibold transition-all"
            style={period === key
              ? { backgroundColor: primaryColor, color: "hsl(var(--primary-foreground))" }
              : { color: mutedColor }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : stats && (
        <>
          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Gross Revenue" value={formatCurrency(stats.grossRevenue)} icon={<TrendingUp size={14} color={primaryColor} strokeWidth={2.5} />} accentColor={primaryColor} />
            <StatCard label="Net Income" value={formatCurrency(stats.netEarnings)} sub="after mileage write-off" icon={<DollarSign size={14} color="#4ade80" strokeWidth={2.5} />} accentColor="#4ade80" />
            <StatCard label="Expenses" value={formatCurrency(stats.totalExpenses)} icon={<Receipt size={14} color="#f87171" strokeWidth={2.5} />} accentColor="#f87171" />
            <StatCard label="Hours Worked" value={`${stats.totalHours.toFixed(1)}h`} icon={<Clock size={14} color="#60a5fa" strokeWidth={2.5} />} accentColor="#60a5fa" />
            <StatCard label="Shifts" value={String(stats.shiftCount)} icon={<Zap size={14} color="#fbbf24" strokeWidth={2.5} />} accentColor="#fbbf24" />
            <StatCard label="Avg / hr" value={formatCurrency(stats.avgHourlyRate)} sub="net hourly rate" icon={<Activity size={14} color="#a78bfa" strokeWidth={2.5} />} accentColor="#a78bfa" />
          </div>

          {/* Earnings chart */}
          <div className="rounded-2xl p-5 pt-4" style={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
            <p className="text-sm font-bold text-content-primary mb-4">Daily Earnings</p>
            {chart.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grossGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={primaryColor} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: mutedColor }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: mutedColor }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: `1px solid hsl(var(--border))`, borderRadius: 12, fontSize: 12 }}
                    labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 700 }}
                    formatter={(v: number) => [formatCurrency(v), ""]}
                  />
                  <Area type="monotone" dataKey="gross" stroke={primaryColor} fill="url(#grossGrad)" strokeWidth={2.5} name="Gross" />
                  <Area type="monotone" dataKey="net" stroke="#60a5fa" fill="none" strokeWidth={1.5} strokeDasharray="4 2" name="Net" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40">
                <p className="text-sm text-content-muted">No data for this period.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
