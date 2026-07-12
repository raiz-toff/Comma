/**
 * Location access levels, and what to do when the driver grants us less than the app needs.
 *
 * Android and iOS both let a user grant location *only while the app is open*, which reads like a
 * yes but behaves like a no for Comma: mileage stops recording the moment they switch to Maps,
 * take a call, or lock the screen — so shifts come out short and nothing tells them why.
 *
 * Worse, on Android 11+ the OS will not show a dialog for "Allow all the time" at all; the request
 * silently no-ops and the only route is the system Settings screen. So a prompt is not enough —
 * the driver needs to be *told what happened* and *walked through the fix*, which is what
 * promptForFullLocationAccess does.
 */

import { Alert, Linking, Platform } from "react-native";

export type LocationAccessLevel =
  /** Nothing granted — GPS tracking cannot run at all. */
  | "none"
  /** "While using the app" — tracking runs, but pauses whenever Comma isn't in the foreground. */
  | "foreground"
  /** "Allow all the time" / "Always" — what background mileage tracking actually needs. */
  | "full";

export async function getLocationAccessLevel(): Promise<LocationAccessLevel> {
  if (Platform.OS === "web") return "none";
  try {
    const Location = await import("expo-location");
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== "granted") return "none";
    const bg = await Location.getBackgroundPermissionsAsync();
    return bg.status === "granted" ? "full" : "foreground";
  } catch {
    return "none";
  }
}

/** The OS's own wording for the setting we're asking for — quoting it makes the guide followable. */
const ALWAYS_OPTION = Platform.OS === "ios" ? "Always" : "Allow all the time";

const STEPS =
  Platform.OS === "ios"
    ? ["1. Tap Open Settings below", "2. Tap Location", `3. Choose "${ALWAYS_OPTION}"`]
    : [
        "1. Tap Open Settings below",
        "2. Tap Permissions, then Location",
        `3. Choose "${ALWAYS_OPTION}"`,
      ];

/**
 * Tells the driver their current grant isn't enough, why it matters in terms of their own money,
 * and exactly which taps fix it. Deep-links to the system Settings page, because on Android 11+
 * that is the only place the setting can be changed.
 */
export function promptForFullLocationAccess(opts?: { onDismiss?: () => void }): void {
  Alert.alert(
    `Comma needs "${ALWAYS_OPTION}"`,
    [
      "Right now Comma can only see your location while the app is open on screen.",
      "",
      "That means your mileage stops recording the moment you switch to your delivery app, take a call, or lock your phone — so your shifts will log short, and you'll under-claim your write-off.",
      "",
      ...STEPS,
      "",
      "Your location never leaves your phone.",
    ].join("\n"),
    [
      { text: "Not now", style: "cancel", onPress: () => opts?.onDismiss?.() },
      {
        text: "Open Settings",
        onPress: () => {
          Linking.openSettings();
          opts?.onDismiss?.();
        },
      },
    ]
  );
}

/**
 * Ask for everything we need, and if we end up with a partial grant, explain it rather than
 * shrugging. Returns the level we actually ended up with.
 */
export async function requestFullLocationAccess(): Promise<LocationAccessLevel> {
  if (Platform.OS === "web") return "none";
  const Location = await import("expo-location");

  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") {
    // Permanently denied — the OS won't ask again, so Settings is the only way back.
    if (!fg.canAskAgain) promptForFullLocationAccess();
    return "none";
  }

  const existing = await Location.getBackgroundPermissionsAsync();
  if (existing.status === "granted") return "full";

  // No-ops on Android 11+ (the OS refuses to prompt); harmless to attempt, and it does work on
  // older Android and on iOS.
  const bg = await Location.requestBackgroundPermissionsAsync().catch(() => ({ status: "denied" }));
  if (bg.status === "granted") return "full";

  promptForFullLocationAccess();
  return "foreground";
}
