import React, { useState } from "react";
import {
  ScrollView,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Text } from "@/src/components/ui/text";
import { SectionHeader } from "@/src/components/ui/SectionHeader";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { getVehicles, insertVehicle } from "@/src/database/queries/vehicles";
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

// Custom icons using pure Views
const CarIcon = ({ color = "#64748b" }: { color?: string }) => (
  <View style={{ width: 28, height: 18, position: "relative" }}>
    {/* Car body */}
    <View style={{ position: "absolute", bottom: 0, width: 28, height: 10, borderRadius: 3, backgroundColor: color }} />
    {/* Roof */}
    <View style={{ position: "absolute", bottom: 8, left: 5, right: 5, height: 9, borderRadius: 3, backgroundColor: color }} />
    {/* Wheels */}
    <View style={{ position: "absolute", bottom: -3, left: 4, width: 7, height: 7, borderRadius: 4, backgroundColor: "#0b0f19", borderWidth: 1.5, borderColor: color }} />
    <View style={{ position: "absolute", bottom: -3, right: 4, width: 7, height: 7, borderRadius: 4, backgroundColor: "#0b0f19", borderWidth: 1.5, borderColor: color }} />
  </View>
);

const PlusIcon = ({ size = 14, color = "#10b981" }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size, justifyContent: "center", alignItems: "center" }}>
    <View style={{ position: "absolute", width: size, height: 1.5, backgroundColor: color, borderRadius: 1 }} />
    <View style={{ position: "absolute", width: 1.5, height: size, backgroundColor: color, borderRadius: 1 }} />
  </View>
);

export default function VehiclesScreen() {
  const queryClient = useQueryClient();
  const { isOnboardingCompleted } = useSettingsStore();

  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [vehicleType, setVehicleType] = useState("gas");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { data: vehiclesList = [], isLoading, refetch } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => getVehicles(),
    enabled: isOnboardingCompleted,
  });

  const resetForm = () => {
    setName("");
    setVehicleType("gas");
    setMake("");
    setModel("");
    setYear("");
    setLicensePlate("");
    setShowAddForm(false);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Validation", "Please enter a vehicle name.");
      return;
    }
    setIsSaving(true);
    const isFirstVehicle = vehiclesList.length === 0;
    try {
      await insertVehicle({
        id: `vehicle_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: name.trim(),
        type: vehicleType,
        make: make.trim() || null,
        model: model.trim() || null,
        year: year ? parseInt(year, 10) : null,
        fuelType: vehicleType,
        licensePlate: licensePlate.trim() || null,
        isActive: isFirstVehicle,
        createdAt: new Date(),
      });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      resetForm();
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to save vehicle.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView className="dark flex-1 bg-[#0b0f19]">
      {/* Header */}
      <View className="px-4 pt-3 pb-2 border-b border-slate-800/80 bg-slate-900/40">
        <SectionHeader
          title="Vehicles"
          action={{
            label: showAddForm ? "Cancel" : "+ Add Vehicle",
            onPress: () => setShowAddForm((v) => !v),
          }}
        />
      </View>

      <ScrollView contentContainerClassName="p-4 pb-16 flex flex-col gap-5">
        {/* Add Vehicle Form */}
        {showAddForm && (
          <View className="bg-slate-900/60 border border-slate-700/60 rounded-2xl p-4 flex flex-col gap-4">
            <Text className="text-sm font-extrabold text-slate-100 tracking-tight">New Vehicle</Text>

            {/* Name */}
            <View className="flex flex-col gap-1.5">
              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Name / Nickname *</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. My Prius"
                placeholderTextColor="#475569"
                className="bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm font-semibold"
              />
            </View>

            {/* Type */}
            <View className="flex flex-col gap-2">
              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vehicle Type</Text>
              <View className="flex flex-row flex-wrap gap-2">
                {VEHICLE_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => setVehicleType(t.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg border",
                      vehicleType === t.id
                        ? "border-emerald-500 bg-emerald-500/10"
                        : "border-slate-800 bg-slate-900/40"
                    )}
                  >
                    <Text className={cn("text-[11px] font-bold", vehicleType === t.id ? "text-emerald-400" : "text-slate-400")}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Make / Model */}
            <View className="flex flex-row gap-3">
              <View className="flex-1 flex flex-col gap-1.5">
                <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Make</Text>
                <TextInput
                  value={make}
                  onChangeText={setMake}
                  placeholder="Toyota"
                  placeholderTextColor="#475569"
                  className="bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm font-semibold"
                />
              </View>
              <View className="flex-1 flex flex-col gap-1.5">
                <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Model</Text>
                <TextInput
                  value={model}
                  onChangeText={setModel}
                  placeholder="Prius"
                  placeholderTextColor="#475569"
                  className="bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm font-semibold"
                />
              </View>
            </View>

            {/* Year / License */}
            <View className="flex flex-row gap-3">
              <View className="flex-1 flex flex-col gap-1.5">
                <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Year</Text>
                <TextInput
                  value={year}
                  onChangeText={setYear}
                  placeholder="2021"
                  keyboardType="numeric"
                  placeholderTextColor="#475569"
                  className="bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm font-semibold"
                />
              </View>
              <View className="flex-1 flex flex-col gap-1.5">
                <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">License Plate</Text>
                <TextInput
                  value={licensePlate}
                  onChangeText={setLicensePlate}
                  placeholder="ABC 1234"
                  placeholderTextColor="#475569"
                  className="bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm font-semibold"
                />
              </View>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              onPress={handleSave}
              disabled={isSaving}
              className="w-full py-3.5 bg-emerald-500 rounded-xl items-center justify-center shadow-md shadow-emerald-500/20 flex-row gap-2"
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <PlusIcon size={14} color="white" />
                  <Text className="text-white font-bold text-sm tracking-wide">Save Vehicle</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Vehicle List */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator size="large" color="#10b981" />
          </View>
        ) : vehiclesList.length === 0 ? (
          <View className="py-12">
            <EmptyState
              icon="car"
              title="No Vehicles"
              message="Add your first vehicle to track mileage and expenses per vehicle."
              actionLabel="Add Vehicle"
              onAction={() => setShowAddForm(true)}
            />
          </View>
        ) : (
          <View className="flex flex-col gap-3">
            {vehiclesList.map((v: any) => (
              <TouchableOpacity
                key={v.id}
                onPress={() => router.push(`/vehicles/${v.id}` as any)}
                className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex-row items-center gap-4 active:border-slate-700"
              >
                {/* Icon area */}
                <View className="w-12 h-12 rounded-xl bg-slate-800/60 border border-slate-700/40 items-center justify-center">
                  <CarIcon color={v.isActive ? "#10b981" : "#475569"} />
                </View>

                {/* Info */}
                <View className="flex-1 flex-col gap-0.5">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-sm font-bold text-slate-100">{v.name}</Text>
                    {v.isActive && (
                      <View className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                        <Text className="text-[9px] font-extrabold text-emerald-400 uppercase tracking-wide">Active</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-xs text-slate-400">
                    {[v.year, v.make, v.model].filter(Boolean).join(" ") || v.type}
                  </Text>
                  {v.licensePlate && (
                    <Text className="text-[10px] text-slate-500 font-mono mt-0.5">{v.licensePlate}</Text>
                  )}
                </View>

                {/* Chevron */}
                <View style={{ width: 6, height: 10, borderRightWidth: 1.5, borderTopWidth: 1.5, borderColor: "#475569", transform: [{ rotate: "45deg" }] }} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
