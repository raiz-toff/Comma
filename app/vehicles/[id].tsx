import React, { useState, useEffect } from "react";
import {
  ScrollView,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Text } from "@/src/components/ui/text";
import { CurrencyText } from "@/src/components/ui/CurrencyText";
import { getVehicles, getVehicleStats, updateVehicle, deleteVehicle } from "@/src/database/queries/vehicles";
import { getMaintenanceLogs, insertMaintenanceLog, deleteMaintenanceLog } from "@/src/database/queries/maintenance";
import { useSettingsStore } from "@/store/useSettingsStore";
import { cn } from "@/src/lib/utils";

const VEHICLE_TYPES = [
  { id: "gas", label: "Gas" },
  { id: "hybrid", label: "Hybrid" },
  { id: "ev", label: "Electric" },
  { id: "motorcycle", label: "Moto" },
  { id: "bicycle", label: "Bicycle" },
  { id: "ebike", label: "E-Bike" },
  { id: "scooter", label: "Scooter" },
  { id: "walking", label: "Walking" },
];

const MAINTENANCE_TYPES = [
  { id: "oil_change", label: "Oil Change" },
  { id: "tire", label: "Tires" },
  { id: "brake", label: "Brakes" },
  { id: "fuel", label: "Fuel" },
  { id: "wash", label: "Wash" },
  { id: "other", label: "Other" },
];

