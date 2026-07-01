"use client";
import { create } from "zustand";
import { getTokens, type GoogleTokens } from "@/lib/auth";
import { getProfile, getLastBackupAt } from "@/lib/db/queries/settings";
import { getActivePlatforms, type ActivePlatform } from "@/lib/db/queries/platforms";

interface Profile {
  displayName?: string;
  country?: string;
  distanceUnit?: "km" | "mi";
  selectedPlatforms?: string[];
  taxRegion?: string;
  taxWithholdingPct?: number;
  [key: string]: unknown;
}

interface AppState {
  // Auth
  tokens: GoogleTokens | null;
  isAuthenticated: boolean;

  // DB / data loaded
  isDbReady: boolean;
  isDbLoading: boolean;
  dbError: string | null;

  // Startup — true until we've checked IDB + auth on first mount
  isHydrating: boolean;
  // true if IndexedDB had a saved DB on startup (skip connect page)
  hasLocalData: boolean;

  // Profile
  profile: Profile | null;
  lastBackupAt: string | null;

  // Platform switcher
  activePlatformId: string;           // "all" or a platform id like "doordash"
  activePlatforms: ActivePlatform[];  // active platforms from DB

  // Actions
  initAuth: () => void;
  setTokens: (tokens: GoogleTokens | null) => void;
  setDbReady: (ready: boolean) => void;
  setDbError: (error: string | null) => void;
  setHydrating: (v: boolean) => void;
  setHasLocalData: (v: boolean) => void;
  setActivePlatformId: (id: string) => void;
  loadProfile: () => Promise<void>;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  tokens: null,
  isAuthenticated: false,
  isDbReady: false,
  isDbLoading: false,
  dbError: null,
  isHydrating: true,
  hasLocalData: false,
  profile: null,
  lastBackupAt: null,
  activePlatformId: "all",
  activePlatforms: [],

  initAuth: () => {
    const tokens = getTokens();
    set({ tokens, isAuthenticated: !!tokens?.accessToken });
  },

  setTokens: (tokens) => {
    set({ tokens, isAuthenticated: !!tokens?.accessToken });
  },

  setDbReady: (ready) => {
    set({ isDbReady: ready, isDbLoading: !ready });
  },

  setDbError: (error) => {
    set({ dbError: error, isDbLoading: false });
  },

  setHydrating: (v) => set({ isHydrating: v }),

  setHasLocalData: (v) => set({ hasLocalData: v }),

  setActivePlatformId: (id) => set({ activePlatformId: id }),

  loadProfile: async () => {
    try {
      const [profile, lastBackupAt, activePlatforms] = await Promise.all([
        getProfile(),
        getLastBackupAt(),
        getActivePlatforms(),
      ]);
      set({ profile: profile as Profile | null, lastBackupAt, activePlatforms });
    } catch {}
  },

  reset: () => {
    set({
      tokens: null,
      isAuthenticated: false,
      isDbReady: false,
      isDbLoading: false,
      dbError: null,
      hasLocalData: false,
      profile: null,
      lastBackupAt: null,
      activePlatformId: "all",
      activePlatforms: [],
    });
  },
}));
