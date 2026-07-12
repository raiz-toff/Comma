import React, { useState, useEffect } from "react";
import {
  ScrollView,
  View,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  TextInput,
  Modal,
  Linking,
  KeyboardAvoidingView,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Text } from "@/src/components/ui/text";
import { PlatformBadge } from "@/src/components/ui/PlatformBadge";
import { CurrencyText } from "@/src/components/ui/CurrencyText";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { COLORS, withAlpha } from "@/src/theme/colors";
import { getShiftById, deleteShift, getLocationPointsByShiftId, getShiftPlatforms } from "@/src/database/queries/shifts";
import { getVehicleById } from "@/src/database/queries/vehicles";
import { getExpensesByShift, insertExpense, deleteExpense } from "@/src/database/queries/expenses";
import { getEffectiveMileageRate, calculateMileageWriteOff } from "@/src/database/queries/taxProfiles";
import { useSettingsStore } from "@/store/useSettingsStore";
import { getExpenseCategories, getCategoryMeta } from "@/src/registry/expenseCategories";
import { cn } from "@/src/lib/utils";
import { PLATFORMS, type PlatformKey } from "@/src/registry/platforms";
import { ArrowLeft, Clock3, Gauge, MapPinned, PencilLine, Plus, Route, Trash2, ReceiptText, Maximize2 } from "lucide-react-native";
import Svg, { Polyline, Circle, Line } from "react-native-svg";
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";

import { parseRoutePath, catmullRomSpline } from "../../utils/polyline";
import { haversineDistance } from "../../utils/geoCalculations";

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

