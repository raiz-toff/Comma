"use client";
import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useAppStore } from "@/store/useAppStore";
import { getStatsForRange, getDailyEarnings, type PeriodStats, type DailyEarnings } from "@/lib/db/queries/analytics";
import { formatCurrency } from "@/lib/utils";

// ─── Spark helpers ────────────────────────────────────────────────────────────

function sparkLine(pts: number[], h = 38) {
  if (!pts || pts.length < 2) return { path: "", area: "" };
  const max = Math.max(...pts, 1), min = Math.min(...pts), rng = (max - min) || 1;
  const coords = pts.map((p, i) => [(i / (pts.length - 1)) * 100, h - ((p - min) / rng) * h] as [number, number]);
  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [fx] = coords[0]; const [lx] = coords[coords.length - 1];
  const area = path + ` L ${lx.toFixed(1)},${h} L ${fx.toFixed(1)},${h} Z`;
  return { path, area };
}

function sparkStep(pts: number[], h = 38) {
  if (!pts || pts.length < 2) return { path: "", area: "" };
  const max = Math.max(...pts, 1), min = Math.min(...pts), rng = (max - min) || 1;
  let path = "";
  pts.forEach((p, i) => {
    const x = (i / (pts.length - 1)) * 100;
    const y = h - ((p - min) / rng) * h;
    if (i === 0) { path += `M ${x.toFixed(1)},${y.toFixed(1)}`; return; }
    const prevYStr = path.match(/[\d.]+$/)?.[0] ?? `${h}`;
    path += ` L ${x.toFixed(1)},${prevYStr} L ${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return { path, area: path + ` L 100,${h} L 0,${h} Z` };
}

function sparkCurve(pts: number[], h = 38) {
  if (!pts || pts.length < 2) return { path: "", area: "" };
  const max = Math.max(...pts, 1), min = Math.min(...pts), rng = (max - min) || 1;
  let path = "";
  pts.forEach((p, i) => {
    const x = (i / (pts.length - 1)) * 100;
    const y = h - ((p - min) / rng) * h;
    if (i === 0) { path += `M ${x.toFixed(1)},${y.toFixed(1)}`; return; }
    const prevX = ((i - 1) / (pts.length - 1)) * 100;
    const prevY = h - ((pts[i - 1] - min) / rng) * h;
    const cpX = prevX + (x - prevX) / 2;
    path += ` C ${cpX.toFixed(1)},${prevY.toFixed(1)} ${cpX.toFixed(1)},${y.toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return { path, area: path + ` L 100,${h} L 0,${h} Z` };
}

// ─── Period helpers ───────────────────────────────────────────────────────────

type Preset = "week" | "month" | "ytd" | "year";

function getRange(p: Preset) {
  const now = new Date();
  if (p === "week") {
    const s = new Date(now); s.setDate(now.getDate() - now.getDay()); s.setHours(0, 0, 0, 0);
    return { start: s, end: new Date(s.getTime() + 7 * 86400000) };
  }
  if (p === "month") return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
  if (p === "ytd") return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
  return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear() + 1, 0, 1) };
}

function getPrevRange(p: Preset) {
  const now = new Date();
  if (p === "week") {
    const s = new Date(now); s.setDate(now.getDate() - now.getDay() - 7); s.setHours(0, 0, 0, 0);
    return { start: s, end: new Date(s.getTime() + 7 * 86400000) };
  }
  if (p === "month") return { start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: new Date(now.getFullYear(), now.getMonth(), 1) };
  return { start: new Date(now.getFullYear() - 1, 0, 1), end: new Date(now.getFullYear(), 0, 1) };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, accent, children, pulseDot }: { label: string; accent: string; children: React.ReactNode; pulseDot?: boolean }) {
  return (
    <div className="relative flex flex-col overflow-hidden"
      style={{ backgroundColor: "#1c1a17", padding: "18px 18px 14px", minHeight: 208 }}>
      <div className="pointer-events-none absolute inset-0" style={{
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
        backgroundSize: "80px 80px", opacity: 0.018, mixBlendMode: "overlay",
      }} />
      {pulseDot && (
        <div className="absolute" style={{ top: 16, right: 16 }}>
          <div className="rounded-full" style={{ width: 8, height: 8, backgroundColor: accent, position: "absolute" }} />
          <div className="rounded-full absolute" style={{ inset: 0, border: `1.5px solid ${accent}`, animation: "kpi-pulse 1.5s ease-out 0.6s infinite" }} />
        </div>
      )}
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>
        {label}
      </div>
      <div className="relative z-10 flex flex-col flex-1">{children}</div>
    </div>
  );
}

function KpiValue({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "1.8rem", fontWeight: 900, letterSpacing: "-0.03em", color: "#f4f2ed", lineHeight: 1, marginBottom: 0, fontVariantNumeric: "tabular-nums" }}>
      {children}
    </div>
  );
}

