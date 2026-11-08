import { useEffect } from "react";
import { router, type Href } from "expo-router";
import * as Notifications from "expo-notifications";

/**
 * Centralizes OS-notification handling at app launch:
 *  - routes taps to the right screen from BOTH warm and cold start (via the payload `data.url`),
 *  - cancels leftover reminders from the removed Schedule screen, which were registered with
 *    the OS as weekly repeats and would otherwise keep firing.
 */
export function useNotificationRouting() {
  useEffect(() => {
    Notifications.getAllScheduledNotificationsAsync()
      .then((pending) =>
        Promise.all(
          pending
            .filter((n) => n.content.categoryIdentifier === "shift-reminder")
            .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
        ),
      )
      .catch(() => {});

    const handle = (response: Notifications.NotificationResponse) => {
      const url = (response.notification.request.content.data as { url?: string } | undefined)?.url;
      // "/schedule" no longer exists; a reminder still sitting in the tray opens the dashboard.
      if (url) router.push((url === "/schedule" ? "/" : url) as Href);
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
