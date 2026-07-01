"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useAppStore } from "@/store/useAppStore";
import { getExpensesPaginated, insertExpense, softDeleteExpense, type Expense } from "@/lib/db/queries/expenses";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ChevronLeft, ChevronRight, Plus, Trash2, ArrowDownRight, ArrowUpRight, Droplets, Wrench, Shield, Smartphone, Coffee, CreditCard, ShoppingBag, Package2, MoreHorizontal } from "lucide-react";

// ─── Category registry ────────────────────────────────────────────────────────

const CATEGORIES: Record<string, { label: string; Icon: React.FC<{ size?: number; color?: string }> }> = {
  fuel:        { label: "Fuel",         Icon: ({ size = 18, color = "#9B9BA4" }) => <Droplets size={size} color={color} /> },
  maintenance: { label: "Maintenance",  Icon: ({ size = 18, color = "#9B9BA4" }) => <Wrench size={size} color={color} /> },
  insurance:   { label: "Insurance",    Icon: ({ size = 18, color = "#9B9BA4" }) => <Shield size={size} color={color} /> },
  phone:       { label: "Phone / Data", Icon: ({ size = 18, color = "#9B9BA4" }) => <Smartphone size={size} color={color} /> },
  food:        { label: "Food & Drink", Icon: ({ size = 18, color = "#9B9BA4" }) => <Coffee size={size} color={color} /> },
  parking:     { label: "Parking",      Icon: ({ size = 18, color = "#9B9BA4" }) => <CreditCard size={size} color={color} /> },
  tolls:       { label: "Tolls",        Icon: ({ size = 18, color = "#9B9BA4" }) => <CreditCard size={size} color={color} /> },
  supplies:    { label: "Supplies",     Icon: ({ size = 18, color = "#9B9BA4" }) => <ShoppingBag size={size} color={color} /> },
  equipment:   { label: "Equipment",    Icon: ({ size = 18, color = "#9B9BA4" }) => <Package2 size={size} color={color} /> },
  other:       { label: "Other",        Icon: ({ size = 18, color = "#9B9BA4" }) => <MoreHorizontal size={size} color={color} /> },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function newExpenseDefaults() {
  return { category: "fuel", amount: "", date: new Date().toISOString().slice(0, 10), merchant: "", notes: "", isDeductible: true };
}

type DeductFilter = "all" | "yes" | "no";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const { isDbReady } = useAppStore();
  const [selectedMonth, setSelectedMonth] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });
  const [selectedWeekIdx, setSelectedWeekIdx] = useState<number | null>(null);
  const [monthExpenses, setMonthExpenses] = useState<Expense[]>([]);
  const [ytdExpenses, setYtdExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(newExpenseDefaults());
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterDeductible, setFilterDeductible] = useState<DeductFilter>("all");
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [monthSelectorOpen, setMonthSelectorOpen] = useState(false);
  const [selectorYear, setSelectorYear] = useState(() => new Date().getFullYear());
  const [selectorYearExpenses, setSelectorYearExpenses] = useState<Expense[]>([]);

  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth(); // 0-indexed

  const loadMonth = useCallback(async () => {
    if (!isDbReady) return;
    setLoading(true);
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const [mRows, ytdRows] = await Promise.all([
      getExpensesPaginated(5000, 0, { startDate: start, endDate: end }),
      getExpensesPaginated(10000, 0, { startDate: new Date(year, 0, 1), endDate: new Date(year + 1, 0, 0, 23, 59, 59, 999) }),
    ]);
    setMonthExpenses(mRows);
    setYtdExpenses(ytdRows);
    setLoading(false);
  }, [isDbReady, year, month]);

  useEffect(() => { loadMonth(); }, [loadMonth]);

  useEffect(() => {
    if (!monthSelectorOpen || !isDbReady) return;
    const load = async () => {
      const rows = await getExpensesPaginated(10000, 0, { startDate: new Date(selectorYear, 0, 1), endDate: new Date(selectorYear + 1, 0, 0, 23, 59, 59, 999) });
      setSelectorYearExpenses(rows);
    };
    load();
  }, [monthSelectorOpen, selectorYear, isDbReady]);

  // Apply category / deductible filters
  const filteredExpenses = useMemo(() => monthExpenses.filter((e) => {
    if (filterCategory && e.category !== filterCategory) return false;
    if (filterDeductible === "yes" && !e.isDeductible) return false;
    if (filterDeductible === "no" && e.isDeductible) return false;
    return true;
  }), [monthExpenses, filterCategory, filterDeductible]);

  // Build 4-week buckets
  const weeks = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const buckets = [
      { label: "W1", min: 1, max: 7, total: 0, items: [] as Expense[] },
      { label: "W2", min: 8, max: 14, total: 0, items: [] as Expense[] },
      { label: "W3", min: 15, max: 21, total: 0, items: [] as Expense[] },
      { label: "W4", min: 22, max: daysInMonth, total: 0, items: [] as Expense[] },
    ];
    filteredExpenses.forEach((e) => {
      const day = new Date(e.date).getDate();
      const bucket = buckets.find((b) => day >= b.min && day <= b.max);
      if (bucket) { bucket.total += e.amount; bucket.items.push(e); }
    });
    return buckets;
  }, [filteredExpenses, year, month]);

  const totalMonthAmount = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const maxWeekTotal = Math.max(...weeks.map((w) => w.total), 0.01);
  const displayedExpenses = selectedWeekIdx !== null ? weeks[selectedWeekIdx].items : filteredExpenses;

  // YTD stats
  const ytdDeductible = ytdExpenses.filter((e) => e.isDeductible).reduce((s, e) => s + e.amount, 0);
  const ytdNonDeductible = ytdExpenses.filter((e) => !e.isDeductible).reduce((s, e) => s + e.amount, 0);

  // Month selector list
  const modalMonths = useMemo(() => {
    const now = new Date();
    const maxMonth = selectorYear === now.getFullYear() ? now.getMonth() : 11;
    return Array.from({ length: maxMonth + 1 }, (_, i) => {
      const mIdx = maxMonth - i;
      const mDate = new Date(selectorYear, mIdx, 1);
      const mKey = `${selectorYear}-${String(mIdx + 1).padStart(2, "0")}`;
      const items = selectorYearExpenses.filter((e) => {
        const d = new Date(e.date);
        return d.getFullYear() === selectorYear && d.getMonth() === mIdx;
      });
      const total = items.reduce((s, e) => s + e.amount, 0);
      const daysInM = new Date(selectorYear, mIdx + 1, 0).getDate();
      const w = [{ min: 1, max: 7, total: 0 }, { min: 8, max: 14, total: 0 }, { min: 15, max: 21, total: 0 }, { min: 22, max: daysInM, total: 0 }];
      items.forEach((e) => { const d = new Date(e.date).getDate(); const bk = w.find((b) => d >= b.min && d <= b.max); if (bk) bk.total += e.amount; });
      return { date: mDate, label: mDate.toLocaleDateString("en-US", { month: "long" }), total, weeks: w, maxWeek: Math.max(...w.map((b) => b.total), 0.01) };
    });
  }, [selectorYear, selectorYearExpenses]);

  const isCurrentOrFutureMonth = year === new Date().getFullYear() && month >= new Date().getMonth();

  async function handleAdd() {
    if (!form.amount || !form.date) return;
    setSaving(true);
    await insertExpense({ id: crypto.randomUUID(), category: form.category, amount: parseFloat(form.amount), date: new Date(form.date + "T12:00:00"), merchant: form.merchant, merchantNormalized: form.merchant.toLowerCase().trim(), notes: form.notes || null, isDeductible: form.isDeductible, deductiblePct: 100, isRecurring: false, syncUpdatedAt: Date.now() });
    setAddOpen(false);
    setForm(newExpenseDefaults());
    setSaving(false);
    loadMonth();
  }

  async function handleDelete(id: string) {
    await softDeleteExpense(id);
    setDeleteId(null);
    loadMonth();
  }

  const { symbol, value } = fmtCurrencyParts(totalMonthAmount);

  return (
    <div className="pb-20 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6">

      {/* ── Page title + Add ── */}
      <div className="flex items-center justify-between px-4 pt-6 pb-2">
        <div>
          <h1 className="text-2xl font-black" style={{ color: "#F6F6F7", letterSpacing: "-0.5px" }}>Expenses</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9B9BA4" }}>Track deductible costs</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-[13px] font-extrabold uppercase tracking-wide" style={{ backgroundColor: "#4ade80", color: "#000" }}>
          <Plus size={15} strokeWidth={3} />Add
        </button>
      </div>

      {/* ── Month selector + big amount ── */}
      <div className="flex flex-col items-center pt-4 pb-4 px-4 gap-5">
        <button
          onClick={() => { setSelectorYear(year); setMonthSelectorOpen(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{ backgroundColor: "#16161A", border: "0.8px solid #1C1C21" }}
        >
          <span className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: "#9B9BA4" }}>
            {selectedMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </span>
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="#9B9BA4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>

        <div className="flex items-center justify-between w-full px-2 gap-3">
          <button
            onClick={() => { setSelectedWeekIdx(null); setSelectedMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1)); }}
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: "#16161A", border: "0.8px solid #1C1C21" }}
          >
            <ChevronLeft size={20} color="#F6F6F7" strokeWidth={3} />
          </button>
          <div className="flex items-start min-w-0 shrink">
            <span className="text-2xl font-semibold mr-0.5 mt-2.5" style={{ color: "#f87171", lineHeight: "30px" }}>{symbol}</span>
            <span className="text-[48px] font-extrabold leading-none" style={{ color: "#F6F6F7", letterSpacing: "-0.02em" }}>{value}</span>
          </div>
          <button
            onClick={() => { if (!isCurrentOrFutureMonth) { setSelectedWeekIdx(null); setSelectedMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1)); }}}
            disabled={isCurrentOrFutureMonth}
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: "#16161A", border: "0.8px solid #1C1C21", opacity: isCurrentOrFutureMonth ? 0.35 : 1 }}
          >
            <ChevronRight size={20} color={isCurrentOrFutureMonth ? "#2E2E36" : "#F6F6F7"} strokeWidth={3} />
          </button>
        </div>
      </div>

      {/* ── Bar chart (W1–W4) ── */}
      <div className="mx-4 mb-5 p-4 relative" style={{ backgroundColor: "#0F0F12", borderRadius: 20, border: "0.8px solid #1E1E23" }}>
        <div className="absolute left-4 right-4 flex items-center justify-between pointer-events-none" style={{ top: 28, zIndex: 1 }}>
          <div className="flex-1 h-px" style={{ borderTop: "1px dashed rgba(113,113,122,0.25)" }} />
          <span className="pl-2 text-[9px] font-bold tracking-wide" style={{ backgroundColor: "#0F0F12", color: "#9B9BA4" }}>
            HIGH: {fmtCurrency(maxWeekTotal)}
          </span>
        </div>
        <div className="flex items-end justify-between" style={{ height: 100 }}>
          {weeks.map((week, idx) => {
            const isSelected = selectedWeekIdx === idx;
            const pct = Math.max((week.total / maxWeekTotal) * 100, week.total > 0 ? 8 : 2);
            return (
              <button key={idx} onClick={() => setSelectedWeekIdx(isSelected ? null : idx)} className="flex flex-col items-center justify-end flex-1 h-full gap-2">
                <div className="relative" style={{ width: 14, height: 64, backgroundColor: "#16161A", borderRadius: 7, overflow: "hidden" }}>
                  <div style={{ position: "absolute", bottom: 0, width: "100%", height: `${pct}%`, backgroundColor: "#4ade80", borderRadius: 7, opacity: selectedWeekIdx === null || isSelected ? 1 : 0.35 }} />
                </div>
                <span className="text-[11px]" style={{ color: isSelected ? "#4ade80" : "#9B9BA4", fontWeight: isSelected ? 800 : 500 }}>{week.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── YTD bento ── */}
      <div className="px-4 mb-5 grid grid-cols-2 gap-3">
        <div className="p-4" style={{ backgroundColor: "#0F0F12", borderRadius: 20, border: "0.8px solid #1E1E23" }}>
          <div className="flex items-center gap-1.5 mb-2">
            <div className="p-1 rounded-lg" style={{ backgroundColor: "#052e16" }}><ArrowDownRight size={14} color="#4ade80" /></div>
            <span className="text-[10px] font-extrabold uppercase tracking-wide" style={{ color: "#9B9BA4" }}>Deductible YTD</span>
          </div>
          <p className="text-3xl font-extrabold" style={{ color: "#F6F6F7", letterSpacing: "-0.5px" }}>{fmtCurrency(ytdDeductible)}</p>
        </div>
        <div className="p-4" style={{ backgroundColor: "#0F0F12", borderRadius: 20, border: "0.8px solid #1E1E23" }}>
          <div className="flex items-center gap-1.5 mb-2">
            <div className="p-1 rounded-lg" style={{ backgroundColor: "#2e0f0f" }}><ArrowUpRight size={14} color="#f87171" /></div>
            <span className="text-[10px] font-extrabold uppercase tracking-wide" style={{ color: "#9B9BA4" }}>Standard YTD</span>
          </div>
          <p className="text-3xl font-extrabold" style={{ color: "#F6F6F7", letterSpacing: "-0.5px" }}>{fmtCurrency(ytdNonDeductible)}</p>
        </div>
      </div>

      {/* ── Transactions header + filter toggle ── */}
      <div className="flex items-center justify-between px-4 mb-3">
        <p className="text-[18px] font-extrabold" style={{ color: "#F6F6F7", letterSpacing: "-0.5px" }}>Transactions</p>
        <button
          onClick={() => setFiltersVisible(!filtersVisible)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
          style={{ backgroundColor: "#16161A", border: `1px solid ${filtersVisible ? "#4ade80" : "#1C1C21"}` }}
        >
          <span className="text-[11px] font-extrabold uppercase" style={{ color: filtersVisible ? "#4ade80" : "#9B9BA4" }}>Filters</span>
        </button>
      </div>

      {/* ── Filters ── */}
      {filtersVisible && (
        <div className="pb-3">
          <div className="flex gap-2 overflow-x-auto pb-2 px-4 no-scrollbar">
            {[{ id: "", label: "All Categories" }, ...Object.entries(CATEGORIES).map(([id, { label }]) => ({ id, label }))].map(({ id, label }) => {
              const active = filterCategory === id;
              return (
                <button key={id} onClick={() => setFilterCategory(active ? "" : id)} className="shrink-0 px-4 py-2 rounded-full text-xs font-extrabold" style={{ backgroundColor: active ? "#052e1620" : "#16161A", border: `1px solid ${active ? "#166534" : "#1C1C21"}`, color: active ? "#4ade80" : "#9B9BA4" }}>
                  {label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 px-4 mt-1">
            {([{ key: "all" as const, label: "All" }, { key: "yes" as const, label: "Deductible" }, { key: "no" as const, label: "Standard" }]).map(({ key, label }) => {
              const active = filterDeductible === key;
              return (
                <button key={key} onClick={() => setFilterDeductible(key)} className="px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase" style={{ backgroundColor: active ? (key === "yes" ? "#052e16" : key === "no" ? "#2e0f0f" : "#1C1C21") : "#16161A", border: `1px solid ${active ? (key === "yes" ? "#166534" : key === "no" ? "#451a1a" : "#2E2E36") : "#1C1C21"}`, color: active ? (key === "yes" ? "#4ade80" : key === "no" ? "#f87171" : "#F6F6F7") : "#65656E" }}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Expense list ── */}
      <div className="px-4">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : displayedExpenses.length === 0 ? (
          <div className="flex flex-col items-center py-12">
            <p className="text-sm" style={{ color: "#65656E" }}>No expenses for this period.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {displayedExpenses.map((expense) => {
              const cat = CATEGORIES[expense.category] ?? CATEGORIES.other;
              const dateLabel = new Date(expense.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
              return (
                <div key={expense.id} className="flex items-center gap-3.5 p-4" style={{ backgroundColor: "#0F0F12", border: "0.8px solid #1E1E23", borderRadius: 20 }}>
                  <div className="flex items-center justify-center shrink-0" style={{ width: 46, height: 46, backgroundColor: "#16161A", border: "1px solid #1C1C21", borderRadius: 14 }}>
                    <cat.Icon size={20} color="#9B9BA4" />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold" style={{ color: "#F6F6F7" }}>{cat.label}</span>
                      {expense.isDeductible && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md" style={{ backgroundColor: "#052e16", border: "1px solid #166534", color: "#4ade80" }}>Tax Deductible</span>
                      )}
                    </div>
                    <span className="text-xs" style={{ color: "#9B9BA4" }}>{dateLabel}{expense.notes ? ` · ${expense.notes}` : ""}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-[15px] font-bold" style={{ color: "#f87171", letterSpacing: "-0.5px" }}>-{fmtCurrency(expense.amount)}</span>
                    <button onClick={() => setDeleteId(expense.id)} className="p-1.5 rounded-lg" style={{ backgroundColor: "#2e0f0f", border: "1px solid #451a1a" }}>
                      <Trash2 size={12} color="#f87171" strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Month selector overlay ── */}
      {monthSelectorOpen && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: "#000" }}>
          <div className="flex items-center justify-between px-4 py-4 shrink-0" style={{ borderBottom: "0.5px solid #1E1E23" }}>
            <p className="text-lg font-extrabold" style={{ color: "#F6F6F7" }}>{selectorYear} Expenses</p>
            <button onClick={() => setMonthSelectorOpen(false)} className="text-sm font-semibold" style={{ color: "#4ade80" }}>Done</button>
          </div>
          <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: "0.5px solid #0F0F12" }}>
            <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#9B9BA4" }}>Month</span>
            <span className="text-[10px] font-extrabold" style={{ color: "#9B9BA4" }}>YTD Deductible: {fmtCurrency(ytdDeductible)}</span>
          </div>
          <div className="flex-1 overflow-y-auto py-2 px-4 space-y-3">
            {modalMonths.map((m, idx) => {
              const isSelected = year === m.date.getFullYear() && month === m.date.getMonth();
              return (
                <button
                  key={idx}
                  onClick={() => { setSelectedMonth(m.date); setSelectedWeekIdx(null); setMonthSelectorOpen(false); }}
                  className="w-full flex items-center justify-between p-4 text-left"
                  style={{ backgroundColor: "#0F0F12", borderRadius: 20, border: isSelected ? "1px solid #4ade80" : "0.8px solid #1E1E23" }}
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-[12px] font-semibold" style={{ color: "#9B9BA4" }}>{m.label} {selectorYear}</span>
                    <span className="text-lg font-black" style={{ color: "#F6F6F7", letterSpacing: "-0.4px" }}>{fmtCurrency(m.total)}</span>
                  </div>
                  <div className="flex items-end gap-1">
                    {m.weeks.map((wk, wIdx) => (
                      <div key={wIdx} className="flex flex-col items-center gap-1">
                        <div className="relative" style={{ width: 8, height: 32, backgroundColor: "#16161A", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ position: "absolute", bottom: 0, width: "100%", height: `${Math.max(wk.total / m.maxWeek * 100, wk.total > 0 ? 8 : 2)}%`, backgroundColor: "#4ade80", borderRadius: 4 }} />
                        </div>
                        <span className="text-[8px] font-bold" style={{ color: "#9B9BA4" }}>W{wIdx + 1}</span>
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderTop: "0.5px solid #1E1E23" }}>
            <button onClick={() => setSelectorYear((y) => y - 1)} className="px-4 py-2 rounded-lg text-xs font-bold" style={{ backgroundColor: "#16161A", border: "0.8px solid #1C1C21", color: "#F6F6F7" }}>Previous Year</button>
            <span className="text-xs font-semibold" style={{ color: "#9B9BA4" }}>{selectorYear}</span>
            <button onClick={() => setSelectorYear((y) => y + 1)} disabled={selectorYear >= new Date().getFullYear()} className="px-4 py-2 rounded-lg text-xs font-bold" style={{ backgroundColor: "#16161A", border: "0.8px solid #1C1C21", color: "#F6F6F7", opacity: selectorYear >= new Date().getFullYear() ? 0.35 : 1 }}>Next Year</button>
          </div>
        </div>
      )}

      {/* ── Add dialog ── */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} title="Add Expense">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {Object.entries(CATEGORIES).map(([id, { label }]) => <option key={id} value={id}>{label}</option>)}
            </Select>
            <Input label="Amount ($)" type="number" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <Input label="Merchant" placeholder="Optional" value={form.merchant} onChange={(e) => setForm({ ...form, merchant: e.target.value })} />
          </div>
          <Input label="Notes" placeholder="Optional…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isDeductible} onChange={(e) => setForm({ ...form, isDeductible: e.target.checked })} className="accent-primary" />
            <span className="text-sm" style={{ color: "#9B9BA4" }}>Tax deductible</span>
          </label>
          <div className="flex gap-2 pt-1">
            <Button variant="ghost" className="flex-1" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button className="flex-1" loading={saving} onClick={handleAdd}>Save</Button>
          </div>
        </div>
      </Dialog>

      {/* ── Delete confirm ── */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete expense?">
        <p className="text-sm mb-4" style={{ color: "#9B9BA4" }}>This expense will be permanently removed from your next Drive backup.</p>
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="destructive" className="flex-1" onClick={() => deleteId && handleDelete(deleteId)}>Delete</Button>
        </div>
      </Dialog>
    </div>
  );
}