function KpiBadge({ accent, label, sub }: { accent: string; label: string; sub: string }) {
  return (
    <div style={{ marginTop: "auto", display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, padding: "4px 10px", fontSize: 11, fontWeight: 800, alignSelf: "flex-start" }}>
      <span style={{ color: accent }}>{label}</span>
      <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: 700, letterSpacing: "0.06em" }}>{sub}</span>
    </div>
  );
}

function SparkSvg({ path, area, accent }: { path: string; area: string; accent: string }) {
  const id = `g${accent.replace("#", "")}`;
  return (
    <svg viewBox="0 0 100 38" preserveAspectRatio="none" width="100%" height="50" style={{ margin: "8px 0", overflow: "visible", flexShrink: 0 }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity={0.22} />
          <stop offset="100%" stopColor={accent} stopOpacity={0} />
        </linearGradient>
      </defs>
      {area && <path d={area} fill={`url(#${id})`} />}
      {path && <path d={path} fill="none" stroke={accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

function BarPillars({ pts, accent }: { pts: number[]; accent: string }) {
  const max = Math.max(...pts, 1);
  return (
    <div style={{ display: "flex", gap: 2, height: 30, alignItems: "flex-end", margin: "10px 0" }}>
      {pts.map((p, i) => (
        <div key={i} style={{ flex: 1, background: accent, borderRadius: 2, height: Math.max(3, Math.round((p / max) * 26)) }} />
      ))}
    </div>
  );
}

function DotMatrix({ accent }: { accent: string }) {
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "center", margin: "14px 0 10px", flexWrap: "wrap" }}>
      {Array.from({ length: 14 }, (_, i) => (
        <div key={i} style={{ width: 5, height: 5, borderRadius: 1, background: accent, opacity: 0.3 + (i / 14) * 0.7 }} />
      ))}
    </div>
  );
}

function TabToggle({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "1.5px", gap: 1 }}>
      {options.map((opt) => (
        <button key={opt} onClick={() => onChange(opt)} style={{
          padding: "1px 7px", fontSize: 9, fontWeight: 800, borderRadius: 8, lineHeight: "16px", height: 18,
          border: "none", cursor: "pointer", transition: "all 0.15s",
          background: value === opt ? "rgba(255,255,255,0.15)" : "transparent",
          color: value === opt ? "#f4f2ed" : "rgba(255,255,255,0.35)",
        }}>
          {opt}
        </button>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PRESETS: { key: Preset; label: string }[] = [
  { key: "week",  label: "Week"  },
  { key: "month", label: "Month" },
  { key: "ytd",   label: "YTD"   },
  { key: "year",  label: "Year"  },
];

export default function DashboardPage() {
  const { isDbReady, profile } = useAppStore();
  const [preset, setPreset] = useState<Preset>("month");
  const [stats, setStats]       = useState<PeriodStats | null>(null);
  const [prevStats, setPrevStats] = useState<PeriodStats | null>(null);
  const [daily, setDaily]       = useState<DailyEarnings[]>([]);
  const [loading, setLoading]   = useState(true);
  const [rateTab,  setRateTab]  = useState("Active");
  const [hoursTab, setHoursTab] = useState("Active");

  useEffect(() => {
    if (!isDbReady) return;
    setLoading(true);
    const { start, end }         = getRange(preset);
    const { start: ps, end: pe } = getPrevRange(preset);
    Promise.all([
      getStatsForRange(start, end),
      getStatsForRange(ps, pe),
      getDailyEarnings(start, end),   // sparklines = same window as KPI numbers
    ]).then(([s, p, d]) => { setStats(s); setPrevStats(p); setDaily(d); })
      .finally(() => setLoading(false));
  }, [isDbReady, preset]);

  if (!isDbReady || loading || !stats) {
    return <div className="flex h-48 items-center justify-center"><Spinner size="lg" /></div>;
  }

  const gross      = stats.grossRevenue;
  const expenses   = stats.totalExpenses;
  const netEarnings = stats.netEarnings;
  const hours      = stats.totalHours;
  const activeRate = stats.avgHourlyRate;
  const taxRate    = typeof (profile as Record<string, unknown>)?.taxWithholdingPct === "number"
    ? (profile as Record<string, unknown>).taxWithholdingPct as number
    : 29;
  const taxSetAside  = gross * (taxRate / 100);
  const netAfterTax  = netEarnings - taxSetAside;
  const netMargin    = gross > 0 ? Math.max(0, (netAfterTax / gross) * 100) : 0;
  const burnRatio    = gross > 0 ? Math.min(100, (expenses / gross) * 100) : 0;
  const prevGross    = prevStats?.grossRevenue ?? 0;
  const delta        = prevGross > 0 ? ((gross - prevGross) / prevGross) * 100 : 0;
  const isUp         = delta >= 0;

  const hoursInt = Math.floor(hours);
  const hoursDec = (hours % 1).toFixed(2).slice(1);
  const hoursM   = Math.round((hours % 1) * 60);

  // All sparkline arrays come from real DB rows.
  // pad to ≥2 points so SVG paths are always drawable.
  const pad = (arr: number[]) => arr.length >= 2 ? arr : arr.length === 1 ? [0, arr[0]] : [0, 0];
  const grossPts  = pad(daily.map((d) => d.gross));
  const netPts    = pad(daily.map((d) => d.net));
  const expPts    = pad(daily.map((d) => d.expenses));
  const ratePts   = pad(daily.map((d) => d.rate));
  const pillarPts = pad(daily.map((d) => d.hours));

  const lGross = sparkLine(grossPts);
  const lRate  = sparkLine(ratePts);
  const lExp   = sparkStep(expPts);
  const lNet   = sparkCurve(netPts);

  const primary = "hsl(var(--primary))";
  const pf      = "hsl(var(--primary-foreground))";

  return (
    <div className="space-y-5 max-w-5xl">
      <style>{`@keyframes kpi-pulse { 0%{transform:scale(1);opacity:0.5} 100%{transform:scale(1.7);opacity:0} }`}</style>

      {/* Period tabs */}
      <div className="flex items-center gap-1 p-1 rounded-2xl w-fit" style={{ backgroundColor: "#1c1a17", border: "1px solid rgba(255,255,255,0.07)" }}>
        {PRESETS.map(({ key, label }) => (
          <button key={key} onClick={() => setPreset(key)}
            className="rounded-xl px-4 py-1.5 text-sm font-bold transition-all"
            style={preset === key ? { background: primary, color: pf } : { color: "rgba(255,255,255,0.4)", background: "transparent" }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 3 × 2 grid — 1px gap acts as divider lines */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: "rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>

        {/* ① GROSS EARNINGS */}
        <KpiCard label="Gross Earnings" accent="#14b8a6" pulseDot>
          <KpiValue>{formatCurrency(gross)}</KpiValue>
          <SparkSvg {...lGross} accent="#14b8a6" />
          <KpiBadge accent="#14b8a6" label={`${isUp ? "↑" : "↓"} ${Math.abs(delta).toFixed(1)}%`} sub="VS LAST" />
        </KpiCard>

        {/* ② AVG RATE / HR */}
        <KpiCard label="Avg Rate / Hr" accent="#f59e0b">
          <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
            <span />
            <TabToggle options={["Active", "Online"]} value={rateTab} onChange={setRateTab} />
          </div>
          <KpiValue>
            {formatCurrency(activeRate)}
            <span style={{ fontSize: "0.42em", opacity: 0.55, fontWeight: 800, marginLeft: 3 }}>/hr</span>
          </KpiValue>
          <SparkSvg {...lRate} accent="#f59e0b" />
          <KpiBadge accent="#f59e0b" label={activeRate >= 35 ? "ELITE" : activeRate >= 25 ? "PRO" : "ACTIVE"} sub="ACTIVE EFFICIENCY" />
        </KpiCard>

        {/* ③ BUSINESS EXPENSES */}
        <KpiCard label="Business Expenses" accent="#06b6d4">
          <KpiValue>{formatCurrency(expenses)}</KpiValue>
          <SparkSvg {...lExp} accent="#06b6d4" />
          <KpiBadge accent="#06b6d4" label={`${burnRatio.toFixed(1)}%`} sub="OF GROSS" />
        </KpiCard>

        {/* ④ TAX SET ASIDE */}
        <KpiCard label="Tax Set Aside" accent="#0ea5e9">
          <KpiValue>{formatCurrency(taxSetAside)}</KpiValue>
          <DotMatrix accent="#0ea5e9" />
          <KpiBadge accent="#0ea5e9" label={`${taxRate}%`} sub="TAX RATE" />
        </KpiCard>

        {/* ⑤ NET AFTER TAX */}
        <KpiCard label="Net After Tax" accent="#3b82f6">
          <KpiValue>{formatCurrency(netAfterTax)}</KpiValue>
          <SparkSvg {...lNet} accent="#3b82f6" />
          <KpiBadge accent="#3b82f6" label={`${netMargin.toFixed(1)}%`} sub="MARGIN" />
        </KpiCard>

        {/* ⑥ TOTAL HOURS */}
        <KpiCard label="Total Hours" accent="#6366f1">
          <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
            <span />
            <TabToggle options={["Active", "Online"]} value={hoursTab} onChange={setHoursTab} />
          </div>
          <KpiValue>
            <span style={{ fontWeight: 900 }}>{hoursInt}</span>
            <span style={{ fontSize: "0.52em", fontWeight: 800, opacity: 0.6 }}>{hoursDec}</span>
            <span style={{ fontSize: "0.38em", fontWeight: 900, marginLeft: 8, color: "#3b82f6", letterSpacing: "0.05em" }}>HRS</span>
          </KpiValue>
          <BarPillars pts={pillarPts} accent="#6366f1" />
          <KpiBadge accent="#3b82f6" label={`${hoursInt}h ${hoursM}m`} sub="ACTIVE" />
        </KpiCard>

      </div>
    </div>
  );
}
