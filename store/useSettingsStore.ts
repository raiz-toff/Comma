import { create } from "zustand";
import { Platform } from "react-native";
import { db } from "../src/database/client";
import { settings, vehicles, shifts, expenses, goals } from "../src/database/schema";
import { eq } from "drizzle-orm";
import { DEMO_ROUTES } from './demoRoutes';

import { type ExpenseCategory } from "../src/registry/expenseCategories";
import { getCountryDef, type CountryDef } from "../src/registry/countries/index";
import { resolveProvinceDef, type ProvinceDef, getMileagePresetRate } from "../src/registry/provinces/index";
import { getMarketContext, type MarketContext } from "../src/registry/market/resolve";
import { getWithholdingPresetPct } from "../src/registry/tax/withholdingPresets";
import {
  GamificationService,
  type Challenge,
  type NotificationItem,
  type PersonalRecords,
  type GamificationState,
} from "../src/services/gamification";

const isWeb = Platform.OS === "web";


type VehicleType = 'car' | 'scooter' | 'ebike';
const VEHICLE_TYPES: VehicleType[] = ['car', 'scooter', 'ebike'];

/** Real OSRM road-snapped routes. vehicle type sets scale: car=city, scooter=neighbourhood, ebike=local. */
const generateMockRoutePath = (shiftCounter: number, vehicleType: VehicleType = 'car'): string => {
  const pool = DEMO_ROUTES[vehicleType] ?? DEMO_ROUTES.car;
  const route = pool[shiftCounter % pool.length];
  let currentTime = Date.now() - 3600000;
  const points = route.map(([lng, lat]: [number, number]) => {
    currentTime += 6000 + (shiftCounter * 7 + Math.abs(lng * 10) | 0) % 8000;
    return { latitude: lat, longitude: lng, timestamp: currentTime };
  });
  return JSON.stringify(points);
};

export interface DriverProfile {
  displayName: string;
  country: "US" | "CA" | "UK";
  taxRegion: string;
  avatarType: "emoji" | "initials";
  avatarData: string;
  selectedPlatforms: string[];
  workSchedulePreset: "flexible" | "weekdays" | "evenings" | "weekends";
  weeklyGoal: number;
  monthlyGoal: number;
  annualGoal: number;
  taxWithholdingPct: number;
  hstRegistered: boolean;
  distanceUnit: "km" | "mi";
  theme: "light" | "dark" | "auto";
  customCategories?: ExpenseCategory[];
  bentoLayout?: string;
  locale?: {
    currency?: string;
    dateFormat?: string;
    weekStartDay?: number;
    timeFormat?: "12h" | "24h";
  };
}

export interface VehicleDraft {
  nickname: string;
  type: string;
  make: string;
  model: string;
  year: string;
}

interface SettingsState {
  isOnboardingCompleted: boolean;
  profile: DriverProfile;
  activeVehicle: VehicleDraft | null;
  isLoading: boolean;
  isDemoMode: boolean;
  activePlatformFilter: string;
  preferredVehicleId: string | null;
  isHeaderVisible: boolean;

  // Derived from registry — synced on every profile load/update
  countryDef: CountryDef | null;
  provinceDef: ProvinceDef | null;
  marketContext: MarketContext | null;

  // Gamification & Notifications State
  xpTotal: number;
  xpLevel: number;
  streakDays: number;
  unlockedBadgeIds: string[];
  challenges: Challenge[];
  notifications: NotificationItem[];
  personalRecords: PersonalRecords;

  // Actions
  loadSettings: () => Promise<void>;
  completeOnboarding: (
    profile: DriverProfile,
    vehicle: VehicleDraft,
    vehicle2?: VehicleDraft | null,
    useMileagePreset?: boolean
  ) => Promise<void>;
  resetSettings: () => Promise<void>;
  loadSampleData: () => Promise<void>;
  clearSampleData: () => Promise<void>;
  setActivePlatformFilter: (filter: string) => void;
  setPreferredVehicle: (vehicleId: string) => Promise<void>;
  setHeaderVisible: (visible: boolean) => void;
  /** Update profile fields and re-persist. Also re-derives locale defs. */
  updateProfile: (patch: Partial<DriverProfile>) => Promise<void>;
  /** Apply the registry withholding preset for the current country+region. */
  applyTaxPreset: (regionCode: string) => Promise<void>;

  // Gamification Actions
  evaluateGamification: () => Promise<void>;
  dismissNotification: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  clearAllNotifications: () => Promise<void>;
}

/**
 * Derive countryDef, provinceDef, marketContext from a profile.
 * Call this any time profile.country or profile.taxRegion changes.
 */
function syncLocaleDefsFromProfile(profile: DriverProfile): {
  countryDef: CountryDef;
  provinceDef: ProvinceDef | null;
  marketContext: MarketContext;
} {
  const country = profile.country || "CA";
  const region = profile.taxRegion || (country === "CA" ? "ON" : "CA");
  const countryDef = getCountryDef(country);
  const provinceDef = resolveProvinceDef(country, region);
  const marketContext = getMarketContext(country, region);
  return { countryDef, provinceDef, marketContext };
}


