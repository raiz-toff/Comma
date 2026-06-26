import React, { useState } from "react";
import {
  ScrollView,
  View,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Text } from "@/src/components/ui/text";
import { Button } from "@/src/components/ui/button";
import { PlatformBadge } from "@/src/components/ui/PlatformBadge";
import { CurrencyText } from "@/src/components/ui/CurrencyText";
import { SectionHeader } from "@/src/components/ui/SectionHeader";
import { StatCard } from "@/src/components/ui/StatCard";
import { getShiftById, deleteShift, getLocationPointsByShiftId } from "@/src/database/queries/shifts";
import { getVehicleById } from "@/src/database/queries/vehicles";
import { getExpensesByShift, insertExpense, deleteExpense } from "@/src/database/queries/expenses";
import { useSettingsStore } from "@/store/useSettingsStore";
import { getExpenseCategories, getCategoryMeta } from "@/src/registry/expenseCategories";
import { cn } from "@/src/lib/utils";
import { PLATFORMS, type PlatformKey } from "@/src/registry/platforms";
import { ArrowLeft, Clock3, Gauge, MapPinned, PencilLine, Plus, Route, Trash2, ReceiptText } from "lucide-react-native";
import Svg, { Polyline, Circle, Line } from "react-native-svg";
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";

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

