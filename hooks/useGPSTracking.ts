import { useEffect } from "react";
import { Platform } from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { useActiveShift } from "../store/useActiveShift";

const LOCATION_TASK_NAME = "COMMA_BACKGROUND_LOCATION_TASK";
const isWeb = Platform.OS === "web";


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
