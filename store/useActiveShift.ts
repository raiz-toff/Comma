import { create } from "zustand";
import { attachLocationPointsToShift, insertShift, insertShiftPlatform } from "../src/database/queries/shifts";
import { type PlatformKey } from "../src/registry/platforms";
import { db } from "../src/database/client";
import { settings, tempNativePoints } from "../src/database/schema";
import { eq, asc } from "drizzle-orm";
import { Platform } from "react-native";
import CommaTracker from "../modules/comma-tracker";
import { haversineDistance, isGPSJitter, classifyMiles } from "../utils/geoCalculations";
import { useSettingsStore } from "./useSettingsStore";
import simplify from "simplify-js";

export type GigPlatform = PlatformKey;

export interface CompletedShiftPayload {
  shiftId: string;
  platform: GigPlatform;
  vehicleId: string;
  startTime: number;
  endTime: number;
  activeMileage: number;
  deadMileage: number;
}

interface ActiveShiftState {
  isActive: boolean;
  platform: GigPlatform | null;
  vehicleId: string | null;
  startTime: number | null; // Unix epoch in milliseconds
  elapsedSeconds: number;
  activeMileage: number;
  deadMileage: number;
  targetTime: number | null; // Unix epoch in milliseconds
  isPaused: boolean;
  isAutoPaused: boolean;
  pausedSeconds: number;
  isFirstOrderReceived: boolean;
  sessionId: string | null;
  
  // Actions
  startShift: (platform: GigPlatform, vehicleId: string, targetTime: number | null) => Promise<void>;
  endShift: () => Promise<CompletedShiftPayload | null>;
  incrementTimer: () => void;
  updateMileage: (activeMiles: number, deadMiles: number) => void;
  pauseShift: () => void;
  resumeShift: () => void;
  setAutoPaused: (paused: boolean) => void;
  markFirstOrderReceived: () => void;
  reset: () => void;
  hydrateShift: (state: Partial<ActiveShiftState>) => void;
}

