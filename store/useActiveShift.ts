import { create } from "zustand";
import { insertShift } from "../src/database/queries/shifts";

export type GigPlatform = "doordash" | "ubereats" | "skip" | "other";

export interface CompletedShiftPayload {
  platform: GigPlatform;
  vehicleId: string;
  startTime: number;
  endTime: number;
  trackedMileage: number;
}

interface ActiveShiftState {
  isActive: boolean;
  platform: GigPlatform | null;
  vehicleId: string | null;
  startTime: number | null; // Unix epoch in milliseconds
  elapsedSeconds: number;
  trackedMileage: number;
  
  // Actions
  startShift: (platform: GigPlatform, vehicleId: string) => void;
  endShift: () => Promise<CompletedShiftPayload | null>;
  incrementTimer: () => void;
  updateMileage: (addedMiles: number) => void;
  reset: () => void;
}

export const useActiveShift = create<ActiveShiftState>((set, get) => ({
  isActive: false,
  platform: null,
  vehicleId: null,
  startTime: null,
  elapsedSeconds: 0,
  trackedMileage: 0,

  startShift: (platform, vehicleId) => set({
    isActive: true,
    platform,
    vehicleId,
    startTime: Date.now(),
    elapsedSeconds: 0,
    trackedMileage: 0
  }),

  endShift: async () => {
    const state = get();
    if (!state.isActive || !state.startTime || !state.platform || !state.vehicleId) return null;
    
    const endTime = Date.now();
    const durationSeconds = state.elapsedSeconds; // Use elapsedSeconds from state as it represents actual tracked active time
    const shiftId = `shift_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const payload = {
      id: shiftId,
      vehicleId: state.vehicleId,
      platform: state.platform,
      startTime: new Date(state.startTime),
      endTime: new Date(endTime),
      grossRevenue: 0.0,
      tipsRevenue: 0.0,
      trackedMileage: state.trackedMileage,
      activeMileage: state.trackedMileage,
      deadMileage: 0.0,
      durationSeconds: durationSeconds,
      pausedSeconds: 0,
    };

    try {
      await insertShift(payload);
    } catch (e) {
      console.error("Failed to insert shift in database:", e);
    }
    
    const completedPayload: CompletedShiftPayload = {
      platform: state.platform,
      vehicleId: state.vehicleId,
      startTime: state.startTime,
      endTime,
      trackedMileage: state.trackedMileage,
    };
    return completedPayload;
  },

  incrementTimer: () => set((state) => ({ 
    elapsedSeconds: state.isActive ? state.elapsedSeconds + 1 : state.elapsedSeconds 
  })),

  updateMileage: (addedMiles) => set((state) => ({ 
    trackedMileage: Number((state.trackedMileage + addedMiles).toFixed(2))
  })),

  reset: () => set({
    isActive: false,
    platform: null,
    vehicleId: null,
    startTime: null,
    elapsedSeconds: 0,
    trackedMileage: 0
  })
}));
