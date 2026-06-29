import { useEffect } from "react";
import { Platform } from "react-native";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { useActiveShift } from "../store/useActiveShift";
import CommaTracker from "../modules/comma-tracker";

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

      // Android 13+ suppresses the foreground-service notification unless
      // POST_NOTIFICATIONS is granted. Request it so the "Recording mileage"
      // notification is actually visible. Non-blocking — tracking proceeds regardless.
      try {
        const { status: notifStatus } = await Notifications.getPermissionsAsync();
        if (notifStatus !== "granted") {
          await Notifications.requestPermissionsAsync();
        }
      } catch (notifErr) {
        console.warn("Notification permission request failed:", notifErr);
      }

      // Launch the native foreground service (CommaTrackerModule.kt →
      // LocationTrackingService.kt). It shows the ongoing notification and
      // writes GPS points into the temp_native_points table, which endShift() reads.
      console.log("[useGPSTracking] Permissions granted — starting native CommaTracker service.");
      CommaTracker.startTracking();
    } catch (err) {
      console.error("Failed to start location updates:", err);
    }
  };

  const stopTracking = async () => {
    if (isWeb) return;

    try {
      console.log("[useGPSTracking] Stopping native CommaTracker service.");
      CommaTracker.stopTracking();
    } catch (err) {
      // Silence no-op exceptions when the service was never running
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
