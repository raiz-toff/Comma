/**
 * The permission-priming sequence, shown once — right after a new driver has seen their first
 * number, before they land on the dashboard.
 *
 * Why here and not at shift start (where these all used to live): asking for a stack of OS dialogs
 * the instant someone taps "start shift" buries the request under an action, and a dialog dismissed
 * in a hurry silently degrades tracking with no way to know why. Priming them during onboarding —
 * each on its own page that says what the permission is for and what breaks without it — turns four
 * ambush dialogs into four informed choices.
 *
 * One page per permission Comma still needs, and only for the ones this device hasn't already
 * granted: the list is built from LIVE OS status on mount, so a driver who already said yes (or who
 * re-runs onboarding after a reset while the grants survive) is never shown a page for something
 * they've already done. If nothing is outstanding, the whole sequence is skipped.
 *
 * Every page is skippable and never blocks: the shift-start fallback in useGPSTracking re-asks for
 * anything skipped here, and the dashboard's activation checklist keeps the location item live.
 */

import React, { useEffect, useState } from "react";
import { View, Pressable, ScrollView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, BatteryCharging, Footprints, Navigation, Check } from "lucide-react-native";
import { Text } from "../ui/text";
import { useColors } from "@/src/theme/useColors";
import {
  getLocationAccessLevel,
  requestFullLocationAccess,
  promptForFullLocationAccess,
} from "@/src/services/permissions/locationAccess";
import {
  getNotificationStatus,
  requestNotifications,
  getActivityStatus,
  requestActivity,
  isActivityRecognitionApplicable,
  isBatteryExemptionApplicable,
  requestBatteryOptimizationExemption,
  promptEnableInSettings,
} from "@/src/services/permissions/permissionRequests";

type PermId = "location" | "notifications" | "activity" | "battery";

type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

type PermPage = {
  id: PermId;
  Icon: LucideIcon;
  title: string;
  sub: string;
  /** Plain-language why, plus the consequence if it stays off. */
  points: string[];
  primaryLabel: string;
  /** Fires the actual OS request through the shared permission service. */
  request: () => Promise<void>;
  /** Secondary path for someone who denied earlier: explain the taps and deep-link to Settings. */
  openSettings: () => void;
};

/** The permission settings deep-link path, worded per platform, for the ones without a bespoke
 *  guide of their own (location has its own richer one in locationAccess.ts). */
const ANDROID_STEPS = (label: string) => [
  "1. Tap Open Settings below",
  "2. Tap Permissions",
  `3. Turn on ${label}`,
];
const IOS_STEPS = (label: string) => ["1. Tap Open Settings below", `2. Turn on ${label}`];

/** Every possible page, in ask-order (location first — it is the only hard requirement). */
const ALL_PAGES: PermPage[] = [
  {
    id: "location",
    Icon: Navigation,
    title: "Track your miles automatically",
    sub: "During a shift, Comma records your GPS location so it can separate your active delivery miles from dead miles — turning them into a tax write-off without you noting a single odometer reading.",
    points: [
      'You\'ll see a second prompt asking to allow location "All the time" — that\'s what keeps mileage logging when you switch to Maps or your delivery app, or lock the screen.',
      "Without it, tracking pauses the moment Comma leaves the screen, so your shifts log short and you under-claim the write-off.",
      "All location data stays on your device — it is never uploaded anywhere.",
    ],
    primaryLabel: "Enable location",
    request: async () => {
      await requestFullLocationAccess();
    },
    openSettings: () => promptForFullLocationAccess(),
  },
  {
    id: "notifications",
    Icon: Bell,
    title: "See your live shift",
    sub: 'While a shift runs, Comma shows an ongoing "Recording mileage" notification with your live time and distance.',
    points: [
      "It's how you glance at your shift without reopening the app — and how you know tracking is actually running.",
      "Without it, on Android 13 and up that status notification is hidden, so tracking runs invisibly with nothing to confirm it's on.",
    ],
    primaryLabel: "Allow notifications",
    request: async () => {
      await requestNotifications();
    },
    openSettings: () =>
      promptEnableInSettings(
        "notifications",
        Platform.OS === "ios" ? IOS_STEPS("Notifications") : ANDROID_STEPS("Notifications")
      ),
  },
  {
    id: "activity",
    Icon: Footprints,
    title: "Save your battery",
    sub: "With physical-activity access, Comma can tell when you're stopped and pause the GPS radio until you're moving again.",
    points: [
      "That's the difference between a light background drain and a heavy one over a long shift.",
      "Without it, GPS stays on for the whole shift and uses more battery — tracking still works, it just costs you more charge.",
    ],
    primaryLabel: "Allow activity access",
    request: async () => {
      await requestActivity();
    },
    openSettings: () =>
      promptEnableInSettings("physical activity", ANDROID_STEPS("Physical activity")),
  },
  {
    id: "battery",
    Icon: BatteryCharging,
    title: "Keep tracking alive",
    sub: "Some phones (Samsung, Xiaomi and others) aggressively kill background apps to save power — which can stop your shift recording partway through.",
    points: [
      "Letting Comma run unrestricted keeps the tracker alive even after you swipe the app away.",
      "Without it, a shift can quietly stop logging in the middle, and you'd only notice the missing miles later.",
    ],
    primaryLabel: "Allow background running",
    request: async () => {
      requestBatteryOptimizationExemption();
    },
    openSettings: () =>
      promptEnableInSettings(
        "unrestricted background use",
        [
          "1. Tap Open Settings below",
          "2. Tap Battery",
          "3. Choose Unrestricted",
        ]
      ),
  },
];

