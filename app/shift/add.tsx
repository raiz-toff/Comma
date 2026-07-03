import React, { useEffect, useState } from "react";
import {
  ScrollView,
  View,
  TextInput,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams, Stack } from "expo-router";
import { DatePickerModal } from "../../src/components/ui/DatePickerModal";
import { TimePickerModal } from "../../src/components/ui/TimePickerModal";
import { Button } from "../../src/components/ui/button";
import { Text } from "../../src/components/ui/text";
import { PlatformBadge } from "../../src/components/ui/PlatformBadge";
import { PLATFORM_REGISTRY } from "../../src/registry/platforms";
import { getPlatformContext } from "../../src/hooks/usePlatformContext";
import { getVehicles } from "../../src/database/queries/vehicles";
import { getShiftById, getShiftPlatforms, saveShiftWithPlatforms } from "../../src/database/queries/shifts";
import { useSettingsStore } from "../../store/useSettingsStore";
import { usePlatformTheme } from "../../src/hooks/usePlatformTheme";
import Svg, { Polyline, Circle, Line } from "react-native-svg";

type GigPlatform = string;

const isWeb = Platform.OS === "web";

// Dynamically load WebView with a fallback to avoid crash if native binary is outdated
let WebView: any = null;
let hasWebViewNativeModule = false;
if (!isWeb) {
  try {
    const WebViewModule = require("react-native-webview");
    WebView = WebViewModule.WebView || WebViewModule.default || WebViewModule;
    if (WebView) {
      hasWebViewNativeModule = true;
    }
  } catch (e: any) {
    console.warn("react-native-webview fallback triggered. Error:", e?.message || e);
  }
}

