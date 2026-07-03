"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useAppStore } from "@/store/useAppStore";
import { getShiftsPaginated, insertShift, type Shift } from "@/lib/db/queries/shifts";
import { getVehicles, type Vehicle } from "@/lib/db/queries/vehicles";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

// ─── Platform logos ───────────────────────────────────────────────────────────

function PlatformLogo({ id, size = 16 }: { id: string; size?: number }) {
  switch (id.toLowerCase()) {
    case "doordash":
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M23.071 8.409a6.09 6.09 0 0 0-5.396-3.228H.584A.589.589 0 0 0 .17 6.184L3.894 9.93a1.752 1.752 0 0 0 1.242.516h12.049a1.554 1.554 0 1 1 .031 3.108H8.91a.589.589 0 0 0-.415 1.003l3.725 3.747a1.75 1.75 0 0 0 1.242.516h3.757c4.887 0 8.584-5.225 5.852-10.413" fill="#FF3008"/></svg>;
    case "ubereats":
      return <svg width={size} height={size} viewBox="0 0 192 192" fill="none"><path d="M20 41.85v31.73c.77 8.11 8.14 14.41 16.88 14.52 8.91.12 16.58-6.25 17.36-14.52V41.85" stroke="#06C167" strokeLinecap="round" strokeLinejoin="round" strokeWidth="8"/><path d="M54.24 88.11V55.2m13.84 32.91V41.85" stroke="#06C167" strokeLinecap="round" strokeMiterlimit="10" strokeWidth="8"/><circle cx="84.53" cy="71.66" r="16.45" stroke="#06C167" strokeLinecap="round" strokeMiterlimit="10" strokeWidth="8"/><path d="M142.57 82.97c-3 3.17-7.24 5.14-11.95 5.14-9.09 0-16.45-7.37-16.45-16.45s7.37-16.45 16.45-16.45 16.45 7.37 16.45 16.45h-32.9" stroke="#06C167" strokeLinecap="round" strokeLinejoin="round" strokeWidth="8"/><path d="M160.22 88.11V56.96m11.78 0h0c-1.9 0-3.77.45-5.45 1.32-2.73 1.42-6.33 3.97-6.33 7.51" stroke="#06C167" strokeLinecap="round" strokeMiterlimit="10" strokeWidth="8"/></svg>;
    case "instacart":
      return <svg width={size} height={size} viewBox="0 0 32 32"><path d="M20.839 12.823c1.896 1.906 3.443 5.026 2.557 6.87-2.37 4.953-20.052 13.635-21.557 12.135-1.5-1.5 7.188-19.193 12.135-21.568 1.849-.88 4.964.682 6.87 2.563l-.005.021zM30.208 10.74c-.307-1.141-1.094-2.292-2.266-2.427-2.146-.25-5.536 3.547-5.297 4.448.245.922 5.026 2.5 6.802 1.224.922-.661 1.042-2.083.74-3.219zM23.552.208c1.599.432 3.214 1.531 3.406 3.177.344 3.016-4.979 7.76-6.245 7.422-1.26-.339-3.49-7.047-1.688-9.552.927-1.297 2.932-1.474 4.531-1.052v.005z" fill="#0AAD0A"/></svg>;
    case "skip":
      return <svg width={size} height={size} viewBox="0 0 20 20"><rect width="20" height="20" rx="4" fill="#ED5A1F"/><path d="M6 6h8v2H9v2h4v2H9v4H6V6z" fill="#fff"/></svg>;
    case "amazonflex": case "amazon":
      return <svg width={size} height={size} viewBox="0 0 20 20"><rect width="20" height="20" rx="4" fill="#232F3E"/><path d="M5 14V6h2l2.5 5 2.5-5h2v8h-2V9.5L9 14H8L6 9.5V14H5z" fill="#FF9900"/></svg>;
    case "foodora":
      return <svg width={size} height={size} viewBox="0 0 20 20"><rect width="20" height="20" rx="4" fill="#D8003F"/><path d="M7 5h6v2H9v2h3v2H9v4H7V5z" fill="#fff"/></svg>;
    case "lyft":
      return <svg width={size} height={size} viewBox="0 0 20 20"><rect width="20" height="20" rx="4" fill="#FF00BF"/><path d="M7 5v8c0 1.1.9 2 2 2h4v-2H9V5H7z" fill="#fff"/></svg>;
    default:
      return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#9B9BA4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>;
  }
}

