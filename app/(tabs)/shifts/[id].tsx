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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Text } from "@/src/components/ui/text";
import { Button } from "@/src/components/ui/button";
import { PlatformBadge } from "@/src/components/ui/PlatformBadge";
import { CurrencyText } from "@/src/components/ui/CurrencyText";
import { SectionHeader } from "@/src/components/ui/SectionHeader";
import { StatCard } from "@/src/components/ui/StatCard";
import { getShiftById, deleteShift, getLocationPointsByShiftId } from "@/src/database/queries/shifts";
import { getExpensesByShift, insertExpense, deleteExpense } from "@/src/database/queries/expenses";
import { useSettingsStore } from "@/store/useSettingsStore";
import { cn } from "@/src/lib/utils";
import { PLATFORMS, type PlatformKey } from "@/src/registry/platforms";
import { ArrowLeft, Clock3, Gauge, MapPinned, PencilLine, Plus, Route, Trash2, ReceiptText } from "lucide-react-native";
import Svg, { Polyline, Circle, Line } from "react-native-svg";

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
      <View className="py-8 border border-dashed border-slate-800/60 rounded-2xl items-center justify-center">
        <Text className="text-slate-500 text-xs font-medium">No route path was recorded for this shift.</Text>
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
    const height = 220;
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
      <View className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950" style={{ height: 260 }}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
          <Line x1="0" y1="55" x2={width} y2="55" stroke="#111827" strokeWidth="1" />
          <Line x1="0" y1="110" x2={width} y2="110" stroke="#111827" strokeWidth="1" />
          <Line x1="0" y1="165" x2={width} y2="165" stroke="#111827" strokeWidth="1" />
          <Line x1="80" y1="0" x2="80" y2={height} stroke="#111827" strokeWidth="1" />
          <Line x1="160" y1="0" x2="160" y2={height} stroke="#111827" strokeWidth="1" />
          <Line x1="240" y1="0" x2="240" y2={height} stroke="#111827" strokeWidth="1" />
          <Polyline points={svgPoints} fill="none" stroke={strokeColor} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={startX} cy={startY} r="6" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
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
          background-color: #0b0f19;
        }
        .leaflet-control-attribution {
          font-size: 8px !important;
          background: rgba(11, 15, 25, 0.85) !important;
          color: #4b5563 !important;
        }
        .leaflet-control-zoom {
          border: 1px solid #1f2937 !important;
          margin-top: 12px !important;
          margin-left: 12px !important;
        }
        .leaflet-bar a {
          background-color: #111827 !important;
          color: #9ca3af !important;
          border-bottom: 1px solid #1f2937 !important;
        }
        .leaflet-bar a:hover {
          background-color: #1f2937 !important;
          color: #f3f4f6 !important;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var points = ${pointsJson};
        var map = L.map('map', {
          zoomControl: true,
          attributionControl: true
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
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
            fillColor: '#10b981',
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

          map.fitBounds(polyline.getBounds(), { padding: [30, 30] });
        } else {
          map.setView([0, 0], 2);
        }
      </script>
    </body>
    </html>
  `;

  return (
    <View className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0b0f19]" style={{ height: 260 }}>
      <WebView
        originWhitelist={["*"]}
        source={{ html: htmlContent }}
        style={{ flex: 1, backgroundColor: "#0b0f19" }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scalesPageToFit={true}
      />
    </View>
  );
};

const EXPENSE_CATEGORIES = [
  { id: "fuel", label: "Fuel", icon: "⛽" },
  { id: "maintenance", label: "Maintenance", icon: "🔧" },
  { id: "wash", label: "Car Wash", icon: "🚿" },
  { id: "insurance", label: "Insurance", icon: "🛡️" },
  { id: "other", label: "Other", icon: "💵" },
];

export default function ShiftDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { profile } = useSettingsStore();

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

  const handleDeleteShift = () => {
    const performDelete = async () => {
      try {
        await deleteShift(id!);
        queryClient.invalidateQueries({ queryKey: ["shifts"] });
        queryClient.invalidateQueries({ queryKey: ["analytics"] });
        router.back();
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
    const performDelete = async () => {
      try {
        await deleteExpense(expId);
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
      <SafeAreaView className="dark flex-1 bg-[#000000] items-center justify-center" edges={["bottom", "left", "right"]} style={{ paddingTop: insets.top + 64 }}>
        <ActivityIndicator size="large" color="#10b981" />
      </SafeAreaView>
    );
  }

  if (!shift) {
    return (
      <SafeAreaView className="dark flex-1 bg-[#000000] items-center justify-center p-6" edges={["bottom", "left", "right"]} style={{ paddingTop: insets.top + 64 }}>
        <Text className="text-slate-400 text-sm text-center">Shift not found.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text className="text-emerald-500 text-sm font-bold">← Go Back</Text>
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
  const routeStrokeColor = PLATFORMS[shift.platform as PlatformKey]?.color || "#10b981";
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
  })} - ${new Date(shift.endTime).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })}`;

  return (
    <SafeAreaView className="dark flex-1 bg-[#000000]" edges={["bottom", "left", "right"]} style={{ paddingTop: insets.top + 64 }}>
      {/* Top Header */}
      <View className="px-4 pt-3 pb-3 border-b border-slate-800/80 bg-slate-900/40 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => router.back()} className="px-3 py-2 bg-slate-800/40 rounded-lg border border-slate-700/30">
          <Text className="text-slate-300 text-xs font-semibold">← Back</Text>
        </TouchableOpacity>
        <Text className="text-slate-100 font-extrabold text-sm tracking-tight">Shift Details</Text>
        <TouchableOpacity
          onPress={() => router.push({ pathname: "/shift/add", params: { shiftId: shift.id } })}
          className="px-3 py-2 bg-slate-800/40 rounded-lg border border-slate-700/30"
        >
          <Text className="text-emerald-500 text-xs font-bold">Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerClassName="p-4 pb-16 flex flex-col gap-5">
        {/* Main Card */}
        <View className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 flex flex-col gap-4">
          <View className="flex-row justify-between items-start">
            <View className="flex flex-col gap-1">
              <PlatformBadge platform={shift.platform as PlatformKey} size="md" />
              <Text className="text-slate-100 font-bold text-sm mt-1">{dateStr}</Text>
              <Text className="text-slate-400 text-xs font-medium">{timeStr}</Text>
            </View>
            <View className="items-end">
              <CurrencyText amount={totalRevenue} size="lg" className="font-extrabold text-emerald-400" />
              <Text className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Total Revenue</Text>
            </View>
          </View>

          {/* Quick Stats Grid */}
          <View className="grid grid-cols-3 gap-2.5 flex-row border-t border-slate-800/50 pt-4 mt-1">
            <View className="flex-1 items-center bg-slate-950/30 border border-slate-800/40 rounded-xl p-2.5">
              <Text className="text-sm font-extrabold text-slate-100">{durationHrs}h</Text>
              <Text className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Duration</Text>
            </View>
            <View className="flex-1 items-center bg-slate-950/30 border border-slate-800/40 rounded-xl p-2.5">
              <CurrencyText amount={hourlyRate} size="sm" className="font-extrabold text-slate-100" />
              <Text className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Hourly Rate</Text>
            </View>
            <View className="flex-1 items-center bg-slate-950/30 border border-slate-800/40 rounded-xl p-2.5">
              <Text className="text-sm font-extrabold text-slate-100">{totalMiles.toFixed(1)} {profile.distanceUnit}</Text>
              <Text className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Total Dist</Text>
            </View>
          </View>

          {/* Tips breakdown details */}
          <View className="flex-row justify-between items-center bg-slate-950/20 px-3.5 py-2.5 rounded-xl border border-slate-800/40">
            <Text className="text-xs text-slate-400 font-medium">Tips Component</Text>
            <CurrencyText amount={shift.tipsRevenue} size="sm" className="font-bold text-slate-200" />
          </View>

          {shift.notes ? (
            <View className="bg-slate-950/20 px-3.5 py-3 rounded-xl border border-slate-800/40">
              <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Shift Notes</Text>
              <Text className="text-slate-300 text-xs mt-1.5 leading-relaxed font-medium">"{shift.notes}"</Text>
            </View>
          ) : null}
        </View>

        {/* Route map card */}
        <View className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-3">
          <View className="flex-row justify-between items-center">
            <Text className="text-sm font-extrabold text-slate-100 tracking-tight">Route Map</Text>
            <Text className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              {gpsPointCount > 0 ? `${gpsPointCount} local points` : routePoints.length > 0 ? `${routePoints.length} route points` : "No GPS"}
            </Text>
          </View>

          <RouteDetailMap routePathJson={shift.routePath} strokeColor={routeStrokeColor} />

          {routePoints.length > 0 ? (
            <View className="flex-row justify-between items-center bg-slate-950/20 px-3.5 py-2.5 rounded-xl border border-slate-800/40">
              <View className="flex-row items-center gap-2">
                <View className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <Text className="text-xs text-slate-400 font-bold">Start</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Text className="text-xs text-slate-400 font-bold">End</Text>
                <View className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              </View>
            </View>
          ) : null}

          {gpsPointCount > 0 ? (
            <View className="bg-slate-950/20 px-3.5 py-3 rounded-xl border border-slate-800/40 gap-2">
              <View className="flex-row justify-between items-center">
                <Text className="text-xs text-slate-400 font-bold uppercase tracking-wider">Local GPS Log</Text>
                <Text className="text-[10px] text-slate-500 font-bold">{gpsPointCount} points</Text>
              </View>
              <Text className="text-xs text-slate-300 font-medium">
                {firstGpsPoint?.timestamp ? `Started ${new Date(firstGpsPoint.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Started with the first captured point"}
              </Text>
              <Text className="text-xs text-slate-300 font-medium">
                {lastGpsPoint?.timestamp ? `Ended ${new Date(lastGpsPoint.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Last captured point unavailable"}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Mileage breakdown card */}
        <View className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-3">
          <Text className="text-sm font-extrabold text-slate-100 tracking-tight">Mileage Breakdown</Text>
          
          <View className="flex-col gap-2">
            {/* Labeled Rows */}
            <View className="flex-row justify-between text-xs">
              <Text className="text-slate-400 font-medium">Active Distance</Text>
              <Text className="text-slate-200 font-bold">{activeMiles.toFixed(1)} {profile.distanceUnit}</Text>
            </View>
            <View className="flex-row justify-between text-xs">
              <Text className="text-slate-400 font-medium">Dead Distance</Text>
              <Text className="text-slate-200 font-bold">{deadMiles.toFixed(1)} {profile.distanceUnit}</Text>
            </View>
            <View className="flex-row justify-between text-xs border-t border-slate-800/40 pt-2 mt-1">
              <Text className="text-slate-400 font-bold">Dead Distance Ratio</Text>
              <Text className="text-rose-400 font-bold">{deadMilePct.toFixed(0)}%</Text>
            </View>

            {/* Split Progress Bar */}
            <View className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden flex-row mt-2">
              <View style={{ flex: Math.max(0.01, activeMiles), backgroundColor: "#10b981" }} />
              <View style={{ flex: Math.max(0.01, deadMiles), backgroundColor: "#f43f5e" }} />
            </View>
          </View>
        </View>

        {/* Expenses List Section */}
        <View className="flex flex-col gap-3">
          <View className="flex-row justify-between items-center">
            <Text className="text-sm font-extrabold text-slate-100 tracking-tight">Linked Expenses</Text>
            <TouchableOpacity
              onPress={() => setShowAddExpense((v) => !v)}
              className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg"
            >
              <Text className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider">
                {showAddExpense ? "Cancel" : "+ Add Expense"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Add Expense Form */}
          {showAddExpense && (
            <View className="bg-slate-900/60 border border-slate-700/60 rounded-2xl p-4 flex flex-col gap-4">
              <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider">Category</Text>
              <View className="flex-row flex-wrap gap-2">
                {EXPENSE_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setExpenseCategory(cat.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg border flex-row items-center gap-1.5",
                      expenseCategory === cat.id
                        ? "border-emerald-500 bg-emerald-500/10"
                        : "border-slate-800 bg-slate-900/40"
                    )}
                  >
                    <Text className="text-sm">{cat.icon}</Text>
                    <Text className={cn("text-[11px] font-bold", expenseCategory === cat.id ? "text-emerald-400" : "text-slate-400")}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View className="flex flex-col gap-1.5">
                <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Amount ($) *</Text>
                <TextInput
                  value={expenseAmount}
                  onChangeText={setExpenseAmount}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor="#475569"
                  className="bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm font-semibold"
                />
              </View>

              <View className="flex flex-col gap-1.5">
                <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Notes</Text>
                <TextInput
                  value={expenseNotes}
                  onChangeText={setExpenseNotes}
                  placeholder="Receipt note or details..."
                  placeholderTextColor="#475569"
                  className="bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm font-semibold"
                />
              </View>

              <TouchableOpacity
                onPress={handleSaveExpense}
                disabled={isSavingExpense}
                className="w-full py-3.5 bg-emerald-500 rounded-xl items-center justify-center"
              >
                {isSavingExpense ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="text-white font-bold text-sm">Save Expense</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Expenses list cards */}
          {isLoadingExpenses ? (
            <ActivityIndicator size="small" color="#10b981" />
          ) : expensesList.length === 0 ? (
            <View className="py-6 border border-dashed border-slate-800/60 rounded-2xl items-center justify-center">
              <Text className="text-slate-500 text-xs font-medium">No expenses linked to this shift.</Text>
            </View>
          ) : (
            <View className="flex flex-col gap-2.5">
              {expensesList.map((exp: any) => {
                const catInfo = EXPENSE_CATEGORIES.find((c) => c.id === exp.category);
                return (
                  <View
                    key={exp.id}
                    className="flex-row items-center justify-between bg-slate-900/50 border border-slate-800/60 rounded-xl p-3.5"
                  >
                    <View className="flex-row items-center gap-3 flex-1">
                      <Text className="text-xl">{catInfo?.icon || "💵"}</Text>
                      <View className="flex-col flex-1">
                        <Text className="text-sm font-bold text-slate-100">
                          {catInfo?.label || exp.category}
                        </Text>
                        {exp.notes ? (
                          <Text className="text-[10px] text-slate-400 mt-0.5">{exp.notes}</Text>
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
          className="w-full py-4 border border-rose-500/25 bg-rose-500/5 rounded-2xl items-center justify-center mt-4"
        >
          <Text className="text-xs font-extrabold text-rose-400 uppercase tracking-widest">
            Delete Shift Log
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