const DEFAULT_PROFILE: DriverProfile = {
  displayName: "",
  country: "CA",
  taxRegion: "ON",
  avatarType: "emoji",
  avatarData: "🚗",
  selectedPlatforms: [],
  workSchedulePreset: "flexible",
  weeklyGoal: 500,
  monthlyGoal: 2000,
  annualGoal: 24000,
  taxWithholdingPct: 28, // CA default
  hstRegistered: false,
  distanceUnit: "km",
  theme: "dark",
  customCategories: [],
  locale: {
    currency: "CAD",
    dateFormat: "YYYY-MM-DD",
    weekStartDay: 0,
    timeFormat: "12h",
  },
};


export const useSettingsStore = create<SettingsState>((set, get) => ({
  isOnboardingCompleted: false,
  profile: DEFAULT_PROFILE,
  activeVehicle: null,
  isLoading: true,
  isDemoMode: false,
  activePlatformFilter: "all",
  preferredVehicleId: null,
  isHeaderVisible: true,
  countryDef: null,
  provinceDef: null,
  marketContext: null,

  // Gamification default state
  xpTotal: 0,
  xpLevel: 1,
  streakDays: 0,
  unlockedBadgeIds: [],
  challenges: [],
  notifications: [],
  personalRecords: {
    bestShiftGross: 0,
    bestNetHourly: 0,
  },

  setActivePlatformFilter: (filter: string) => {
    const profile = get().profile;
    if (profile?.selectedPlatforms && profile.selectedPlatforms.length === 1) {
      set({ activePlatformFilter: profile.selectedPlatforms[0] });
    } else {
      set({ activePlatformFilter: filter });
    }
  },

  setHeaderVisible: (visible: boolean) => {
    set({ isHeaderVisible: visible });
  },

  setPreferredVehicle: async (vehicleId: string) => {
    set({ preferredVehicleId: vehicleId });
    if (isWeb) {
      localStorage.setItem("comma_preferred_vehicle_id", vehicleId);
      return;
    }
    try {
      await db
        .insert(settings)
        .values({ key: "preferred_vehicle_id", value: vehicleId })
        .onConflictDoUpdate({ target: settings.key, set: { value: vehicleId } });
    } catch (e) {
      console.error("Failed to persist preferredVehicleId:", e);
    }
  },

  loadSettings: async () => {
    set({ isLoading: true });
    if (isWeb) {
      // In-memory or localStorage fallback for Web
      try {
        const rawCompleted = localStorage.getItem("comma_onboarding_completed");
        const rawProfile = localStorage.getItem("comma_profile");
        const rawVehicle = localStorage.getItem("comma_vehicle");
        const rawDemoMode = localStorage.getItem("comma_demo_mode");
        
        if (rawCompleted !== "true") {
          // Auto-onboard and load sample data by default on first launch
          const demoProfile: DriverProfile = {
            displayName: "Jane Doe (Demo)",
            country: "CA",
            taxRegion: "ON",
            avatarType: "emoji",
            avatarData: "🚗",
            selectedPlatforms: ["doordash", "ubereats", "skip"],
            workSchedulePreset: "flexible",
            weeklyGoal: 500,
            monthlyGoal: 2165,
            annualGoal: 26000,
            taxWithholdingPct: 25,
            hstRegistered: false,
            distanceUnit: "km",
            theme: "dark",
          };
          const demoVehicle = {
            nickname: "Prius Prime",
            type: "hybrid",
            make: "Toyota",
            model: "Prius Prime",
            year: "2020",
          };
          await get().completeOnboarding(demoProfile, demoVehicle, null);
          await get().loadSampleData();
          return;
        }
        
        const loadedProfile: DriverProfile = rawProfile ? { ...DEFAULT_PROFILE, ...JSON.parse(rawProfile) } : DEFAULT_PROFILE;
        const localeDefs = syncLocaleDefsFromProfile(loadedProfile);
        const gamificationState = await GamificationService.loadState();
        let finalFilter = localStorage.getItem("comma_active_platform_filter") || "all";
        if (loadedProfile.selectedPlatforms && loadedProfile.selectedPlatforms.length === 1) {
          finalFilter = loadedProfile.selectedPlatforms[0];
        }
        set({
          isOnboardingCompleted: true,
          profile: loadedProfile,
          activeVehicle: rawVehicle ? JSON.parse(rawVehicle) : null,
          isDemoMode: rawDemoMode === "true",
          activePlatformFilter: finalFilter,
          preferredVehicleId: localStorage.getItem("comma_preferred_vehicle_id") || null,
          isLoading: false,
          ...localeDefs,
          ...gamificationState,
        });

      } catch {
        set({ isLoading: false });
      }
      return;
    }

    try {
      // Delete all settings rows
      const raw = await db.select().from(settings).execute();
      const st: Record<string, string> = {};
      raw.forEach((r: { key: string; value: string }) => {
        st[r.key] = r.value;
      });


      const profileStr = st["profile"];
      const widgetsStr = st["dashboard_widgets"];
      const isDemo = st["demo_mode"] === "true";
      const filter = st["active_platform_filter"] || "all";
      const pvid = st["preferred_vehicle_id"] || null;
      const onboardingCompleted = st["onboarding_completed"] === "true";

      if (!onboardingCompleted) {
        // Auto-onboard and load sample data by default on first launch
        const demoProfile: DriverProfile = {
          displayName: "Jane Doe (Demo)",
          country: "CA",
          taxRegion: "ON",
          avatarType: "emoji",
          avatarData: "🚗",
          selectedPlatforms: ["doordash", "ubereats", "skip"],
          workSchedulePreset: "flexible",
          weeklyGoal: 500,
          monthlyGoal: 2165,
          annualGoal: 26000,
          taxWithholdingPct: 25,
          hstRegistered: false,
          distanceUnit: "km",
          theme: "dark",
        };
        const demoVehicle = {
          nickname: "Prius Prime",
          type: "hybrid",
          make: "Toyota",
          model: "Prius Prime",
          year: "2020",
        };
        await get().completeOnboarding(demoProfile, demoVehicle, null);
        await get().loadSampleData();
        return;
      }

      let nextProfile = { ...DEFAULT_PROFILE };

      if (profileStr) {
        try {
          const p = JSON.parse(profileStr);
          nextProfile = { ...DEFAULT_PROFILE, ...p };
        } catch (e) {
          console.warn("Failed to parse profile JSON", e);
        }
      }

      // Fetch vehicle
      const vehicleRows = await db
        .select()
        .from(vehicles)
        .where(eq(vehicles.isActive, true))
        .limit(1);

      const actVeh = vehicleRows[0]
        ? {
            nickname: vehicleRows[0].name,
            type: vehicleRows[0].type,
            make: vehicleRows[0].make || "",
            model: vehicleRows[0].model || "",
            year: vehicleRows[0].year ? vehicleRows[0].year.toString() : "",
          }
        : null;

      // Resolve preferredVehicleId: use stored preference if that vehicle exists,
      // otherwise fall back to the first active vehicle
      const vehicleIdExists = vehicleRows.some((v: { id: string }) => v.id === pvid);
      const preferredVehicleId = vehicleIdExists
        ? pvid
        : vehicleRows[0]?.id || null;

      const localeDefs = syncLocaleDefsFromProfile(nextProfile);
      const gamificationState = await GamificationService.loadState();
      let finalFilter = filter;
      if (nextProfile.selectedPlatforms && nextProfile.selectedPlatforms.length === 1) {
        finalFilter = nextProfile.selectedPlatforms[0];
      }
      set({
        isOnboardingCompleted: true,
        profile: nextProfile,
        activeVehicle: actVeh,
        isDemoMode: isDemo,
        activePlatformFilter: finalFilter,
        preferredVehicleId: preferredVehicleId,
        isLoading: false,
        ...localeDefs,
        ...gamificationState,
      });

    } catch (error) {
      console.error("Failed to load settings from DB:", error);
      set({ isLoading: false });
    }
  },

  completeOnboarding: async (
    profile: DriverProfile,
    vehicle: VehicleDraft,
    vehicle2?: VehicleDraft | null,
    useMileagePreset?: boolean
  ) => {
    set({ isLoading: true });
    
    // Auto distance unit + locale currency from country registry
    const countryDef = getCountryDef(profile.country || "CA");
    const presetPct = getWithholdingPresetPct(
      countryDef.tax.regionPresetType,
      profile.taxRegion
    );
    const finalProfile = {
      ...profile,
      distanceUnit: countryDef.distanceUnit,
      taxWithholdingPct: presetPct ?? profile.taxWithholdingPct ?? countryDef.tax.defaultWithholdingPct,
      locale: {
        currency: countryDef.currency,
        dateFormat: profile.country === "US" ? "MM/DD/YYYY" : "YYYY-MM-DD",
        weekStartDay: profile.locale?.weekStartDay ?? 0,
        timeFormat: profile.locale?.timeFormat ?? "12h",
      },
    };


    if (isWeb) {
      localStorage.setItem("comma_onboarding_completed", "true");
      localStorage.setItem("comma_profile", JSON.stringify(finalProfile));
      localStorage.setItem("comma_vehicle", JSON.stringify(vehicle));
      if (vehicle2) {
        localStorage.setItem("comma_vehicle2", JSON.stringify(vehicle2));
      }

      // Save platform configurations on Web
      const platformConfigs: Record<string, any> = {};
      const mileageVal = useMileagePreset ? getMileagePresetRate(finalProfile.country, finalProfile.taxRegion) : "0.62";
      finalProfile.selectedPlatforms.forEach((pKey, idx) => {
        platformConfigs[pKey] = {
          active: true,
          hourlyRate: "20",
          mileageRate: mileageVal,
          priority: String(idx + 1),
        };
      });
      localStorage.setItem("comma_setting_platform_configurations", JSON.stringify(platformConfigs));

      // Initialize goals on Web
      const initialGoals = [];
      if (finalProfile.weeklyGoal > 0) {
        initialGoals.push({
          id: "goal_weekly_" + Date.now(),
          label: "Weekly Revenue Goal",
          targetValue: finalProfile.weeklyGoal,
          unit: "currency",
          period: "weekly",
          isActive: true,
          createdAt: new Date().toISOString(),
        });
      }
      if (finalProfile.monthlyGoal > 0) {
        initialGoals.push({
          id: "goal_monthly_" + (Date.now() + 1),
          label: "Monthly Revenue Goal",
          targetValue: finalProfile.monthlyGoal,
          unit: "currency",
          period: "monthly",
          isActive: true,
          createdAt: new Date().toISOString(),
        });
      }
      if (finalProfile.annualGoal > 0) {
        initialGoals.push({
          id: "goal_yearly_" + (Date.now() + 2),
          label: "Yearly Revenue Goal",
          targetValue: finalProfile.annualGoal,
          unit: "currency",
          period: "yearly",
          isActive: true,
          createdAt: new Date().toISOString(),
        });
      }
      localStorage.setItem("comma_goals", JSON.stringify(initialGoals));

      const localeDefs = syncLocaleDefsFromProfile(finalProfile);
      set({
        isOnboardingCompleted: true,
        profile: finalProfile,
        activeVehicle: vehicle,
        activePlatformFilter: finalProfile.selectedPlatforms?.length === 1 ? finalProfile.selectedPlatforms[0] : "all",
        isLoading: false,
        ...localeDefs,
      });
      return;

    }

    try {
      // Save onboarding flag to SQLite
      await db
        .insert(settings)
        .values({ key: "onboarding_completed", value: "true" })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: "true" },
        });

      // Save profile configuration
      await db
        .insert(settings)
        .values({ key: "profile", value: JSON.stringify(finalProfile) })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: JSON.stringify(finalProfile) },
        });

      // Save platform configurations
      const platformConfigs: Record<string, any> = {};
      const mileageVal = useMileagePreset ? getMileagePresetRate(finalProfile.country, finalProfile.taxRegion) : "0.62";
      finalProfile.selectedPlatforms.forEach((pKey, idx) => {
        platformConfigs[pKey] = {
          active: true,
          hourlyRate: "20",
          mileageRate: mileageVal,
          priority: String(idx + 1),
        };
      });

      await db
        .insert(settings)
        .values({ key: "platform_configurations", value: JSON.stringify(platformConfigs) })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: JSON.stringify(platformConfigs) },
        });

      // Save vehicle details
      // First de-activate all vehicles
      await db.update(vehicles).set({ isActive: false });

      // Insert new active vehicle
      await db.insert(vehicles).values({
        id: "vehicle_" + Date.now(),
        name: vehicle.nickname.trim() || "Default Vehicle",
        type: vehicle.type || "gas",
        make: vehicle.make?.trim() || null,
        model: vehicle.model?.trim() || null,
        year: vehicle.year ? parseInt(vehicle.year, 10) : null,
        isActive: true,
        createdAt: new Date(),
      });

      // Insert optional secondary vehicle if provided
      if (vehicle2) {
        await db.insert(vehicles).values({
          id: "vehicle2_" + Date.now(),
          name: vehicle2.nickname.trim() || "Secondary Vehicle",
          type: vehicle2.type || "gas",
          make: vehicle2.make?.trim() || null,
          model: vehicle2.model?.trim() || null,
          year: vehicle2.year ? parseInt(vehicle2.year, 10) : null,
          isActive: false,
          createdAt: new Date(),
        });
      }

      // Insert goals from profile
      if (finalProfile.weeklyGoal > 0) {
        await db.insert(goals).values({
          id: "goal_weekly_" + Date.now(),
          label: "Weekly Revenue Goal",
          targetValue: finalProfile.weeklyGoal,
          unit: "currency",
          period: "weekly",
          isActive: true,
          createdAt: new Date(),
        });
      }
      if (finalProfile.monthlyGoal > 0) {
        await db.insert(goals).values({
          id: "goal_monthly_" + (Date.now() + 1),
          label: "Monthly Revenue Goal",
          targetValue: finalProfile.monthlyGoal,
          unit: "currency",
          period: "monthly",
          isActive: true,
          createdAt: new Date(),
        });
      }
      if (finalProfile.annualGoal > 0) {
        await db.insert(goals).values({
          id: "goal_yearly_" + (Date.now() + 2),
          label: "Yearly Revenue Goal",
          targetValue: finalProfile.annualGoal,
          unit: "currency",
          period: "yearly",
          isActive: true,
          createdAt: new Date(),
        });
      }

      const localeDefs = syncLocaleDefsFromProfile(finalProfile);
      set({
        isOnboardingCompleted: true,
        profile: finalProfile,
        activeVehicle: vehicle,
        activePlatformFilter: finalProfile.selectedPlatforms?.length === 1 ? finalProfile.selectedPlatforms[0] : "all",
        isLoading: false,
        ...localeDefs,
      });

    } catch (error) {
      console.error("Failed to complete onboarding in DB:", error);
      set({ isLoading: false });
    }
  },

  updateProfile: async (patch: Partial<DriverProfile>) => {
    const current = get().profile;
    const updated: DriverProfile = { ...current, ...patch };

    // If country changed, auto-update distanceUnit, currency, and locale
    if (patch.country && patch.country !== current.country) {
      const countryDef = getCountryDef(patch.country);
      updated.distanceUnit = countryDef.distanceUnit;
      updated.locale = {
        ...updated.locale,
        currency: countryDef.currency,
        dateFormat: patch.country === "US" ? "MM/DD/YYYY" : "YYYY-MM-DD",
      };
      // Reset taxRegion to country default
      updated.taxRegion = countryDef.tax.defaultRegionCode;
      // Apply country-default withholding preset
      const preset = getWithholdingPresetPct(
        countryDef.tax.regionPresetType,
        countryDef.tax.defaultRegionCode
      );
      updated.taxWithholdingPct = preset ?? countryDef.tax.defaultWithholdingPct;
    }

    // If taxRegion changed, apply region withholding preset
    if (patch.taxRegion && patch.taxRegion !== current.taxRegion) {
      const countryDef = getCountryDef(updated.country);
      const preset = getWithholdingPresetPct(countryDef.tax.regionPresetType, patch.taxRegion);
      if (preset !== null) {
        updated.taxWithholdingPct = preset;
      }
    }

    const localeDefs = syncLocaleDefsFromProfile(updated);
    let nextFilter = get().activePlatformFilter;
    if (updated.selectedPlatforms && updated.selectedPlatforms.length === 1) {
      nextFilter = updated.selectedPlatforms[0];
    } else if (updated.selectedPlatforms && updated.selectedPlatforms.length > 1 && !updated.selectedPlatforms.includes(nextFilter) && nextFilter !== "all") {
      nextFilter = "all";
    }
    set({ profile: updated, activePlatformFilter: nextFilter, ...localeDefs });

    // Persist
    const profileJson = JSON.stringify(updated);
    if (isWeb) {
      localStorage.setItem("comma_profile", profileJson);
    } else {
      try {
        await db
          .insert(settings)
          .values({ key: "profile", value: profileJson })
          .onConflictDoUpdate({ target: settings.key, set: { value: profileJson } });
      } catch (e) {
        console.error("Failed to persist profile update:", e);
      }
    }
  },

  applyTaxPreset: async (regionCode: string) => {
    const { profile } = get();
    const countryDef = getCountryDef(profile.country);
    const preset = getWithholdingPresetPct(countryDef.tax.regionPresetType, regionCode);
    const withholdingPct = preset ?? countryDef.tax.defaultWithholdingPct;
    await get().updateProfile({ taxRegion: regionCode, taxWithholdingPct: withholdingPct });
  },

  resetSettings: async () => {

    set({ isLoading: true });
    if (isWeb) {
      localStorage.clear();
      set({
        isOnboardingCompleted: false,
        profile: DEFAULT_PROFILE,
        activeVehicle: null,
        isDemoMode: false,
        isLoading: false,
      });
      return;
    }

    try {
      // Delete all settings rows
      await db.delete(settings);
      // Delete all vehicles, shifts, expenses, goals (Hard Reset)
      await db.delete(vehicles);
      await db.delete(shifts);
      await db.delete(expenses);
      await db.delete(goals);

      set({
        isOnboardingCompleted: false,
        profile: DEFAULT_PROFILE,
        activeVehicle: null,
        isDemoMode: false,
        isLoading: false,
      });
    } catch (error) {
      console.error("Failed to reset settings:", error);
      set({ isLoading: false });
    }
  },

  loadSampleData: async () => {
    set({ isLoading: true });
    if (isWeb) {
      localStorage.setItem("comma_demo_mode", "true");
      const demoVehicles = [
        { id: 'demo_vehicle_car', name: 'Toyota Prius', type: 'hybrid', isActive: true, createdAt: new Date().toISOString(), make: 'Toyota', model: 'Prius', year: '2020' },
        { id: 'demo_vehicle_scooter', name: 'Honda Ruckus', type: 'scooter', isActive: false, createdAt: new Date().toISOString(), make: 'Honda', model: 'Ruckus', year: '2022' },
        { id: 'demo_vehicle_ebike', name: 'Rad Power RadCity', type: 'ebike', isActive: false, createdAt: new Date().toISOString(), make: 'Rad Power', model: 'RadCity', year: '2023' },
      ];
      localStorage.setItem("comma_vehicles", JSON.stringify(demoVehicles));
      localStorage.setItem("comma_vehicle", JSON.stringify(demoVehicles[0]));
      const demoVehicleIds = ['demo_vehicle_car', 'demo_vehicle_scooter', 'demo_vehicle_ebike'];
      localStorage.setItem("comma_onboarding_completed", "true");
      const finalProfile = {
        displayName: "Jane Doe (Demo)",
        country: "CA" as const,
        taxRegion: "ON",
        avatarType: "emoji" as const,
        avatarData: "🚗",
        selectedPlatforms: ["doordash", "ubereats", "skip"],
        workSchedulePreset: "flexible" as const,
        weeklyGoal: 500,
        monthlyGoal: 2165,
        annualGoal: 26000,
        taxWithholdingPct: 25,
        hstRegistered: false,
        distanceUnit: "km" as const,
        theme: "dark" as const,
      };
      localStorage.setItem("comma_profile", JSON.stringify(finalProfile));

      const now = new Date();

      const templateConfigs = [
        { dayOffset: 0, platform: "doordash", start: "08:00", end: "11:30" },
        { dayOffset: 0, platform: "ubereats", start: "16:00", end: "20:00" },
        { dayOffset: 1, platform: "skip",     start: "11:00", end: "15:00" },
        { dayOffset: 2, platform: "doordash", start: "12:00", end: "16:00" },
        { dayOffset: 3, platform: "ubereats", start: "09:00", end: "13:00" },
        { dayOffset: 3, platform: "skip",     start: "17:00", end: "20:00" },
        { dayOffset: 4, platform: "doordash", start: "16:00", end: "20:00" },
        { dayOffset: 5, platform: "ubereats", start: "11:00", end: "15:00" },
        { dayOffset: 6, platform: "skip",     start: "08:00", end: "12:00" },
        { dayOffset: 6, platform: "doordash", start: "15:00", end: "19:30" },
        { dayOffset: 7, platform: "ubereats", start: "12:00", end: "16:00" },
        { dayOffset: 8, platform: "skip",     start: "16:00", end: "20:00" },
        { dayOffset: 9, platform: "doordash", start: "09:00", end: "13:00" },
        { dayOffset: 9, platform: "ubereats", start: "17:00", end: "20:00" },
      ];
      const demoTemplates = templateConfigs.map((cfg, idx) => {
        const tDate = new Date(now);
        tDate.setDate(now.getDate() + cfg.dayOffset);
        return {
          id: `demo_template_${idx}`,
          platform: cfg.platform,
          dayOfWeek: tDate.getDay(),
          startTime: cfg.start,
          endTime: cfg.end,
          reminderMinutes: 30,
          date: tDate.toISOString().split("T")[0],
        };
      });
      localStorage.setItem("comma_shift_templates", JSON.stringify(demoTemplates));

      const demoShifts = [];
      const demoExpenses = [];
      const platforms = ["doordash", "ubereats", "skip"];

      let shiftCounter = 0;
      for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
        const shiftDate = new Date();
        shiftDate.setDate(now.getDate() - dayOffset);
        
        const dayOfWeek = shiftDate.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
        const dayShiftsToCreate = isWeekend ? ["lunch", "dinner"] : (dayOffset % 3 === 0 ? ["lunch"] : ["lunch", "dinner"]);

        for (const type of dayShiftsToCreate) {
          shiftCounter++;
          const shiftId = `demo_shift_${shiftCounter}`;
          const platform = platforms[(dayOffset + (type === "lunch" ? 0 : 1)) % platforms.length];
          
          let startHour = type === "lunch" ? 11 : 17;
          let durationHours = type === "lunch" ? 3.5 : 4.5;
          
          const startTime = new Date(shiftDate);
          startTime.setHours(startHour, 0, 0, 0);
          
          const endTime = new Date(shiftDate);
          endTime.setHours(startHour + Math.floor(durationHours), (durationHours % 1) * 60, 0, 0);
          
          const baseGross = type === "lunch" ? 65 : 110;
          const randomFactor = (shiftCounter * 17) % 35;
          const gross = baseGross + randomFactor;
          const tips = Math.round(gross * (0.15 + (shiftCounter % 10) / 100));
          const activeMil = Math.round(durationHours * 6.5 + (shiftCounter % 8));
          const deadMil = Math.round(activeMil * 0.25);
          const duration = durationHours * 3600;

          demoShifts.push({
            id: shiftId,
            vehicleId: demoVehicleIds[shiftCounter % 3],
            platform: platform,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            grossRevenue: gross,
            tipsRevenue: tips,
            trackedMileage: activeMil,
            activeMileage: activeMil,
            deadMileage: deadMil,
            durationSeconds: duration,
            pausedSeconds: 0,
            notes: "[COMMA Sample Data]",
            routePath: generateMockRoutePath(shiftCounter, VEHICLE_TYPES[shiftCounter % 3]),
          });

          if (shiftCounter % 4 === 0) {
            demoExpenses.push({
              id: `demo_expense_${shiftCounter}`,
              shiftId: shiftId,
              category: "fuel",
              amount: 45.0 + (shiftCounter % 15),
              date: shiftDate.toISOString(),
              isDeductible: true,
            });
          }
        }
      }

      localStorage.setItem("comma_shifts", JSON.stringify(demoShifts));
      localStorage.setItem("comma_expenses", JSON.stringify(demoExpenses));


      set({
        isOnboardingCompleted: true,
        profile: finalProfile,
        activeVehicle: {
          nickname: "Toyota Prius (Demo)",
          type: "hybrid",
          make: "Toyota",
          model: "Prius",
          year: "2020",
        },
        isDemoMode: true,
        isLoading: false,
      });
      return;
    }

    try {
      await db
        .insert(settings)
        .values({ key: "demo_mode", value: "true" })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: "true" },
        });

      await db.delete(vehicles);
      await db.insert(vehicles).values([
        { id: 'demo_vehicle_car', name: 'Toyota Prius', type: 'hybrid', isActive: true, createdAt: new Date(), make: 'Toyota', model: 'Prius', year: 2020 },
        { id: 'demo_vehicle_scooter', name: 'Honda Ruckus', type: 'scooter', isActive: false, createdAt: new Date(), make: 'Honda', model: 'Ruckus', year: 2022 },
        { id: 'demo_vehicle_ebike', name: 'Rad Power RadCity', type: 'ebike', isActive: false, createdAt: new Date(), make: 'Rad Power', model: 'RadCity', year: 2023 },
      ]);
      await db
        .insert(settings)
        .values({ key: "preferred_vehicle_id", value: "demo_vehicle_car" })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: "demo_vehicle_car" },
        });
      const demoVehicleIds = ['demo_vehicle_car', 'demo_vehicle_scooter', 'demo_vehicle_ebike'];

      const now = new Date();

      const templateConfigs = [
        { dayOffset: 0, platform: "doordash", start: "08:00", end: "11:30" },
        { dayOffset: 0, platform: "ubereats", start: "16:00", end: "20:00" },
        { dayOffset: 1, platform: "skip",     start: "11:00", end: "15:00" },
        { dayOffset: 2, platform: "doordash", start: "12:00", end: "16:00" },
        { dayOffset: 3, platform: "ubereats", start: "09:00", end: "13:00" },
        { dayOffset: 3, platform: "skip",     start: "17:00", end: "20:00" },
        { dayOffset: 4, platform: "doordash", start: "16:00", end: "20:00" },
        { dayOffset: 5, platform: "ubereats", start: "11:00", end: "15:00" },
        { dayOffset: 6, platform: "skip",     start: "08:00", end: "12:00" },
        { dayOffset: 6, platform: "doordash", start: "15:00", end: "19:30" },
        { dayOffset: 7, platform: "ubereats", start: "12:00", end: "16:00" },
        { dayOffset: 8, platform: "skip",     start: "16:00", end: "20:00" },
        { dayOffset: 9, platform: "doordash", start: "09:00", end: "13:00" },
        { dayOffset: 9, platform: "ubereats", start: "17:00", end: "20:00" },
      ];
      const demoTemplates = templateConfigs.map((cfg, idx) => {
        const tDate = new Date(now);
        tDate.setDate(now.getDate() + cfg.dayOffset);
        return {
          id: `demo_template_${idx}`,
          platform: cfg.platform,
          dayOfWeek: tDate.getDay(),
          startTime: cfg.start,
          endTime: cfg.end,
          reminderMinutes: 30,
          date: tDate.toISOString().split("T")[0],
        };
      });

      await db
        .insert(settings)
        .values({ key: "shift_templates", value: JSON.stringify(demoTemplates) })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: JSON.stringify(demoTemplates) },
        });

      const demoShifts = [];
      const demoExpenses = [];
      const platforms = ["doordash", "ubereats", "skip"];

      let shiftCounter = 0;
      for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
        const shiftDate = new Date();
        shiftDate.setDate(now.getDate() - dayOffset);
        
        const dayOfWeek = shiftDate.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
        const dayShiftsToCreate = isWeekend ? ["lunch", "dinner"] : (dayOffset % 3 === 0 ? ["lunch"] : ["lunch", "dinner"]);

        for (const type of dayShiftsToCreate) {
          shiftCounter++;
          const shiftId = `demo_shift_${shiftCounter}`;
          const platform = platforms[(dayOffset + (type === "lunch" ? 0 : 1)) % platforms.length];
          
          let startHour = type === "lunch" ? 11 : 17;
          let durationHours = type === "lunch" ? 3.5 : 4.5;
          
          const startTime = new Date(shiftDate);
          startTime.setHours(startHour, 0, 0, 0);
          
          const endTime = new Date(shiftDate);
          endTime.setHours(startHour + Math.floor(durationHours), (durationHours % 1) * 60, 0, 0);
          
          const baseGross = type === "lunch" ? 65 : 110;
          const randomFactor = (shiftCounter * 17) % 35;
          const gross = baseGross + randomFactor;
          const tips = Math.round(gross * (0.15 + (shiftCounter % 10) / 100));
          const activeMil = Math.round(durationHours * 6.5 + (shiftCounter % 8));
          const deadMil = Math.round(activeMil * 0.25);
          const duration = durationHours * 3600;

          demoShifts.push({
            id: shiftId,
            vehicleId: demoVehicleIds[shiftCounter % 3],
            platform: platform,
            startTime: startTime,
            endTime: endTime,
            grossRevenue: gross,
            tipsRevenue: tips,
            trackedMileage: activeMil,
            activeMileage: activeMil,
            deadMileage: deadMil,
            durationSeconds: duration,
            pausedSeconds: 0,
            notes: "[COMMA Sample Data]",
            routePath: generateMockRoutePath(shiftCounter, VEHICLE_TYPES[shiftCounter % 3]),
          });

          if (shiftCounter % 4 === 0) {
            demoExpenses.push({
              id: `demo_expense_${shiftCounter}`,
              shiftId: shiftId,
              category: "fuel",
              amount: 45.0 + (shiftCounter % 15),
              date: shiftDate,
              isDeductible: true,
            });
          }
        }
      }

      for (const s of demoShifts) {
        await db.insert(shifts).values(s);
      }
      for (const e of demoExpenses) {
        await db.insert(expenses).values(e);
      }


      await get().loadSettings();
      await get().evaluateGamification();
      set({ isDemoMode: true, isLoading: false });
    } catch (error) {
      console.error("Failed to load sample data:", error);
      set({ isLoading: false });
    }
  },

  clearSampleData: async () => {
    set({ isLoading: true });
    if (isWeb) {
      localStorage.clear();
      set({
        isOnboardingCompleted: false,
        profile: DEFAULT_PROFILE,
        activeVehicle: null,
        isDemoMode: false,
        isLoading: false,
      });
      return;
    }

    try {
      await db.delete(settings);
      await db.delete(vehicles);
      await db.delete(shifts);
      await db.delete(expenses);
      await db.delete(goals);

      // Save empty gamification state on clear
      const defaultState: GamificationState = {
        xpTotal: 0,
        xpLevel: 1,
        streakDays: 0,
        streakLastDay: null,
        streakFrozenCount: 1,
        personalRecords: { bestShiftGross: 0, bestNetHourly: 0 },
        unlockedBadgeIds: [],
        challenges: [
          {
            id: "challenge_earn_500_week",
            name: "Earn 500 This Week",
            description: "Reach $500 gross earnings this week.",
            metric: "earnings",
            target: 500,
            current: 0,
            completedAt: null,
            startedAt: new Date().toISOString(),
          },
          {
            id: "challenge_20_deliveries_week",
            name: "20 Deliveries",
            description: "Complete 20 deliveries this week.",
            metric: "deliveries",
            target: 20,
            current: 0,
            completedAt: null,
            startedAt: new Date().toISOString(),
          },
          {
            id: "challenge_5_shift_streak",
            name: "5 Shift Streak",
            description: "Log shifts on 5 consecutive days.",
            metric: "streak",
            target: 5,
            current: 0,
            completedAt: null,
            startedAt: new Date().toISOString(),
          },
        ],
        notifications: [],
      };
      await GamificationService.saveState(defaultState);

      set({
        isOnboardingCompleted: false,
        profile: DEFAULT_PROFILE,
        activeVehicle: null,
        isDemoMode: false,
        isLoading: false,
        ...defaultState,
      });
    } catch (error) {
      console.error("Failed to clear sample data:", error);
      set({ isLoading: false });
    }
  },

  evaluateGamification: async () => {
    const updated = await GamificationService.evaluateAll();
    set({ ...updated });
  },

  dismissNotification: async (id: string) => {
    const state = await GamificationService.loadState();
    state.notifications = state.notifications.filter((n) => n.id !== id);
    await GamificationService.saveState(state);
    set({ notifications: state.notifications });
  },

  markAllNotificationsRead: async () => {
    const state = await GamificationService.loadState();
    state.notifications = state.notifications.map((n) => ({ ...n, read: true }));
    await GamificationService.saveState(state);
    set({ notifications: state.notifications });
  },

  clearAllNotifications: async () => {
    const state = await GamificationService.loadState();
    state.notifications = [];
    await GamificationService.saveState(state);
    set({ notifications: [] });
  },
}));
