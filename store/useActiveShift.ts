import { create } from 'zustand';

export type GigPlatform = 'doordash' | 'ubereats' | 'skip' | 'other';

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
  endShift: () => CompletedShiftPayload | null;
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

  endShift: () => {
    const state = get();
    if (!state.isActive || !state.startTime || !state.platform || !state.vehicleId) return null;
    
    const payload: CompletedShiftPayload = {
      platform: state.platform,
      vehicleId: state.vehicleId,
      startTime: state.startTime,
      endTime: Date.now(),
      trackedMileage: state.trackedMileage,
    };
    return payload;
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