/** Build the list of pages this device still needs, from live OS status. */
async function buildPendingPages(): Promise<PermPage[]> {
  const byId = new Map(ALL_PAGES.map((p) => [p.id, p]));
  const pending: PermPage[] = [];

  const [locationLevel, notifStatus, activityStatus] = await Promise.all([
    getLocationAccessLevel(),
    getNotificationStatus(),
    isActivityRecognitionApplicable() ? getActivityStatus() : Promise.resolve("unavailable" as const),
  ]);

  if (locationLevel !== "full") pending.push(byId.get("location")!);
  if (notifStatus !== "granted") pending.push(byId.get("notifications")!);
  if (isActivityRecognitionApplicable() && activityStatus !== "granted") {
    pending.push(byId.get("activity")!);
  }
  // Battery has no readable status; include it wherever it applies (Android).
  if (isBatteryExemptionApplicable()) pending.push(byId.get("battery")!);

  return pending;
}

export function PermissionsOnboarding({ onDone }: { onDone: () => void }) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const [pages, setPages] = useState<PermPage[] | null>(null);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const pending = await buildPendingPages();
      if (!alive) return;
      if (pending.length === 0) {
        onDone();
        return;
      }
      setPages(pending);
    })();
    return () => {
      alive = false;
    };
    // onDone is stable enough for a one-shot mount effect; re-running would restart the sequence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const advance = () => {
    if (!pages) return;
    if (index + 1 >= pages.length) onDone();
    else setIndex((i) => i + 1);
  };

  const handlePrimary = async () => {
    if (!pages || busy) return;
    setBusy(true);
    try {
      await pages[index].request();
    } finally {
      setBusy(false);
    }
    advance();
  };

  // Building status, or nothing outstanding (about to call onDone) — hold on a plain canvas so the
  // reveal doesn't flash into a half-built screen.
  if (!pages) {
    return <View style={{ flex: 1, backgroundColor: C.background }} />;
  }

  const page = pages[index];
  const { Icon } = page;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: C.background,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      {/* Progress — one segment per outstanding permission, matching the wizard's step bar. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 24,
          paddingTop: 20,
          paddingBottom: 8,
        }}
      >
        {pages.map((p, i) => (
          <View
            key={p.id}
            style={{
              height: 4,
              flex: i === index ? 2 : 1,
              borderRadius: 2,
              backgroundColor: i <= index ? C.contentPrimary : C.surface04,
            }}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "space-between", paddingHorizontal: 24, paddingTop: 8, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              backgroundColor: C.surface04,
              borderWidth: 1,
              borderColor: C.lineStrong,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 28,
            }}
          >
            <Icon size={28} color={C.contentPrimary} strokeWidth={1.5} />
          </View>

          <View style={{ gap: 6, marginBottom: 28 }}>
            <Text variant="headingXl">{page.title}</Text>
            <Text variant="paragraphM" style={{ color: C.contentMuted }}>
              {page.sub}
            </Text>
          </View>

          <View style={{ gap: 12 }}>
            {page.points.map((point) => (
              <View key={point} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: C.surface04,
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: 1,
                  }}
                >
                  <Check size={10} color={C.contentPrimary} strokeWidth={3} />
                </View>
                <Text variant="paragraphM" style={{ flex: 1 }}>
                  {point}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ gap: 4, marginTop: 32 }}>
          <Pressable
            onPress={handlePrimary}
            disabled={busy}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            style={{
              backgroundColor: C.contentPrimary,
              borderRadius: 16,
              paddingVertical: 17,
              alignItems: "center",
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Text variant="headingS" style={{ color: C.background }}>
              {page.primaryLabel}
            </Text>
          </Pressable>

          <Pressable
            onPress={page.openSettings}
            accessibilityRole="button"
            style={{ paddingVertical: 12, alignItems: "center" }}
          >
            <Text variant="labelM" style={{ color: C.contentSecondary }}>
              Already denied it? Turn it on in Settings
            </Text>
          </Pressable>

          <Pressable
            onPress={advance}
            accessibilityRole="button"
            style={{ paddingVertical: 10, alignItems: "center" }}
          >
            <Text variant="labelM" style={{ color: C.contentMuted }}>
              Skip for now
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