const updateWidgetState = async (state: any) => {
  if (Platform.OS === "web") return;
  try {
    const payload = JSON.stringify({
      isActive: state.isActive,
      platform: state.platform,
      vehicleId: state.vehicleId,
      startTime: state.startTime,
      elapsedSeconds: state.elapsedSeconds,
      activeMileage: state.activeMileage,
      deadMileage: state.deadMileage,
      targetTime: state.targetTime,
      isPaused: state.isPaused,
      isAutoPaused: state.isAutoPaused,
      pausedSeconds: state.pausedSeconds,
      isFirstOrderReceived: state.isFirstOrderReceived,
      sessionId: state.sessionId,
    });
    
    if (db) {
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
  } catch (e) {
    console.error("Failed to update widget state:", e);
  }
};

export const useActiveShift = create<ActiveShiftState>((set, get) => ({
  isActive: false,
  platform: null,
  vehicleId: null,
  startTime: null,
  elapsedSeconds: 0,
  activeMileage: 0,
  deadMileage: 0,
  targetTime: null,
  isPaused: false,
  isAutoPaused: false,
  pausedSeconds: 0,
  isFirstOrderReceived: false,
  sessionId: null,

  startShift: async (platform, vehicleId, targetTime) => {
    if (Platform.OS !== "web") {
      try {
        await db.delete(tempNativePoints);
      } catch (e) {
        console.error("Failed to clear temp_native_points on startShift:", e);
      }
    }

    const newState = {
      isActive: true,
      platform,
      vehicleId,
      startTime: Date.now(),
      elapsedSeconds: 0,
      activeMileage: 0,
      deadMileage: 0,
      targetTime,
      isPaused: false,
      isAutoPaused: false,
      pausedSeconds: 0,
      isFirstOrderReceived: false,
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    };
    set(newState);
    updateWidgetState(newState);
  },

  endShift: async () => {
    const state = get();
    if (!state.isActive || !state.startTime || !state.platform || !state.vehicleId) return null;
    
    const endTime = Date.now();
    const durationSeconds = state.elapsedSeconds;
    const shiftId = `shift_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // 1. Halt Native Tracking
    if (Platform.OS !== "web") {
      try {
        CommaTracker.stopTracking();
      } catch (e) {
        console.error("Failed to stop native tracking:", e);
      }
    }

    // 2. Fetch Temp Data
    let points: { id: number; lat: number; lon: number; timestamp: number }[] = [];
    if (Platform.OS !== "web") {
      try {
        points = await db
          .select()
          .from(tempNativePoints)
          .orderBy(asc(tempNativePoints.timestamp));
      } catch (e) {
        console.error("Failed to fetch temp native points:", e);
      }
    }

    // 3. Calculate Final Metrics
    let calculatedActiveMileage = 0;
    let calculatedDeadMileage = 0;

    // Read the distance unit once per shift (not per point).
    const unit = useSettingsStore.getState().profile?.distanceUnit ?? "mi";
    const conversionFactor = unit === "mi" ? 1609.344 : 1000.0;

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const distM = haversineDistance(
        { lat: prev.lat, lng: prev.lon },
        { lat: curr.lat, lng: curr.lon }
      );
      const timeDeltaMs = curr.timestamp - prev.timestamp;

      // Discard GPS jitter (implied speed > ~150 km/h) so a single glitchy fix can't inflate
      // mileage — uses the shared threshold in gpsConfig via geoCalculations.
      if (isGPSJitter(distM, timeDeltaMs)) continue;

      const speedMps = timeDeltaMs > 0 ? distM / (timeDeltaMs / 1000) : 0;
      const speedKmh = speedMps * 3.6;
      const distanceConverted = distM / conversionFactor;

      if (classifyMiles(speedKmh) === "dead") {
        calculatedDeadMileage += distanceConverted;
      } else {
        calculatedActiveMileage += distanceConverted;
      }
    }

    calculatedActiveMileage = Number(calculatedActiveMileage.toFixed(2));
    calculatedDeadMileage = Number(calculatedDeadMileage.toFixed(2));

    // 4. Compress (RDP) & 5. Save as JSON with timestamps
    let encodedPolylineString: string | null = null;
    if (points.length >= 2) {
      // Carry each point's timestamp THROUGH simplification. simplify-js returns references to
      // the same input objects it keeps (it selects points, never interpolates), so extra props
      // survive — far more reliable than matching simplified coords back to originals by an
      // epsilon (which could miss on FP drift and fall back to a wrong Date.now() timestamp).
      type SimplifyPoint = { x: number; y: number; timestamp: number };
      const formattedForSimplify: SimplifyPoint[] = points.map((p) => ({ x: p.lon, y: p.lat, timestamp: p.timestamp }));
      const toleranceInDegrees = 10 / 111320; // 10 meters in degrees
      const simplified = simplify(formattedForSimplify, toleranceInDegrees, true) as SimplifyPoint[];
      const simplifiedLatLng = simplified.map((sp) => ({
        latitude: sp.y,
        longitude: sp.x,
        timestamp: sp.timestamp,
      }));
      encodedPolylineString = JSON.stringify(simplifiedLatLng);
    }

    let notes: string | null = null;
    if (state.targetTime && state.startTime) {
      const targetSec = Math.round((state.targetTime - state.startTime) / 1000);
      notes = `[ShiftTarget: ${targetSec}]`;
    }

    // 6. Final Commit
    const payload = {
      id: shiftId,
      vehicleId: state.vehicleId,
      platform: state.platform,
      startTime: new Date(state.startTime),
      endTime: new Date(endTime),
      grossRevenue: 0.0,
      tipsRevenue: 0.0,
      bonusAmount: 0.0,
      trackedMileage: calculatedActiveMileage + calculatedDeadMileage,
      activeMileage: calculatedActiveMileage,
      deadMileage: calculatedDeadMileage,
      durationSeconds: durationSeconds,
      pausedSeconds: state.pausedSeconds,
      routePath: encodedPolylineString,
      notes,
      reconciliationStatus: "pending_reconciliation" as any,
    };

    try {
      await insertShift(payload);
      
      if (state.platform) {
        const activePlatformsList = state.platform.split(",");
        for (const pKey of activePlatformsList) {
          if (pKey) {
            await insertShiftPlatform({
              id: `sp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              shiftId: shiftId,
              platform: pKey,
              platformOnlineSeconds: 0,
              grossRevenue: 0.0,
              tipsRevenue: 0.0,
              tripsCount: 0,
            });
          }
        }
      }
    } catch (e) {
      console.error("Failed to insert shift in database:", e);
    }

    // 7. Wipe Scratchpad
    if (Platform.OS !== "web") {
      try {
        await db.delete(tempNativePoints);
      } catch (e) {
        console.error("Failed to clear temp_native_points scratchpad:", e);
      }
    }
    
    const completedPayload: CompletedShiftPayload = {
      shiftId,
      platform: state.platform,
      vehicleId: state.vehicleId,
      startTime: state.startTime,
      endTime,
      activeMileage: calculatedActiveMileage,
      deadMileage: calculatedDeadMileage,
    };

    const emptyState = {
      isActive: false,
      platform: null,
      vehicleId: null,
      startTime: null,
      elapsedSeconds: 0,
      activeMileage: 0,
      deadMileage: 0,
      targetTime: null,
      isPaused: false,
      isAutoPaused: false,
      pausedSeconds: 0,
      isFirstOrderReceived: false,
      sessionId: null,
    };
    set(emptyState);
    updateWidgetState(emptyState);

    return completedPayload;
  },

  incrementTimer: () => set((state) => {
    if (!state.isActive) return {};
    if (state.isPaused) {
      return { pausedSeconds: state.pausedSeconds + 1 };
    } else {
      return { elapsedSeconds: state.elapsedSeconds + 1 };
    }
  }),

  updateMileage: (activeMiles, deadMiles) => set((state) => ({ 
    activeMileage: Number((state.activeMileage + activeMiles).toFixed(2)),
    deadMileage: Number((state.deadMileage + deadMiles).toFixed(2))
  })),

  pauseShift: () => {
    set({ isPaused: true, isAutoPaused: false });
    updateWidgetState(get());
  },
  
  resumeShift: () => {
    set({ isPaused: false, isAutoPaused: false });
    updateWidgetState(get());
  },

  setAutoPaused: (paused) => {
    set({ isPaused: paused, isAutoPaused: paused });
    updateWidgetState(get());
  },

  markFirstOrderReceived: () => set({ isFirstOrderReceived: true }),

  reset: () => {
    (async () => {
      try {
        if (Platform.OS === "web") {
          localStorage.removeItem("comma_active_shift_state");
        } else {
          await db.delete(settings).where(eq(settings.key, "active_shift_state"));
        }
      } catch {}
    })();
    
    const emptyState = {
      isActive: false,
      platform: null,
      vehicleId: null,
      startTime: null,
      elapsedSeconds: 0,
      activeMileage: 0,
      deadMileage: 0,
      targetTime: null,
      isPaused: false,
      isAutoPaused: false,
      pausedSeconds: 0,
      isFirstOrderReceived: false,
      sessionId: null,
    };
    set(emptyState);
    updateWidgetState(emptyState);
  },

  hydrateShift: (state) => set((s) => ({ ...s, ...state }))
}));
