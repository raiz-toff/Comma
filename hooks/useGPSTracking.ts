import { useEffect } from "react";
import { Platform } from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { useActiveShift } from "../store/useActiveShift";
import { useSettingsStore } from "../store/useSettingsStore";
import { GPS_CONFIG } from "../src/registry/gpsConfig";
import { haversineDistance, classifyMiles, isGPSJitter } from "../utils/geoCalculations";

const LOCATION_TASK_NAME = "COMMA_BACKGROUND_LOCATION_TASK";
const isWeb = Platform.OS === "web";

// Module level state to track last coordinate across task executions
let lastLocation: { lat: number; lng: number; timestamp: number } | null = null;

if (!isWeb) {
  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
    if (error) {
      console.error("Background Location Task Error:", error);
      return;
    }
    if (data) {
      const { locations } = data;
      if (!locations || locations.length === 0) return;

      const unit = useSettingsStore.getState().profile.distanceUnit;
      const conversionFactor = unit === "mi" ? 1609.344 : 1000.0;

      for (const loc of locations) {
        const currentCoord = {
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          timestamp: loc.timestamp,
        };

        if (lastLocation) {
          const distanceM = haversineDistance(lastLocation, currentCoord);
          const elapsedMs = currentCoord.timestamp - lastLocation.timestamp;

          // Jitter filter
          if (!isGPSJitter(distanceM, elapsedMs)) {
            const speedKmh = loc.coords.speed ? loc.coords.speed * 3.6 : (distanceM / (elapsedMs / 1000)) * 3.6;
            const category = classifyMiles(speedKmh);
            const distanceConverted = distanceM / conversionFactor;

            if (category === "active") {
              useActiveShift.getState().updateMileage(distanceConverted, 0);
            } else {
              useActiveShift.getState().updateMileage(0, distanceConverted);
            }
          }
        }
        lastLocation = currentCoord;
      }
    }
  });
}

export function useGPSTracking() {
  const isActive = useActiveShift((s) => s.isActive);

  const startTracking = async () => {
    if (isWeb) return;

    try {
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== "granted") {
        console.warn("Foreground location permission not granted.");
        return;
      }

      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus !== "granted") {
        console.warn("Background location permission not granted.");
        return;
      }

      const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (!isRegistered) {
        lastLocation = null;
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: GPS_CONFIG.accuracy,
          timeInterval: GPS_CONFIG.timeInterval,
          distanceInterval: GPS_CONFIG.distanceInterval,
          foregroundService: {
            notificationTitle: "Comma GPS Tracking",
            notificationBody: "Tracking delivery miles in background.",
            notificationColor: "#10b981",
          },
          pausesUpdatesAutomatically: false,
        });
      }
    } catch (err) {
      console.error("Failed to start location updates:", err);
    }
  };

  const stopTracking = async () => {
    if (isWeb) return;

    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (isRegistered) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        lastLocation = null;
      }
    } catch (err) {
      console.error("Failed to stop location updates:", err);
    }
  };

  useEffect(() => {
    if (isActive) {
      startTracking();
    } else {
      stopTracking();
    }
    return () => {
      stopTracking();
    };
  }, [isActive]);

  return { startTracking, stopTracking };
}