const RouteDetailMap = ({ routePathJson, strokeColor, isNavigatingBack }: { routePathJson: string | null | undefined; strokeColor: string; isNavigatingBack?: boolean }) => {
  const [mapReady, setMapReady] = useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setMapReady(true);
    }, 450);
    return () => clearTimeout(timer);
  }, []);

  const points = React.useMemo(() => {
    return parseRoutePath(routePathJson) as Array<{ latitude: number; longitude: number; timestamp?: number }> | null;
  }, [routePathJson]);

  const smoothedPoints = React.useMemo(() => {
    if (!points) return null;
    return catmullRomSpline(points, 8);
  }, [points]);

  const mapEvents = React.useMemo(() => {
    if (!points || points.length === 0) return [];
    
    const events: Array<{
      type: "start" | "pause" | "stop" | "end";
      latitude: number;
      longitude: number;
      label: string;
    }> = [];

    events.push({
      type: "start",
      latitude: points[0].latitude,
      longitude: points[0].longitude,
      label: "Start Point",
    });

    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      
      if (prev.timestamp && curr.timestamp) {
        const dt = (curr.timestamp - prev.timestamp) / 1000;
        const ds = haversineDistance(
          { lat: prev.latitude, lng: prev.longitude },
          { lat: curr.latitude, lng: curr.longitude }
        );

        if (dt > 120) {
          events.push({
            type: "pause",
            latitude: curr.latitude,
            longitude: curr.longitude,
            label: "Pause",
          });
        } else if (ds < 20 && dt > 45) {
          events.push({
            type: "stop",
            latitude: curr.latitude,
            longitude: curr.longitude,
            label: "Stop",
          });
        }
      }
    }

    events.push({
      type: "end",
      latitude: points[points.length - 1].latitude,
      longitude: points[points.length - 1].longitude,
      label: "Ending Point",
    });

    return events;
  }, [points]);

  if (!points) {
    return (
      <View className="py-8 border-b border-line-subtle items-center justify-center bg-surface-02" style={{ height: 200 }}>
        <Text variant="paragraphS" className="text-content-muted">No route path was recorded for this shift.</Text>
      </View>
    );
  }

  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const smoothed = smoothedPoints || points;
  const lats = smoothed.map((p) => p.latitude);
  const lngs = smoothed.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = maxLat - minLat || 0.001;
  const lngRange = maxLng - minLng || 0.001;
  const startPoint = points[0];
  const endPoint = points[points.length - 1];

  const width = 320;
  const height = 200;
  const padding = 16;
  const svgPoints = smoothed.map((p) => {
    const x = padding + ((p.longitude - minLng) / lngRange) * (width - 2 * padding);
    const y = padding + (1 - (p.latitude - minLat) / latRange) * (height - 2 * padding);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const startX = padding + ((startPoint.longitude - minLng) / lngRange) * (width - 2 * padding);
  const startY = padding + (1 - (startPoint.latitude - minLat) / latRange) * (height - 2 * padding);
  const endX = padding + ((endPoint.longitude - minLng) / lngRange) * (width - 2 * padding);
  const endY = padding + (1 - (endPoint.latitude - minLat) / latRange) * (height - 2 * padding);

  const renderSvg = (isFull: boolean) => {
    return (
      <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
        <Line x1="0" y1="50" x2={width} y2="50" stroke={COLORS.surface02} strokeWidth="1" />
        <Line x1="0" y1="100" x2={width} y2="100" stroke={COLORS.surface02} strokeWidth="1" />
        <Line x1="0" y1="150" x2={width} y2="150" stroke={COLORS.surface02} strokeWidth="1" />
        <Line x1="80" y1="0" x2="80" y2={height} stroke={COLORS.surface02} strokeWidth="1" />
        <Line x1="160" y1="0" x2="160" y2={height} stroke={COLORS.surface02} strokeWidth="1" />
        <Line x1="240" y1="0" x2="240" y2={height} stroke={COLORS.surface02} strokeWidth="1" />
        <Polyline points={svgPoints} fill="none" stroke={strokeColor} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={startX} cy={startY} r="6" fill={COLORS.success} stroke={COLORS.contentPrimary} strokeWidth="2" />
        <Circle cx={endX} cy={endY} r="6" fill={COLORS.destructive} stroke={COLORS.contentPrimary} strokeWidth="2" />
      </Svg>
    );
  };

  const htmlContent = React.useMemo(() => {
    const smoothedPointsJson = JSON.stringify(smoothedPoints);
    const rawPointsJson = JSON.stringify(points);
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
      <link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
      <style>
        html, body, #map {
          height: 100%;
          width: 100%;
          margin: 0;
          padding: 0;
          background-color: #0F0F12;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var points = ${smoothedPointsJson};
        var rawPoints = ${rawPointsJson};
        
        var map = new maplibregl.Map({
          container: 'map',
          style: {
            "version": 8,
            "sources": {
              "cartodb-dark": {
                "type": "raster",
                "tiles": [
                  "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
                  "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
                  "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
                  "https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
                ],
                "tileSize": 256
              }
            },
            "layers": [
              {
                "id": "cartodb-dark-layer",
                "type": "raster",
                "source": "cartodb-dark",
                "minzoom": 0,
                "maxzoom": 20
              }
            ]
          },
          center: [0, 0],
          zoom: 2,
          interactive: true,
          attributionControl: false
        });

        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

        map.on('load', function() {
          if (points && points.length > 0) {
            var coordinates = points.map(function(p) {
              return [p.longitude, p.latitude];
            });

            map.addSource('route', {
              'type': 'geojson',
              'data': {
                'type': 'Feature',
                'properties': {},
                'geometry': {
                  'type': 'LineString',
                  'coordinates': coordinates
                }
              }
            });

            map.addLayer({
              'id': 'route-line',
              'type': 'line',
              'source': 'route',
              'layout': {
                'line-join': 'round',
                'line-cap': 'round'
              },
              'paint': {
                'line-color': '${strokeColor}',
                'line-width': 5,
                'line-opacity': 0.9
              }
            });

            var timelineEvents = ${JSON.stringify(mapEvents)};

            timelineEvents.forEach(function(ev) {
              var color = '${COLORS.info}'; // stop
              if (ev.type === 'start') color = '${COLORS.success}';
              else if (ev.type === 'end') color = '${COLORS.destructive}';
              else if (ev.type === 'pause') color = '${COLORS.warning}';
              
              var el = document.createElement('div');
              var size = (ev.type === 'start' || ev.type === 'end') ? '14px' : '10px';
              el.style.width = size;
              el.style.height = size;
              el.style.borderRadius = '50%';
              el.style.backgroundColor = color;
              el.style.border = '2px solid #ffffff';
              el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.4)';
              
              new maplibregl.Marker({ element: el })
                .setLngLat([ev.longitude, ev.latitude])
                .addTo(map);
            });

            var bounds = coordinates.reduce(function(acc, coord) {
              return acc.extend(coord);
            }, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));

            map.fitBounds(bounds, { padding: 30, animate: false });
          }
        });
      </script>
    </body>
    </html>
  `;
  }, [points, smoothedPoints, mapEvents, strokeColor]);

  const webViewSource = React.useMemo(() => ({ html: htmlContent }), [htmlContent]);

  const renderWebView = (isFull: boolean) => {
    return (
      <WebView
        originWhitelist={["*"]}
        source={webViewSource}
        style={{ flex: 1, backgroundColor: COLORS.surface02 }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scalesPageToFit={true}
        scrollEnabled={false}
      />
    );
  };

  const useFallback = isWeb || !hasWebViewNativeModule || !WebView || !mapReady || isNavigatingBack;

  return (
    <View className="overflow-hidden bg-surface-02" style={{ height: 200, position: "relative" }}>
      {useFallback ? renderSvg(false) : renderWebView(false)}

      <TouchableOpacity
        onPress={() => setIsFullscreen(true)}
        accessibilityRole="button"
        accessibilityLabel="View map fullscreen"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{
          position: "absolute",
          bottom: 12,
          right: 12,
          backgroundColor: COLORS.scrim,
          padding: 10,
          borderRadius: 12,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: COLORS.lineStrong,
          zIndex: 999,
        }}
      >
        <Maximize2 size={16} color={COLORS.contentPrimary} />
      </TouchableOpacity>

      <Modal visible={isFullscreen} animationType="fade" onRequestClose={() => setIsFullscreen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface02 }}>
          <View style={{ flex: 1, position: "relative" }}>
            {useFallback ? renderSvg(true) : renderWebView(true)}

            {/* Exit Fullscreen Button */}
            <TouchableOpacity
              onPress={() => setIsFullscreen(false)}
              accessibilityRole="button"
              accessibilityLabel="Exit fullscreen map"
              style={{
                position: "absolute",
                top: Platform.OS === "ios" ? 12 : 24,
                left: 16,
                backgroundColor: COLORS.scrim,
                padding: 10,
                borderRadius: 12,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: COLORS.lineStrong,
                zIndex: 999,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <ArrowLeft size={16} color={COLORS.contentPrimary} />
              <Text variant="labelM">Back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

export default function ShiftDetailScreen() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const queryClient = useQueryClient();
  const { profile, isDemoMode } = useSettingsStore();
  const { accentColor, accentColorContrast } = usePlatformTheme();

  // Exit transition optimization for WebView unmount
  const [isNavigatingBack, setIsNavigatingBack] = useState(false);

  const handleBack = () => {
    setIsNavigatingBack(true);
    setTimeout(() => {
      if (from === "dashboard") {
        router.replace("/(tabs)/");
      } else {
        router.replace("/(tabs)/shifts");
      }
    }, 60);
  };
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

  const { data: shiftPlatformsList = [] } = useQuery({
    queryKey: ["shift-platforms", id],
    queryFn: () => getShiftPlatforms(id!),
    enabled: !!id,
  });

  // Fetch Vehicle
  const { data: vehicle } = useQuery({
    queryKey: ["vehicle", shift?.vehicleId],
    queryFn: () => getVehicleById(shift!.vehicleId!),
    enabled: !!shift?.vehicleId,
  });

  // The mileage write-off is a tax estimate, not real money — it must never be subtracted from
  // the headline earnings figure (see netEarnings below), only shown as a separate line.
  const { data: mileageRate } = useQuery({
    queryKey: ["shift-mileage-rate", shift?.vehicleId, shift?.startTime],
    queryFn: () => getEffectiveMileageRate(shift!.vehicleId!, new Date(shift!.startTime).getFullYear(), profile?.country || "CA", vehicle!.type),
    enabled: !!shift?.vehicleId && !!vehicle,
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

  const routePoints = React.useMemo(() => {
    return parseRoutePath(shift?.routePath) as Array<{ latitude: number; longitude: number; timestamp?: number }> | null;
  }, [shift?.routePath]);

  const timelineEvents = React.useMemo(() => {
    if (!routePoints || routePoints.length === 0) return [];
    
    const events: Array<{
      type: "start" | "pause" | "stop" | "end";
      latitude: number;
      longitude: number;
      timestamp?: number;
      duration?: number;
      label: string;
    }> = [];

    // 1. Start Point
    events.push({
      type: "start",
      latitude: routePoints[0].latitude,
      longitude: routePoints[0].longitude,
      timestamp: routePoints[0].timestamp,
      label: "Start Point",
    });

    // 2. Scan for intermediate pauses/stops
    for (let i = 1; i < routePoints.length - 1; i++) {
      const prev = routePoints[i - 1];
      const curr = routePoints[i];
      
      if (prev.timestamp && curr.timestamp) {
        const dt = (curr.timestamp - prev.timestamp) / 1000; // in seconds
        const ds = haversineDistance(
          { lat: prev.latitude, lng: prev.longitude },
          { lat: curr.latitude, lng: curr.longitude }
        );

        if (dt > 120) {
          events.push({
            type: "pause",
            latitude: curr.latitude,
            longitude: curr.longitude,
            timestamp: curr.timestamp,
            duration: dt,
            label: `Paused Shift (${Math.round(dt / 60)}m)`,
          });
        } else if (ds < 20 && dt > 45) {
          events.push({
            type: "stop",
            latitude: curr.latitude,
            longitude: curr.longitude,
            timestamp: curr.timestamp,
            duration: dt,
            label: `Stopped (${Math.round(dt)}s)`,
          });
        }
      }
    }

    // 3. Ending Point
    events.push({
      type: "end",
      latitude: routePoints[routePoints.length - 1].latitude,
      longitude: routePoints[routePoints.length - 1].longitude,
      timestamp: routePoints[routePoints.length - 1].timestamp,
      label: "Ending Point",
    });

    return events;
  }, [routePoints]);

  const [eventAddresses, setEventAddresses] = useState<Record<number, string>>({});
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);

  useEffect(() => {
    if (!timelineEvents || timelineEvents.length === 0) {
      setEventAddresses({});
      return;
    }

    const resolveAddresses = async () => {
      setIsLoadingAddresses(true);
      const addresses: Record<number, string> = {};

      const fetchAddress = async (lat: number, lng: number) => {
        try {
          const Location = require("expo-location");
          const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
          if (results && results.length > 0) {
            const res = results[0];
            const parts = [
              res.streetNumber,
              res.street,
              res.city,
              res.region,
            ].filter(Boolean);
            if (parts.length > 0) {
              return parts.join(" ");
            }
          }
        } catch (e) {
          // Fallback to OSM Nominatim
        }

        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, {
            headers: { 'User-Agent': 'CommaApp/1.0' }
          });
          const data = await response.json();
          if (data && data.display_name) {
            const parts = data.display_name.split(",");
            return parts.slice(0, 3).map((p: string) => p.trim()).join(", ");
          }
        } catch (e) {
          // Fallback to raw coords
        }

        return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      };

      try {
        const promises = timelineEvents.map(async (event, index) => {
          const addr = await fetchAddress(event.latitude, event.longitude);
          addresses[index] = addr;
        });
        await Promise.all(promises);
        setEventAddresses(addresses);
      } catch (err) {
        console.error("Geocoding failed:", err);
      } finally {
        setIsLoadingAddresses(false);
      }
    };

    resolveAddresses();
  }, [timelineEvents]);

  if (isLoadingShift) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={COLORS.contentSecondary} />
      </SafeAreaView>
    );
  }

  if (!shift) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
        <EmptyState
          icon="clock"
          title="Shift not found"
          message="This shift could not be loaded. It may have been deleted."
          actionLabel="Go Back"
          onAction={handleBack}
          className="flex-1"
        />
      </SafeAreaView>
    );
  }

  // Mileage metrics
  const activeMiles = shift.activeMileage || 0;
  const deadMiles = shift.deadMileage || 0;
  const totalMiles = activeMiles + deadMiles;
  const deadMilePct = totalMiles > 0 ? (deadMiles / totalMiles) * 100 : 0;
  const durationHrs = (shift.durationSeconds / 3600).toFixed(1);
  const expenseTotal = expensesList.reduce((sum, exp: any) => sum + (Number(exp.amount) || 0), 0);
  // Real money earned for this shift — never reduced by the mileage write-off, which is a tax
  // estimate, not an expense (see mileageRate query above). Actual costs (fuel, tolls, etc.) are
  // what the user logged in expensesList, so those — and only those — reduce earnings to profit.
  const netEarnings = (shift.grossRevenue || 0) + (shift.tipsRevenue || 0) + (shift.bonusAmount || 0) - expenseTotal;
  const writeOff = mileageRate ? calculateMileageWriteOff(totalMiles, mileageRate) : 0;
  const hourlyRate = shift.durationSeconds > 0 ? (netEarnings / (shift.durationSeconds / 3600)) : 0;
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
    <SafeAreaView className="flex-1 bg-background">
      {/* Top Header */}
      <View className="px-4 py-3 border-b border-line-subtle bg-surface-02 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="px-4 py-2 bg-surface-03 rounded-xl border border-line-subtle flex-row items-center gap-1.5"
        >
          <ArrowLeft size={14} color={COLORS.contentSecondary} />
          <Text variant="labelM" className="text-content-secondary">Back</Text>
        </TouchableOpacity>
        <Text variant="labelM" className="tracking-tight">Shift Details</Text>
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
          accessibilityRole="button"
          className="px-4 py-2 bg-surface-03 rounded-xl border border-line-subtle"
        >
          <Text variant="labelM" style={{ color: accentColor }}>Edit</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerClassName="p-4 pb-16 flex flex-col gap-4" keyboardShouldPersistTaps="handled">
        {/* Combined Map & Details Card */}
        <View className="bg-surface-02 border border-line-subtle rounded-xl overflow-hidden">
          {/* Map on the top */}
          <View style={{ height: 200, width: "100%" }}>
            <RouteDetailMap routePathJson={shift.routePath} strokeColor={routeStrokeColor} isNavigatingBack={isNavigatingBack} />
          </View>

          {/* Details below map */}
          <View className="p-6 flex flex-col gap-5">
            <View className="flex-row justify-between items-start">
              <View className="flex flex-col gap-2 flex-1">
                <PlatformBadge platform={shift.platform as PlatformKey} size="md" className="px-4 py-1.5" />
                <Text variant="headingS" className="tracking-tight mt-1">{dateStr}</Text>
                <Text variant="labelM" className="text-content-secondary" tabular>{timeStr}</Text>
                {vehicle && (
                  <View className="flex-row items-center gap-1.5 mt-2 bg-surface-03 self-start px-2.5 py-1 rounded-lg border border-line-subtle">
                    <Text variant="paragraphS" className="text-content-secondary font-bold">
                      {vehicle.type === "hybrid" || vehicle.type === "car" ? "🚗" : vehicle.type === "scooter" ? "🛵" : "🚲"} {vehicle.name}
                    </Text>
                  </View>
                )}
              </View>
              <View className="items-end ml-4">
                {/* Money hero — explicit 28px stays (no variant fits), weight capped at extrabold */}
                <CurrencyText amount={netEarnings} size="xl" style={{ fontWeight: "800", fontSize: 28, color: accentColor }} />
                <Text variant="labelXs" className="text-content-muted mt-1">Net Earnings</Text>
              </View>
            </View>

            {/* Quick Stats Grid — kept custom (StatCard's icon row + min-height doesn't drop
                into this compact centered 3-up layout); tokenized instead. */}
            <View className="flex-row border-t border-line-subtle pt-5 mt-1 gap-3">
              <View className="flex-1 items-center bg-surface-03 border border-line-subtle rounded-lg p-4">
                <Text variant="headingS" tabular>{durationHrs}h</Text>
                <Text variant="labelXs" className="text-content-secondary mt-1">Duration</Text>
              </View>
              <View className="flex-1 items-center bg-surface-03 border border-line-subtle rounded-lg p-4">
                <CurrencyText amount={hourlyRate} size="lg" className="text-content-primary" />
                <Text variant="labelXs" className="text-content-secondary mt-1">Hourly Rate</Text>
              </View>
              <View className="flex-1 items-center bg-surface-03 border border-line-subtle rounded-lg p-4">
                <Text variant="headingS" tabular>{totalMiles.toFixed(1)} {profile.distanceUnit}</Text>
                <Text variant="labelXs" className="text-content-secondary mt-1">Total Dist</Text>
              </View>
            </View>

            {/* Mileage write-off — a rough estimate of taxes it could save you, not money you
                earned, so it's kept out of Net Earnings above and only shown here as a note. */}
            {totalMiles > 0 && mileageRate?.deductionMethod === "standard_mileage" && writeOff > 0 && (
              <View className="flex-row items-center gap-2 bg-surface-03/70 px-4 py-3 rounded-lg border border-line-subtle">
                <Text className="text-sm">🚗</Text>
                <Text variant="paragraphS" className="text-content-secondary flex-1">
                  Driving {totalMiles.toFixed(1)} {profile.distanceUnit} could save you about{" "}
                  <CurrencyText amount={writeOff} size="sm" style={{ color: COLORS.warning, fontWeight: "700" }} />{" "}
                  on your taxes. That's not part of what you earned above.
                </Text>
              </View>
            )}

            {/* Tips breakdown details */}
            <View className="flex-row justify-between items-center bg-surface-03/70 px-4 py-4 rounded-lg border border-line-subtle">
              <Text variant="labelM" className="text-content-secondary">Tips Component</Text>
              <CurrencyText amount={shift.tipsRevenue} size="md" className="font-extrabold text-content-primary" />
            </View>

            {/* Bonus breakdown details — only shown when a bonus was logged */}
            {!!shift.bonusAmount && (
              <View className="flex-row justify-between items-center bg-surface-03/70 px-4 py-4 rounded-lg border border-line-subtle">
                <Text variant="labelM" className="text-content-secondary">Bonus Component</Text>
                <CurrencyText amount={shift.bonusAmount} size="md" className="font-extrabold text-content-primary" />
              </View>
            )}

            {shift.notes ? (
              <View className="bg-surface-03/70 px-4 py-4 rounded-lg border border-line-subtle">
                <Text variant="labelXs" className="text-content-secondary">Shift Notes</Text>
                <Text variant="paragraphM" className="text-content-primary font-semibold mt-2 leading-relaxed">"{shift.notes}"</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Platform breakdown card */}
        {shiftPlatformsList && shiftPlatformsList.length > 0 && (
          <View className="bg-surface-02 border border-line-subtle rounded-xl p-5 flex flex-col gap-4">
            <Text variant="headingS" className="tracking-tight">Platform Breakdown</Text>
            
            <View className="flex-col gap-4">
              {shiftPlatformsList.map((sp: any) => {
                const total = sp.grossRevenue + sp.tipsRevenue;
                const onlineHrs = sp.platformOnlineSeconds / 3600;
                const payPerHour = onlineHrs > 0 ? total / onlineHrs : 0;
                const payPerTrip = sp.tripsCount > 0 ? total / sp.tripsCount : 0;
                
                const formatOnlineTime = (secs: number) => {
                  const h = Math.floor(secs / 3600);
                  const m = Math.floor((secs % 3600) / 60);
                  if (h > 0) return `${h}h ${m}m`;
                  return `${m}m`;
                };

                return (
                  <View key={sp.id} className="bg-surface-03/70 border border-line-subtle rounded-lg p-4 flex flex-col gap-3">
                    <View className="flex-row justify-between items-center border-b border-line-subtle/80 pb-2">
                      <PlatformBadge platform={sp.platform} size="sm" />
                      <View className="flex-row items-center gap-1">
                        <Text variant="paragraphS" className="text-content-secondary font-bold">Total: </Text>
                        <CurrencyText amount={total} size="sm" className="font-extrabold text-content-primary" />
                      </View>
                    </View>

                    <View className="flex-row flex-wrap gap-2">
                      <View className="flex-1 min-w-[45%] bg-background border border-line-subtle/60 rounded-xl p-2.5 items-center">
                        <Text variant="labelM" tabular>{formatOnlineTime(sp.platformOnlineSeconds)}</Text>
                        <Text variant="labelXs" className="text-content-muted mt-0.5">Online Time</Text>
                      </View>
                      <View className="flex-1 min-w-[45%] bg-background border border-line-subtle/60 rounded-xl p-2.5 items-center">
                        <Text variant="labelM" tabular>{sp.tripsCount} trips</Text>
                        <Text variant="labelXs" className="text-content-muted mt-0.5">Trips</Text>
                      </View>
                      <View className="flex-1 min-w-[45%] bg-background border border-line-subtle/60 rounded-xl p-2.5 items-center">
                        <CurrencyText amount={payPerHour} size="sm" className="text-content-primary" />
                        <Text variant="labelXs" className="text-content-muted mt-0.5">Pay / Hour</Text>
                      </View>
                      <View className="flex-1 min-w-[45%] bg-background border border-line-subtle/60 rounded-xl p-2.5 items-center">
                        <CurrencyText amount={payPerTrip} size="sm" className="text-content-primary" />
                        <Text variant="labelXs" className="text-content-muted mt-0.5">Pay / Trip</Text>
                      </View>
                    </View>

                    <View className="flex-row justify-between items-center mt-1 px-1">
                      <Text variant="paragraphS" className="text-content-muted font-semibold">Gross: <CurrencyText amount={sp.grossRevenue} size="sm" className="font-bold text-content-primary" /></Text>
                      <Text variant="paragraphS" className="text-content-muted font-semibold">Tips: <CurrencyText amount={sp.tipsRevenue} size="sm" className="font-bold text-content-primary" /></Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Mileage breakdown card */}
        <View className="bg-surface-02 border border-line-subtle rounded-xl p-5 flex flex-col gap-4">
          <Text variant="headingS" className="tracking-tight">Mileage Breakdown</Text>

          <View className="flex-col gap-3">
            {/* Labeled Rows */}
            <View className="flex-row justify-between">
              <Text className="text-content-secondary font-bold">Active Distance</Text>
              <Text className="text-content-primary font-extrabold" tabular>{activeMiles.toFixed(1)} {profile.distanceUnit}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-content-secondary font-bold">Dead Distance</Text>
              <Text className="text-content-primary font-extrabold" tabular>{deadMiles.toFixed(1)} {profile.distanceUnit}</Text>
            </View>
            <View className="flex-row justify-between border-t border-line-subtle pt-4 mt-1">
              <Text className="text-content-secondary font-extrabold">Dead Distance Ratio</Text>
              <Text variant="labelL" className="text-destructive" tabular>{deadMilePct.toFixed(0)}%</Text>
            </View>

            {/* Split Progress Bar */}
            <View
              className="w-full h-3 bg-surface-03 rounded-full overflow-hidden flex-row mt-2"
              accessible={true}
              accessibilityLabel={`Dead distance ${deadMilePct.toFixed(0)} percent of total`}
            >
              <View style={{ flex: Math.max(0.01, activeMiles), backgroundColor: accentColor }} />
              <View style={{ flex: Math.max(0.01, deadMiles), backgroundColor: COLORS.destructive }} />
            </View>
          </View>
        </View>

        {/* Route Timeline */}
        {timelineEvents && timelineEvents.length >= 2 && (
          <View className="bg-surface-02 border border-line-subtle rounded-xl p-5 flex flex-col gap-4">
            <Text variant="headingS" className="tracking-tight">Route Timeline</Text>

            <View className="flex flex-col">
              {timelineEvents.map((event, index) => {
                const color = event.type === "start" ? COLORS.success : event.type === "end" ? COLORS.destructive : event.type === "pause" ? COLORS.warning : COLORS.info;
                const bgLight = event.type === "start" ? "bg-success/10" : event.type === "end" ? "bg-destructive/10" : event.type === "pause" ? "bg-warning/10" : "bg-info/10";
                const borderLight = event.type === "start" ? "border-success/20" : event.type === "end" ? "border-destructive/20" : event.type === "pause" ? "border-warning/20" : "border-info/20";
                
                return (
                  <View key={index} className="flex-row items-stretch">
                    {/* Visual line and indicator column */}
                    <View className="items-center mr-3 w-8">
                      <View className={cn("w-8 h-8 rounded-full items-center justify-center border", bgLight, borderLight)}>
                        <MapPinned size={14} color={color} />
                      </View>
                      {index < timelineEvents.length - 1 && (
                        <View className="w-[2px] bg-line-subtle flex-grow my-1.5" style={{ minHeight: 30 }} />
                      )}
                    </View>

                    {/* Content Column */}
                    <View className="flex-1 pb-6 flex flex-col justify-start">
                      <View className="flex-row justify-between items-center">
                        <Text variant="labelXs" className="text-content-secondary">{event.label}</Text>
                        {event.timestamp && (
                          <Text variant="paragraphS" className="text-content-muted" tabular>
                            {new Date(event.timestamp).toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: profile?.locale?.timeFormat !== "24h",
                            })}
                          </Text>
                        )}
                      </View>

                      <Text variant="labelM" className="mt-1">
                        {eventAddresses[index] || (isLoadingAddresses ? "Resolving address..." : `${event.latitude.toFixed(5)}, ${event.longitude.toFixed(5)}`)}
                      </Text>

                      <TouchableOpacity
                        onPress={() => {
                          const url = `https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`;
                          Linking.openURL(url).catch((err) => console.error("Error opening map link:", err));
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`View ${event.label} on map`}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={{
                          alignSelf: "flex-start",
                          marginTop: 8,
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 20,
                          backgroundColor: withAlpha(accentColor, 0.08),
                          borderWidth: StyleSheet.hairlineWidth,
                          borderColor: withAlpha(accentColor, 0.19),
                          flexDirection: "row",
                          alignItems: "center",
                        }}
                      >
                        <Text variant="labelXs" style={{ color: accentColor }}>
                          VIEW MAP →
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Expenses List Section */}
        <View className="bg-surface-02 border border-line-subtle rounded-xl p-5 flex flex-col gap-4">
          <View className="flex-row justify-between items-center">
            <Text variant="headingS" className="tracking-tight">Linked Expenses</Text>
            <TouchableOpacity
              onPress={() => setShowAddExpense((v) => !v)}
              accessibilityRole="button"
              className="px-4 py-2 bg-surface-03 border border-line-subtle rounded-xl"
            >
              <Text variant="labelXs" className="text-content-secondary">
                {showAddExpense ? "Cancel" : "+ Add Expense"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Add Expense Form */}
          {showAddExpense && (
            <View className="bg-surface-03/50 border border-line-subtle/50 rounded-lg p-4 flex flex-col gap-4">
              <Text variant="labelXs" className="text-content-secondary">Category</Text>
              <View className="flex-row flex-wrap gap-2">
                {expenseCategories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setExpenseCategory(cat.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: expenseCategory === cat.id }}
                    style={[
                      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 6 },
                      expenseCategory === cat.id
                        ? { borderColor: accentColor, backgroundColor: withAlpha(accentColor, 0.09) }
                        : { borderColor: COLORS.lineSubtle, backgroundColor: COLORS.surface02 }
                    ]}
                  >
                    <Text style={{ fontSize: 14 }}>{cat.icon}</Text>
                    <Text variant="paragraphS" className="font-bold" style={{ color: expenseCategory === cat.id ? accentColor : COLORS.contentSecondary }}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View className="flex flex-col gap-1.5">
                <Text variant="labelXs" className="text-content-secondary">Amount ($) *</Text>
                <TextInput
                  value={expenseAmount}
                  onChangeText={setExpenseAmount}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor={COLORS.contentMuted}
                  className="bg-surface-02 border border-line-subtle rounded-xl px-4 py-3 text-content-primary text-sm font-semibold"
                />
              </View>

              <View className="flex flex-col gap-1.5">
                <Text variant="labelXs" className="text-content-secondary">Notes</Text>
                <TextInput
                  value={expenseNotes}
                  onChangeText={setExpenseNotes}
                  placeholder="Receipt note or details..."
                  placeholderTextColor={COLORS.contentMuted}
                  className="bg-surface-02 border border-line-subtle rounded-xl px-4 py-3 text-content-primary text-sm font-semibold"
                />
              </View>

              <TouchableOpacity
                onPress={handleSaveExpense}
                disabled={isSavingExpense}
                accessibilityRole="button"
                accessibilityState={{ disabled: isSavingExpense }}
                style={{ width: "100%", paddingVertical: 14, backgroundColor: accentColor, borderRadius: 12, alignItems: "center", justifyContent: "center" }}
              >
                {isSavingExpense ? (
                  <ActivityIndicator size="small" color={accentColorContrast} />
                ) : (
                  <Text variant="labelM" style={{ color: accentColorContrast }}>Save Expense</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Expenses list cards */}
          {isLoadingExpenses ? (
            <ActivityIndicator size="small" color={COLORS.contentSecondary} />
          ) : expensesList.length === 0 ? (
            <View className="py-6 border border-dashed border-line-subtle rounded-xl items-center justify-center">
              <Text variant="paragraphS" className="text-content-muted">No expenses linked to this shift.</Text>
            </View>
          ) : (
            <View className="flex flex-col gap-3">
              {expensesList.map((exp: any) => {
                const catInfo = getCategoryMeta(exp.category, country, customCategories);
                return (
                  <View
                    key={exp.id}
                    className="flex-row items-center justify-between bg-surface-03/50 border border-line-subtle/60 rounded-xl p-4"
                  >
                    <View className="flex-row items-center gap-3 flex-1">
                      <Text className="text-xl">{catInfo?.icon || "💵"}</Text>
                      <View className="flex-col flex-1">
                        <Text variant="labelM">
                          {catInfo?.label || exp.category}
                        </Text>
                        {exp.notes ? (
                          <Text variant="paragraphS" className="text-content-muted mt-0.5">{exp.notes}</Text>
                        ) : null}
                      </View>
                    </View>
                    <View className="flex-row items-center gap-3">
                      <CurrencyText amount={exp.amount} size="sm" className="font-bold text-destructive" />
                      <TouchableOpacity
                        onPress={() => handleDeleteExpense(exp.id)}
                        accessibilityRole="button"
                        accessibilityLabel="Delete expense"
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        className="p-2 rounded-lg bg-destructive/10 border border-destructive/20"
                      >
                        <Trash2 size={14} color={COLORS.destructive} />
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
          accessibilityRole="button"
          className="w-full py-4 border border-destructive/20 bg-destructive/10 rounded-xl items-center justify-center mt-2"
        >
          <Text variant="labelXs" className="text-destructive">
            Delete Shift Log
          </Text>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