const RouteLargeMap = ({ routePathJson, strokeColor }: { routePathJson: string | null | undefined; strokeColor: string }) => {
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

  if (isWeb || !hasWebViewNativeModule || !WebView) {
    const lats = points.map((p) => p.latitude);
    const lngs = points.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latRange = maxLat - minLat || 0.001;
    const lngRange = maxLng - minLng || 0.001;
    const W = 340;
    const H = 200;
    const PAD = 16;

    const svgPoints = points
      .map((p) => {
        const x = PAD + ((p.longitude - minLng) / lngRange) * (W - 2 * PAD);
        const y = PAD + (1 - (p.latitude - minLat) / latRange) * (H - 2 * PAD);
        return x.toFixed(1) + "," + y.toFixed(1);
      })
      .join(" ");

    const startX = PAD + ((points[0].longitude - minLng) / lngRange) * (W - 2 * PAD);
    const startY = PAD + (1 - (points[0].latitude - minLat) / latRange) * (H - 2 * PAD);
    const endX = PAD + ((points[points.length - 1].longitude - minLng) / lngRange) * (W - 2 * PAD);
    const endY = PAD + (1 - (points[points.length - 1].latitude - minLat) / latRange) * (H - 2 * PAD);

    return (
      <View style={{ marginVertical: 8, backgroundColor: "#0F0F12", borderRadius: 16, borderWidth: 0.5, borderColor: "#1E1E23", overflow: "hidden" }}>
        <View style={{ height: H, backgroundColor: "#0A0A0C", justifyContent: "center", alignItems: "center" }}>
          <Svg width="100%" height={H} viewBox={"0 0 " + W + " " + H}>
            <Line x1="0" y1="50" x2="340" y2="50" stroke="#121216" strokeWidth="0.8" />
            <Line x1="0" y1="100" x2="340" y2="100" stroke="#121216" strokeWidth="0.8" />
            <Line x1="0" y1="150" x2="340" y2="150" stroke="#121216" strokeWidth="0.8" />
            <Line x1="85" y1="0" x2="85" y2="200" stroke="#121216" strokeWidth="0.8" />
            <Line x1="170" y1="0" x2="170" y2="200" stroke="#121216" strokeWidth="0.8" />
            <Line x1="255" y1="0" x2="255" y2="200" stroke="#121216" strokeWidth="0.8" />
            <Polyline points={svgPoints} fill="none" stroke={strokeColor} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx={startX} cy={startY} r="5" fill="#22c55e" />
            <Circle cx={endX} cy={endY} r="6" fill="#FF5247" stroke="#000" strokeWidth="1" />
          </Svg>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#22c55e" }} />
            <Text style={{ color: "#9B9BA4", fontSize: 11, fontWeight: "600" }}>Start</Text>
          </View>
          <Text style={{ color: "#65656E", fontSize: 11, fontWeight: "600" }}>{points.length} GPS points</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ color: "#9B9BA4", fontSize: 11, fontWeight: "600" }}>End</Text>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#FF5247" }} />
          </View>
        </View>
      </View>
    );
  }

  const pointsJson = JSON.stringify(points);
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        html, body, #map {
          height: 100%;
          width: 100%;
          margin: 0;
          padding: 0;
          background-color: #0F0F12;
        }
        .leaflet-control-zoom {
          border: 1px solid #1E1E23 !important;
          margin-top: 8px !important;
          margin-left: 8px !important;
        }
        .leaflet-bar a {
          background-color: #16161A !important;
          color: #9ca3af !important;
          border-bottom: 1px solid #1C1C21 !important;
        }
        .leaflet-bar a:hover {
          background-color: #1C1C21 !important;
          color: #f3f4f6 !important;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var points = ${pointsJson};
        var map = L.map('map', {
          zoomControl: false,
          dragging: false,
          touchZoom: false,
          doubleClickZoom: false,
          scrollWheelZoom: false,
          boxZoom: false,
          keyboard: false,
          attributionControl: false
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          subdomains: 'abcd',
          maxZoom: 20
        }).addTo(map);

        if (points && points.length > 0) {
          var latLngs = points.map(function(p) {
            return [p.latitude, p.longitude];
          });

          var polyline = L.polyline(latLngs, {
            color: '${strokeColor}',
            weight: 5,
            opacity: 0.9,
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(map);

          var startLatLng = latLngs[0];
          var endLatLng = latLngs[latLngs.length - 1];

          L.circleMarker(startLatLng, {
            radius: 7,
            fillColor: '#22c55e',
            fillOpacity: 1,
            color: '#ffffff',
            weight: 2
          }).addTo(map);

          L.circleMarker(endLatLng, {
            radius: 7,
            fillColor: '#FF5247',
            fillOpacity: 1,
            color: '#ffffff',
            weight: 2
          }).addTo(map);

          map.fitBounds(polyline.getBounds(), { padding: [30, 30], maxZoom: 16 });
        } else {
          map.setView([0, 0], 2);
        }
      </script>
    </body>
    </html>
  `;

  return (
    <View style={{ marginVertical: 8, backgroundColor: "#0F0F12", borderRadius: 16, borderWidth: 0.5, borderColor: "#1E1E23", overflow: "hidden", height: 240 }}>
      <WebView
        originWhitelist={["*"]}
        source={{ html: htmlContent }}
        style={{ flex: 1, backgroundColor: "#0F0F12" }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scalesPageToFit={true}
        scrollEnabled={false}
      />
    </View>
  );
};

// Stable object reference — inline literals inside JSX recreate on every render
// and trigger an Expo Router infinite re-render loop via Stack.Screen.
const SCREEN_OPTIONS = { presentation: "fullScreenModal" as const, headerShown: false };

export default function AddShiftModal() {
  const queryClient = useQueryClient();
  const { profile, isDemoMode } = useSettingsStore();
  const { shiftId } = useLocalSearchParams<{ shiftId: string }>();

  const { accentColor, accentColorDim, accentColorContrast } = usePlatformTheme();

  // Form State
  const [selectedPlatformsList, setSelectedPlatformsList] = useState<string[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [date, setDate] = useState<Date>(new Date());
  const [startTime, setStartTime] = useState<Date>(new Date());
  const [endTime, setEndTime] = useState<Date>(new Date(Date.now() + 4 * 60 * 60 * 1000)); // Default 4 hrs shift
  
  // platformForms stores inputs per platform key
  const [platformForms, setPlatformForms] = useState<Record<string, {
    grossRevenue: string;
    tipsRevenue: string;
    tripsCount: string;
    onlineHours: string;
    onlineMinutes: string;
    activeHours: string;
    activeMinutes: string;
  }>>({});
  
  const [activeMileage, setActiveMileage] = useState<string>("");
  const [deadMileage, setDeadMileage] = useState<string>("");
  // Shift-level bonus (not split per-platform — mirrors bonusAmount on the shifts table)
  const [bonusAmount, setBonusAmount] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [shiftTargetSeconds, setShiftTargetSeconds] = useState<number | null>(null);

  // UI state for native date pickers
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState<boolean>(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Wizard Step State
  const [stepIndex, setStepIndex] = useState<number>(0);

  const stepsSequence = React.useMemo(() => {
    const list: Array<{ type: "context" | "duration" | "platform" | "mileage" | "notes"; platform?: string }> = [
      { type: "context" },
      { type: "duration" },
    ];
    selectedPlatformsList.forEach((pKey) => {
      list.push({ type: "platform", platform: pKey });
    });
    list.push({ type: "mileage" }, { type: "notes" });
    return list;
  }, [selectedPlatformsList]);

  React.useEffect(() => {
    if (stepIndex >= stepsSequence.length) {
      setStepIndex(Math.max(0, stepsSequence.length - 1));
    }
  }, [stepsSequence, stepIndex]);

  // Query Vehicles
  const { data: vehiclesList = [], isLoading: isLoadingVehicles } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      return getVehicles();
    },
  });

  // Set default vehicle only when NOT editing an existing shift.
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

  // Query Shift Platforms (Reconciliation / Multi-platform entries)
  const { data: dbPlatformsList = [] } = useQuery({
    queryKey: ["shiftPlatforms", shiftId],
    queryFn: () => getShiftPlatforms(shiftId!),
    enabled: !!shiftId,
  });

  // Pre-populate if editing/reconciling
  React.useEffect(() => {
    if (existingShift) {
      setSelectedVehicleId(existingShift.vehicleId || "");
      
      const start = new Date(existingShift.startTime);
      const end = new Date(existingShift.endTime);
      
      setDate(start);
      setStartTime(start);
      setEndTime(end);
      
      const parts = existingShift.platform.split(",");
      setSelectedPlatformsList(parts);
      
      // Populate platform forms
      const initialForms: Record<string, any> = {};
      if (dbPlatformsList && dbPlatformsList.length > 0) {
        dbPlatformsList.forEach((sp: any) => {
          const onlineH = Math.floor((sp.platformOnlineSeconds || 0) / 3600);
          const onlineM = Math.floor(((sp.platformOnlineSeconds || 0) % 3600) / 60);
          const activeH = Math.floor((sp.platformActiveSeconds || 0) / 3600);
          const activeM = Math.floor(((sp.platformActiveSeconds || 0) % 3600) / 60);
          initialForms[sp.platform] = {
            grossRevenue: String(sp.grossRevenue || ""),
            tipsRevenue: String(sp.tipsRevenue || ""),
            tripsCount: String(sp.tripsCount || ""),
            onlineHours: onlineH > 0 ? String(onlineH) : "",
            onlineMinutes: onlineM > 0 ? String(onlineM) : "",
            activeHours: activeH > 0 ? String(activeH) : "",
            activeMinutes: activeM > 0 ? String(activeM) : "",
          };
        });
      } else {
        // Legacy single platform fallback
        parts.forEach((pKey: string) => {
          initialForms[pKey] = {
            grossRevenue: String(existingShift.grossRevenue || ""),
            tipsRevenue: String(existingShift.tipsRevenue || ""),
            tripsCount: "",
            onlineHours: "",
            onlineMinutes: "",
            activeHours: "",
            activeMinutes: "",
          };
        });
      }
      setPlatformForms(initialForms);
      
      setActiveMileage(String(existingShift.activeMileage || ""));
      setDeadMileage(String(existingShift.deadMileage || ""));
      setBonusAmount(String(existingShift.bonusAmount || ""));
      
      let rawNotes = existingShift.notes || "";
      const match = rawNotes.match(/\[ShiftTarget:\s*(\d+)\]/);
      if (match) {
        setShiftTargetSeconds(parseInt(match[1], 10));
        rawNotes = rawNotes.replace(/\[ShiftTarget:\s*\d+\]/, "").trim();
      } else {
        setShiftTargetSeconds(null);
      }
      setNotes(rawNotes);
    } else {
      // Default behavior for manual logging new shift
      const list = [...(profile?.selectedPlatforms || [])];
      if (list.length > 0 && selectedPlatformsList.length === 0) {
        setSelectedPlatformsList([list[0]]);
      }
    }
  }, [existingShift, dbPlatformsList, profile]);

  const togglePlatform = (pKey: string) => {
    setSelectedPlatformsList((prev) => {
      let next;
      if (prev.includes(pKey)) {
        if (prev.length <= 1) return prev;
        next = prev.filter((x) => x !== pKey);
      } else {
        next = [...prev, pKey];
      }
      return next;
    });

    if (!platformForms[pKey]) {
      setPlatformForms((prev) => ({
        ...prev,
        [pKey]: {
          grossRevenue: "",
          tipsRevenue: "",
          tripsCount: "",
          onlineHours: "",
          onlineMinutes: "",
          activeHours: "",
          activeMinutes: "",
        }
      }));
    }
  };

  const displayPlatforms = React.useMemo(() => {
    const list = [...(profile?.selectedPlatforms || [])];
    if (existingShift?.platform) {
      const parts = existingShift.platform.split(",");
      parts.forEach((p: string) => {
        if (!list.includes(p)) list.push(p);
      });
    }
    return list as string[];
  }, [profile?.selectedPlatforms, existingShift?.platform]);

  const handleSave = async () => {
    if (isDemoMode) {
      Alert.alert(
        "Demo Mode Active",
        "You cannot add or edit shifts while Demo Mode is active. Please turn off Demo Mode in Settings to manage your shifts.",
        [
          { text: "Go to Settings", onPress: () => router.push("/settings") },
          { text: "Cancel", style: "cancel" }
        ]
      );
      return;
    }

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
    if (selectedPlatformsList.length === 0) {
      setErrorMessage("Please select at least one platform.");
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
      // Parse individual platform values and compute totals
      let totalGross = 0;
      let totalTips = 0;
      
      const platformEntries = selectedPlatformsList.map((pKey) => {
        const form = platformForms[pKey] || { grossRevenue: "", tipsRevenue: "", tripsCount: "", onlineHours: "", onlineMinutes: "", activeHours: "", activeMinutes: "" };
        const gross = parseFloat(form.grossRevenue) || 0.0;
        const tips = parseFloat(form.tipsRevenue) || 0.0;
        const trips = parseInt(form.tripsCount, 10) || 0;

        // Single platform: online time = shift duration (no separate input shown)
        const onlineSecs = selectedPlatformsList.length === 1
          ? durationSeconds
          : (parseInt(form.onlineHours, 10) || 0) * 3600 + (parseInt(form.onlineMinutes, 10) || 0) * 60;

        const activeSecs = (parseInt(form.activeHours, 10) || 0) * 3600 + (parseInt(form.activeMinutes, 10) || 0) * 60;

        totalGross += gross;
        totalTips += tips;

        return {
          platform: pKey,
          platformOnlineSeconds: onlineSecs,
          platformActiveSeconds: activeSecs,
          grossRevenue: gross,
          tipsRevenue: tips,
          tripsCount: trips,
        };
      });

      let finalNotes = notes.trim() || null;
      if (shiftTargetSeconds !== null) {
        finalNotes = finalNotes ? `${finalNotes} [ShiftTarget: ${shiftTargetSeconds}]` : `[ShiftTarget: ${shiftTargetSeconds}]`;
      }

      const targetShiftId = shiftId || `shift_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // Persist the shift and its per-platform ledger atomically. One transaction means an
      // interrupted/failed save can't leave the shift with a half-deleted platform breakdown.
      const shiftPayload = {
        id: targetShiftId,
        vehicleId: selectedVehicleId || null,
        platform: selectedPlatformsList.join(","),
        startTime: finalStartDate,
        endTime: finalEndDate,
        grossRevenue: totalGross,
        tipsRevenue: totalTips,
        bonusAmount: parseFloat(bonusAmount) || 0.0,
        trackedMileage: parseFloat(activeMileage) || 0.0,
        activeMileage: parseFloat(activeMileage) || 0.0,
        deadMileage: parseFloat(deadMileage) || 0.0,
        durationSeconds,
        notes: finalNotes,
        reconciliationStatus: "reconciled" as const,
        // Only initialize pausedSeconds on create; never reset it on edit.
        ...(shiftId ? {} : { pausedSeconds: 0 }),
      };

      await saveShiftWithPlatforms(targetShiftId, Boolean(shiftId), shiftPayload, platformEntries);

      // Evaluate gamification and smart notifications
      await useSettingsStore.getState().evaluateGamification();
      
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

  const currentStep = stepsSequence[stepIndex] || { type: "context" };

  return (
    <SafeAreaView className="flex-1 bg-[#000]">
      <Stack.Screen options={SCREEN_OPTIONS} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        {/* Header Bar */}
        <View className="flex flex-row items-center px-5 py-4 border-b border-[#1E1E23] bg-[#0F0F12]">
          <TouchableOpacity
            onPress={() => router.back()}
            className="p-1 flex-row items-center min-w-[70px]"
          >
            <Text className="text-zinc-400 text-sm font-medium tracking-wide">
              Cancel
            </Text>
          </TouchableOpacity>
          <Text className="flex-1 text-white text-base font-bold tracking-tight text-center">
            {shiftId ? "Reconcile Shift" : "Log Shift"}
          </Text>
          <View className="min-w-[70px]" />
        </View>

        {/* Progress Bar */}
        <View className="flex flex-row items-center justify-between px-5 pt-4 pb-2 bg-[#000]">
          <View className="flex flex-row gap-1.5 items-center flex-1">
            {stepsSequence.map((step, i) => (
              <View
                key={`${step.type}-${(step as { platform?: string }).platform ?? ""}-${i}`}
                style={{
                  flex: 1,
                  height: 4,
                  backgroundColor: i <= stepIndex ? accentColor : "#26262C",
                  borderRadius: 2,
                }}
              />
            ))}
          </View>
          <Text className="text-zinc-500 text-[10px] font-extrabold tracking-wider uppercase ml-4">
            Step {stepIndex + 1} / {stepsSequence.length}
          </Text>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="p-4 flex flex-col gap-6 pb-12"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {errorMessage ? (
            <View className="bg-rose-500/10 border border-rose-500/20 p-3.5 rounded-xl">
              <Text className="text-rose-400 text-xs font-semibold">{errorMessage}</Text>
            </View>
          ) : null}

          {/* ── STEP 1: CONTEXT (PLATFORM & VEHICLE) ───────────────────── */}
          {currentStep.type === "context" && (
            <View className="flex flex-col gap-5">
              {/* Platform Field */}
              <View className="flex flex-col gap-2">
                <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wide">Platform(s)</Text>
                <View className="flex-row flex-wrap gap-2.5">
                  {displayPlatforms.length > 0 ? (
                    displayPlatforms.map((pKey: string) => {
                      const isSelected = selectedPlatformsList.includes(pKey);
                      return (
                        <TouchableOpacity
                          key={pKey}
                          onPress={() => togglePlatform(pKey)}
                          activeOpacity={0.85}
                          className="rounded-xl border-2 p-2"
                          style={{
                            borderColor: isSelected ? accentColor : "#26262C",
                            backgroundColor: isSelected ? accentColorDim : "#16161A",
                          }}
                        >
                          <PlatformBadge platform={pKey} size="md" />
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <View className="flex-1 p-4 bg-[#16161A] border border-[#1C1C21] rounded-xl flex-row justify-between items-center">
                      <Text className="text-zinc-400 text-xs font-semibold">No active platforms. Enable them in settings.</Text>
                      <TouchableOpacity
                        onPress={() => router.push("/settings?tab=platforms")}
                        style={{ backgroundColor: accentColor }}
                        className="py-1.5 px-3 rounded-lg"
                      >
                        <Text style={{ color: accentColorContrast }} className="text-xs font-bold">Go to Settings</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>

              {/* Vehicle Selector */}
              <View className="flex flex-col gap-2">
                <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wide">Vehicle</Text>
                {isLoadingVehicles ? (
                  <ActivityIndicator size="small" color={accentColor} className="self-start mt-2" />
                ) : vehiclesList.length === 0 ? (
                  <View className="p-3 border border-dashed border-[#1C1C21] rounded-xl bg-[#0F0F12]">
                    <Text className="text-zinc-400 text-xs">No vehicles registered. Please add a vehicle in settings.</Text>
                  </View>
                ) : (
                  <View className="flex flex-col gap-2">
                    {vehiclesList.map((vehicle: any) => {
                      const isSelected = selectedVehicleId === vehicle.id;
                      const specs = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
                      const subtitle = [specs, vehicle.type].filter(Boolean).join(" · ");
                      return (
                        <TouchableOpacity
                          key={vehicle.id}
                          onPress={() => setSelectedVehicleId(vehicle.id)}
                          activeOpacity={0.85}
                          className="p-3.5 rounded-xl border flex-row items-center gap-3"
                          style={{
                            borderColor: isSelected ? accentColor : "#1E1E23",
                            backgroundColor: isSelected ? accentColorDim : "#0F0F12",
                          }}
                        >
                          <View
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 10,
                              borderWidth: 2,
                              borderColor: isSelected ? accentColor : "#2E2E36",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {isSelected && (
                              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: accentColor }} />
                            )}
                          </View>
                          <View className="flex-1">
                            <Text className="text-sm font-bold text-white">{vehicle.name}</Text>
                            {subtitle ? (
                              <Text className="text-xs text-zinc-400 mt-0.5">{subtitle}</Text>
                            ) : null}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* ── STEP 2: DURATION ───────────────────────────────────────── */}
          {currentStep.type === "duration" && (
            <View className="flex flex-col gap-3">
              <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wide">Date & Duration</Text>
              
              {/* Shift Date */}
              <View className="flex flex-col gap-1.5">
                <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider pl-1">Shift Date</Text>
                {Platform.OS === "web" ? (
                  <input
                    type="date"
                    value={date.toISOString().substring(0, 10)}
                    onChange={(e) => {
                      if (e.target.value) {
                        setDate(new Date(e.target.value + "T00:00:00"));
                      }
                    }}
                    className="bg-[#0F0F12] border border-[#1E1E23] rounded-xl p-3.5 text-white text-sm w-full outline-none focus:border-white"
                  />
                ) : (
                  <TouchableOpacity
                    onPress={() => setShowDatePicker(true)}
                    className="bg-[#0F0F12] border border-[#1E1E23] rounded-xl p-3.5 flex-row justify-between items-center"
                  >
                    <Text className="text-white text-sm font-semibold">{date.toLocaleDateString(undefined, { dateStyle: "medium" })}</Text>
                    <Text style={{ color: accentColor }} className="text-[10px] uppercase font-bold tracking-wider">Select</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Times Row */}
              <View className="flex flex-row gap-3">
                <View className="flex-1 flex flex-col gap-1.5">
                  <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider pl-1">Start Time</Text>
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
                      className="bg-[#0F0F12] border border-[#1E1E23] rounded-xl p-3.5 text-white text-sm w-full outline-none focus:border-white"
                    />
                  ) : (
                    <TouchableOpacity
                      onPress={() => setShowStartTimePicker(true)}
                      className="bg-[#0F0F12] border border-[#1E1E23] rounded-xl p-3.5 flex-row justify-between items-center"
                    >
                      <Text className="text-white text-sm font-semibold">
                        {startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: profile?.locale?.timeFormat !== "24h" })}
                      </Text>
                      <Text style={{ color: accentColor }} className="text-[10px] uppercase font-bold tracking-wider">Select</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View className="flex-1 flex flex-col gap-1.5">
                  <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider pl-1">End Time</Text>
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
                      className="bg-[#0F0F12] border border-[#1E1E23] rounded-xl p-3.5 text-white text-sm w-full outline-none focus:border-white"
                    />
                  ) : (
                    <TouchableOpacity
                      onPress={() => setShowEndTimePicker(true)}
                      className="bg-[#0F0F12] border border-[#1E1E23] rounded-xl p-3.5 flex-row justify-between items-center"
                    >
                      <Text className="text-white text-sm font-semibold">
                        {endTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: profile?.locale?.timeFormat !== "24h" })}
                      </Text>
                      <Text style={{ color: accentColor }} className="text-[10px] uppercase font-bold tracking-wider">Select</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <DatePickerModal
                visible={showDatePicker}
                value={date}
                onChange={setDate}
                onClose={() => setShowDatePicker(false)}
              />
              <TimePickerModal
                visible={showStartTimePicker}
                value={startTime}
                is24Hour={profile?.locale?.timeFormat === "24h"}
                onChange={setStartTime}
                onClose={() => setShowStartTimePicker(false)}
              />
              <TimePickerModal
                visible={showEndTimePicker}
                value={endTime}
                is24Hour={profile?.locale?.timeFormat === "24h"}
                onChange={setEndTime}
                onClose={() => setShowEndTimePicker(false)}
              />
            </View>
          )}

          {/* ── STEP 3: PLATFORM LEDGER ────────────────────────────────── */}
          {currentStep.type === "platform" && (() => {
            const pKey = currentStep.platform!;
            const pCtx = getPlatformContext(pKey);
            const form = platformForms[pKey] || { grossRevenue: "", tipsRevenue: "", tripsCount: "", onlineHours: "", onlineMinutes: "", activeHours: "", activeMinutes: "" };

            const updateForm = (fieldKey: string, val: string) => {
              setPlatformForms((prev) => ({
                ...prev,
                [pKey]: {
                  ...(prev[pKey] || { grossRevenue: "", tipsRevenue: "", tripsCount: "", onlineHours: "", onlineMinutes: "", activeHours: "", activeMinutes: "" }),
                  [fieldKey]: val,
                }
              }));
            };

            return (
              <View key={pKey} className="bg-[#0F0F12] border border-[#1E1E23] rounded-2xl p-4 flex flex-col gap-4 mb-2">
                <View className="flex-row justify-between items-center border-b border-[#1E1E23] pb-3">
                  <PlatformBadge platform={pKey} size="md" />
                  <Text className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Platform Ledger</Text>
                </View>

                {/* Online Duration — only needed when splitting time across multiple platforms */}
                {selectedPlatformsList.length > 1 && (
                  <View className="flex flex-col gap-1.5">
                    <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider pl-1">Online Duration</Text>
                    <View className="flex-row gap-3">
                      <View className="flex-1 flex flex-row items-center bg-[#000] border border-[#1E1E23] rounded-xl px-3">
                        <TextInput
                          value={form.onlineHours}
                          onChangeText={(val) => updateForm("onlineHours", val.replace(/[^0-9]/g, ""))}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor="#65656E"
                          className="flex-1 text-white text-sm py-3 font-semibold"
                        />
                        <Text className="text-zinc-500 text-xs font-bold ml-1">hrs</Text>
                      </View>
                      <View className="flex-1 flex flex-row items-center bg-[#000] border border-[#1E1E23] rounded-xl px-3">
                        <TextInput
                          value={form.onlineMinutes}
                          onChangeText={(val) => updateForm("onlineMinutes", val.replace(/[^0-9]/g, ""))}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor="#65656E"
                          className="flex-1 text-white text-sm py-3 font-semibold"
                        />
                        <Text className="text-zinc-500 text-xs font-bold ml-1">min</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Active Duration — time spent on active deliveries (always shown) */}
                <View className="flex flex-col gap-1.5">
                  <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider pl-1">Active Duration</Text>
                  <View className="flex-row gap-3">
                    <View className="flex-1 flex flex-row items-center bg-[#000] border border-[#1E1E23] rounded-xl px-3">
                      <TextInput
                        value={form.activeHours}
                        onChangeText={(val) => updateForm("activeHours", val.replace(/[^0-9]/g, ""))}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#65656E"
                        className="flex-1 text-white text-sm py-3 font-semibold"
                      />
                      <Text className="text-zinc-500 text-xs font-bold ml-1">hrs</Text>
                    </View>
                    <View className="flex-1 flex flex-row items-center bg-[#000] border border-[#1E1E23] rounded-xl px-3">
                      <TextInput
                        value={form.activeMinutes}
                        onChangeText={(val) => updateForm("activeMinutes", val.replace(/[^0-9]/g, ""))}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#65656E"
                        className="flex-1 text-white text-sm py-3 font-semibold"
                      />
                      <Text className="text-zinc-500 text-xs font-bold ml-1">min</Text>
                    </View>
                  </View>
                </View>

                {/* Dynamic revenue fields from registry */}
                {pCtx.revenueFields.map((field: any) => (
                  <View key={field.key} className="flex flex-col gap-1.5">
                    <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider pl-1">
                      {field.label} ({profile.locale?.currency || "$"})
                      {field.required ? " *" : ""}
                    </Text>
                    <TextInput
                      value={(form as any)[field.key] || ""}
                      onChangeText={(text) => {
                        const sanitized = text.replace(/[^0-9.]/g, "");
                        const parts = sanitized.split(".");
                        const clean = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : sanitized;
                        updateForm(field.key, clean);
                      }}
                      keyboardType="numeric"
                      placeholder="0.00"
                      placeholderTextColor="#65656E"
                      className="bg-[#000] border border-[#1E1E23] rounded-xl px-4 py-3.5 text-white text-sm focus:border-white font-semibold"
                    />
                  </View>
                ))}

                {/* Bonus — shift-level (not split per-platform), shown once on the first platform */}
                {pKey === selectedPlatformsList[0] && (
                  <View className="flex flex-col gap-1.5">
                    <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider pl-1">
                      Bonus ({profile.locale?.currency || "$"})
                    </Text>
                    <TextInput
                      value={bonusAmount}
                      onChangeText={(text) => {
                        const sanitized = text.replace(/[^0-9.]/g, "");
                        const parts = sanitized.split(".");
                        setBonusAmount(parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : sanitized);
                      }}
                      keyboardType="numeric"
                      placeholder="0.00"
                      placeholderTextColor="#65656E"
                      className="bg-[#000] border border-[#1E1E23] rounded-xl px-4 py-3.5 text-white text-sm focus:border-white font-semibold"
                    />
                  </View>
                )}

                {/* Trips Count */}
                <View className="flex flex-col gap-1.5">
                  <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider pl-1">Trips Completed</Text>
                  <TextInput
                    value={form.tripsCount}
                    onChangeText={(val) => updateForm("tripsCount", val.replace(/[^0-9]/g, ""))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#65656E"
                    className="bg-[#000] border border-[#1E1E23] rounded-xl px-4 py-3.5 text-white text-sm focus:border-white font-semibold"
                  />
                </View>
              </View>
            );
          })()}

          {/* ── STEP 4: MILEAGE & ROUTE ────────────────────────────────── */}
          {currentStep.type === "mileage" && (
            <View className="bg-[#0F0F12] border border-[#1E1E23] rounded-2xl p-4 flex flex-col gap-3.5 mb-2">
              <View className="flex-row justify-between items-center border-b border-[#1E1E23] pb-3">
                <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wide">
                  Unified Distance ({profile.distanceUnit})
                </Text>
                <Text className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Odometer</Text>
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1 flex flex-col gap-1.5">
                  <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider pl-1">Active Distance</Text>
                  <TextInput
                    value={activeMileage}
                    onChangeText={(text) => {
                      const sanitized = text.replace(/[^0-9.]/g, "");
                      const parts = sanitized.split(".");
                      setActiveMileage(parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : sanitized);
                    }}
                    keyboardType="numeric"
                    placeholder="0.0"
                    placeholderTextColor="#65656E"
                    className="bg-[#000] border border-[#1E1E23] rounded-xl px-4 py-3.5 text-white text-sm focus:border-white font-semibold"
                  />
                </View>

                <View className="flex-1 flex flex-col gap-1.5">
                  <Text className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider pl-1">Dead Distance</Text>
                  <TextInput
                    value={deadMileage}
                    onChangeText={(text) => {
                      const sanitized = text.replace(/[^0-9.]/g, "");
                      const parts = sanitized.split(".");
                      setDeadMileage(parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : sanitized);
                    }}
                    keyboardType="numeric"
                    placeholder="0.0"
                    placeholderTextColor="#65656E"
                    className="bg-[#000] border border-[#1E1E23] rounded-xl px-4 py-3.5 text-white text-sm focus:border-white font-semibold"
                  />
                </View>
              </View>

              {/* Route Map (if routePath exists and is a non-empty string) */}
              {existingShift?.routePath && typeof existingShift.routePath === "string" && existingShift.routePath.trim().length > 0 && (
                <RouteLargeMap
                  routePathJson={existingShift.routePath}
                  strokeColor={PLATFORM_REGISTRY[selectedPlatformsList[0]]?.color || "#3b82f6"}
                />
              )}
            </View>
          )}

          {/* ── STEP 5: NOTES ──────────────────────────────────────────── */}
          {currentStep.type === "notes" && (
            <View className="flex flex-col gap-2">
              <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wide">Notes</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                placeholder="Add details about your shift (traffic, weather, peak pay details)..."
                placeholderTextColor="#65656E"
                className="bg-[#0F0F12] border border-[#1E1E23] rounded-xl px-4 py-3.5 text-white text-sm h-24 focus:border-white text-left align-top leading-relaxed font-semibold"
              />
            </View>
          )}
        </ScrollView>

        {/* Navigation Footer */}
        <View className="flex flex-row justify-between items-center px-5 py-4 border-t border-[#1E1E23] bg-[#0F0F12]">
          <TouchableOpacity
            onPress={() => {
              if (stepIndex > 0) {
                setStepIndex(stepIndex - 1);
              } else {
                router.back();
              }
            }}
            className="py-3 px-6 rounded-xl bg-[#1E1E23] border border-[#26262C] items-center justify-center min-w-[100px]"
          >
            <Text className="text-zinc-300 font-bold text-sm">
              {stepIndex === 0 ? "Cancel" : "Back"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            disabled={isSaving}
            onPress={() => {
              if (isSaving) return;
              // Validate Step 1 Context
              if (currentStep.type === "context") {
                if (selectedPlatformsList.length === 0) {
                  setErrorMessage("Please select at least one platform.");
                  return;
                }
                if (!selectedVehicleId) {
                  setErrorMessage("Please select a vehicle.");
                  return;
                }
              }
              // Validate Step 2 Duration
              if (currentStep.type === "duration") {
                const finalStartDate = new Date(date);
                finalStartDate.setHours(startTime.getHours());
                finalStartDate.setMinutes(startTime.getMinutes());
                
                const finalEndDate = new Date(date);
                finalEndDate.setHours(endTime.getHours());
                finalEndDate.setMinutes(endTime.getMinutes());
                
                if (finalEndDate < finalStartDate) {
                  finalEndDate.setDate(finalEndDate.getDate() + 1);
                }
                
                const durationSeconds = Math.max(0, Math.floor((finalEndDate.getTime() - finalStartDate.getTime()) / 1000));
                if (durationSeconds <= 0) {
                  setErrorMessage("End time must be after start time.");
                  return;
                }
              }

              setErrorMessage("");

              if (stepIndex < stepsSequence.length - 1) {
                setStepIndex(stepIndex + 1);
              } else {
                handleSave();
              }
            }}
            style={{ backgroundColor: accentColor, opacity: isSaving ? 0.6 : 1 }}
            className="py-3 px-6 rounded-xl items-center justify-center min-w-[120px] flex-row gap-1"
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={accentColorContrast} />
            ) : (
              <Text style={{ color: accentColorContrast }} className="font-bold text-sm">
                {stepIndex === stepsSequence.length - 1 ? "Finish" : "Continue"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
