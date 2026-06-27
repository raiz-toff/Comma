import { create } from "zustand";
import { attachLocationPointsToShift, insertShift } from "../src/database/queries/shifts";
import { type PlatformKey } from "../src/registry/platforms";
import { cleanRoute } from "../utils/mapMatching";
import { db } from "../src/database/client";
import { settings } from "../src/database/schema";
import { eq } from "drizzle-orm";
import { Platform } from "react-native";

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
  startShift: (platform: GigPlatform, vehicleId: string, targetTime: number | null) => void;
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

  startShift: (platform, vehicleId, targetTime) => {
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

    if (state.sessionId) {
      try {
        await attachLocationPointsToShift(state.sessionId, shiftId);
      } catch (e) {
        console.error("Failed to attach local location points to shift:", e);
      }
    }

    // Clean & road-snap the route before saving (will be loaded from temp_native_points in Phase 3/4)
    let routePathJson: string | null = null;

    let notes: string | null = null;
    if (state.targetTime && state.startTime) {
      const targetSec = Math.round((state.targetTime - state.startTime) / 1000);
      notes = `[ShiftTarget: ${targetSec}]`;
    }

    const payload = {
      id: shiftId,
      vehicleId: state.vehicleId,
      platform: state.platform,
      startTime: new Date(state.startTime),
      endTime: new Date(endTime),
      grossRevenue: 0.0,
      tipsRevenue: 0.0,
      trackedMileage: state.activeMileage + state.deadMileage,
      activeMileage: state.activeMileage,
      deadMileage: state.deadMileage,
      durationSeconds: durationSeconds,
      pausedSeconds: state.pausedSeconds,
      routePath: routePathJson,
      notes,
    };

    try {
      await insertShift(payload);
    } catch (e) {
      console.error("Failed to insert shift in database:", e);
    }
    
    const completedPayload: CompletedShiftPayload = {
      shiftId,
      platform: state.platform,
      vehicleId: state.vehicleId,
      startTime: state.startTime,
      endTime,
      activeMileage: state.activeMileage,
      deadMileage: state.deadMileage,
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