const RouteDetailMap = ({ routePathJson, strokeColor }: { routePathJson: string | null | undefined; strokeColor: string }) => {
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

  if (!points) {
    return (
      <View className="py-8 border-b border-[#1f1f1f] items-center justify-center bg-[#0d0d0d]" style={{ height: 200 }}>
        <Text className="text-zinc-500 text-xs font-medium">No route path was recorded for this shift.</Text>
      </View>
    );
  }

  if (isWeb || !hasWebViewNativeModule || !WebView) {
    const lats = points.map((p) => p.latitude);
    const lngs = points.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latRange = maxLat - minLat || 0.001;
    const lngRange = maxLng - minLng || 0.001;
    const startPoint = points[0];
    const endPoint = points[points.length - 1];
    const sampledPoints = points.length <= 25 ? points : points.filter((_, index) => index % Math.max(1, Math.floor(points.length / 24)) === 0);

    const width = 320;
    const height = 200;
    const padding = 16;
    const svgPoints = sampledPoints.map((p) => {
      const x = padding + ((p.longitude - minLng) / lngRange) * (width - 2 * padding);
      const y = padding + (1 - (p.latitude - minLat) / latRange) * (height - 2 * padding);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    const startX = padding + ((startPoint.longitude - minLng) / lngRange) * (width - 2 * padding);
    const startY = padding + (1 - (startPoint.latitude - minLat) / latRange) * (height - 2 * padding);
    const endX = padding + ((endPoint.longitude - minLng) / lngRange) * (width - 2 * padding);
    const endY = padding + (1 - (endPoint.latitude - minLat) / latRange) * (height - 2 * padding);

    return (
      <View className="overflow-hidden bg-[#0d0d0d]" style={{ height: 200 }}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
          <Line x1="0" y1="50" x2={width} y2="50" stroke="#121212" strokeWidth="1" />
          <Line x1="0" y1="100" x2={width} y2="100" stroke="#121212" strokeWidth="1" />
          <Line x1="0" y1="150" x2={width} y2="150" stroke="#121212" strokeWidth="1" />
          <Line x1="80" y1="0" x2="80" y2={height} stroke="#121212" strokeWidth="1" />
          <Line x1="160" y1="0" x2="160" y2={height} stroke="#121212" strokeWidth="1" />
          <Line x1="240" y1="0" x2="240" y2={height} stroke="#121212" strokeWidth="1" />
          <Polyline points={svgPoints} fill="none" stroke={strokeColor} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={startX} cy={startY} r="6" fill="#22c55e" stroke="#ffffff" strokeWidth="2" />
          <Circle cx={endX} cy={endY} r="6" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
        </Svg>
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
          background-color: #0d0d0d;
        }
        .leaflet-control-attribution {
          font-size: 8px !important;
          background: rgba(13, 13, 13, 0.85) !important;
          color: #4b5563 !important;
          }
        .leaflet-control-zoom {
          border: 1px solid #1f1f1f !important;
          margin-top: 12px !important;
          margin-left: 12px !important;
        }
        .leaflet-bar a {
          background-color: #161615 !important;
          color: #9ca3af !important;
          border-bottom: 1px solid #262522 !important;
        }
        .leaflet-bar a:hover {
          background-color: #262522 !important;
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
            fillColor: '#ef4444',
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
    <View className="overflow-hidden bg-[#0d0d0d]" style={{ height: 200 }}>
      <WebView
        originWhitelist={["*"]}
        source={{ html: htmlContent }}
        style={{ flex: 1, backgroundColor: "#0d0d0d" }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scalesPageToFit={true}
        scrollEnabled={false}
      />
    </View>
  );
};

export default function ShiftDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { profile, isDemoMode } = useSettingsStore();
  const { accentColor, accentColorContrast } = usePlatformTheme();
  const country = profile?.country || "CA";
  const customCategories = profile?.customCategories || [];
  const expenseCategories = getExpenseCategories(country, customCategories);

  // Add Expense inline modal state
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState("fuel");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseNotes, setExpenseNotes] = useState("");
  const [isSavingExpense, setIsSavingExpense] = useState(false);

  // Fetch Shift
  const { data: shift, isLoading: isLoadingShift } = useQuery({
    queryKey: ["shift", id],
    queryFn: () => getShiftById(id!),
    enabled: !!id,
  });

  // Fetch Expenses
  const { data: expensesList = [], isLoading: isLoadingExpenses } = useQuery({
    queryKey: ["shift-expenses", id],
    queryFn: () => getExpensesByShift(id!),
    enabled: !!id,
  });

  const { data: localPoints = [] } = useQuery({
    queryKey: ["shift-location-points", id],
    queryFn: () => getLocationPointsByShiftId(id!),
    enabled: !!id,
  });

  // Fetch Vehicle
  const { data: vehicle } = useQuery({
    queryKey: ["vehicle", shift?.vehicleId],
    queryFn: () => getVehicleById(shift!.vehicleId!),
    enabled: !!shift?.vehicleId,
  });

  const handleDeleteShift = () => {
    if (isDemoMode) {
      Alert.alert(
        "Demo Mode Active",
        "You cannot delete shifts while Demo Mode is active. Please turn off Demo Mode in Settings to manage your shifts.",
        [
          { text: "Go to Settings", onPress: () => router.push("/settings") },
          { text: "Cancel", style: "cancel" }
        ]
      );
      return;
    }

    const performDelete = async () => {
      try {
        await deleteShift(id!);
        await useSettingsStore.getState().evaluateGamification();
        queryClient.invalidateQueries({ queryKey: ["shifts"] });
        queryClient.invalidateQueries({ queryKey: ["analytics"] });
        router.replace("/(tabs)/shifts");
      } catch (err) {
        console.error(err);
        Alert.alert("Error", "Failed to delete shift.");
      }
    };

    if (isWeb) {
      if (window.confirm("Permanently delete this shift and all linked expenses?")) {
        performDelete();
      }
    } else {
      Alert.alert(
        "Delete Shift",
        "Are you sure you want to permanently delete this shift and all linked expenses?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: performDelete },
        ]
      );
    }
  };

  const handleSaveExpense = async () => {
    if (isDemoMode) {
      Alert.alert(
        "Demo Mode Active",
        "You cannot add expenses while Demo Mode is active. Please turn off Demo Mode in Settings to manage your expenses.",
        [
          { text: "Go to Settings", onPress: () => router.push("/settings") },
          { text: "Cancel", style: "cancel" }
        ]
      );
      return;
    }

    if (!expenseAmount || isNaN(parseFloat(expenseAmount))) {
      Alert.alert("Validation", "Please enter a valid expense amount.");
      return;
    }
    setIsSavingExpense(true);
    try {
      await insertExpense({
        id: `expense_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        shiftId: id!,
        category: expenseCategory,
        amount: parseFloat(expenseAmount),
        date: new Date(),
        isDeductible: true,
        vehicleId: shift?.vehicleId || null,
        notes: expenseNotes.trim() || null,
      });

      await useSettingsStore.getState().evaluateGamification();
      queryClient.invalidateQueries({ queryKey: ["shift-expenses", id] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      
      setExpenseAmount("");
      setExpenseNotes("");
      setShowAddExpense(false);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to add expense.");
    } finally {
      setIsSavingExpense(false);
    }
  };

  const handleDeleteExpense = (expId: string) => {
    if (isDemoMode) {
      Alert.alert(
        "Demo Mode Active",
        "You cannot delete expenses while Demo Mode is active. Please turn off Demo Mode in Settings to manage your expenses.",
        [
          { text: "Go to Settings", onPress: () => router.push("/settings") },
          { text: "Cancel", style: "cancel" }
        ]
      );
      return;
    }

    const performDelete = async () => {
      try {
        await deleteExpense(expId);
        await useSettingsStore.getState().evaluateGamification();
        queryClient.invalidateQueries({ queryKey: ["shift-expenses", id] });
        queryClient.invalidateQueries({ queryKey: ["analytics"] });
      } catch (err) {
        Alert.alert("Error", "Failed to delete expense.");
      }
    };

    if (isWeb) {
      if (window.confirm("Delete this expense?")) performDelete();
    } else {
      Alert.alert("Delete Expense", "Are you sure you want to delete this expense?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: performDelete },
      ]);
    }
  };

  if (isLoadingShift) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#000000", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={accentColor} />
      </SafeAreaView>
    );
  }

  if (!shift) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#000000", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ color: "#71717a", fontSize: 13, textAlign: "center" }}>Shift not found.</Text>
        <TouchableOpacity onPress={() => router.replace("/(tabs)/shifts")} style={{ marginTop: 16 }}>
          <Text style={{ color: accentColor, fontSize: 13, fontWeight: "700" }}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Mileage metrics
  const activeMiles = shift.activeMileage || 0;
  const deadMiles = shift.deadMileage || 0;
  const totalMiles = activeMiles + deadMiles;
  const deadMilePct = totalMiles > 0 ? (deadMiles / totalMiles) * 100 : 0;
  const durationHrs = (shift.durationSeconds / 3600).toFixed(1);
  const totalRevenue = shift.grossRevenue + shift.tipsRevenue;
  const hourlyRate = shift.durationSeconds > 0 ? (totalRevenue / (shift.durationSeconds / 3600)) : 0;
  let routePoints: Array<{ latitude: number; longitude: number }> = [];
  if (shift.routePath && typeof shift.routePath === "string") {
    try {
      const parsed = JSON.parse(shift.routePath);
      routePoints = Array.isArray(parsed) ? parsed : [];
    } catch {
      routePoints = [];
    }
  }
  const expenseTotal = expensesList.reduce((sum, exp: any) => sum + (Number(exp.amount) || 0), 0);
  const routeStrokeColor = PLATFORMS[shift.platform as PlatformKey]?.color || accentColor;
  const gpsPointCount = localPoints.length;
  const firstGpsPoint = localPoints[0];
  const lastGpsPoint = localPoints[gpsPointCount - 1];

  const dateStr = new Date(shift.startTime).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const timeStr = `${new Date(shift.startTime).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: profile?.locale?.timeFormat !== "24h",
  })} - ${new Date(shift.endTime).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: profile?.locale?.timeFormat !== "24h",
  })}`;

  return (
    <SafeAreaView className="flex-1 bg-[#000000]">
      {/* Top Header */}
      <View className="px-4 py-3 border-b border-[#1f1f1f] bg-[#0d0d0d] flex-row items-center justify-between">
        <TouchableOpacity onPress={() => router.replace("/(tabs)/shifts")} className="px-3.5 py-2 bg-[#161615] rounded-xl border border-[#262522]">
          <Text className="text-zinc-400 text-xs font-bold">← Back</Text>
        </TouchableOpacity>
        <Text className="text-white font-extrabold text-sm tracking-tight">Shift Details</Text>
        <TouchableOpacity
          onPress={() => {
            if (isDemoMode) {
              Alert.alert(
                "Demo Mode Active",
                "You cannot edit shifts while Demo Mode is active. Please turn off Demo Mode in Settings to manage your shifts.",
                [
                  { text: "Go to Settings", onPress: () => router.push("/settings") },
                  { text: "Cancel", style: "cancel" }
                ]
              );
              return;
            }
            router.push({ pathname: "/shift/add", params: { shiftId: shift.id } });
          }}
          className="px-3.5 py-2 bg-[#161615] rounded-xl border border-[#262522]"
        >
          <Text style={{ color: accentColor, fontSize: 12, fontWeight: "700" }}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerClassName="p-4 pb-16 flex flex-col gap-4">
        {/* Combined Map & Details Card */}
        <View className="bg-[#0d0d0d] border border-[#1f1f1f] rounded-[20px] overflow-hidden">
          {/* Map on the top */}
          <View style={{ height: 200, width: "100%" }}>
            <RouteDetailMap routePathJson={shift.routePath} strokeColor={routeStrokeColor} />
          </View>

          {/* Details below map */}
          <View className="p-6 flex flex-col gap-5">
            <View className="flex-row justify-between items-start">
              <View className="flex flex-col gap-2 flex-1">
                <PlatformBadge platform={shift.platform as PlatformKey} size="md" className="px-3.5 py-1.5" />
                <Text className="text-white font-extrabold text-base tracking-tight mt-1">{dateStr}</Text>
                <Text className="text-zinc-400 text-sm font-semibold">{timeStr}</Text>
                {vehicle && (
                  <View className="flex-row items-center gap-1.5 mt-2 bg-[#161615] self-start px-2.5 py-1 rounded-lg border border-[#262522]">
                    <Text className="text-xs text-zinc-400 font-bold">
                      {vehicle.type === "hybrid" || vehicle.type === "car" ? "🚗" : vehicle.type === "scooter" ? "🛵" : "🚲"} {vehicle.name}
                    </Text>
                  </View>
                )}
              </View>
              <View className="items-end ml-4">
                <CurrencyText amount={totalRevenue} size="xl" style={{ fontWeight: "900", fontSize: 28, color: accentColor }} />
                <Text className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">Total Revenue</Text>
              </View>
            </View>

            {/* Quick Stats Grid */}
            <View className="flex-row border-t border-[#1f1f1f] pt-5 mt-1 gap-3">
              <View className="flex-1 items-center bg-[#161615] border border-[#262522] rounded-[16px] p-3.5">
                <Text className="text-lg font-black text-white">{durationHrs}h</Text>
                <Text className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Duration</Text>
              </View>
              <View className="flex-1 items-center bg-[#161615] border border-[#262522] rounded-[16px] p-3.5">
                <CurrencyText amount={hourlyRate} size="lg" className="font-black text-lg text-white" />
                <Text className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Hourly Rate</Text>
              </View>
              <View className="flex-1 items-center bg-[#161615] border border-[#262522] rounded-[16px] p-3.5">
                <Text className="text-lg font-black text-white">{totalMiles.toFixed(1)} {profile.distanceUnit}</Text>
                <Text className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Total Dist</Text>
              </View>
            </View>

            {/* Tips breakdown details */}
            <View className="flex-row justify-between items-center bg-[#161615]/70 px-4 py-3.5 rounded-[16px] border border-[#262522]">
              <Text className="text-sm text-zinc-300 font-bold">Tips Component</Text>
              <CurrencyText amount={shift.tipsRevenue} size="md" className="font-extrabold text-zinc-100 text-sm" />
            </View>

            {shift.notes ? (
              <View className="bg-[#161615]/70 px-4 py-4 rounded-[16px] border border-[#262522]">
                <Text className="text-[11px] font-extrabold text-zinc-400 uppercase tracking-widest">Shift Notes</Text>
                <Text className="text-zinc-200 text-sm mt-2 leading-relaxed font-semibold">"{shift.notes}"</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Mileage breakdown card */}
        <View className="bg-[#0d0d0d] border border-[#1f1f1f] rounded-[20px] p-5 flex flex-col gap-4">
          <Text className="text-base font-extrabold text-white tracking-tight">Mileage Breakdown</Text>
          
          <View className="flex-col gap-3">
            {/* Labeled Rows */}
            <View className="flex-row justify-between text-sm">
              <Text className="text-zinc-400 font-bold">Active Distance</Text>
              <Text className="text-zinc-100 font-extrabold">{activeMiles.toFixed(1)} {profile.distanceUnit}</Text>
            </View>
            <View className="flex-row justify-between text-sm">
              <Text className="text-zinc-400 font-bold">Dead Distance</Text>
              <Text className="text-zinc-100 font-extrabold">{deadMiles.toFixed(1)} {profile.distanceUnit}</Text>
            </View>
            <View className="flex-row justify-between text-sm border-t border-[#1f1f1f] pt-3.5 mt-1">
              <Text className="text-zinc-400 font-extrabold">Dead Distance Ratio</Text>
              <Text className="text-rose-400 font-black text-base">{deadMilePct.toFixed(0)}%</Text>
            </View>

            {/* Split Progress Bar */}
            <View className="w-full h-3 bg-[#161615] rounded-full overflow-hidden flex-row mt-2">
              <View style={{ flex: Math.max(0.01, activeMiles), backgroundColor: accentColor }} />
              <View style={{ flex: Math.max(0.01, deadMiles), backgroundColor: "#f43f5e" }} />
            </View>
          </View>
        </View>

        {/* Expenses List Section */}
        <View className="bg-[#0d0d0d] border border-[#1f1f1f] rounded-[20px] p-5 flex flex-col gap-4">
          <View className="flex-row justify-between items-center">
            <Text className="text-base font-extrabold text-white tracking-tight">Linked Expenses</Text>
            <TouchableOpacity
              onPress={() => setShowAddExpense((v) => !v)}
              className="px-3.5 py-2 bg-[#161615] border border-[#262522] rounded-xl"
            >
              <Text className="text-xs text-zinc-300 font-bold uppercase tracking-wider">
                {showAddExpense ? "Cancel" : "+ Add Expense"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Add Expense Form */}
          {showAddExpense && (
            <View className="bg-[#161615]/50 border border-[#262522]/50 rounded-[16px] p-4 flex flex-col gap-4">
              <Text className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Category</Text>
              <View className="flex-row flex-wrap gap-2">
                {expenseCategories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setExpenseCategory(cat.id)}
                    style={[
                      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 0.8, flexDirection: "row", alignItems: "center", gap: 6 },
                      expenseCategory === cat.id
                        ? { borderColor: accentColor, backgroundColor: accentColor + "18" }
                        : { borderColor: "#262522", backgroundColor: "#0d0d0d" }
                    ]}
                  >
                    <Text style={{ fontSize: 14 }}>{cat.icon}</Text>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: expenseCategory === cat.id ? accentColor : "#71717a" }}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View className="flex flex-col gap-1.5">
                <Text className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Amount ($) *</Text>
                <TextInput
                  value={expenseAmount}
                  onChangeText={setExpenseAmount}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor="#4b5563"
                  className="bg-[#0d0d0d] border border-[#262522] rounded-xl px-4 py-3 text-white text-sm font-semibold"
                />
              </View>

              <View className="flex flex-col gap-1.5">
                <Text className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Notes</Text>
                <TextInput
                  value={expenseNotes}
                  onChangeText={setExpenseNotes}
                  placeholder="Receipt note or details..."
                  placeholderTextColor="#4b5563"
                  className="bg-[#0d0d0d] border border-[#262522] rounded-xl px-4 py-3 text-white text-sm font-semibold"
                />
              </View>

              <TouchableOpacity
                onPress={handleSaveExpense}
                disabled={isSavingExpense}
                style={{ width: "100%", paddingVertical: 14, backgroundColor: accentColor, borderRadius: 12, alignItems: "center", justifyContent: "center" }}
              >
                {isSavingExpense ? (
                  <ActivityIndicator size="small" color={accentColorContrast} />
                ) : (
                  <Text style={{ color: accentColorContrast, fontWeight: "700", fontSize: 13 }}>Save Expense</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Expenses list cards */}
          {isLoadingExpenses ? (
            <ActivityIndicator size="small" color={accentColor} />
          ) : expensesList.length === 0 ? (
            <View className="py-6 border border-dashed border-[#262522] rounded-xl items-center justify-center">
              <Text className="text-zinc-500 text-xs font-medium">No expenses linked to this shift.</Text>
            </View>
          ) : (
            <View className="flex flex-col gap-2.5">
              {expensesList.map((exp: any) => {
                const catInfo = getCategoryMeta(exp.category, country, customCategories);
                return (
                  <View
                    key={exp.id}
                    className="flex-row items-center justify-between bg-[#161615]/50 border border-[#262522]/60 rounded-xl p-3.5"
                  >
                    <View className="flex-row items-center gap-3 flex-1">
                      <Text className="text-xl">{catInfo?.icon || "💵"}</Text>
                      <View className="flex-col flex-1">
                        <Text className="text-sm font-bold text-white">
                          {catInfo?.label || exp.category}
                        </Text>
                        {exp.notes ? (
                          <Text className="text-[10px] text-zinc-500 mt-0.5">{exp.notes}</Text>
                        ) : null}
                      </View>
                    </View>
                    <View className="flex-row items-center gap-3">
                      <CurrencyText amount={exp.amount} size="sm" className="font-bold text-rose-400" />
                      <TouchableOpacity
                        onPress={() => handleDeleteExpense(exp.id)}
                        className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20"
                      >
                        <View style={{ width: 10, height: 11, borderWidth: 1.5, borderColor: "#f43f5e", borderTopWidth: 0, borderBottomLeftRadius: 1, borderBottomRightRadius: 1 }}>
                          <View style={{ width: 10, height: 1.5, backgroundColor: "#f43f5e", position: "absolute", top: -3 }} />
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Delete Shift Button */}
        <TouchableOpacity
          onPress={handleDeleteShift}
          className="w-full py-4 border border-rose-500/20 bg-rose-950/10 rounded-[20px] items-center justify-center mt-2"
        >
          <Text className="text-xs font-extrabold text-rose-400 uppercase tracking-widest">
            Delete Shift Log
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
