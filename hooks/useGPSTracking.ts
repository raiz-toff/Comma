import { useEffect } from "react";
import { Platform } from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { useActiveShift } from "../store/useActiveShift";
import { useSettingsStore } from "../store/useSettingsStore";
import { insertLocationPoint } from "../src/database/queries/shifts";
import { haversineDistance, classifyMiles, isGPSJitter } from "../utils/geoCalculations";

const LOCATION_TASK_NAME = "COMMA_BACKGROUND_LOCATION_TASK";
const isWeb = Platform.OS === "web";

// Module level state to track last coordinate across task executions
let lastLocation: { lat: number; lng: number; timestamp: number } | null = null;
let slowPointStreak = 0;

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
        const activeShift = useActiveShift.getState();

        if (activeShift.sessionId) {
          try {
            await insertLocationPoint({
              id: `point_${loc.timestamp}_${Math.random().toString(36).slice(2, 8)}`,
              sessionId: activeShift.sessionId,
              shiftId: null,
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              altitude: loc.coords.altitude ?? null,
              accuracy: loc.coords.accuracy ?? null,
              speed: loc.coords.speed ?? null,
              timestamp: new Date(loc.timestamp),
              source: "gps",
              isFiltered: false,
            });
          } catch (err) {
            console.warn("Failed to persist local GPS point:", err);
          }
        }

        activeShift.addCoordinate(loc.coords.latitude, loc.coords.longitude);

        if (lastLocation) {
          const distanceM = haversineDistance(lastLocation, currentCoord);
          const elapsedMs = currentCoord.timestamp - lastLocation.timestamp;
          const speedKmh = elapsedMs > 0 ? (distanceM / (elapsedMs / 1000)) * 3.6 : 0;

          // Jitter filter
          if (!isGPSJitter(distanceM, elapsedMs)) {
            const distanceConverted = distanceM / conversionFactor;
            const isFirstReceived = activeShift.isFirstOrderReceived;

            activeShift.updateMileage(isFirstReceived ? distanceConverted : 0, isFirstReceived ? 0 : distanceConverted);

            const movementType = classifyMiles(speedKmh);
            if (movementType === "dead") {
              slowPointStreak += 1;
              if (slowPointStreak >= 3 && !activeShift.isPaused) {
                activeShift.setAutoPaused(true);
              }
            } else {
              slowPointStreak = 0;
              if (activeShift.isAutoPaused) {
                activeShift.resumeShift();
              }
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

      lastLocation = null;
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 10,
        deferredUpdatesInterval: 10000,
        deferredUpdatesDistance: 50,
        showsBackgroundLocationIndicator: true,
        activityType: Location.ActivityType.AutomotiveNavigation,
        foregroundService: {
          notificationTitle: "Comma GPS Tracking",
          notificationBody: "Tracking delivery miles in background.",
          notificationColor: "#10b981",
        },
        pausesUpdatesAutomatically: false,
      });
    } catch (err) {
      console.error("Failed to start location updates:", err);
    }
  };

  const stopTracking = async () => {
    if (isWeb) return;

    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (isRegistered) {
        const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (hasStarted) {
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        }
        lastLocation = null;
        slowPointStreak = 0;
      }
    } catch (err) {
      // Silence no-op task exceptions
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
