"use client";
import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import {
  getVehicles,
  insertVehicle,
  updateVehicle,
  softDeleteVehicle,
  setActiveVehicle,
} from "@/lib/db/queries/vehicles";
import type { Vehicle } from "@/lib/db/queries/vehicles";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Car, Plus, Pencil, Trash2 } from "lucide-react";

const VEHICLE_TYPES = [
  { value: "gas", label: "Gas" },
  { value: "electric", label: "Electric" },
  { value: "hybrid", label: "Hybrid" },
  { value: "diesel", label: "Diesel" },
  { value: "motorcycle", label: "Motorcycle" },
  { value: "other", label: "Other" },
];

function emptyForm() {
  return { name: "", type: "gas", make: "", model: "", year: "", licensePlate: "", currentOdometer: "" };
}

export default function VehiclesPage() {
  const { isDbReady } = useAppStore();
  const [list, setList] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!isDbReady) return;
    setLoading(true);
    setList(await getVehicles());
    setLoading(false);
  }, [isDbReady]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm());
    setFormOpen(true);
  }

  function openEdit(v: Vehicle) {
    setEditingId(v.id);
    setForm({
      name: v.name,
      type: v.type,
      make: v.make ?? "",
      model: v.model ?? "",
      year: v.year ? String(v.year) : "",
      licensePlate: v.licensePlate ?? "",
      currentOdometer: v.currentOdometer ? String(v.currentOdometer) : "",
    });
    setFormOpen(true);
  }

  function openDelete(id: string) {
    setDeletingId(id);
    setDeleteOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateVehicle(editingId, {
          name: form.name.trim(),
          type: form.type,
          make: form.make.trim() || null,
          model: form.model.trim() || null,
          year: form.year ? parseInt(form.year) : null,
          licensePlate: form.licensePlate.trim() || null,
          currentOdometer: form.currentOdometer ? parseInt(form.currentOdometer) : 0,
        });
      } else {
        await insertVehicle({
          id: crypto.randomUUID(),
          name: form.name.trim(),
          type: form.type,
          make: form.make.trim() || null,
          model: form.model.trim() || null,
          year: form.year ? parseInt(form.year) : null,
          licensePlate: form.licensePlate.trim() || null,
          currentOdometer: form.currentOdometer ? parseInt(form.currentOdometer) : 0,
          isActive: list.length === 0,
          createdAt: new Date(),
          syncUpdatedAt: Date.now(),
        });
      }
      setFormOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingId) return;
    const wasActive = list.find((v) => v.id === deletingId)?.isActive;
    await softDeleteVehicle(deletingId);
    const remaining = list.filter((v) => v.id !== deletingId);
    if (wasActive && remaining.length > 0) {
      await setActiveVehicle(remaining[0].id);
    }
    setDeleteOpen(false);
    setDeletingId(null);
    load();
  }

  async function handleSetActive(id: string) {
    await setActiveVehicle(id);
    load();
  }

  const deletingVehicle = list.find((v) => v.id === deletingId);

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: "#F6F6F7", letterSpacing: "-0.3px" }}>Vehicles</h1>
          <p className="text-sm mt-0.5" style={{ color: "#9B9BA4" }}>Track and manage your vehicles</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-[12px] font-extrabold uppercase tracking-wide"
          style={{ backgroundColor: "#3b82f6", color: "#fff" }}
        >
          <Plus size={14} strokeWidth={3} />Add Vehicle
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : list.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-3 py-16 rounded-3xl"
          style={{ backgroundColor: "#0F0F12", border: "0.8px dashed #1E1E23" }}
        >
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ backgroundColor: "#16161A" }}
          >
            <Car size={26} style={{ color: "#65656E" }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: "#65656E" }}>No vehicles added yet</p>
          <p className="text-xs text-center px-8" style={{ color: "#3C3C45" }}>
            Add your vehicle to track mileage per shift
          </p>
          <button
            onClick={openAdd}
            className="mt-2 px-5 py-2.5 rounded-2xl text-[12px] font-bold uppercase tracking-wide"
            style={{ backgroundColor: "#3b82f6", color: "#fff" }}
          >
            Add Vehicle
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((v) => {
            const subtitle = [v.make, v.model, v.year].filter(Boolean).join(" ");
            return (
              <div
                key={v.id}
                className="p-5 flex flex-col gap-3"
                style={{
                  backgroundColor: "#0F0F12",
                  borderRadius: 20,
                  border: v.isActive ? "1px solid #3b82f6" : "0.8px solid #1E1E23",
                }}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
                      style={{ backgroundColor: v.isActive ? "rgba(59,130,246,0.15)" : "#16161A" }}
                    >
                      <Car size={20} style={{ color: v.isActive ? "#3b82f6" : "#65656E" }} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate" style={{ color: "#F6F6F7" }}>{v.name}</p>
                      {subtitle && (
                        <p className="text-xs truncate mt-0.5" style={{ color: "#9B9BA4" }}>{subtitle}</p>
                      )}
                    </div>
                  </div>
                  {v.isActive && (
                    <span
                      className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide"
                      style={{ backgroundColor: "rgba(59,130,246,0.15)", color: "#3b82f6" }}
                    >
                      Primary
                    </span>
                  )}
                </div>

                {/* Type badge + plate */}
                <div className="flex items-center gap-2">
                  <span
                    className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wide"
                    style={{ backgroundColor: "#16161A", color: "#9B9BA4" }}
                  >
                    {v.type}
                  </span>
                  {v.licensePlate && (
                    <span className="text-[11px] font-semibold" style={{ color: "#65656E" }}>
                      {v.licensePlate}
                    </span>
                  )}
                  {v.currentOdometer > 0 && (
                    <span className="text-[11px]" style={{ color: "#3C3C45" }}>
                      {v.currentOdometer.toLocaleString()} km/mi
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div
                  className="flex items-center gap-2 pt-2"
                  style={{ borderTop: "0.5px solid #1E1E23" }}
                >
                  {!v.isActive && (
                    <button
                      onClick={() => handleSetActive(v.id)}
                      className="flex-1 py-1.5 rounded-xl text-[11px] font-bold"
                      style={{ backgroundColor: "#16161A", color: "#9B9BA4", border: "0.8px solid #1C1C21" }}
                    >
                      Set Primary
                    </button>
                  )}
                  <button
                    onClick={() => openEdit(v)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl"
                    style={{ backgroundColor: "#16161A", border: "0.8px solid #1C1C21" }}
                    title="Edit"
                  >
                    <Pencil size={13} style={{ color: "#9B9BA4" }} />
                  </button>
                  <button
                    onClick={() => openDelete(v.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl"
                    style={{ backgroundColor: "#16161A", border: "0.8px solid #1C1C21" }}
                    title="Remove"
                  >
                    <Trash2 size={13} style={{ color: "#9B9BA4" }} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? "Edit Vehicle" : "Add Vehicle"}
      >
        <div className="space-y-4">
          <Input
            label="Nickname *"
            placeholder="e.g. My Prius"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Select
            label="Type"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            {VEHICLE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Make"
              placeholder="e.g. Toyota"
              value={form.make}
              onChange={(e) => setForm({ ...form, make: e.target.value })}
            />
            <Input
              label="Model"
              placeholder="e.g. Prius"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Year"
              type="number"
              placeholder="2020"
              min="1900"
              max="2099"
              value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value })}
            />
            <Input
              label="License Plate"
              placeholder="ABC 1234"
              value={form.licensePlate}
              onChange={(e) => setForm({ ...form, licensePlate: e.target.value })}
            />
          </div>
          <Input
            label="Starting Odometer (km/mi)"
            type="number"
            placeholder="0"
            min="0"
            value={form.currentOdometer}
            onChange={(e) => setForm({ ...form, currentOdometer: e.target.value })}
          />
          <div className="flex gap-2 pt-1">
            <Button variant="ghost" className="flex-1" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button className="flex-1" loading={saving} onClick={handleSave}>
              {editingId ? "Save Changes" : "Add Vehicle"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteOpen}
        onClose={() => { setDeleteOpen(false); setDeletingId(null); }}
        title="Remove Vehicle"
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "#9B9BA4" }}>
            Remove{" "}
            <span className="font-bold" style={{ color: "#F6F6F7" }}>{deletingVehicle?.name}</span>?
            {" "}This cannot be undone.
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => { setDeleteOpen(false); setDeletingId(null); }}
            >
              Cancel
            </Button>
            <button
              className="flex-1 py-2.5 rounded-xl text-sm font-bold"
              style={{ backgroundColor: "#ef4444", color: "#fff" }}
              onClick={handleDelete}
            >
              Remove
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
