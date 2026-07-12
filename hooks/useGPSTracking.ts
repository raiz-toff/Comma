import { useEffect } from "react";
import { Platform, Alert, Linking, PermissionsAndroid } from "react-native";
import { promptForFullLocationAccess } from "../src/services/permissions/locationAccess";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { useActiveShift } from "../store/useActiveShift";
import { useSettingsStore } from "../store/useSettingsStore";
import CommaTracker from "../modules/comma-tracker";

const GPS_POLL_INTERVAL_MS = 10_000;

const isWeb = Platform.OS === "web";


export function useGPSTracking() {
  const isActive = useActiveShift((s) => s.isActive);
  const startTime = useActiveShift((s) => s.startTime);
  const isPaused = useActiveShift((s) => s.isPaused);

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

      // Floating "live shift" overlay (shown over OTHER apps while you drive). Set the unit, and
      // if the "display over other apps" permission isn't granted yet, offer it FIRST — before the
      // battery/background settings deep-links below, which would otherwise background the app and
      // hide this prompt. Awaited so it reliably appears.
      try {
        const unit = useSettingsStore.getState().profile?.distanceUnit ?? "mi";
        CommaTracker.setDistanceUnit(unit);
        if (CommaTracker.hasOverlayPermission() === false) {
          await new Promise<void>((resolve) => {
            Alert.alert(
              "Show your shift on top?",
              "Let Comma float your live time + miles over other apps like Maps and your delivery app, so you can glance at your shift without switching back.",
              [
                { text: "Not now", style: "cancel", onPress: () => resolve() },
                { text: "Enable", onPress: () => { CommaTracker.requestOverlayPermission(); resolve(); } },
              ],
              { cancelable: false }
            );
          });
        }
      } catch (overlayErr) {
        console.warn("[useGPSTracking] Overlay setup failed:", overlayErr);
      }

      // 3. Background permission is requested but NOT required: a foreground service with the
      //    ongoing notification can collect location with while-in-use permission. Never
      //    hard-gate tracking on it (on Android 11+ this can only deep-link to Settings, so
      //    hard-gating would silently break tracking for most users).
      //    Show our own disclosure BEFORE the OS "Allow all the time" prompt — but only when
      //    it isn't already granted, so returning users aren't asked on every single shift.
      const { status: existingBgStatus } = await Location.getBackgroundPermissionsAsync();
      if (existingBgStatus !== "granted") {
        await new Promise<void>((resolve) => {
          Alert.alert(
            "Track mileage in the background?",
            "Comma records your GPS location during this shift, including while the app is closed or you're using another app, so your mileage keeps logging without you having to keep Comma open. Location data stays on your device and is never uploaded. The next screen lets you allow this.",
            [{ text: "Continue", onPress: () => resolve() }],
            { cancelable: false }
          );
        });
      }
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus !== "granted") {
        // A "while using the app" grant reads like a yes but logs short shifts, and on Android 11+
        // the request above cannot even show a dialog. Say so and walk them to the setting rather
        // than warning a console nobody reads. Still never hard-gates tracking.
        console.warn("Background location not granted; tracking will pause when the app is backgrounded.");
        promptForFullLocationAccess();
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

      // Activity Recognition (Android 10+/API 29+) powers battery-first movement-gated GPS:
      // the native service pauses the GPS radio while the user is still. Non-blocking — if
      // denied, the service falls back to GPS-on for the whole shift.
      if (Platform.OS === "android" && typeof Platform.Version === "number" && Platform.Version >= 29) {
        try {
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION);
        } catch (arErr) {
          console.warn("[useGPSTracking] Activity recognition permission request failed:", arErr);
        }
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

  // Keep the native overlay clock in sync with the in-app timer (pause-aware). Push on shift
  // start and whenever start time / pause state changes — NOT every second, since the native
  // service ticks the clock itself (so it keeps moving even when JS is frozen in the background).
  useEffect(() => {
    if (isWeb || !isActive) return;
    try {
      const s = useActiveShift.getState();
      CommaTracker.setShiftTiming(
        s.startTime ?? Date.now(),
        s.pausedSeconds ?? 0,
        s.isPaused ?? false,
        s.elapsedSeconds ?? 0
      );
    } catch (err) {
      console.warn("[useGPSTracking] setShiftTiming failed:", err);
    }
  }, [isActive, startTime, isPaused]);

  // Poll the native service every 10s and sync live GPS distance into the Zustand store
  // so the shift console shows real mileage rather than 0.
  // The final active/dead split is computed from raw points at endShift(); this just feeds
  // the live total as activeMileage so the display isn't always zero.
  useEffect(() => {
    if (isWeb || !isActive) return;
    const poll = () => {
      try {
        const meters = CommaTracker.getActiveDistanceMeters();
        if (meters > 0) {
          const unit = useSettingsStore.getState().profile?.distanceUnit ?? "mi";
          const factor = unit === "km" ? 1000.0 : 1609.344;
          const dist = Number((meters / factor).toFixed(2));
          useActiveShift.getState().hydrateShift({ activeMileage: dist });
        }
      } catch {}
    };
    poll(); // immediate first read when shift starts
    const interval = setInterval(poll, GPS_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isActive]);

  return { startTracking, stopTracking };
}
