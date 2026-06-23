import { create } from "zustand";
import { insertShift } from "../src/database/queries/shifts";
import { type PlatformKey } from "../src/registry/platforms";

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
  pausedSeconds: number;
  isFirstOrderReceived: boolean;
  
  // Actions
  startShift: (platform: GigPlatform, vehicleId: string, targetTime: number | null) => void;
  endShift: () => Promise<CompletedShiftPayload | null>;
  incrementTimer: () => void;
  updateMileage: (activeMiles: number, deadMiles: number) => void;
  pauseShift: () => void;
  resumeShift: () => void;
  markFirstOrderReceived: () => void;
  reset: () => void;
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
  pausedSeconds: 0,
  isFirstOrderReceived: false,

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
    pausedSeconds: 0,
    isFirstOrderReceived: false,
  }),

  endShift: async () => {
    const state = get();
    if (!state.isActive || !state.startTime || !state.platform || !state.vehicleId) return null;
    
    const endTime = Date.now();
    const durationSeconds = state.elapsedSeconds;
    const shiftId = `shift_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

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

  pauseShift: () => set({ isPaused: true }),
  
  resumeShift: () => set({ isPaused: false }),

  markFirstOrderReceived: () => set({ isFirstOrderReceived: true }),

  reset: () => set({
    isActive: false,
    platform: null,
    vehicleId: null,
    startTime: null,
    elapsedSeconds: 0,
    activeMileage: 0,
    deadMileage: 0,
    targetTime: null,
    isPaused: false,
    pausedSeconds: 0,
    isFirstOrderReceived: false,
  })
}));