const MAINTENANCE_ICONS: Record<string, string> = {
  oil_change: "🛢️",
  tire: "🔄",
  brake: "🛑",
  fuel: "⛽",
  wash: "🚿",
  other: "🔧",
};

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { profile } = useSettingsStore();

  // Edit form state
  const [name, setName] = useState("");
  const [vehicleType, setVehicleType] = useState("gas");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [isSavingVehicle, setIsSavingVehicle] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Add maintenance form state
  const [showAddMaintenance, setShowAddMaintenance] = useState(false);
  const [mType, setMType] = useState("oil_change");
  const [mCost, setMCost] = useState("");
  const [mOdometer, setMOdometer] = useState("");
  const [mNotes, setMNotes] = useState("");
  const [isSavingMaintenance, setIsSavingMaintenance] = useState(false);

  // Vehicle data
  const { data: vehiclesList = [], isLoading: isLoadingVehicle } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => getVehicles(),
  });

  const vehicle = vehiclesList.find((v: any) => v.id === id);

  useEffect(() => {
    if (vehicle) {
      setName(vehicle.name || "");
      setVehicleType(vehicle.type || "gas");
      setMake(vehicle.make || "");
      setModel(vehicle.model || "");
      setYear(vehicle.year ? String(vehicle.year) : "");
      setLicensePlate(vehicle.licensePlate || "");
      setIsActive(vehicle.isActive ?? false);
    }
  }, [vehicle]);

  const { data: stats } = useQuery({
    queryKey: ["vehicle-stats", id],
    queryFn: () => getVehicleStats(id!),
    enabled: !!id,
  });

  const { data: maintenanceLogs = [] } = useQuery({
    queryKey: ["maintenance", id],
    queryFn: () => getMaintenanceLogs(id!),
    enabled: !!id,
  });

  const handleSaveVehicle = async () => {
    if (!name.trim()) {
      Alert.alert("Validation", "Vehicle name is required.");
      return;
    }
    setIsSavingVehicle(true);
    try {
      await updateVehicle(id!, {
        name: name.trim(),
        type: vehicleType,
        make: make.trim() || null,
        model: model.trim() || null,
        year: year ? parseInt(year, 10) : null,
        licensePlate: licensePlate.trim() || null,
        isActive,
      });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      setIsEditing(false);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to save vehicle.");
    } finally {
      setIsSavingVehicle(false);
    }
  };

  const handleDeleteVehicle = () => {
    const performDelete = async () => {
      try {
        await deleteVehicle(id!);
        queryClient.invalidateQueries({ queryKey: ["vehicles"] });
        queryClient.invalidateQueries({ queryKey: ["analytics"] });
        router.back();
      } catch (err: any) {
        Alert.alert("Error", err?.message || "Failed to delete vehicle.");
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Delete this vehicle? This cannot be undone.")) performDelete();
    } else {
      Alert.alert("Delete Vehicle", "Delete this vehicle? This cannot be undone.", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: performDelete },
      ]);
    }
  };

  const handleSaveMaintenance = async () => {
    if (!mCost || isNaN(parseFloat(mCost))) {
      Alert.alert("Validation", "Please enter a valid cost.");
      return;
    }
    setIsSavingMaintenance(true);
    try {
      await insertMaintenanceLog({
        id: `maint_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        vehicleId: id!,
        type: mType,
        cost: parseFloat(mCost),
        odometer: mOdometer ? parseFloat(mOdometer) : null,
        date: new Date(),
        notes: mNotes.trim() || null,
      });
      queryClient.invalidateQueries({ queryKey: ["maintenance", id] });
      setMType("oil_change");
      setMCost("");
      setMOdometer("");
      setMNotes("");
      setShowAddMaintenance(false);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to save maintenance log.");
    } finally {
      setIsSavingMaintenance(false);
    }
  };

  const handleDeleteMaintenance = (logId: string) => {
    const performDelete = async () => {
      await deleteMaintenanceLog(logId);
      queryClient.invalidateQueries({ queryKey: ["maintenance", id] });
    };
    if (Platform.OS === "web") {
      if (window.confirm("Delete this log?")) performDelete();
    } else {
      Alert.alert("Delete", "Delete this maintenance log?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: performDelete },
      ]);
    }
  };

  if (isLoadingVehicle) {
    return (
      <SafeAreaView className="dark flex-1 bg-[#000000] items-center justify-center">
        <ActivityIndicator size="large" color="#10b981" />
      </SafeAreaView>
    );
  }

  if (!vehicle) {
    return (
      <SafeAreaView className="dark flex-1 bg-[#000000] items-center justify-center p-6">
        <Text className="text-slate-400 text-sm text-center">Vehicle not found.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text className="text-emerald-500 text-sm font-bold">← Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="dark flex-1 bg-[#000000]">
      {/* Top Header */}
      <View className="px-4 pt-3 pb-2 border-b border-slate-800/80 bg-slate-900/40 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => router.back()} className="px-3 py-2 bg-slate-800/40 rounded-lg border border-slate-700/30">
          <Text className="text-slate-300 text-xs font-semibold">← Back</Text>
        </TouchableOpacity>
        <Text className="text-slate-100 font-extrabold text-base tracking-tight">{vehicle.name}</Text>
        <TouchableOpacity
          onPress={() => setIsEditing((e) => !e)}
          className="px-3 py-2 bg-slate-800/40 rounded-lg border border-slate-700/30"
        >
          <Text className="text-emerald-500 text-xs font-bold">{isEditing ? "Cancel" : "Edit"}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerClassName="p-4 pb-16 flex flex-col gap-5">
        {/* Vehicle Stats Row */}
        <View className="flex-row gap-3">
          <View className="flex-1 bg-slate-900/60 border border-slate-800/60 rounded-2xl p-4 items-center gap-1">
            <Text className="text-2xl font-extrabold text-slate-100">{stats?.totalShifts ?? 0}</Text>
            <Text className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Shifts</Text>
          </View>
          <View className="flex-1 bg-slate-900/60 border border-slate-800/60 rounded-2xl p-4 items-center gap-1">
            <Text className="text-2xl font-extrabold text-slate-100">{(stats?.totalActiveMileage ?? 0).toFixed(1)}</Text>
            <Text className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{profile.distanceUnit} Active</Text>
          </View>
        </View>

        {/* Edit / Info Form */}
        <View className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-4">
          <Text className="text-sm font-extrabold text-slate-100 tracking-tight border-b border-slate-800/40 pb-2">
            Vehicle Info
          </Text>

          {/* Name */}
          <View className="flex flex-col gap-1.5">
            <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Name</Text>
            {isEditing ? (
              <TextInput
                value={name}
                onChangeText={setName}
                placeholderTextColor="#475569"
                className="bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm font-semibold"
              />
            ) : (
              <Text className="text-slate-200 text-sm font-semibold">{vehicle.name}</Text>
            )}
          </View>

          {/* Type */}
          {isEditing && (
            <View className="flex flex-col gap-2">
              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Type</Text>
              <View className="flex flex-row flex-wrap gap-2">
                {VEHICLE_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => setVehicleType(t.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg border",
                      vehicleType === t.id ? "border-emerald-500 bg-emerald-500/10" : "border-slate-800 bg-slate-900/40"
                    )}
                  >
                    <Text className={cn("text-[11px] font-bold", vehicleType === t.id ? "text-emerald-400" : "text-slate-400")}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Make / Model / Year / Plate */}
          <View className="flex flex-row gap-3">
            <View className="flex-1 flex flex-col gap-1.5">
              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Make</Text>
              {isEditing ? (
                <TextInput value={make} onChangeText={setMake} placeholder="Toyota" placeholderTextColor="#475569"
                  className="bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm font-semibold" />
              ) : (
                <Text className="text-slate-200 text-sm font-semibold">{vehicle.make || "—"}</Text>
              )}
            </View>
            <View className="flex-1 flex flex-col gap-1.5">
              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Model</Text>
              {isEditing ? (
                <TextInput value={model} onChangeText={setModel} placeholder="Prius" placeholderTextColor="#475569"
                  className="bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm font-semibold" />
              ) : (
                <Text className="text-slate-200 text-sm font-semibold">{vehicle.model || "—"}</Text>
              )}
            </View>
          </View>

          <View className="flex flex-row gap-3">
            <View className="flex-1 flex flex-col gap-1.5">
              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Year</Text>
              {isEditing ? (
                <TextInput value={year} onChangeText={setYear} placeholder="2021" keyboardType="numeric" placeholderTextColor="#475569"
                  className="bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm font-semibold" />
              ) : (
                <Text className="text-slate-200 text-sm font-semibold">{vehicle.year || "—"}</Text>
              )}
            </View>
            <View className="flex-1 flex flex-col gap-1.5">
              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">License Plate</Text>
              {isEditing ? (
                <TextInput value={licensePlate} onChangeText={setLicensePlate} placeholder="ABC 1234" placeholderTextColor="#475569"
                  className="bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 text-sm font-semibold" />
              ) : (
                <Text className="text-slate-200 text-sm font-mono">{vehicle.licensePlate || "—"}</Text>
              )}
            </View>
          </View>

          {/* Active Toggle */}
          {isEditing && (
            <View className="flex-row items-center justify-between p-3 bg-slate-950/30 rounded-xl border border-slate-800/40">
              <Text className="text-sm font-semibold text-slate-200">Set as Active Vehicle</Text>
              <Switch
                value={isActive}
                onValueChange={setIsActive}
                trackColor={{ false: "#1e293b", true: "#10b981" }}
                thumbColor="#f1f5f9"
              />
            </View>
          )}

          {/* Edit save / delete buttons */}
          {isEditing && (
            <View className="flex-col gap-2 mt-1">
              <TouchableOpacity
                onPress={handleSaveVehicle}
                disabled={isSavingVehicle}
                className="w-full py-3.5 bg-emerald-500 rounded-xl items-center justify-center"
              >
                {isSavingVehicle ? <ActivityIndicator size="small" color="white" /> : (
                  <Text className="text-white font-bold text-sm">Save Changes</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDeleteVehicle}
                className="w-full py-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl items-center justify-center"
              >
                <Text className="text-rose-400 font-bold text-sm">Delete Vehicle</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Maintenance Log Section */}
        <View className="flex flex-col gap-3">
          <View className="flex-row justify-between items-center">
            <Text className="text-sm font-extrabold text-slate-100 tracking-tight">Maintenance Log</Text>
            <TouchableOpacity
              onPress={() => setShowAddMaintenance((v) => !v)}
              className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg"
            >
              <Text className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider">
                {showAddMaintenance ? "Cancel" : "+ Add Log"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Add Maintenance Form */}
          {showAddMaintenance && (
            <View className="bg-slate-900/60 border border-slate-700/60 rounded-2xl p-4 flex flex-col gap-4">
              <View className="flex flex-row flex-wrap gap-2">
                {MAINTENANCE_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => setMType(t.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg border flex-row items-center gap-1.5",
                      mType === t.id ? "border-emerald-500 bg-emerald-500/10" : "border-slate-800 bg-slate-900/40"
                    )}
                  >
                    <Text className="text-sm">{MAINTENANCE_ICONS[t.id]}</Text>
                    <Text className={cn("text-[11px] font-bold", mType === t.id ? "text-emerald-400" : "text-slate-400")}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View className="flex flex-row gap-3">
                <View className="flex-1 flex flex-col gap-1.5">
                  <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cost ($) *</Text>
                  <TextInput
                    value={mCost}
                    onChangeText={setMCost}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor="#475569"
                    className="bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm font-semibold"
                  />
                </View>
                <View className="flex-1 flex flex-col gap-1.5">
                  <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Odometer ({profile.distanceUnit})</Text>
                  <TextInput
                    value={mOdometer}
                    onChangeText={setMOdometer}
                    keyboardType="numeric"
                    placeholder="Optional"
                    placeholderTextColor="#475569"
                    className="bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm font-semibold"
                  />
                </View>
              </View>

              <View className="flex flex-col gap-1.5">
                <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Notes</Text>
                <TextInput
                  value={mNotes}
                  onChangeText={setMNotes}
                  multiline
                  numberOfLines={2}
                  placeholder="Add notes..."
                  placeholderTextColor="#475569"
                  className="bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm font-semibold h-20"
                />
              </View>

              <TouchableOpacity
                onPress={handleSaveMaintenance}
                disabled={isSavingMaintenance}
                className="w-full py-3.5 bg-emerald-500 rounded-xl items-center justify-center"
              >
                {isSavingMaintenance ? <ActivityIndicator size="small" color="white" /> : (
                  <Text className="text-white font-bold text-sm">Save Log</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Maintenance list */}
          {maintenanceLogs.length === 0 ? (
            <View className="py-6 border border-dashed border-slate-800/60 rounded-2xl items-center justify-center">
              <Text className="text-slate-500 text-xs font-medium">No maintenance logs yet.</Text>
            </View>
          ) : (
            <View className="flex flex-col gap-2.5">
              {maintenanceLogs.map((log: any) => (
                <View key={log.id} className="flex-row items-center justify-between bg-slate-900/50 border border-slate-800/60 rounded-xl p-3.5">
                  <View className="flex-row items-center gap-3 flex-1">
                    <Text className="text-xl">{MAINTENANCE_ICONS[log.type] || "🔧"}</Text>
                    <View className="flex-col flex-1">
                      <Text className="text-sm font-bold text-slate-100 capitalize">
                        {MAINTENANCE_TYPES.find((t) => t.id === log.type)?.label || log.type}
                      </Text>
                      <Text className="text-[10px] text-slate-500 mt-0.5">
                        {new Date(log.date).toLocaleDateString(undefined, { dateStyle: "medium" })}
                        {log.odometer ? ` · ${log.odometer} ${profile.distanceUnit}` : ""}
                      </Text>
                      {log.notes ? <Text className="text-[10px] text-slate-400 italic mt-0.5">{log.notes}</Text> : null}
                    </View>
                  </View>
                  <View className="flex-row items-center gap-3">
                    <CurrencyText amount={log.cost} size="sm" className="font-bold text-amber-400" />
                    <TouchableOpacity
                      onPress={() => handleDeleteMaintenance(log.id)}
                      className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20"
                    >
                      <View style={{ width: 10, height: 11, borderWidth: 1.5, borderColor: "#f43f5e", borderTopWidth: 0, borderBottomLeftRadius: 1, borderBottomRightRadius: 1 }}>
                        <View style={{ width: 10, height: 1.5, backgroundColor: "#f43f5e", position: "absolute", top: -3 }} />
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
