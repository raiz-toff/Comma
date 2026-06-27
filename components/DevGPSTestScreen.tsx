import React, { useState, useEffect } from "react";
import {
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../src/components/ui/text";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { db } from "../src/database/client";
import { tempNativePoints } from "../src/database/schema";
import { desc, asc } from "drizzle-orm";
import { haversineDistance } from "../utils/geoCalculations";
import simplify from "simplify-js";
import { useSettingsStore } from "../store/useSettingsStore";
import { encodePolyline, decodePolyline, catmullRomSpline } from "../utils/polyline";
import Svg, { Polyline, Circle, Line } from "react-native-svg";

// Import CommaTracker native module safely
import CommaTracker from "../modules/comma-tracker";

// Dynamically load WebView to avoid crash if native binary is outdated
let WebViewModule: any = null;
let hasWebViewNativeModule = false;
if (Platform.OS !== "web") {
  try {
    const RNWebView = require("react-native-webview");
    WebViewModule = RNWebView.WebView || RNWebView.default || RNWebView;
    if (WebViewModule) {
      hasWebViewNativeModule = true;
    }
  } catch (e: any) {
    console.warn("react-native-webview fallback triggered in DevGPSTestScreen. Error:", e?.message || e);
  }
}
export default function DevGPSTestScreen({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  // Permissions state
  const [fgPermission, setFgPermission] = useState<string>("checking...");
  const [bgPermission, setBgPermission] = useState<string>("checking...");
  const [notifPermission, setNotifPermission] = useState<string>("checking...");

  // Tracking engine state
  const [isServiceActive, setIsServiceActive] = useState<boolean>(false);

  // Database status state
  const [dbPointsCount, setDbPointsCount] = useState<number>(0);
  const [latestPoints, setLatestPoints] = useState<any[]>([]);
  const [isLoadingDb, setIsLoadingDb] = useState<boolean>(false);
  const [postProcessedData, setPostProcessedData] = useState<{
    rawCount: number;
    simplifiedCount: number;
    activeMileage: number;
    deadMileage: number;
    polyline: string;
    decodedPoints: { latitude: number; longitude: number }[];
  } | null>(null);

  // Check everything on load
  useEffect(() => {
    checkPermissions();
    refreshDbStats();
  }, []);

  const checkPermissions = async () => {
    if (isWeb) {
      setFgPermission("Granted (Mock Web)");
      setBgPermission("Not Supported on Web");
      setNotifPermission("Granted (Mock Web)");
      return;
    }

    try {
      const { status: fg } = await Location.getForegroundPermissionsAsync();
      setFgPermission(fg);

      const { status: bg } = await Location.getBackgroundPermissionsAsync();
      setBgPermission(bg);

      const { status: notif } = await Notifications.getPermissionsAsync();
      setNotifPermission(notif);
    } catch (e) {
      setFgPermission("Error checking");
      setBgPermission("Error checking");
      setNotifPermission("Error checking");
    }
  };

  const requestPermissions = async () => {
    if (isWeb) return;
    try {
      // 1. Request notifications
      const { status: notif } = await Notifications.requestPermissionsAsync();
      setNotifPermission(notif);

      // 2. Request location
      const { status: fg } = await Location.requestForegroundPermissionsAsync();
      setFgPermission(fg);
      if (fg === "granted") {
        const { status: bg } = await Location.requestBackgroundPermissionsAsync();
        setBgPermission(bg);
      } else {
        Alert.alert("Permission Required", "Foreground location permission is needed first.");
      }
    } catch (e) {
      Alert.alert("Permission Error", "Failed to request permissions.");
    }
  };

  const refreshDbStats = async () => {
    if (isWeb) return;
    setIsLoadingDb(true);
    try {
      // 1. Get total count
      const result = await db.select().from(tempNativePoints);
      setDbPointsCount(result.length);

      // 2. Get latest 10 coordinates
      const latest = await db
        .select()
        .from(tempNativePoints)
        .orderBy(desc(tempNativePoints.timestamp))
        .limit(10);
      setLatestPoints(latest);
    } catch (e: any) {
      console.error(e);
      Alert.alert("DB Query Failed", e.message || "Failed to load coordinates.");
    } finally {
      setIsLoadingDb(false);
    }
  };

  const clearDbPoints = async () => {
    if (isWeb) return;
    Alert.alert(
      "Clear Coordinates",
      "Are you sure you want to delete all coordinates from temp_native_points?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete All",
          style: "destructive",
          onPress: async () => {
            try {
              await db.delete(tempNativePoints);
              refreshDbStats();
            } catch (e: any) {
              Alert.alert("Clear Failed", e.message || "Failed to delete rows.");
            }
          },
        },
      ]
    );
  };

  const injectMockPoint = async () => {
    if (isWeb) {
      Alert.alert("Mock Web", "Database operations not supported on web client.");
      return;
    }

    try {
      // Inject a random point within the Toronto area
      const testLat = 43.6745 + (Math.random() - 0.5) * 0.003;
      const testLon = -79.4455 + (Math.random() - 0.5) * 0.003;
      await db.insert(tempNativePoints).values({
        lat: testLat,
        lon: testLon,
        timestamp: Date.now(),
      });
      refreshDbStats();
    } catch (e: any) {
      Alert.alert("Insertion Failed", e.message || "Failed to inject mock coordinate.");
    }
  };

  const injectRouteSequence = async () => {
    if (isWeb) return;
    try {
      const timeStart = Date.now() - 100000;
      const rawTorontoPoints = [
        { lat: 43.674560, lon: -79.446379, offset: 0 },
        { lat: 43.674801, lon: -79.445499, offset: 10 },
        { lat: 43.674909, lon: -79.444777, offset: 20 },
        { lat: 43.675450, lon: -79.444796, offset: 40 },
        { lat: 43.675641, lon: -79.444948, offset: 50 },
        { lat: 43.675159, lon: -79.444772, offset: 60 },
        { lat: 43.674827, lon: -79.444530, offset: 70 },
        { lat: 43.674259, lon: -79.444337, offset: 80 },
        { lat: 43.674056, lon: -79.444802, offset: 90 },
        { lat: 43.673936, lon: -79.445181, offset: 100 }
      ];

      const newPoints = rawTorontoPoints.map((p) => ({
        lat: p.lat,
        lon: p.lon,
        timestamp: timeStart + p.offset * 1000
      }));

      for (const p of newPoints) {
        await db.insert(tempNativePoints).values(p);
      }
      
      refreshDbStats();
      Alert.alert("Toronto Route Injected", "10 sequential coordinates in Toronto injected successfully.");
    } catch (e: any) {
      Alert.alert("Failed", e.message || "Failed to inject route sequence.");
    }
  };

  const runPostProcessing = async () => {
    if (isWeb) return;
    setIsLoadingDb(true);
    try {
      const points = await db
        .select()
        .from(tempNativePoints)
        .orderBy(asc(tempNativePoints.timestamp));

      if (points.length < 2) {
        Alert.alert("Failed", "Please log or inject at least 2 points to run post-processing calculations.");
        return;
      }

      // Stop native service if active
      try {
        CommaTracker.stopTracking();
        setIsServiceActive(false);
      } catch (err) {}

      // Calculate mileage
      let calculatedActiveMileage = 0;
      let calculatedDeadMileage = 0;

      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const distM = haversineDistance(
          { lat: prev.lat, lng: prev.lon },
          { lat: curr.lat, lng: curr.lon }
        );
        const timeDeltaMs = curr.timestamp - prev.timestamp;
        const speedMps = timeDeltaMs > 0 ? distM / (timeDeltaMs / 1000) : 0;
        const speedKmh = speedMps * 3.6;

        const unit = useSettingsStore.getState().profile?.distanceUnit ?? "mi";
        const conversionFactor = unit === "mi" ? 1609.344 : 1000.0;
        const distanceConverted = distM / conversionFactor;

        if (speedKmh < 5) {
          calculatedDeadMileage += distanceConverted;
        } else {
          calculatedActiveMileage += distanceConverted;
        }
      }

      // Compress (RDP)
      const formattedForSimplify = points.map((p: { lat: number; lon: number }) => ({ x: p.lon, y: p.lat }));
      const toleranceInDegrees = 10 / 111320;
      const simplified = simplify(formattedForSimplify, toleranceInDegrees, true) as { x: number; y: number }[];

      // Encode
      const simplifiedLatLng = simplified.map((p: { x: number; y: number }) => ({ lat: p.y, lng: p.x }));
      const polyline = encodePolyline(simplifiedLatLng);

      // Decode
      const decoded = decodePolyline(polyline).map((p: { lat: number; lng: number }) => ({ latitude: p.lat, longitude: p.lng }));

      let finalPolyline = polyline;
      let finalDecoded = decoded;

      setPostProcessedData({
        rawCount: points.length,
        simplifiedCount: simplified.length,
        activeMileage: Number(calculatedActiveMileage.toFixed(2)),
        deadMileage: Number(calculatedDeadMileage.toFixed(2)),
        polyline: finalPolyline,
        decodedPoints: finalDecoded,
      });

    } catch (e: any) {
      console.error(e);
      Alert.alert("Error", e.message || "Failed to post-process points.");
    } finally {
      setIsLoadingDb(false);
    }
  };

  const startNativeService = () => {
    if (isWeb) {
      Alert.alert("Web Mock", "Native service cannot run on Web.");
      return;
    }

    try {
      CommaTracker.startTracking();
      setIsServiceActive(true);
      Alert.alert("Foreground Service", "LocationTrackingService started successfully.");
    } catch (e: any) {
      Alert.alert("Start Failed", e.message || "Native module startTracking failed.");
    }
  };

  const stopNativeService = () => {
    if (isWeb) return;
    try {
      CommaTracker.stopTracking();
      setIsServiceActive(false);
      Alert.alert("Foreground Service", "LocationTrackingService stopped successfully.");
    } catch (e: any) {
      Alert.alert("Stop Failed", e.message || "Native module stopTracking failed.");
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>🛠️ GPS Engine Debugger</Text>
          <Text style={styles.headerSubtitle}>Native Tracking & Direct DB Persistence</Text>
        </View>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>Close</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Section 1: Permissions */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>1. System Permissions</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Foreground Location:</Text>
            <Text
              style={[
                styles.infoValue,
                fgPermission === "granted" ? styles.successText : styles.warningText,
              ]}
            >
              {fgPermission}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Background Location:</Text>
            <Text
              style={[
                styles.infoValue,
                bgPermission === "granted" ? styles.successText : styles.warningText,
              ]}
            >
              {bgPermission}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Notifications Access:</Text>
            <Text
              style={[
                styles.infoValue,
                notifPermission === "granted" ? styles.successText : styles.warningText,
              ]}
            >
              {notifPermission}
            </Text>
          </View>
          <Pressable onPress={requestPermissions} style={styles.actionBtn}>
            <Text style={styles.actionBtnText}>Request Permissions</Text>
          </Pressable>
        </View>

        {/* Section 2: Native Service Controller */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>2. Kotlin Foreground Service</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Service Status (In-memory):</Text>
            <Text
              style={[
                styles.infoValue,
                isServiceActive ? styles.successText : styles.mutedText,
              ]}
            >
              {isServiceActive ? "ACTIVE" : "INACTIVE"}
            </Text>
          </View>

          <View style={styles.btnGroup}>
            <Pressable
              onPress={startNativeService}
              style={[styles.actionBtn, styles.greenBtn, { flex: 1 }]}
            >
              <Text style={styles.actionBtnText}>Start Service</Text>
            </Pressable>

            <Pressable
              onPress={stopNativeService}
              style={[styles.actionBtn, styles.redBtn, { flex: 1 }]}
            >
              <Text style={styles.actionBtnText}>Stop Service</Text>
            </Pressable>
          </View>
        </View>

        {/* Section 3: SQLite Database Bridge */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardHeader}>3. Direct SQLite Database (`comma.db`)</Text>
            {isLoadingDb && <ActivityIndicator size="small" color="#ffffff" />}
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Table `temp_native_points`:</Text>
            <Text style={styles.infoValue}>{dbPointsCount} rows found</Text>
          </View>

          <View style={styles.btnGroupWrap}>
            <Pressable onPress={refreshDbStats} style={[styles.miniBtn, { flex: 1 }]}>
              <Text style={styles.miniBtnText}>🔄 Refresh</Text>
            </Pressable>
            <Pressable onPress={injectMockPoint} style={[styles.miniBtn, { flex: 1 }]}>
              <Text style={styles.miniBtnText}>⚡ Mock Point</Text>
            </Pressable>
            <Pressable onPress={injectRouteSequence} style={[styles.miniBtn, { flex: 1.2 }]}>
              <Text style={styles.miniBtnText}>🚗 Mock Route</Text>
            </Pressable>
            <Pressable onPress={clearDbPoints} style={[styles.miniBtn, styles.redMiniBtn, { flex: 0.8 }]}>
              <Text style={styles.miniBtnText}>🗑️ Clear</Text>
            </Pressable>
          </View>
        </View>

        {/* Section 4: End Shift & JS Post-Processing */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>4. Shift Completion & Post-Processing Simulation</Text>

          <Pressable onPress={runPostProcessing} style={[styles.actionBtn, { backgroundColor: "#3b82f6" }]}>
            <Text style={[styles.actionBtnText, { color: "#ffffff" }]}>🏁 End Shift & Post-Process Data</Text>
          </Pressable>

          {postProcessedData && (
            <View style={styles.postProcessResults}>
              <Text style={styles.resultsTitle}>📊 JS Calculations Outcome</Text>
              
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Total pay mileage:</Text>
                <Text style={[styles.infoValue, { color: '#22c55e' }]}>
                  {(postProcessedData.activeMileage + postProcessedData.deadMileage).toFixed(2)} {useSettingsStore.getState().profile?.distanceUnit ?? "mi"}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Waiting (slower than 5km/h):</Text>
                <Text style={[styles.infoValue, { color: '#ef4444' }]}>
                  {postProcessedData.deadMileage} {useSettingsStore.getState().profile?.distanceUnit ?? "mi"}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Douglas-Peucker compression:</Text>
                <Text style={styles.infoValue}>
                  {postProcessedData.rawCount} ➔ {postProcessedData.simplifiedCount} pts ({Math.round((1 - postProcessedData.simplifiedCount / postProcessedData.rawCount) * 100)}% ratio)
                </Text>
              </View>

              <View style={[styles.infoRow, { flexDirection: 'column', alignItems: 'flex-start', marginTop: 6 }]}>
                <Text style={styles.infoLabel}>Encoded Polyline:</Text>
                <Text style={styles.polylineText} numberOfLines={2}>{postProcessedData.polyline}</Text>
              </View>
              
              <View style={styles.miniMapContainer}>
                <Text style={styles.miniMapTitle}>📍 Decoded Route Shape (MapLibre GL dark map):</Text>
                <View style={[styles.miniMapBox, { height: 200, paddingVertical: 0, alignItems: "stretch" }]}>
                  {postProcessedData.decodedPoints.length >= 2 ? (() => {
                    const points = postProcessedData.decodedPoints;
                    const smoothed = catmullRomSpline(points, 8);
                    
                    if (isWeb || !hasWebViewNativeModule || !WebViewModule) {
                      const lats = points.map(p => p.latitude);
                      const lngs = points.map(p => p.longitude);
                      const minLat = Math.min(...lats);
                      const maxLat = Math.max(...lats);
                      const minLng = Math.min(...lngs);
                      const maxLng = Math.max(...lngs);
                      const latRange = maxLat - minLat || 0.0001;
                      const lngRange = maxLng - minLng || 0.0001;
                      
                      const width = 280;
                      const height = 120;
                      const padding = 12;
                      
                      const svgPoints = smoothed.map(p => {
                        const x = padding + ((p.longitude - minLng) / lngRange) * (width - 2 * padding);
                        const y = padding + (1 - (p.latitude - minLat) / latRange) * (height - 2 * padding);
                        return `${x.toFixed(1)},${y.toFixed(1)}`;
                      }).join(" ");
                      
                      const start = points[0];
                      const end = points[points.length - 1];
                      const startX = padding + ((start.longitude - minLng) / lngRange) * (width - 2 * padding);
                      const startY = padding + (1 - (start.latitude - minLat) / latRange) * (height - 2 * padding);
                      const endX = padding + ((end.longitude - minLng) / lngRange) * (width - 2 * padding);
                      const endY = padding + (1 - (end.latitude - minLat) / latRange) * (height - 2 * padding);

                      return (
                        <View style={{ paddingVertical: 8, width: "100%", alignItems: "center" }}>
                          <Svg width="100%" height={120} viewBox={`0 0 ${width} ${height}`}>
                            <Polyline points={svgPoints} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                            <Circle cx={startX} cy={startY} r="5" fill="#22c55e" stroke="#ffffff" strokeWidth="1.5" />
                            <Circle cx={endX} cy={endY} r="5" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                          </Svg>
                        </View>
                      );
                    }

                    // Use raw GPS points for the map line — the Catmull-Rom spline is
                    // only for the SVG preview above. On a real map, the raw points
                    // land on the actual road; the spline can overshoot and drift visually.
                    const rawPointsJson = JSON.stringify(points);
                    const htmlContent = `
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
                            background-color: #0d0d0d;
                          }
                        </style>
                      </head>
                      <body>
                        <div id="map"></div>
                        <script>
                          var points = ${rawPointsJson};
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
                                  'line-color': '#3b82f6',
                                  'line-width': 4,
                                  'line-opacity': 0.9
                                }
                              });

                              var startPt = [rawPoints[0].longitude, rawPoints[0].latitude];
                              var endPt = [rawPoints[rawPoints.length - 1].longitude, rawPoints[rawPoints.length - 1].latitude];

                              function createCircleMarker(color) {
                                var el = document.createElement('div');
                                el.style.width = '12px';
                                el.style.height = '12px';
                                el.style.borderRadius = '50%';
                                el.style.backgroundColor = color;
                                el.style.border = '2px solid #ffffff';
                                return el;
                              }

                              new maplibregl.Marker({ element: createCircleMarker('#22c55e') })
                                .setLngLat(startPt)
                                .addTo(map);

                              new maplibregl.Marker({ element: createCircleMarker('#ef4444') })
                                .setLngLat(endPt)
                                .addTo(map);

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

                    return (
                      <WebViewModule
                        originWhitelist={["*"]}
                        source={{ html: htmlContent }}
                        style={{ flex: 1, backgroundColor: "#0d0d0d" }}
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                        scalesPageToFit={true}
                        scrollEnabled={true}
                      />
                    );
                  })() : (
                    <Text style={styles.emptyLogText}>Not enough points.</Text>
                  )}
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Section 5: Live Coordinate Log Console */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>5. Latest Coordinate Log (temp_native_points)</Text>
          {latestPoints.length === 0 ? (
            <Text style={styles.emptyLogText}>
              No points stored yet. Enable the service and drive (or inject mock points) to see logs.
            </Text>
          ) : (
            <View style={styles.logConsole}>
              <View style={styles.logHeader}>
                <Text style={styles.logHeaderCol}>Time</Text>
                <Text style={styles.logHeaderCol}>Latitude</Text>
                <Text style={styles.logHeaderCol}>Longitude</Text>
              </View>
              {latestPoints.map((pt, idx) => {
                const dateStr = new Date(pt.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                });
                return (
                  <View key={pt.id || idx} style={styles.logRow}>
                    <Text style={styles.logTextCol}>{dateStr}</Text>
                    <Text style={styles.logTextCol}>{pt.lat?.toFixed(6)}</Text>
                    <Text style={styles.logTextCol}>{pt.lon?.toFixed(6)}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 0.8,
    borderBottomColor: "#1f1f1f",
  },
  headerTitleRow: {
    flexDirection: "column",
    gap: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#ffffff",
  },
  headerSubtitle: {
    fontSize: 11,
    color: "#7a7670",
    fontWeight: "500",
  },
  closeBtn: {
    backgroundColor: "#1f1f1f",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  closeBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
  scrollContent: {
    padding: 24,
    gap: 16,
  },
  card: {
    backgroundColor: "#0d0d0d",
    borderWidth: 0.8,
    borderColor: "#1f1f1f",
    borderRadius: 14,
    padding: 18,
    gap: 12,
  },
  cardHeader: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 13,
    color: "#7a7670",
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 13,
    color: "#ffffff",
    fontWeight: "700",
  },
  successText: {
    color: "#ffffff",
    backgroundColor: "#1c3d23",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  warningText: {
    color: "#e2b83b",
    fontWeight: "700",
  },
  mutedText: {
    color: "#52525b",
  },
  actionBtn: {
    backgroundColor: "#ffffff",
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 10,
    marginTop: 4,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#000000",
  },
  btnGroup: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  greenBtn: {
    backgroundColor: "#22c55e",
  },
  redBtn: {
    backgroundColor: "#ef4444",
  },
  btnGroupWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  miniBtn: {
    backgroundColor: "#1c1b18",
    borderWidth: 0.8,
    borderColor: "#3d3a35",
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
    minWidth: 100,
  },
  redMiniBtn: {
    borderColor: "#ef4444",
  },
  miniBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ffffff",
  },
  emptyLogText: {
    fontSize: 12,
    color: "#52525b",
    lineHeight: 18,
    textAlign: "center",
    paddingVertical: 10,
  },
  logConsole: {
    backgroundColor: "#000000",
    borderRadius: 8,
    borderWidth: 0.8,
    borderColor: "#1f1f1f",
    overflow: "hidden",
  },
  logHeader: {
    flexDirection: "row",
    backgroundColor: "#0d0d0d",
    borderBottomWidth: 0.8,
    borderBottomColor: "#1f1f1f",
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  logHeaderCol: {
    flex: 1,
    fontSize: 10,
    fontWeight: "700",
    color: "#52525b",
  },
  logRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#121212",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  logTextCol: {
    flex: 1,
    fontSize: 11,
    color: "#7a7670",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  postProcessResults: {
    marginTop: 10,
    borderTopWidth: 0.8,
    borderTopColor: "#1f1f1f",
    paddingTop: 12,
    gap: 8,
  },
  resultsTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#3b82f6",
    marginBottom: 4,
  },
  polylineText: {
    fontSize: 11,
    color: "#a1a1aa",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    backgroundColor: "#000000",
    borderWidth: 0.5,
    borderColor: "#1f1f1f",
    padding: 6,
    borderRadius: 4,
    width: "100%",
    marginTop: 4,
  },
  miniMapContainer: {
    marginTop: 12,
    gap: 6,
  },
  miniMapTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
  },
  miniMapBox: {
    backgroundColor: "#000000",
    borderWidth: 0.8,
    borderColor: "#1f1f1f",
    borderRadius: 8,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  inputContainer: {
    marginTop: 4,
    marginBottom: 12,
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#a1a1aa",
  },
  textInput: {
    height: 44,
    backgroundColor: "#000000",
    borderColor: "#1f1f1f",
    borderWidth: 0.8,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: "#ffffff",
  },
});
