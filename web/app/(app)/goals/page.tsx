"use client";
import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import { getAllGoals, insertGoal, softDeleteGoal, getGoalProgress, type Goal } from "@/lib/db/queries/goals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency } from "@/lib/utils";
import { Plus, Trash2, Target, CheckCircle2 } from "lucide-react";

type GoalWithProgress = Goal & { progress: number; pct: number };

function fmtVal(value: number, unit: string) {
  if (unit === "currency") return formatCurrency(value);
  if (unit === "hours") return `${value.toFixed(1)}h`;
  if (unit === "mileage") return `${value.toFixed(1)} km`;
  return String(Math.round(value));
}

function progressColor(pct: number) {
  if (pct >= 100) return "hsl(var(--primary))";
  if (pct >= 70)  return "#fbbf24";
  return "#60a5fa";
}

export default function GoalsPage() {
  const { isDbReady } = useAppStore();
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ label: "", targetValue: "", unit: "currency", period: "weekly" });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isDbReady) return;
    setLoading(true);
    const rows = await getAllGoals();
    const withProgress: GoalWithProgress[] = await Promise.all(
      rows.map(async (g) => {
        const progress = await getGoalProgress(g);
        const pct = Math.min(100, g.targetValue > 0 ? (progress / g.targetValue) * 100 : 0);
        return { ...g, progress, pct };
      })
    );
    setGoals(withProgress);
    setLoading(false);
  }, [isDbReady]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!form.label || !form.targetValue) return;
    setSaving(true);
    await insertGoal({
      id: crypto.randomUUID(), label: form.label, targetValue: parseFloat(form.targetValue),
      unit: form.unit, period: form.period, isActive: true, createdAt: new Date(), syncUpdatedAt: Date.now(),
    });
    setAddOpen(false);
    setForm({ label: "", targetValue: "", unit: "currency", period: "weekly" });
    setSaving(false);
    load();
  }

  async function handleDelete(id: string) {
    await softDeleteGoal(id);
    setDeleteId(null);
    load();
  }

  const primary = "hsl(var(--primary))";
  const card = { backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" };

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-content-muted">{goals.length} goal{goals.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ backgroundColor: primary, color: "hsl(var(--primary-foreground))" }}
        >
          <Plus size={15} strokeWidth={2.5} /> New Goal
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : goals.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3 rounded-2xl" style={card}>
          <Target size={36} className="text-content-disabled" />
          <p className="text-sm text-content-muted">No goals yet. Set a target to track your progress.</p>
          <button onClick={() => setAddOpen(true)} className="mt-1 text-sm font-semibold" style={{ color: primary }}>
            Add your first goal →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => {
            const done = goal.pct >= 100;
            const color = progressColor(goal.pct);
            return (
              <div key={goal.id} className="rounded-2xl p-5" style={card}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {done && <CheckCircle2 size={14} color={primary} strokeWidth={2.5} />}
                      <p className="text-sm font-bold text-content-primary truncate">{goal.label}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${primary}18`, color: primary }}
                      >{goal.period}</span>
                      <span className="text-[11px] text-content-muted">{goal.unit}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 ml-4 shrink-0">
                    <div className="text-right">
                      <p className="text-lg font-extrabold text-content-primary" style={{ letterSpacing: "-0.3px" }}>{fmtVal(goal.progress, goal.unit)}</p>
                      <p className="text-xs text-content-muted">of {fmtVal(goal.targetValue, goal.unit)}</p>
                    </div>
                    <button onClick={() => setDeleteId(goal.id)} className="text-content-disabled hover:text-destructive transition-colors p-1">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {/* Progress track */}
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "hsl(var(--accent))" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${goal.pct}%`, backgroundColor: color }}
                  />
                </div>
                <p className="text-[11px] mt-1.5 text-right" style={{ color }}>{goal.pct.toFixed(0)}% complete</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Add dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} title="New Goal">
        <div className="space-y-4">
          <Input label="Goal label" placeholder="e.g. Earn $1,000 this week" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              <option value="currency">Currency ($)</option>
              <option value="hours">Hours</option>
              <option value="shifts">Shifts</option>
              <option value="mileage">Mileage (km)</option>
            </Select>
            <Input label="Target" type="number" min="0" step="any" placeholder="0" value={form.targetValue} onChange={(e) => setForm({ ...form, targetValue: e.target.value })} />
          </div>
          <Select label="Period" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </Select>
          <div className="flex gap-2 pt-1">
            <Button variant="ghost" className="flex-1" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button className="flex-1" loading={saving} onClick={handleAdd}>Save Goal</Button>
          </div>
        </div>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete goal?">
        <p className="text-sm text-content-secondary mb-4">This goal will be permanently removed.</p>
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="destructive" className="flex-1" onClick={() => deleteId && handleDelete(deleteId)}>Delete</Button>
        </div>
      </Dialog>
    </div>
  );
}
