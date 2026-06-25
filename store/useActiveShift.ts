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
  routePath: Array<{ latitude: number; longitude: number; timestamp: number }>;
  
  // Actions
  startShift: (platform: GigPlatform, vehicleId: string, targetTime: number | null) => void;
  endShift: () => Promise<CompletedShiftPayload | null>;
  incrementTimer: () => void;
  updateMileage: (activeMiles: number, deadMiles: number) => void;
  addCoordinate: (latitude: number, longitude: number) => void;
  pauseShift: () => void;
  resumeShift: () => void;
  setAutoPaused: (paused: boolean) => void;
  markFirstOrderReceived: () => void;
  reset: () => void;
  hydrateShift: (state: Partial<ActiveShiftState>) => void;
}

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
  routePath: [],

  startShift: (platform, vehicleId, targetTime) => set({
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
    routePath: [],
  }),

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

    // Clean & road-snap the route before saving (simplify + OSRM match, graceful fallback)
    let routePathJson: string | null = null;
    if (state.routePath.length >= 2) {
      const raw = state.routePath.map(({ latitude, longitude }) => ({ latitude, longitude }));
      const cleaned = await cleanRoute(raw);
      routePathJson = JSON.stringify(cleaned);
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

  addCoordinate: (latitude, longitude) => set((state) => {
    if (!state.isActive || state.isPaused) return {};
    return {
      routePath: [...state.routePath, { latitude, longitude, timestamp: Date.now() }]
    };
  }),

  pauseShift: () => set({ isPaused: true, isAutoPaused: false }),
  
  resumeShift: () => set({ isPaused: false, isAutoPaused: false }),

  setAutoPaused: (paused) => set({ isPaused: paused, isAutoPaused: paused }),

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
    
    set({
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
      routePath: [],
    });
  },

  hydrateShift: (state) => set((s) => ({ ...s, ...state }))
}));
