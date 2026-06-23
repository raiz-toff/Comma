import { useEffect } from "react";
import { Platform, AppState, AppStateStatus } from "react-native";
import { useKeepAwake, activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useActiveShift } from "../store/useActiveShift";
import { db } from "../src/database/client";
import { settings } from "../src/database/schema";
import { eq } from "drizzle-orm";

const isWeb = Platform.OS === "web";

export function useWakeLock() {
  const { isActive, elapsedSeconds, incrementTimer } = useActiveShift();

  // 1. Keep Awake effect
  useEffect(() => {
    if (isActive) {
      if (!isWeb) {
        activateKeepAwakeAsync("COMMA_SHIFT_WAKE_LOCK");
      }
    } else {
      if (!isWeb) {
        deactivateKeepAwake("COMMA_SHIFT_WAKE_LOCK");
      }
    }
  }, [isActive]);

  // 2. Active timer effect (every 1 second when active)
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isActive) {
      interval = setInterval(() => {
        incrementTimer();
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive]);

  // 3. Persist elapsed seconds to storage every 30 seconds
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isActive) {
      interval = setInterval(async () => {
        try {
          if (isWeb) {
            localStorage.setItem("comma_active_shift_elapsed", String(elapsedSeconds));
          } else {
            await db
              .insert(settings)
              .values({ key: "active_shift_elapsed", value: String(elapsedSeconds) })
              .onConflictDoUpdate({
                target: settings.key,
                set: { value: String(elapsedSeconds) },
              });
          }
        } catch {
          // Quiet catch
        }
      }, 30000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, elapsedSeconds]);

  // 4. Reconcile timer on foreground focus
  useEffect(() => {
    const handleAppStateChange = async (nextStatus: AppStateStatus) => {
      if (nextStatus === "active" && isActive) {
        try {
          let persistedSeconds = 0;
          if (isWeb) {
            const val = localStorage.getItem("comma_active_shift_elapsed");
            if (val) persistedSeconds = parseInt(val, 10);
          } else {
            const row = await db
              .select()
              .from(settings)
              .where(eq(settings.key, "active_shift_elapsed"))
              .limit(1);
            if (row[0]?.value) {
              persistedSeconds = parseInt(row[0].value, 10);
            }
          }

          // If background database timer elapsed state is further ahead than in-memory Zustand
          if (persistedSeconds > elapsedSeconds) {
            // Set the maximum to reconcile and avoid clock losing time
            useActiveShift.setState({ elapsedSeconds: persistedSeconds });
          }
        } catch {
          // Quiet catch
        }
      }
    };

    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => {
      sub.remove();
    };
  }, [isActive, elapsedSeconds]);
}
