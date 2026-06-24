import React, { useState } from "react";
import {
  ScrollView,
  View,
  TextInput,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Button } from "../../src/components/ui/button";
import { Text } from "../../src/components/ui/text";
import { PlatformBadge } from "../../src/components/ui/PlatformBadge";
import { PLATFORMS } from "../../src/registry/platforms";
import { getVehicles } from "../../src/database/queries/vehicles";
import { insertShift, updateShift, getShiftById } from "../../src/database/queries/shifts";
import { useSettingsStore } from "../../store/useSettingsStore";
import { cn } from "../../src/lib/utils";
import Svg, { Polyline, Circle, Line } from "react-native-svg";

// react-native-maps is a native module — lazy-loaded inside component to avoid
// top-level module initialization crashes on Android.
const loadMaps = () => {
  if (Platform.OS === "web") return { MapView: null, Marker: null, MapPolyline: null };
  try {
    const Maps = require("react-native-maps");
    return { MapView: Maps.default || null, Marker: Maps.Marker || null, MapPolyline: Maps.Polyline || null };
  } catch {
    return { MapView: null, Marker: null, MapPolyline: null };
  }
};

type GigPlatform = "doordash" | "ubereats" | "skip" | "other";

// ─── Route Map Component ─────────────────────────────────────────────────────
// Native: Full interactive MapView with road-snapped polyline
// Web / fallback: SVG schematic trace

const RouteLargeMap = ({ routePathJson, strokeColor }: { routePathJson: string | null | undefined; strokeColor: string }) => {
  // Lazy-load maps inside the component to avoid top-level native module crashes
  const { MapView, Marker, MapPolyline } = React.useMemo(() => loadMaps(), []);

  const points = React.useMemo(() => {
    if (!routePathJson || typeof routePathJson !== "string") return null;
    try {
      const parsed = JSON.parse(routePathJson);
      if (!Array.isArray(parsed) || parsed.length < 2) return null;
      return parsed as Array<{ latitude: number; longitude: number }>;
    } catch {
      return null;
    }
  }, [routePathJson]);

  if (!points) return null;

  // ── Native interactive MapView ──────────────────────────────────────────────
  if (Platform.OS !== "web" && MapView) {
    const lats = points.map((p) => p.latitude);
    const lngs = points.map((p) => p.longitude);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latPad = (maxLat - minLat) * 0.25 || 0.005;
    const lngPad = (maxLng - minLng) * 0.25 || 0.005;

    const region = {
      latitude:  (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta:  maxLat - minLat + latPad,
      longitudeDelta: maxLng - minLng + lngPad,
    };

    const startPoint = points[0];
    const endPoint   = points[points.length - 1];

    return (
      <View style={{ borderRadius: 16, overflow: "hidden", marginVertical: 8 }}>
        <MapView
          style={{ width: "100%", height: 220 }}
          region={region}
          scrollEnabled
          zoomEnabled
          pitchEnabled={false}
          rotateEnabled={false}
          mapType="standard"
          userInterfaceStyle="dark"
        >
          <MapPolyline
            coordinates={points}
            strokeColor={strokeColor}
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
          <Marker coordinate={startPoint} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={{
              width: 14, height: 14, borderRadius: 7,
              backgroundColor: "#10b981",
              borderWidth: 2, borderColor: "#fff"
            }} />
          </Marker>
          <Marker coordinate={endPoint} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={{
              width: 14, height: 14, borderRadius: 7,
              backgroundColor: strokeColor,
              borderWidth: 2, borderColor: "#fff"
            }} />
          </Marker>
        </MapView>

        {/* Legend */}
        <View style={{
          flexDirection: "row", justifyContent: "space-between",
          paddingHorizontal: 12, paddingVertical: 8,
          backgroundColor: "#0d0d0d",
          borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
          borderWidth: 0.5, borderTopWidth: 0, borderColor: "#1f1f1f",
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#10b981" }} />
            <Text style={{ color: "#a1a1aa", fontSize: 11, fontWeight: "600" }}>Start</Text>
          </View>
          <Text style={{ color: "#52525b", fontSize: 11, fontWeight: "600" }}>
            {points.length} GPS points
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ color: "#a1a1aa", fontSize: 11, fontWeight: "600" }}>End</Text>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: strokeColor }} />
          </View>
        </View>
      </View>
    );
  }

  // ── Web / Fallback: SVG schematic trace ─────────────────────────────────────
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const latRange = maxLat - minLat || 0.001;
  const lngRange = maxLng - minLng || 0.001;
  const W = 340, H = 200, PAD = 16;

  const svgPoints = points.map((p) => {
    const x = PAD + ((p.longitude - minLng) / lngRange) * (W - 2 * PAD);
    const y = PAD + (1 - (p.latitude - minLat) / latRange) * (H - 2 * PAD);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  const startX = PAD + ((points[0].longitude - minLng) / lngRange) * (W - 2 * PAD);
  const startY = PAD + (1 - (points[0].latitude - minLat) / latRange) * (H - 2 * PAD);
  const endX   = PAD + ((points[points.length-1].longitude - minLng) / lngRange) * (W - 2 * PAD);
  const endY   = PAD + (1 - (points[points.length-1].latitude - minLat) / latRange) * (H - 2 * PAD);

  return (
    <View style={{ marginVertical: 8, backgroundColor: "#0d0d0d", borderRadius: 16, borderWidth: 0.5, borderColor: "#1f1f1f", overflow: "hidden" }}>
      <View style={{ height: H, backgroundColor: "#060608", justifyContent: "center", alignItems: "center" }}>
        <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
          <Line x1="0" y1="50"  x2="340" y2="50"  stroke="#121216" strokeWidth="0.8" />
          <Line x1="0" y1="100" x2="340" y2="100" stroke="#121216" strokeWidth="0.8" />
          <Line x1="0" y1="150" x2="340" y2="150" stroke="#121216" strokeWidth="0.8" />
          <Line x1="85"  y1="0" x2="85"  y2="200" stroke="#121216" strokeWidth="0.8" />
          <Line x1="170" y1="0" x2="170" y2="200" stroke="#121216" strokeWidth="0.8" />
          <Line x1="255" y1="0" x2="255" y2="200" stroke="#121216" strokeWidth="0.8" />
          <Polyline points={svgPoints} fill="none" stroke={strokeColor} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={startX} cy={startY} r="5" fill="#10b981" />
          <Circle cx={endX}   cy={endY}   r="6" fill="#ef4444" stroke="#000" strokeWidth="1" />
        </Svg>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#10b981" }} />
          <Text style={{ color: "#a1a1aa", fontSize: 11, fontWeight: "600" }}>Start</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ color: "#a1a1aa", fontSize: 11, fontWeight: "600" }}>End</Text>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#ef4444" }} />
        </View>
      </View>
    </View>
  );
};



