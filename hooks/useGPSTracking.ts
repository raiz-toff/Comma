import { useEffect } from "react";
import { Platform, Alert, Linking } from "react-native";
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
      // 1. Foreground (while-in-use) permission is the only hard requirement.
      const { status: fgStatus, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== "granted") {
        // Permanently denied — the OS won't prompt again, so deep-link to Settings instead
        // of silently no-opping forever.
        if (!canAskAgain) {
          Alert.alert(
            "Location permission needed",
            "Comma needs location access to track your mileage during a shift. Enable it in Settings.",
            [
              { text: "Open Settings", onPress: () => Linking.openSettings() },
              { text: "Not now", style: "cancel" },
            ]
          );
        } else {
          console.warn("Foreground location permission not granted.");
        }
        return;
      }

      // 2. Permission alone is not enough — the OS location/GPS toggle must be ON, or the
      //    shift would silently record 0 miles with no indication why.
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        Alert.alert(
          "Location is turned off",
          "Turn on Location/GPS in your device settings so Comma can track your mileage."
        );
        return;
      }

      // 3. Background permission is requested but NOT required: a foreground service with the
      //    ongoing notification can collect location with while-in-use permission. Never
      //    hard-gate tracking on it (on Android 11+ this can only deep-link to Settings, so
      //    hard-gating would silently break tracking for most users).
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus !== "granted") {
        console.warn("Background location not granted; tracking will pause when the app is backgrounded.");
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

      // Request battery optimization exemption so OEM killers (Samsung, Xiaomi, etc.)
      // cannot terminate the foreground service when the app is swiped from recents.
      // The dialog only appears once; subsequent calls are no-ops if already granted.
      try {
        CommaTracker.requestBatteryOptimizationExemption();
      } catch (batteryErr) {
        console.warn("[useGPSTracking] Battery optimization exemption request failed:", batteryErr);
      }

      // Launch the native foreground service (CommaTrackerModule.kt →
      // LocationTrackingService.kt). It shows the ongoing notification and
      // writes GPS points into the temp_native_points table, which endShift() reads.
      console.log("[useGPSTracking] Permissions granted — starting native CommaTracker service.");
      const started = CommaTracker.startTracking();
      if (started === false) {
        Alert.alert(
          "Couldn't start tracking",
          "Mileage tracking couldn't start. Check that location permission is enabled, then try again."
        );
      }
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
    // Intentionally NO cleanup that stops tracking: the native foreground service must survive
    // JS remounts (Fast Refresh, navigation container resets) while a shift is active. Tracking
    // is stopped explicitly when isActive flips to false (the else branch) or when the shift ends.
  }, [isActive]);

  return { startTracking, stopTracking };
}
