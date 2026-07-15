/**
 * The runtime permissions Comma needs to track a shift, each behind one function that both
 * onboarding and the shift-start fallback call — so there is exactly one place that knows how to
 * ask the OS for a given permission, and the two entry points can never drift.
 *
 * Location lives in its own file (locationAccess.ts) because it is the one permission with a
 * partial-grant problem ("while using the app" reads like yes, behaves like no) that needs its own
 * explain-and-walk-to-Settings dance. Everything else — notifications, activity recognition, and
 * the battery-optimization exemption — is a plain yes/no and lives here.
 *
 * A note on status: three of these can be read back from the OS, so onboarding can skip a page for
 * a permission already granted. The battery exemption cannot — Android exposes no getter through
 * our native module — so its request is simply idempotent (the OS only shows the dialog if the app
 * isn't already exempt).
 */

import { Alert, Linking, PermissionsAndroid, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import CommaTracker from "../../../modules/comma-tracker";

const isAndroid = Platform.OS === "android";
const isWeb = Platform.OS === "web";

/** granted / denied are self-explanatory; "unavailable" means the OS or build has no such
 *  permission to ask for (iOS, web, or an Android version predating it); "unknown" means the
 *  request threw and we shouldn't claim either way. */
export type PermissionStatus = "granted" | "denied" | "unavailable" | "unknown";

/**
 * Deep-link to Comma's own page in the system Settings app. This is the only route back once a
 * permission is permanently denied — at that point the OS stops showing its dialog, so a fresh
 * request no-ops and Settings is the sole way to flip it. Extracted here so onboarding and the
 * shift-start fallback share one deep-link, rather than each hand-rolling Linking.openSettings().
 */
export function openAppSettings(): void {
  void Linking.openSettings();
}

/**
 * The generic "you denied this earlier, here's how to turn it back on" prompt: a short numbered
 * guide plus a button that drops the driver on Comma's Settings page. locationAccess.ts has its
 * own richer version for location (which also has to explain the "Allow all the time" step); this
 * covers the plain permissions.
 */
export function promptEnableInSettings(what: string, steps: string[]): void {
  Alert.alert(
    `Turn ${what} on in Settings`,
    [...steps, "", "Then come back to Comma."].join("\n"),
    [
      { text: "Not now", style: "cancel" },
      { text: "Open Settings", onPress: () => openAppSettings() },
    ]
  );
}

// ── Notifications ───────────────────────────────────────────────────────────────
// Android 13+ suppresses the foreground-service notification unless POST_NOTIFICATIONS is granted,
// so without this the "Recording mileage" status notification is silently invisible.

export async function getNotificationStatus(): Promise<PermissionStatus> {
  if (isWeb) return "unavailable";
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === "granted" ? "granted" : "denied";
  } catch {
    return "unknown";
  }
}

export async function requestNotifications(): Promise<PermissionStatus> {
  if (isWeb) return "unavailable";
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted" ? "granted" : "denied";
  } catch {
    return "unknown";
  }
}

// ── Activity recognition (Android 10+ / API 29+) ─────────────────────────────────
// Powers battery-first movement-gated GPS: the native service can pause the GPS radio while the
// driver is standing still. Denied just means the radio stays on for the whole shift.

function activitySupported(): boolean {
  return isAndroid && typeof Platform.Version === "number" && Platform.Version >= 29;
}

/** True on the platforms where this permission actually exists — lets onboarding hide the page
 *  entirely on iOS and older Android rather than showing an ask the OS would reject. */
export function isActivityRecognitionApplicable(): boolean {
  return activitySupported();
}

export async function getActivityStatus(): Promise<PermissionStatus> {
  if (!activitySupported()) return "unavailable";
  try {
    const granted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION
    );
    return granted ? "granted" : "denied";
  } catch {
    return "unknown";
  }
}

export async function requestActivity(): Promise<PermissionStatus> {
  if (!activitySupported()) return "unavailable";
  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION
    );
    return result === PermissionsAndroid.RESULTS.GRANTED ? "granted" : "denied";
  } catch {
    return "unknown";
  }
}

// ── Battery-optimization exemption ───────────────────────────────────────────────
// Stops OEM task-killers (Samsung, Xiaomi, etc.) from terminating the foreground service when the
// app is swiped out of recents. No OS getter exists through the native module, so there is no
// status to read — the request is idempotent and the dialog only appears if not already exempt.

/** True where the exemption is even a thing to ask for. */
export function isBatteryExemptionApplicable(): boolean {
  return isAndroid;
}

export function requestBatteryOptimizationExemption(): void {
  if (!isAndroid) return;
  try {
    CommaTracker.requestBatteryOptimizationExemption();
  } catch {
    // No-op on builds/platforms without the native module.
  }
}
