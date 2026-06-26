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

  // 3. Persist FULL state to storage every 15 seconds
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isActive) {
      interval = setInterval(async () => {
        try {
          const shiftState = useActiveShift.getState();
          const payload = JSON.stringify({
            isActive: shiftState.isActive,
            platform: shiftState.platform,
            vehicleId: shiftState.vehicleId,
            startTime: shiftState.startTime,
            elapsedSeconds: shiftState.elapsedSeconds,
            activeMileage: shiftState.activeMileage,
            deadMileage: shiftState.deadMileage,
            targetTime: shiftState.targetTime,
            isPaused: shiftState.isPaused,
            isAutoPaused: shiftState.isAutoPaused,
            pausedSeconds: shiftState.pausedSeconds,
            isFirstOrderReceived: shiftState.isFirstOrderReceived,
            sessionId: shiftState.sessionId,
            // purposely ignoring massive routePath arrays
          });

          if (isWeb) {
            localStorage.setItem("comma_active_shift_state", payload);
          } else {
            await db
              .insert(settings)
              .values({ key: "active_shift_state", value: payload })
              .onConflictDoUpdate({
                target: settings.key,
                set: { value: payload },
              });
            try {
              const { requestWidgetUpdate } = require("react-native-android-widget");
              requestWidgetUpdate({ widgetName: "ActiveShiftWidget" }).catch((err: any) => {
                // Catch and ignore native linkage rejection under Expo Go / unlinked builds
              });
            } catch (widgetErr) {
              // Catch synchronous import/resolution failures
            }
          }
        } catch {
          // Quiet catch
        }
      }, 15000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, elapsedSeconds]);

  // 4. Hydrate shift on cold boot
  useEffect(() => {
    const hydrateShift = async () => {
      if (useActiveShift.getState().isActive) return;
      try {
        let payload = null;
        if (isWeb) {
          payload = localStorage.getItem("comma_active_shift_state");
        } else {
          const row = await db
            .select()
            .from(settings)
            .where(eq(settings.key, "active_shift_state"))
            .limit(1);
          payload = row[0]?.value;
        }

        if (payload) {
          const state = JSON.parse(payload);
          if (state.isActive) {
            // Restore missing time elapsed since app was killed
            const now = Date.now();
            if (state.startTime && !state.isPaused) {
              const expectedElapsed = Math.floor((now - state.startTime) / 1000) - state.pausedSeconds;
              if (expectedElapsed > state.elapsedSeconds) {
                 state.elapsedSeconds = expectedElapsed;
              }
            }
            useActiveShift.getState().hydrateShift(state);
          }
        }
      } catch {}
    };
    hydrateShift();
  }, []);
}