export default function AddShiftModal() {
  const queryClient = useQueryClient();
  const { profile } = useSettingsStore();
  const { shiftId } = useLocalSearchParams<{ shiftId: string }>();

  // Form State
  const [selectedPlatform, setSelectedPlatform] = useState<GigPlatform>("doordash");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [date, setDate] = useState<Date>(new Date());
  const [startTime, setStartTime] = useState<Date>(new Date());
  const [endTime, setEndTime] = useState<Date>(new Date(Date.now() + 4 * 60 * 60 * 1000)); // Default 4 hrs shift
  const [grossRevenue, setGrossRevenue] = useState<string>("");
  const [tips, setTips] = useState<string>("");
  const [activeMileage, setActiveMileage] = useState<string>("");
  const [deadMileage, setDeadMileage] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // UI state for native date pickers
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState<boolean>(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Query Vehicles
  const { data: vehiclesList = [], isLoading: isLoadingVehicles } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      return getVehicles();
    },
  });

  // Set default vehicle only when NOT editing an existing shift.
  // Must be in useEffect (not queryFn) to avoid setState outside React's render cycle on Android Fabric.
  React.useEffect(() => {
    if (vehiclesList.length > 0 && !shiftId && !selectedVehicleId) {
      const active = vehiclesList.find((v: any) => v.isActive);
      setSelectedVehicleId(active ? active.id : vehiclesList[0].id);
    }
  }, [vehiclesList, shiftId]);

  // Query Existing Shift
  const { data: existingShift } = useQuery({
    queryKey: ["shift", shiftId],
    queryFn: () => getShiftById(shiftId!),
    enabled: !!shiftId,
  });

  // Pre-populate if editing
  React.useEffect(() => {
    if (existingShift) {
      setSelectedPlatform(existingShift.platform);
      setSelectedVehicleId(existingShift.vehicleId || "");
      
      const start = new Date(existingShift.startTime);
      const end = new Date(existingShift.endTime);
      
      setDate(start);
      setStartTime(start);
      setEndTime(end);
      
      setGrossRevenue(String(existingShift.grossRevenue || ""));
      setTips(String(existingShift.tipsRevenue || ""));
      setActiveMileage(String(existingShift.activeMileage || ""));
      setDeadMileage(String(existingShift.deadMileage || ""));
      setNotes(existingShift.notes || "");
    }
  }, [existingShift]);

  const handleSave = async () => {
    setErrorMessage("");
    
    // Construct final start/end timestamps based on chosen date and times
    const finalStartDate = new Date(date);
    finalStartDate.setHours(startTime.getHours());
    finalStartDate.setMinutes(startTime.getMinutes());
    finalStartDate.setSeconds(0);
    finalStartDate.setMilliseconds(0);

    const finalEndDate = new Date(date);
    finalEndDate.setHours(endTime.getHours());
    finalEndDate.setMinutes(endTime.getMinutes());
    finalEndDate.setSeconds(0);
    finalEndDate.setMilliseconds(0);

    // If shift crosses midnight (endTime < startTime), advance the end date by 1 day
    if (finalEndDate < finalStartDate) {
      finalEndDate.setDate(finalEndDate.getDate() + 1);
    }

    // Validation
    if (!selectedPlatform) {
      setErrorMessage("Please select a platform.");
      return;
    }
    if (!selectedVehicleId) {
      setErrorMessage("Please select a vehicle.");
      return;
    }

    const durationSeconds = Math.max(0, Math.floor((finalEndDate.getTime() - finalStartDate.getTime()) / 1000));
    if (durationSeconds <= 0) {
      setErrorMessage("End time must be after start time.");
      return;
    }

    setIsSaving(true);

    try {
      if (shiftId) {
        // Edit mode
        await updateShift(shiftId, {
          vehicleId: selectedVehicleId || null,
          platform: selectedPlatform,
          startTime: finalStartDate,
          endTime: finalEndDate,
          grossRevenue: parseFloat(grossRevenue) || 0.0,
          tipsRevenue: parseFloat(tips) || 0.0,
          trackedMileage: parseFloat(activeMileage) || 0.0,
          activeMileage: parseFloat(activeMileage) || 0.0,
          deadMileage: parseFloat(deadMileage) || 0.0,
          durationSeconds,
          notes: notes.trim() || null,
        });
      } else {
        // Create mode
        const newShiftId = `shift_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        await insertShift({
          id: newShiftId,
          vehicleId: selectedVehicleId || null,
          platform: selectedPlatform,
          startTime: finalStartDate,
          endTime: finalEndDate,
          grossRevenue: parseFloat(grossRevenue) || 0.0,
          tipsRevenue: parseFloat(tips) || 0.0,
          trackedMileage: parseFloat(activeMileage) || 0.0,
          activeMileage: parseFloat(activeMileage) || 0.0,
          deadMileage: parseFloat(deadMileage) || 0.0,
          durationSeconds,
          pausedSeconds: 0,
          notes: notes.trim() || null,
        });
      }
      
      // Invalidate queries to reload dashboard/list pages
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      if (shiftId) {
        queryClient.invalidateQueries({ queryKey: ["shift", shiftId] });
      }
      
      router.back();
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to save shift. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView className="dark flex-1 bg-[#000000]">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header Bar */}
        <View className="flex flex-row justify-between items-center px-4 py-3 border-b border-slate-800/80 bg-slate-900/40">
          <TouchableOpacity onPress={() => router.back()} className="py-2 px-3 bg-slate-800/40 rounded-lg border border-slate-700/30">
            <Text className="text-slate-300 text-xs font-semibold">Cancel</Text>
          </TouchableOpacity>
          <Text className="text-slate-100 text-base font-extrabold tracking-tight">
            {shiftId ? "Edit Shift" : "Add Shift"}
          </Text>
          <TouchableOpacity 
            onPress={handleSave} 
            disabled={isSaving}
            className="py-2 px-4 bg-emerald-500 rounded-lg shadow-md shadow-emerald-500/10"
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text className="text-white text-xs font-bold uppercase tracking-wider">Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerClassName="p-4 flex flex-col gap-6 pb-12">
          {errorMessage ? (
            <View className="bg-rose-500/10 border border-rose-500/20 p-3.5 rounded-xl">
              <Text className="text-rose-400 text-xs font-semibold">{errorMessage}</Text>
            </View>
          ) : null}

          {/* Platform Field */}
          <View className="flex flex-col gap-2">
            <Text className="text-slate-400 text-xs font-bold uppercase tracking-wide">Platform</Text>
            <View className="flex-row flex-wrap gap-2.5">
              {(Object.keys(PLATFORMS) as GigPlatform[]).map((pKey) => {
                const isSelected = selectedPlatform === pKey;
                return (
                  <TouchableOpacity
                    key={pKey}
                    onPress={() => setSelectedPlatform(pKey)}
                    className={cn(
                      "p-1 rounded-full border-2 transition-all duration-200",
                      isSelected ? "border-emerald-500 bg-emerald-500/10 scale-105" : "border-transparent opacity-65"
                    )}
                  >
                    <PlatformBadge platform={pKey} size="md" />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Vehicle Selector */}
          <View className="flex flex-col gap-2">
            <Text className="text-slate-400 text-xs font-bold uppercase tracking-wide">Vehicle</Text>
            {isLoadingVehicles ? (
              <ActivityIndicator size="small" color="#10b981" className="self-start mt-2" />
            ) : vehiclesList.length === 0 ? (
              <View className="p-3 border border-dashed border-slate-800 rounded-xl bg-slate-900/20">
                <Text className="text-slate-400 text-xs">No vehicles registered. Please add a vehicle in settings.</Text>
              </View>
            ) : (
              <View className="flex flex-col gap-2">
                {vehiclesList.map((vehicle: any) => {
                  const isSelected = selectedVehicleId === vehicle.id;
                  return (
                    <TouchableOpacity
                      key={vehicle.id}
                      onPress={() => setSelectedVehicleId(vehicle.id)}
                      className={cn(
                        "p-3 rounded-xl border flex-row justify-between items-center bg-slate-900/60 transition-all duration-200",
                        isSelected ? "border-emerald-500 bg-emerald-500/5" : "border-slate-800/80"
                      )}
                    >
                      <View className="flex-col">
                        <Text className="text-sm font-bold text-slate-100">{vehicle.name}</Text>
                        <Text className="text-xs text-slate-400 mt-0.5">
                          {vehicle.year} {vehicle.make} {vehicle.model} ({vehicle.type})
                        </Text>
                      </View>
                      <View className={cn(
                        "w-4 h-4 rounded-full border items-center justify-center",
                        isSelected ? "border-emerald-500 bg-emerald-500" : "border-slate-600"
                      )}>
                        {isSelected && <View className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Date & Time Picker */}
          <View className="flex flex-col gap-3">
            <Text className="text-slate-400 text-xs font-bold uppercase tracking-wide">Date & Duration</Text>
            
            {/* Cross-platform Date Input */}
            <View className="flex flex-col gap-1.5">
              <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-wider pl-1">Shift Date</Text>
              {Platform.OS === "web" ? (
                <input
                  type="date"
                  value={date.toISOString().substring(0, 10)}
                  onChange={(e) => {
                    if (e.target.value) {
                      setDate(new Date(e.target.value + "T00:00:00"));
                    }
                  }}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-slate-100 text-sm w-full outline-none focus:border-emerald-500"
                />
              ) : (
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex-row justify-between items-center"
                >
                  <Text className="text-slate-100 text-sm font-semibold">{date.toLocaleDateString(undefined, { dateStyle: "medium" })}</Text>
                  <Text className="text-emerald-500 text-[10px] uppercase font-bold tracking-wider">Select</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Cross-platform Times Row */}
            <View className="flex flex-row gap-3">
              <View className="flex-1 flex flex-col gap-1.5">
                <Text className="text-slate-505 text-[10px] font-bold uppercase tracking-wider pl-1">Start Time</Text>
                {Platform.OS === "web" ? (
                  <input
                    type="time"
                    value={startTime.toTimeString().substring(0, 5)}
                    onChange={(e) => {
                      if (e.target.value) {
                        const [h, m] = e.target.value.split(":");
                        const newTime = new Date(startTime);
                        newTime.setHours(parseInt(h, 10));
                        newTime.setMinutes(parseInt(m, 10));
                        setStartTime(newTime);
                      }
                    }}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-slate-100 text-sm w-full outline-none focus:border-emerald-500"
                  />
                ) : (
                  <TouchableOpacity
                    onPress={() => setShowStartTimePicker(true)}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex-row justify-between items-center"
                  >
                    <Text className="text-slate-100 text-sm font-semibold">
                      {startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                    <Text className="text-emerald-500 text-[10px] uppercase font-bold tracking-wider">Select</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View className="flex-1 flex flex-col gap-1.5">
                <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-wider pl-1">End Time</Text>
                {Platform.OS === "web" ? (
                  <input
                    type="time"
                    value={endTime.toTimeString().substring(0, 5)}
                    onChange={(e) => {
                      if (e.target.value) {
                        const [h, m] = e.target.value.split(":");
                        const newTime = new Date(endTime);
                        newTime.setHours(parseInt(h, 10));
                        newTime.setMinutes(parseInt(m, 10));
                        setEndTime(newTime);
                      }
                    }}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-slate-100 text-sm w-full outline-none focus:border-emerald-500"
                  />
                ) : (
                  <TouchableOpacity
                    onPress={() => setShowEndTimePicker(true)}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex-row justify-between items-center"
                  >
                    <Text className="text-slate-100 text-sm font-semibold">
                      {endTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                    <Text className="text-emerald-500 text-[10px] uppercase font-bold tracking-wider">Select</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Native DateTimePickers */}
            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) setDate(selectedDate);
                }}
              />
            )}
            {showStartTimePicker && (
              <DateTimePicker
                value={startTime}
                mode="time"
                display="default"
                onChange={(event, selectedTime) => {
                  setShowStartTimePicker(false);
                  if (selectedTime) setStartTime(selectedTime);
                }}
              />
            )}
            {showEndTimePicker && (
              <DateTimePicker
                value={endTime}
                mode="time"
                display="default"
                onChange={(event, selectedTime) => {
                  setShowEndTimePicker(false);
                  if (selectedTime) setEndTime(selectedTime);
                }}
              />
            )}
          </View>

          {/* Revenue Inputs */}
          <View className="flex flex-col gap-4">
            <Text className="text-slate-400 text-xs font-bold uppercase tracking-wide">Earnings</Text>
            
            <View className="flex flex-row gap-3">
              <View className="flex-1 flex flex-col gap-1.5">
                <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-wider pl-1">Gross Revenue ($)</Text>
                <TextInput
                  value={grossRevenue}
                  onChangeText={setGrossRevenue}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor="#475569"
                  className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3.5 text-slate-100 text-sm focus:border-emerald-500 font-semibold"
                />
              </View>

              <View className="flex-1 flex flex-col gap-1.5">
                <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-wider pl-1">Tips ($)</Text>
                <TextInput
                  value={tips}
                  onChangeText={setTips}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor="#475569"
                  className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3.5 text-slate-100 text-sm focus:border-emerald-500 font-semibold"
                />
              </View>
            </View>
          </View>

          {/* Mileage Inputs */}
          <View className="flex flex-col gap-4">
            <Text className="text-slate-400 text-xs font-bold uppercase tracking-wide">Mileage ({profile.distanceUnit})</Text>
            
            <View className="flex flex-row gap-3">
              <View className="flex-1 flex flex-col gap-1.5">
                <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-wider pl-1">Active Distance</Text>
                <TextInput
                  value={activeMileage}
                  onChangeText={setActiveMileage}
                  keyboardType="numeric"
                  placeholder="0.0"
                  placeholderTextColor="#475569"
                  className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3.5 text-slate-100 text-sm focus:border-emerald-500 font-semibold"
                />
              </View>

              <View className="flex-1 flex flex-col gap-1.5">
                <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-wider pl-1">Dead Distance</Text>
                <TextInput
                  value={deadMileage}
                  onChangeText={setDeadMileage}
                  keyboardType="numeric"
                  placeholder="0.0"
                  placeholderTextColor="#475569"
                  className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3.5 text-slate-100 text-sm focus:border-emerald-500 font-semibold"
                />
              </View>
            </View>
          </View>

          {/* Route Map (if routePath exists and is a non-empty string) */}
          {existingShift?.routePath && typeof existingShift.routePath === "string" && existingShift.routePath.trim().length > 0 && (
            <RouteLargeMap
              routePathJson={existingShift.routePath}
              strokeColor={PLATFORMS[selectedPlatform]?.color || "#3b82f6"}
            />
          )}

          {/* Notes Field */}
          <View className="flex flex-col gap-2">
            <Text className="text-slate-400 text-xs font-bold uppercase tracking-wide">Notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              placeholder="Add details about your shift (traffic, weather, peak pay details)..."
              placeholderTextColor="#475569"
              className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3.5 text-slate-100 text-sm h-24 focus:border-emerald-500 text-left align-top leading-relaxed font-medium"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