function PlatformIcon({ id }: { id: string }) {
  return (
    <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "#16161A", border: "1px solid #1C1C21", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <PlatformLogo id={id} size={16} />
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtCurrency(val: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
}

function fmtCurrencyParts(val: number) {
  const parts = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).formatToParts(val);
  return {
    symbol: parts.find((p) => p.type === "currency")?.value ?? "$",
    value: parts.filter((p) => p.type !== "currency").map((p) => p.value).join(""),
  };
}

function shiftNet(s: Shift) {
  const gross = (s.grossRevenue || 0) + (s.tipsRevenue || 0);
  const miles = (s.activeMileage || 0) + (s.deadMileage || 0);
  return gross - miles * 0.67;
}

function newShiftDefaults() {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 3600000);
  return { platform: "doordash", startTime: oneHourAgo.toISOString().slice(0, 16), endTime: now.toISOString().slice(0, 16), grossRevenue: "", tipsRevenue: "", activeMileage: "", notes: "", vehicleId: "" };
}

const PLATFORMS = ["doordash", "ubereats", "skip", "instacart", "amazonflex", "foodora", "lyft", "other"];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ShiftsPage() {
  const { isDbReady, activePlatformId } = useAppStore();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(null);
  const [weeklyShifts, setWeeklyShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(newShiftDefaults());
  const [saving, setSaving] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorYear, setSelectorYear] = useState(() => new Date().getFullYear());
  const [selectorShifts, setSelectorShifts] = useState<Shift[]>([]);
  const [selectorLoading, setSelectorLoading] = useState(false);
  const [selectorPage, setSelectorPage] = useState(0);
  const [vehicleList, setVehicleList] = useState<Vehicle[]>([]);

  const weekStart = useMemo(() => getStartOfWeek(selectedDate), [selectedDate]);
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [weekStart]);

  const isCurrentOrFutureWeek = weekStart.getTime() >= getStartOfWeek(new Date()).getTime();

  const loadWeek = useCallback(async () => {
    if (!isDbReady) return;
    setLoading(true);
    const pid = activePlatformId !== "all" ? activePlatformId : undefined;
    const rows = await getShiftsPaginated(500, 0, { startDate: weekStart, endDate: weekEnd, platform: pid });
    setWeeklyShifts(rows);
    setLoading(false);
  }, [isDbReady, weekStart, weekEnd, activePlatformId]);

  useEffect(() => { loadWeek(); }, [loadWeek]);

  useEffect(() => {
    if (!isDbReady) return;
    getVehicles().then(setVehicleList);
  }, [isDbReady]);

  useEffect(() => {
    if (!selectorOpen || !isDbReady) return;
    const load = async () => {
      setSelectorLoading(true);
      const pid = activePlatformId !== "all" ? activePlatformId : undefined;
      const rows = await getShiftsPaginated(2000, 0, { startDate: new Date(selectorYear, 0, 1), endDate: new Date(selectorYear, 11, 31, 23, 59, 59, 999), platform: pid });
      setSelectorShifts(rows);
      setSelectorLoading(false);
    };
    load();
  }, [selectorOpen, selectorYear, isDbReady, activePlatformId]);

  const shiftsByDay = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    const dayStr = day.toISOString().split("T")[0];
    const dayShifts = weeklyShifts.filter((s) => new Date(s.startTime).toISOString().split("T")[0] === dayStr);
    const total = dayShifts.reduce((sum, s) => sum + shiftNet(s), 0);
    return { date: day, shifts: dayShifts, total, label: day.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 1) };
  }), [weekStart, weeklyShifts]);

  const weeklyTotal = useMemo(() => weeklyShifts.reduce((s, sh) => s + shiftNet(sh), 0), [weeklyShifts]);
  const maxDayTotal = useMemo(() => Math.max(...shiftsByDay.map((d) => d.total), 0.01), [shiftsByDay]);

  const displayedTotal = selectedDayIdx !== null ? shiftsByDay[selectedDayIdx].total : weeklyTotal;
  const displayedLabel = selectedDayIdx !== null
    ? shiftsByDay[selectedDayIdx].date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
    : `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  const displayedShifts = selectedDayIdx !== null ? shiftsByDay[selectedDayIdx].shifts : weeklyShifts;

  const totalOnlineSec = displayedShifts.reduce((s, sh) => s + (sh.durationSeconds || 0), 0);
  const totalPausedSec = displayedShifts.reduce((s, sh) => s + (sh.pausedSeconds || 0), 0);
  const totalActiveSec = Math.max(0, totalOnlineSec - totalPausedSec);
  const totalMiles = displayedShifts.reduce((s, sh) => s + (sh.activeMileage || 0) + (sh.deadMileage || 0), 0);
  const totalDeadMi = displayedShifts.reduce((s, sh) => s + (sh.deadMileage || 0), 0);

  // Week selector list
  const modalWeeks = useMemo(() => {
    const now = new Date();
    const endLimit = selectorYear === now.getFullYear() ? now : new Date(selectorYear, 11, 31);
    const lastWeekStart = getStartOfWeek(endLimit);
    const firstWeekStart = getStartOfWeek(new Date(selectorYear, 0, 1));
    const totalWeeks = Math.ceil((lastWeekStart.getTime() - firstWeekStart.getTime()) / (7 * 86400000)) + 1;
    return Array.from({ length: totalWeeks }, (_, idx) => {
      const wStart = new Date(lastWeekStart);
      wStart.setDate(lastWeekStart.getDate() - idx * 7);
      const wEnd = new Date(wStart);
      wEnd.setDate(wStart.getDate() + 6);
      wEnd.setHours(23, 59, 59, 999);
      const wShifts = selectorShifts.filter((s) => { const t = new Date(s.startTime).getTime(); return t >= wStart.getTime() && t <= wEnd.getTime(); });
      const wTotal = wShifts.reduce((sum, s) => sum + shiftNet(s), 0);
      const days = Array.from({ length: 7 }, (_, i) => {
        const day = new Date(wStart); day.setDate(wStart.getDate() + i);
        const dayStr = day.toISOString().split("T")[0];
        const dayShifts = wShifts.filter((s) => new Date(s.startTime).toISOString().split("T")[0] === dayStr);
        return { total: dayShifts.reduce((sum, s) => sum + shiftNet(s), 0), dateNum: day.getDate() };
      });
      return { start: wStart, end: wEnd, total: wTotal, days, maxDay: Math.max(...days.map((d) => d.total), 0.01) };
    });
  }, [selectorYear, selectorShifts]);

  const WEEKS_PER_PAGE = 8;
  const totalPages = Math.max(Math.ceil(modalWeeks.length / WEEKS_PER_PAGE), 1);
  const visibleWeeks = useMemo(() => modalWeeks.slice(selectorPage * WEEKS_PER_PAGE, (selectorPage + 1) * WEEKS_PER_PAGE), [modalWeeks, selectorPage]);

  async function handleAdd() {
    if (!form.platform || !form.startTime || !form.endTime) return;
    setSaving(true);
    const start = new Date(form.startTime);
    const end = new Date(form.endTime);
    await insertShift({ id: crypto.randomUUID(), platform: form.platform, vehicleId: form.vehicleId || null, startTime: start, endTime: end, grossRevenue: parseFloat(form.grossRevenue) || 0, tipsRevenue: parseFloat(form.tipsRevenue) || 0, activeMileage: parseFloat(form.activeMileage) || 0, deadMileage: 0, trackedMileage: 0, durationSeconds: Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000)), pausedSeconds: 0, notes: form.notes || null, reconciliationStatus: "reconciled", distanceSource: "manual", syncUpdatedAt: Date.now() });
    setAddOpen(false);
    setForm(newShiftDefaults());
    setSaving(false);
    loadWeek();
  }

  const { symbol, value } = fmtCurrencyParts(displayedTotal);

  return (
    <div className="pb-20 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6">

      {/* ── Week selector + big amount ── */}
      <div className="flex flex-col items-center pt-6 pb-4 px-4 gap-5">
        <button
          onClick={() => { setSelectorYear(selectedDate.getFullYear()); setSelectorPage(0); setSelectorOpen(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{ backgroundColor: "#16161A", border: "0.8px solid #1C1C21" }}
        >
          <span className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: "#9B9BA4" }}>{displayedLabel}</span>
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="#9B9BA4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>

        <div className="flex items-center justify-between w-full px-2 gap-3">
          <button
            onClick={() => { setSelectedDayIdx(null); setSelectedDate((d) => { const n = new Date(d); n.setDate(d.getDate() - 7); return n; }); }}
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: "#16161A", border: "0.8px solid #1C1C21" }}
          >
            <ChevronLeft size={20} color="#F6F6F7" strokeWidth={3} />
          </button>
          <div className="flex items-start min-w-0 shrink">
            <span className="text-2xl font-semibold mr-0.5 mt-2.5" style={{ color: "#F6F6F7", lineHeight: "30px" }}>{symbol}</span>
            <span className="text-[48px] font-extrabold leading-none" style={{ color: "#F6F6F7", letterSpacing: "-0.02em" }}>{value}</span>
          </div>
          <button
            onClick={() => { if (!isCurrentOrFutureWeek) { setSelectedDayIdx(null); setSelectedDate((d) => { const n = new Date(d); n.setDate(d.getDate() + 7); return n; }); }}}
            disabled={isCurrentOrFutureWeek}
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: "#16161A", border: "0.8px solid #1C1C21", opacity: isCurrentOrFutureWeek ? 0.35 : 1 }}
          >
            <ChevronRight size={20} color={isCurrentOrFutureWeek ? "#2E2E36" : "#F6F6F7"} strokeWidth={3} />
          </button>
        </div>
      </div>

      {/* ── Bar chart ── */}
      <div className="mx-4 mb-5 p-4 relative" style={{ backgroundColor: "#0F0F12", borderRadius: 20, border: "0.8px solid #1E1E23" }}>
        <div className="absolute left-4 right-4 flex items-center justify-between pointer-events-none" style={{ top: 28, zIndex: 1 }}>
          <div className="flex-1 h-px" style={{ borderTop: "1px dashed rgba(113,113,122,0.25)" }} />
          <span className="pl-2 text-[9px] font-bold tracking-wide" style={{ backgroundColor: "#0F0F12", color: "#9B9BA4" }}>
            HIGH: {fmtCurrency(maxDayTotal)}
          </span>
        </div>
        <div className="flex items-end justify-between" style={{ height: 100 }}>
          {shiftsByDay.map((day, idx) => {
            const isSelected = selectedDayIdx === idx;
            const pct = Math.max((day.total / maxDayTotal) * 100, day.total > 0 ? 8 : 2);
            return (
              <button key={idx} onClick={() => setSelectedDayIdx(isSelected ? null : idx)} className="flex flex-col items-center justify-end flex-1 h-full gap-2 cursor-pointer">
                <div className="relative" style={{ width: 14, height: 64, backgroundColor: "#16161A", borderRadius: 7, overflow: "hidden" }}>
                  <div style={{ position: "absolute", bottom: 0, width: "100%", height: `${pct}%`, backgroundColor: "#3b82f6", borderRadius: 7, opacity: selectedDayIdx === null || isSelected ? 1 : 0.35 }} />
                </div>
                <span className="text-[11px]" style={{ color: isSelected ? "#3b82f6" : "#9B9BA4", fontWeight: isSelected ? 800 : 500 }}>{day.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Stats bento ── */}
      <div className="px-4 mb-5 grid grid-cols-2 gap-3">
        {[
          { label: "Online", value: `${(totalOnlineSec / 3600).toFixed(1)} hrs` },
          { label: "Active", value: `${(totalActiveSec / 3600).toFixed(1)} hrs` },
          { label: "Dead / Total Miles", value: `${totalDeadMi.toFixed(1)} / ${totalMiles.toFixed(1)} mi` },
          { label: "Shifts", value: `${displayedShifts.length}` },
        ].map(({ label, value }) => (
          <div key={label} className="p-4" style={{ backgroundColor: "#0F0F12", borderRadius: 20, border: "0.8px solid #1E1E23" }}>
            <p className="text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "#9B9BA4" }}>{label}</p>
            <p className="text-xl font-extrabold" style={{ color: "#F6F6F7" }}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Shifts list ── */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#9B9BA4" }}>
            {selectedDayIdx !== null ? `Shifts on ${shiftsByDay[selectedDayIdx].date.toLocaleDateString("en-US", { weekday: "long" })}` : "Shifts this week"}
          </p>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-[12px] font-extrabold uppercase tracking-wide"
            style={{ backgroundColor: "#3b82f6", color: "#fff" }}
          >
            <Plus size={14} strokeWidth={3} />Add
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : displayedShifts.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <p className="text-sm" style={{ color: "#65656E" }}>{selectedDayIdx !== null ? "No shifts logged on this day." : "No shifts logged for this week."}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {displayedShifts.map((shift) => {
              const net = shiftNet(shift);
              const miles = (shift.activeMileage || 0) + (shift.deadMileage || 0);
              const durationHrs = (shift.durationSeconds || 0) / 3600;
              const dayName = new Date(shift.startTime).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
              return (
                <Link key={shift.id} href={`/shifts/${shift.id}`} className="block p-4 hover:opacity-90 transition-opacity" style={{ backgroundColor: "#0F0F12", borderRadius: 20, border: "0.8px solid #1E1E23" }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <PlatformIcon id={shift.platform} />
                      <span className="text-sm font-bold truncate" style={{ color: "#F6F6F7" }}>{dayName}</span>
                    </div>
                    <span className="text-[15px] font-bold ml-2 shrink-0" style={{ color: "#F6F6F7" }}>{fmtCurrency(net)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2" style={{ borderTop: "0.5px solid #1E1E23" }}>
                    <span className="text-xs" style={{ color: "#9B9BA4" }}>Duration: {durationHrs.toFixed(1)} hrs</span>
                    {miles > 0 && <span className="text-xs" style={{ color: "#9B9BA4" }}>Mileage: {miles.toFixed(1)} mi</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Week selector overlay ── */}
      {selectorOpen && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: "#000" }}>
          <div className="flex items-center justify-between px-4 py-4 shrink-0" style={{ borderBottom: "0.5px solid #1E1E23" }}>
            <p className="text-lg font-extrabold" style={{ color: "#F6F6F7" }}>Select week ({selectorYear})</p>
            <button onClick={() => setSelectorOpen(false)} className="text-sm font-semibold" style={{ color: "#3b82f6" }}>Cancel</button>
          </div>
          <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: "0.5px solid #0F0F12" }}>
            <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#9B9BA4" }}>Weekly Earnings</span>
            <span className="text-[10px] font-extrabold tracking-widest" style={{ color: "#9B9BA4" }}>S  M  T  W  T  F  S</span>
          </div>
          <div className="flex-1 overflow-y-auto py-2 px-4 space-y-3">
            {selectorLoading ? (
              <div className="flex justify-center py-16"><Spinner /></div>
            ) : visibleWeeks.map((week, idx) => {
              const range = `${week.start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${week.end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
              const isSelected = getStartOfWeek(selectedDate).getTime() === week.start.getTime();
              return (
                <button
                  key={idx}
                  onClick={() => { setSelectedDate(week.start); setSelectedDayIdx(null); setSelectorOpen(false); }}
                  className="w-full flex items-center justify-between p-4 text-left"
                  style={{ backgroundColor: "#0F0F12", borderRadius: 20, border: isSelected ? "1px solid #3b82f6" : "0.8px solid #1E1E23" }}
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-[12px] font-semibold" style={{ color: "#9B9BA4" }}>{range}</span>
                    <span className="text-lg font-black" style={{ color: "#F6F6F7", letterSpacing: "-0.4px" }}>{fmtCurrency(week.total)}</span>
                  </div>
                  <div className="flex items-end gap-1">
                    {week.days.map((day, dIdx) => (
                      <div key={dIdx} className="flex flex-col items-center gap-1">
                        <div className="relative" style={{ width: 8, height: 32, backgroundColor: "#16161A", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ position: "absolute", bottom: 0, width: "100%", height: `${Math.max(day.total / week.maxDay * 100, day.total > 0 ? 10 : 2)}%`, backgroundColor: "#3b82f6", borderRadius: 4 }} />
                        </div>
                        <span className="text-[8px] font-bold" style={{ color: "#9B9BA4" }}>{day.dateNum}</span>
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderTop: "0.5px solid #1E1E23" }}>
            <button onClick={() => { if (selectorPage < totalPages - 1) setSelectorPage((p) => p + 1); else { setSelectorYear((y) => y - 1); setSelectorPage(0); }}} className="px-4 py-2 rounded-lg text-xs font-bold" style={{ backgroundColor: "#16161A", border: "0.8px solid #1C1C21", color: "#F6F6F7" }}>← Older</button>
            <span className="text-xs font-semibold" style={{ color: "#9B9BA4" }}>Page {selectorPage + 1} of {totalPages}</span>
            <button onClick={() => { if (selectorPage > 0) setSelectorPage((p) => p - 1); else if (selectorYear < new Date().getFullYear()) { setSelectorYear((y) => y + 1); setSelectorPage(0); }}} disabled={selectorPage === 0 && selectorYear >= new Date().getFullYear()} className="px-4 py-2 rounded-lg text-xs font-bold" style={{ backgroundColor: "#16161A", border: "0.8px solid #1C1C21", color: "#F6F6F7", opacity: selectorPage === 0 && selectorYear >= new Date().getFullYear() ? 0.35 : 1 }}>Newer →</button>
          </div>
        </div>
      )}

      {/* ── Add shift dialog ── */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} title="Add Manual Shift">
        <div className="space-y-4">
          <Select label="Platform" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
            {PLATFORMS.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start time" type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            <Input label="End time" type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Gross ($)" type="number" min="0" step="0.01" placeholder="0.00" value={form.grossRevenue} onChange={(e) => setForm({ ...form, grossRevenue: e.target.value })} />
            <Input label="Tips ($)" type="number" min="0" step="0.01" placeholder="0.00" value={form.tipsRevenue} onChange={(e) => setForm({ ...form, tipsRevenue: e.target.value })} />
          </div>
          <Input label="Mileage" type="number" min="0" step="0.1" placeholder="0.0" value={form.activeMileage} onChange={(e) => setForm({ ...form, activeMileage: e.target.value })} />
          {vehicleList.length > 0 && (
            <Select label="Vehicle (optional)" value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
              <option value="">None</option>
              {vehicleList.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </Select>
          )}
          <Input label="Notes (optional)" placeholder="Any notes…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex gap-2 pt-1">
            <Button variant="ghost" className="flex-1" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button className="flex-1" loading={saving} onClick={handleAdd}>Save Shift</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
