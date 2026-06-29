import { useEffect } from "react";
import { Platform } from "react-native";
import { router, type Href } from "expo-router";
import * as Notifications from "expo-notifications";

const isWeb = Platform.OS === "web";

/**
 * Centralizes OS-notification handling at app launch:
 *  - registers the interactive "shift-reminder" category (so its action buttons exist even if
 *    a reminder is the very first thing the user taps, before any screen has mounted),
 *  - routes taps to the right screen from BOTH warm and cold start (via the payload `data.url`),
 *  - handles the "Start Shift" and "Remind in 10m" action buttons.
 *
 * Previously no response listener existed, so tapping any notification only opened the app to
 * the last route, and the action buttons did nothing.
 */
export function useNotificationRouting() {
  useEffect(() => {
    if (isWeb) return;

    Notifications.setNotificationCategoryAsync("shift-reminder", [
      { identifier: "start-shift", buttonTitle: "Start Shift 🚗", options: { opensAppToForeground: true } },
      { identifier: "snooze", buttonTitle: "Remind in 10m ⏳", options: { opensAppToForeground: false } },
    ]).catch(() => {});

    const handle = async (response: Notifications.NotificationResponse) => {
      const content = response.notification.request.content;
      const action = response.actionIdentifier;

      if (action === "snooze") {
        // Re-fire the same reminder in 10 minutes.
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: content.title ?? "Scheduled Shift Reminder",
              body: content.body ?? "",
              categoryIdentifier: "shift-reminder",
              data: content.data,
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 600 },
          });
        } catch {
          // best-effort; a failed reschedule shouldn't crash the handler
        }
        return;
      }

      if (action === "start-shift") {
        router.push("/" as Href);
        return;
      }

      // Default body tap → deep-link to the screen named in the payload, if any.
      const url = (content.data as { url?: string } | undefined)?.url;
      if (url) {
        router.push(url as Href);
      }
    };

    // Cold start: app was launched by tapping a notification.
    Notifications.getLastNotificationResponseAsync().then((r) => {
      if (r) handle(r);
    });

    // Warm: tapped while the app is running or backgrounded.
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, []);
}
