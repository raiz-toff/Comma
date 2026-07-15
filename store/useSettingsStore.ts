import { create } from "zustand";
import { Platform } from "react-native";
import { db } from "../src/database/client";
import { queryClient } from "../providers/QueryProvider";
import { settings, vehicles, shifts, expenses, goals, platforms, shiftPlatforms, maintenanceLogs, vehicleTaxProfiles, taxHistory, merchants, syncOverwriteLog } from "../src/database/schema";
import * as schema from "../src/database/schema";
import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { eq } from "drizzle-orm";

// Transaction handle type derived from the drizzle expo-sqlite db (the runtime `db` export is
// typed `any` for the web fallback, so we recover a precise tx type for transaction callbacks).
type Tx = Parameters<Parameters<ExpoSQLiteDatabase<typeof schema>["transaction"]>[0]>[0];
import { resetSyncStateForReset, applyPostResetSyncStateWeb, applyPostResetSyncStateNative } from "../src/database/syncState";
import { clearDeviceAuthSecrets } from "../src/services/googleDrive";
import { DEMO_ROUTES } from './demoRoutes';
import { getDBPlatforms, updateDBPlatform, seedDBPlatforms, type DBPlatform } from "../src/database/queries/platforms";
import { getPlatformsByCountry } from "../src/registry/platforms";

import { type ExpenseCategory } from "../src/registry/expenseCategories";
import { getCountryDef, type CountryDef, resolveProvinceDef, type ProvinceDef, getMileagePresetRate } from "../src/registry/countries/index";
import { getVehicleMileageEligibility } from "../src/registry/countries/mileageRates";
import { upsertTaxProfile } from "../src/database/queries/taxProfiles";
import { getMarketContext, type MarketContext } from "../src/registry/market/resolve";
import { type FeatureKey, type OperationalModelId, getWithholdingPresetPct } from "../src/registry/index";
import {
  GamificationService,
  getNextMondayIso,
  type Challenge,
  type NotificationItem,
  type PersonalRecords,
  type GamificationState,
} from "../src/services/gamification";
import { type AddNotificationInput } from "../src/services/notify";

const isWeb = Platform.OS === "web";

/**
 * Serializes read-modify-write access to the persisted gamification state blob
 * (XP/streaks/badges/notifications all share one SQLite row). Without this,
 * a notification write firing during evaluateGamification can clobber awarded XP/badges.
 */
let gamificationStateLock: Promise<unknown> = Promise.resolve();

function runGamificationStateMutation(
  mutate: (state: GamificationState) => GamificationState | Promise<GamificationState>
): Promise<GamificationState> {
  const run = gamificationStateLock.then(async () => {
    const state = await GamificationService.loadState();
    const next = await mutate(state);
    await GamificationService.saveState(next);
    return next;
  });
  // Keep the chain alive even if one mutation throws.
  gamificationStateLock = run.then(
    () => {},
    () => {}
  );
  return run;
}


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
  country: "US" | "CA" | "UK" | "NP";
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
  accentColor?: string;
  operationalModelId?: OperationalModelId; // set during onboarding, default 'delivery_fixed'
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
  /** User opted out of the mileage write-off entirely (e.g. "doesn't apply to me"). */
  mileageOptOut?: boolean;
  /** User-supplied flat rate overriding the researched country/vehicle-type default. */
  mileageRateOverride?: string;
}

interface SettingsState {
  isOnboardingCompleted: boolean;
  profile: DriverProfile;
  activeVehicle: VehicleDraft | null;
  isLoading: boolean;
  isDemoMode: boolean;
  activePlatformFilter: string;
  /** "all" | a vehicle id | comma-joined vehicle ids — which vehicles' data is shown on
   * Home/Shifts/Analytics/Expenses. Independent of preferredVehicleId, which is "what vehicle
   * does a NEW shift default to" and is set from the shift-start flow, not this filter. */
  activeVehicleFilter: string;
  preferredVehicleId: string | null;
  isHeaderVisible: boolean;
  dbPlatforms: DBPlatform[];

  // Derived from registry — synced on every profile load/update
  countryDef: CountryDef | null;
  provinceDef: ProvinceDef | null;
  marketContext: MarketContext | null;

  // Gamification & Notifications State
  xpTotal: number;
  xpLevel: number;
  streakDays: number;
  streakFrozenCount: number;
  bestStreak: number;
  unlockedBadgeIds: string[];
  challenges: Challenge[];
  notifications: NotificationItem[];
  personalRecords: PersonalRecords;
  lastEvaluationMonth: string | null;

  // Persona Feature Overrides
  featureOverrides: Partial<Record<FeatureKey, boolean>>;

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
  setActiveVehicleFilter: (filter: string) => void;
  setPreferredVehicle: (vehicleId: string) => Promise<void>;
  setHeaderVisible: (visible: boolean) => void;
  /** Update profile fields and re-persist. Also re-derives locale defs. */
  updateProfile: (patch: Partial<DriverProfile>) => Promise<void>;
  /** Apply the registry withholding preset for the current country+region. */
  applyTaxPreset: (regionCode: string) => Promise<void>;
  /** Update user-level feature overrides. */
  updateFeatureOverride: (key: FeatureKey, val: boolean) => Promise<void>;

  // Gamification Actions
  evaluateGamification: () => Promise<string[]>;
  addNotification: (input: AddNotificationInput) => Promise<void>;
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
  theme: "auto",
  operationalModelId: "delivery_fixed" as OperationalModelId,
  customCategories: [],
  locale: {
    currency: "CAD",
    dateFormat: "YYYY-MM-DD",
    weekStartDay: 0,
    timeFormat: "12h",
  },
};


// Seeds a vehicleTaxProfiles row for the current tax year straight from onboarding, so the
// mileage write-off is never computed from a blind flat rate: the user's onboarding choice
// (opt out, custom rate, or accept the researched default) is what gets used.
async function seedDefaultTaxProfile(vehicleId: string, draft: VehicleDraft, countryId: string): Promise<void> {
  const taxYear = new Date().getFullYear();

  if (draft.mileageOptOut) {
    await upsertTaxProfile({
      id: `tp_${vehicleId}_${taxYear}`,
      vehicleId,
      taxYear,
      deductionMethod: "actual_expenses",
      country: countryId,
      standardRatePrimary: null,
      standardRateSecondary: null,
      rateThreshold: null,
    });
    return;
  }

  const override = draft.mileageRateOverride ? parseFloat(draft.mileageRateOverride) : null;
  if (override != null && !isNaN(override)) {
    await upsertTaxProfile({
      id: `tp_${vehicleId}_${taxYear}`,
      vehicleId,
      taxYear,
      deductionMethod: "standard_mileage",
      country: countryId,
      standardRatePrimary: override,
      standardRateSecondary: null,
      rateThreshold: null,
    });
    return;
  }

  const def = getVehicleMileageEligibility(countryId, draft.type);
  await upsertTaxProfile({
    id: `tp_${vehicleId}_${taxYear}`,
    vehicleId,
    taxYear,
    deductionMethod: def.eligible ? "standard_mileage" : "actual_expenses",
    country: countryId,
    standardRatePrimary: def.ratePrimary,
    standardRateSecondary: def.rateSecondary,
    rateThreshold: def.rateThreshold,
  });
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  isOnboardingCompleted: false,
  profile: DEFAULT_PROFILE,
  activeVehicle: null,
  isLoading: true,
  isDemoMode: false,
  activePlatformFilter: "all",
  activeVehicleFilter: "all",
  preferredVehicleId: null,
  isHeaderVisible: true,
  dbPlatforms: [],
  featureOverrides: {},
  countryDef: null,
  provinceDef: null,
  marketContext: null,

  // Gamification default state
  xpTotal: 0,
  xpLevel: 1,
  streakDays: 0,
  streakFrozenCount: 1,
  bestStreak: 0,
  unlockedBadgeIds: [],
  challenges: [],
  notifications: [],
  personalRecords: {
    bestShiftGross: 0,
    bestNetHourly: 0,
  },
  lastEvaluationMonth: null,

  setActivePlatformFilter: (filter: string) => {
    const profile = get().profile;
    if (profile?.selectedPlatforms && profile.selectedPlatforms.length === 1) {
      set({ activePlatformFilter: profile.selectedPlatforms[0] });
    } else {
      set({ activePlatformFilter: filter });
    }
  },

  // Vehicles aren't tracked in this store (they're a separate SQLite table, queried via
  // react-query where needed) — so unlike setActivePlatformFilter this can't auto-collapse
  // to a single vehicle at the store level. GlobalTopHeader caps/collapses locally, where it
  // already has the fetched vehicle list.
  setActiveVehicleFilter: (filter: string) => {
    set({ activeVehicleFilter: filter });
  },

  setHeaderVisible: (visible: boolean) => {
    // Skip no-op writes: scroll handlers call this ~60×/sec, and without this guard every call
    // notifies all subscribers even when the value is unchanged.
    if (get().isHeaderVisible === visible) return;
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
        const rawAppConfig = localStorage.getItem("comma_app_config");

        let appConfig = { operationalModelId: 'delivery_fixed' as OperationalModelId, country: 'CA', featureOverrides: {} as Partial<Record<FeatureKey, boolean>> };
        if (rawAppConfig) {
          try {
            appConfig = JSON.parse(rawAppConfig);
          } catch {}
        }

        if (rawCompleted !== "true") {
          // Onboarding not completed — show the onboarding wizard gate.
          // The dashboard (app/(tabs)/index.tsx) will render <OnboardingWizard />
          // when isOnboardingCompleted is false.
          set({
            isOnboardingCompleted: false,
            profile: DEFAULT_PROFILE,
            activeVehicle: null,
            isDemoMode: false,
            isLoading: false,
          });
          return;
        }

        
        const loadedProfile: DriverProfile = rawProfile ? { ...DEFAULT_PROFILE, ...JSON.parse(rawProfile) } : DEFAULT_PROFILE;

        // Data migration: collapse old persona field to operationalModelId
        if (!(loadedProfile as any).operationalModelId) {
          loadedProfile.operationalModelId = appConfig.operationalModelId || 'delivery_fixed';
        }
        
        const activeCountry = loadedProfile.country || "CA";
        await seedDBPlatforms(activeCountry, loadedProfile.selectedPlatforms || []);
        const dbPlatforms = await getDBPlatforms(activeCountry);
        loadedProfile.selectedPlatforms = dbPlatforms.filter(p => p.isActive).map(p => p.id);

        const localeDefs = syncLocaleDefsFromProfile(loadedProfile);
        const gamificationState = await GamificationService.evaluateAll();
        let finalFilter = localStorage.getItem("comma_active_platform_filter") || "all";
        if (loadedProfile.selectedPlatforms && loadedProfile.selectedPlatforms.length === 1) {
          finalFilter = loadedProfile.selectedPlatforms[0];
        }
        set({
          isOnboardingCompleted: true,
          profile: loadedProfile,
          dbPlatforms,
          activeVehicle: rawVehicle ? JSON.parse(rawVehicle) : null,
          isDemoMode: rawDemoMode === "true",
          activePlatformFilter: finalFilter,
          preferredVehicleId: localStorage.getItem("comma_preferred_vehicle_id") || null,
          featureOverrides: appConfig.featureOverrides || {},
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
      const raw = await db.select().from(settings).execute();
      const st: Record<string, string> = {};
      raw.forEach((r: { key: string; value: string }) => {
        st[r.key] = r.value;
      });

      const profileStr = st["profile"];
      const appConfigStr = st["app_config"];
      const isDemo = st["demo_mode"] === "true";
      const filter = st["active_platform_filter"] || "all";
      const pvid = st["preferred_vehicle_id"] || null;
      const onboardingCompleted = st["onboarding_completed"] === "true";

      let appConfig = { operationalModelId: 'delivery_fixed' as OperationalModelId, country: 'CA', featureOverrides: {} as Partial<Record<FeatureKey, boolean>> };
      if (appConfigStr) {
        try {
          appConfig = JSON.parse(appConfigStr);
        } catch {}
      }

      if (!onboardingCompleted) {
        // Onboarding not completed — show the onboarding wizard gate.
        // The dashboard (app/(tabs)/index.tsx) will render <OnboardingWizard />
        // when isOnboardingCompleted is false.
        set({
          isOnboardingCompleted: false,
          profile: DEFAULT_PROFILE,
          activeVehicle: null,
          isDemoMode: false,
          isLoading: false,
        });
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

      // Data migration: collapse old persona field to operationalModelId
      if (!(nextProfile as any).operationalModelId) {
        nextProfile.operationalModelId = appConfig.operationalModelId || 'delivery_fixed';
      }
      
      const activeCountry = nextProfile.country || "CA";
      await seedDBPlatforms(activeCountry, nextProfile.selectedPlatforms || []);
      const dbPlatforms = await getDBPlatforms(activeCountry);
      nextProfile.selectedPlatforms = dbPlatforms.filter(p => p.isActive).map(p => p.id);

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
      const gamificationState = await GamificationService.evaluateAll();
      let finalFilter = filter;
      if (nextProfile.selectedPlatforms && nextProfile.selectedPlatforms.length === 1) {
        finalFilter = nextProfile.selectedPlatforms[0];
      }
      set({
        isOnboardingCompleted: true,
        profile: nextProfile,
        dbPlatforms,
        activeVehicle: actVeh,
        isDemoMode: isDemo,
        activePlatformFilter: finalFilter,
        preferredVehicleId: preferredVehicleId,
        featureOverrides: appConfig.featureOverrides || {},
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

    await seedDBPlatforms(finalProfile.country, finalProfile.selectedPlatforms);
    const mileageVal = useMileagePreset ? getMileagePresetRate(finalProfile.country, finalProfile.taxRegion) : "0.62";
    // Reconcile the FULL active set to exactly what was selected: activate the chosen apps AND
    // deactivate every other platform. Activating only the selected ones left stale actives
    // behind — e.g. the apps Demo Mode switches on aren't isDemo-tagged, so exiting demo and
    // onboarding a fresh account inherited DoorDash/Uber Eats/Skip as "already added" even
    // though the driver never picked them. The active set now equals the picked set, period.
    const selectedSet = new Set(finalProfile.selectedPlatforms);
    const allDbPlatforms = await getDBPlatforms(finalProfile.country);
    await Promise.all(
      allDbPlatforms.map((p) =>
        updateDBPlatform(finalProfile.country, p.id, {
          isActive: selectedSet.has(p.id),
          ...(selectedSet.has(p.id) ? { mileageRate: mileageVal } : {}),
        }),
      ),
    );

    const appConfig = {
      operationalModelId: finalProfile.operationalModelId || 'delivery_fixed' as OperationalModelId,
      country: finalProfile.country || 'CA',
      featureOverrides: {} as Partial<Record<FeatureKey, boolean>>,
    };
    const appConfigJson = JSON.stringify(appConfig);

    if (isWeb) {
      localStorage.setItem("comma_onboarding_completed", "true");
      localStorage.setItem("comma_profile", JSON.stringify(finalProfile));
      localStorage.setItem("comma_vehicle", JSON.stringify(vehicle));
      localStorage.setItem("comma_app_config", appConfigJson);
      if (vehicle2) {
        localStorage.setItem("comma_vehicle2", JSON.stringify(vehicle2));
      }

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
        featureOverrides: {},
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

      // Save app_config configuration
      await db
        .insert(settings)
        .values({ key: "app_config", value: appConfigJson })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: appConfigJson },
        });

      // Save vehicle details
      // First de-activate all vehicles
      await db.update(vehicles).set({ isActive: false });

      // Insert new active vehicle
      const primaryVehicleId = "vehicle_" + Date.now();
      await db.insert(vehicles).values({
        id: primaryVehicleId,
        name: vehicle.nickname.trim() || "Default Vehicle",
        type: vehicle.type || "gas",
        make: vehicle.make?.trim() || null,
        model: vehicle.model?.trim() || null,
        year: vehicle.year ? parseInt(vehicle.year, 10) : null,
        isActive: true,
        createdAt: new Date(),
      });

      // Seed a tax-year profile so the mileage write-off shown later reflects what the user
      // told us during onboarding (opt out entirely, a custom rate, or the researched default
      // for their vehicle type/country) — never a blind flat rate.
      await seedDefaultTaxProfile(primaryVehicleId, vehicle, finalProfile.country);

      // Insert optional secondary vehicle if provided
      if (vehicle2) {
        const secondaryVehicleId = "vehicle2_" + Date.now();
        await db.insert(vehicles).values({
          id: secondaryVehicleId,
          name: vehicle2.nickname.trim() || "Secondary Vehicle",
          type: vehicle2.type || "gas",
          make: vehicle2.make?.trim() || null,
          model: vehicle2.model?.trim() || null,
          year: vehicle2.year ? parseInt(vehicle2.year, 10) : null,
          isActive: false,
          createdAt: new Date(),
        });
        await seedDefaultTaxProfile(secondaryVehicleId, vehicle2, finalProfile.country);
      }

      // Upsert goals from profile — stable IDs prevent duplicates on re-runs
      if (finalProfile.weeklyGoal > 0) {
        await db.insert(goals).values({
          id: "goal_weekly",
          label: "Weekly Revenue Goal",
          targetValue: finalProfile.weeklyGoal,
          unit: "currency",
          period: "weekly",
          isActive: true,
          createdAt: new Date(),
        }).onConflictDoUpdate({ target: goals.id, set: { targetValue: finalProfile.weeklyGoal, isActive: true } });
      }
      if (finalProfile.monthlyGoal > 0) {
        await db.insert(goals).values({
          id: "goal_monthly",
          label: "Monthly Revenue Goal",
          targetValue: finalProfile.monthlyGoal,
          unit: "currency",
          period: "monthly",
          isActive: true,
          createdAt: new Date(),
        }).onConflictDoUpdate({ target: goals.id, set: { targetValue: finalProfile.monthlyGoal, isActive: true } });
      }
      if (finalProfile.annualGoal > 0) {
        await db.insert(goals).values({
          id: "goal_yearly",
          label: "Yearly Revenue Goal",
          targetValue: finalProfile.annualGoal,
          unit: "currency",
          period: "yearly",
          isActive: true,
          createdAt: new Date(),
        }).onConflictDoUpdate({ target: goals.id, set: { targetValue: finalProfile.annualGoal, isActive: true } });
      }

      const localeDefs = syncLocaleDefsFromProfile(finalProfile);
      set({
        isOnboardingCompleted: true,
        profile: finalProfile,
        activeVehicle: vehicle,
        activePlatformFilter: finalProfile.selectedPlatforms?.length === 1 ? finalProfile.selectedPlatforms[0] : "all",
        featureOverrides: {},
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

      // Filter selectedPlatforms to only include ones valid in the new country
      const newCountryPlatforms = getPlatformsByCountry(patch.country).map(p => p.id);
      updated.selectedPlatforms = (updated.selectedPlatforms || []).filter(
        (pId) => newCountryPlatforms.includes(pId)
      );
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
    // Reconcile the header's active filter to the new platform set. A single platform selects
    // itself; otherwise, if the current filter points at ANY platform that's no longer
    // selected — including the zero-platforms case, where the filter used to be left stranded
    // on the just-removed app so the switcher kept showing it until a restart — fall back to
    // "all".
    const sel = updated.selectedPlatforms ?? [];
    let nextFilter = get().activePlatformFilter;
    if (sel.length === 1) {
      nextFilter = sel[0];
    } else if (nextFilter !== "all" && nextFilter.split(",").some((id) => !sel.includes(id))) {
      nextFilter = "all";
    }
    set({ profile: updated, activePlatformFilter: nextFilter, ...localeDefs });

    // Sync platform active states in DB
    try {
      const activeCountry = updated.country;
      if (patch.country && patch.country !== current.country) {
        await seedDBPlatforms(patch.country, patch.selectedPlatforms || []);
      }
      if (patch.selectedPlatforms) {
        const selected = patch.selectedPlatforms;
        const allPlatforms = await getDBPlatforms(activeCountry);
        // One parallel pass instead of two serial loops (activate-selected, then
        // deactivate-the-rest). The switcher's snappiness comes from the optimistic store
        // update in the caller; this just stops the save from blocking on one SQLite
        // round-trip per platform (issue #14). updateDBPlatform no-ops a missing row, same
        // as the old loops, and stamping (syncUpdatedAt) is unchanged.
        await Promise.all(
          allPlatforms.map((dbP) =>
            updateDBPlatform(activeCountry, dbP.id, { isActive: selected.includes(dbP.id) }),
          ),
        );
      }
      const dbPlatforms = await getDBPlatforms(activeCountry);
      set({ dbPlatforms });
    } catch (e) {
      console.error("Failed to sync platforms in DB during updateProfile:", e);
    }

    // Persist
    const profileJson = JSON.stringify(updated);
    const appConfig = {
      operationalModelId: updated.operationalModelId || 'delivery_fixed' as OperationalModelId,
      country: updated.country || 'CA',
      featureOverrides: get().featureOverrides || {},
    };
    const appConfigJson = JSON.stringify(appConfig);

    if (isWeb) {
      localStorage.setItem("comma_profile", profileJson);
      localStorage.setItem("comma_app_config", appConfigJson);
    } else {
      try {
        await db
          .insert(settings)
          .values({ key: "profile", value: profileJson })
          .onConflictDoUpdate({ target: settings.key, set: { value: profileJson } });

        await db
          .insert(settings)
          .values({ key: "app_config", value: appConfigJson })
          .onConflictDoUpdate({ target: settings.key, set: { value: appConfigJson } });
      } catch (e) {
        console.error("Failed to persist profile update:", e);
      }
    }
  },

  updateFeatureOverride: async (key: FeatureKey, val: boolean) => {
    const currentOverrides = get().featureOverrides || {};
    const updatedOverrides = { ...currentOverrides, [key]: val };

    set({ featureOverrides: updatedOverrides });

    const profile = get().profile;
    const appConfig = {
      operationalModelId: profile.operationalModelId || 'delivery_fixed' as OperationalModelId,
      country: profile.country || 'CA',
      featureOverrides: updatedOverrides,
    };
    const appConfigJson = JSON.stringify(appConfig);

    if (isWeb) {
      localStorage.setItem("comma_app_config", appConfigJson);
    } else {
      try {
        await db
          .insert(settings)
          .values({ key: "app_config", value: appConfigJson })
          .onConflictDoUpdate({ target: settings.key, set: { value: appConfigJson } });
      } catch (e) {
        console.error("Failed to persist feature override:", e);
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

    // Reset App = wipe THIS DEVICE only; the cloud copy is never touched (see
    // app/docs/sync-design.md §4a). Sync is turned OFF *before* the wipe and the
    // device id is RE-MINTED so:
    //   - the next sync won't run and silently refill the now-empty phone, and
    //   - if the user later re-enables sync, the re-minted id makes the cloud's
    //     existing change-logs read as "not mine" → they pull back down cleanly.
    // This is a LOCAL HARD wipe, NOT a soft-delete: we must not push tombstones,
    // or every other device would be wiped too.
    const freshDeviceId = resetSyncStateForReset();

    if (isWeb) {
      localStorage.clear();
      applyPostResetSyncStateWeb(freshDeviceId);
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
      // Hard-wipe all synced record tables + settings (true clean slate). Children
      // before parents to satisfy FK references.
      await db.delete(shiftPlatforms);
      await db.delete(expenses);
      await db.delete(maintenanceLogs);
      await db.delete(vehicleTaxProfiles);
      await db.delete(shifts);
      await db.delete(taxHistory);
      await db.delete(goals);
      await db.delete(merchants);
      await db.delete(vehicles);
      await db.delete(platforms);
      await db.delete(syncOverwriteLog); // local sync audit log — clean slate
      await db.delete(settings);

      // Re-establish the post-reset sync state in the (now-empty) settings KV:
      // sync OFF, cursors cleared, device id re-minted. Written AFTER the settings
      // wipe so these keys survive.
      await applyPostResetSyncStateNative(freshDeviceId);

      // SecureStore survives the table wipe — clear the Google session, backup
      // password, and cached encryption key so the new account starts fully
      // disconnected instead of inheriting the old one (issue #12).
      await clearDeviceAuthSecrets();

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
        displayName: "Hustler",
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
        theme: "auto" as const,
        operationalModelId: "delivery_fixed" as OperationalModelId,
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

      // A recurring phone-plan bill, already overdue — showcases the "Recurring expense
      // due" reminder (Expenses tab) the moment a new demo user opens it.
      const recurringDueDate = new Date(now);
      recurringDueDate.setDate(recurringDueDate.getDate() - 1);
      const recurringLoggedDate = new Date(recurringDueDate);
      recurringLoggedDate.setMonth(recurringLoggedDate.getMonth() - 1);
      demoExpenses.push({
        id: "demo_expense_recurring_phone",
        shiftId: null,
        category: "phone",
        amount: 49.99,
        date: recurringLoggedDate.toISOString(),
        isDeductible: true,
        isRecurring: true,
        recurringInterval: "monthly",
        recurringNextDate: recurringDueDate.toISOString().split("T")[0],
      });

      localStorage.setItem("comma_shifts", JSON.stringify(demoShifts));
      localStorage.setItem("comma_expenses", JSON.stringify(demoExpenses));
      localStorage.setItem("comma_goals", JSON.stringify([
        { id: "goal_weekly", label: "Weekly Revenue Goal", targetValue: 500, unit: "currency", period: "weekly", isActive: true, createdAt: new Date().toISOString() },
        { id: "goal_monthly", label: "Monthly Revenue Goal", targetValue: 2165, unit: "currency", period: "monthly", isActive: true, createdAt: new Date().toISOString() },
        { id: "goal_yearly", label: "Yearly Revenue Goal", targetValue: 26000, unit: "currency", period: "yearly", isActive: true, createdAt: new Date().toISOString() },
      ]));

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
      queryClient.invalidateQueries();
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

      // Surgical: only clear previously-seeded demo vehicles (re-rolling demo data), never a
      // real vehicle — the old unconditional `db.delete(vehicles)` would have wiped a real
      // user's fleet if this ever ran on top of real data.
      await db.delete(vehicles).where(eq(vehicles.isDemo, true));
      await db.insert(vehicles).values([
        { id: 'demo_vehicle_car', name: 'Toyota Prius', type: 'hybrid', isActive: true, createdAt: new Date(), make: 'Toyota', model: 'Prius', year: 2020, isDemo: true },
        { id: 'demo_vehicle_scooter', name: 'Honda Ruckus', type: 'scooter', isActive: false, createdAt: new Date(), make: 'Honda', model: 'Ruckus', year: 2022, isDemo: true },
        { id: 'demo_vehicle_ebike', name: 'Rad Power RadCity', type: 'ebike', isActive: false, createdAt: new Date(), make: 'Rad Power', model: 'RadCity', year: 2023, isDemo: true },
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

      const demoShifts: (typeof shifts.$inferInsert)[] = [];
      const demoExpenses: (typeof expenses.$inferInsert)[] = [];
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
            isDemo: true,
          });

          if (shiftCounter % 4 === 0) {
            demoExpenses.push({
              id: `demo_expense_${shiftCounter}`,
              shiftId: shiftId,
              category: "fuel",
              amount: 45.0 + (shiftCounter % 15),
              date: shiftDate,
              isDeductible: true,
              isDemo: true,
            });
          }
        }
      }

      // A recurring phone-plan bill, already overdue — showcases the "Recurring expense
      // due" reminder (Expenses tab) the moment a new demo user opens it.
      const recurringDueDate = new Date(now);
      recurringDueDate.setDate(recurringDueDate.getDate() - 1);
      const recurringLoggedDate = new Date(recurringDueDate);
      recurringLoggedDate.setMonth(recurringLoggedDate.getMonth() - 1);
      demoExpenses.push({
        id: "demo_expense_recurring_phone",
        shiftId: null,
        category: "phone",
        amount: 49.99,
        date: recurringLoggedDate,
        isDeductible: true,
        isRecurring: true,
        recurringInterval: "monthly",
        recurringNextDate: recurringDueDate.toISOString().split("T")[0],
        isDemo: true,
      });

      // Batch all inserts in one transaction — avoids N serial JS→native bridge round-trips
      await db.transaction(async (tx: Tx) => {
        if (demoShifts.length > 0) await tx.insert(shifts).values(demoShifts);
        if (demoExpenses.length > 0) await tx.insert(expenses).values(demoExpenses);
        // Surgical: only clear previously-seeded demo goals, never a real one. Demo goals use
        // their OWN `demo_`-namespaced ids (like every other demo row — vehicles, shifts,
        // expenses) so they never collide with the real onboarding goals `goal_weekly` etc.
        // Reusing those real ids here used to throw `UNIQUE constraint failed: goals.id` for any
        // driver who'd finished onboarding (their real goal survives the isDemo-scoped delete,
        // then this insert hits it). The activation/goal screens match the weekly goal by
        // period+unit too, so the demo goal still reads as the weekly currency goal.
        await tx.delete(goals).where(eq(goals.isDemo, true));
        await tx.insert(goals).values([
          { id: "demo_goal_weekly", label: "Weekly Revenue Goal", targetValue: 500, unit: "currency", period: "weekly", isActive: true, createdAt: new Date(), isDemo: true },
          { id: "demo_goal_monthly", label: "Monthly Revenue Goal", targetValue: 2165, unit: "currency", period: "monthly", isActive: true, createdAt: new Date(), isDemo: true },
          { id: "demo_goal_yearly", label: "Yearly Revenue Goal", targetValue: 26000, unit: "currency", period: "yearly", isActive: true, createdAt: new Date(), isDemo: true },
        ]);
      });

      await get().loadSettings();
      // Set isDemoMode before evaluateGamification so triggerNativeNotification suppresses OS pushes
      set({ isDemoMode: true });
      await get().evaluateGamification();
      set({ isLoading: false });
      // Bust the query cache so the dashboard re-fetches immediately with demo data
      queryClient.invalidateQueries();
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
      queryClient.invalidateQueries();
      return;
    }

    try {
      // Surgical: delete only demo-tagged rows, and only the settings keys loadSampleData()
      // itself wrote. This used to be an unconditional `db.delete(settings)` / `db.delete(vehicles)`
      // / etc. — safe only because demo mode was assumed to never coexist with real data. Filtering
      // by `isDemo` means a real vehicle/shift/expense/goal (or an unrelated setting) now survives
      // "Exit demo" even if that assumption is ever violated.
      await db.delete(vehicles).where(eq(vehicles.isDemo, true));
      await db.delete(shifts).where(eq(shifts.isDemo, true));
      await db.delete(expenses).where(eq(expenses.isDemo, true));
      await db.delete(goals).where(eq(goals.isDemo, true));
      for (const key of ["demo_mode", "preferred_vehicle_id", "shift_templates", "onboarding_completed"]) {
        await db.delete(settings).where(eq(settings.key, key));
      }

      // Save empty gamification state on clear
      const defaultState: GamificationState = {
        xpTotal: 0,
        xpLevel: 1,
        streakDays: 0,
        streakLastDay: null,
        streakFrozenCount: 1,
        bestStreak: 0,
        personalRecords: { bestShiftGross: 0, bestNetHourly: 0 },
        unlockedBadgeIds: [],
        lastEvaluationMonth: null,
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
            nextResetDate: getNextMondayIso(),
            weekStartedAt: new Date().toISOString(),
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
            nextResetDate: getNextMondayIso(),
            weekStartedAt: new Date().toISOString(),
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
            nextResetDate: getNextMondayIso(),
            weekStartedAt: new Date().toISOString(),
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
      queryClient.invalidateQueries();
    } catch (error) {
      console.error("Failed to clear sample data:", error);
      set({ isLoading: false });
    }
  },

  evaluateGamification: async () => {
    // Capture the badge set before evaluation so we can surface NEW unlocks (Bulletin Mode).
    const prevUnlocked = new Set(get().unlockedBadgeIds ?? []);

    // Serialize against notification writes so neither clobbers the shared state blob.
    const run = gamificationStateLock.then(() => GamificationService.evaluateAll(get().isDemoMode));
    gamificationStateLock = run.then(
      () => {},
      () => {}
    );
    const updated = await run;
    set({ ...updated });

    // Return badge IDs unlocked during THIS evaluation, for the celebration sheet.
    return (updated.unlockedBadgeIds ?? []).filter((id) => !prevUnlocked.has(id));
  },

  addNotification: async (input: AddNotificationInput) => {
    const now = new Date();
    const next = await runGamificationStateMutation((state) => {
      // Throttle: skip if the newest notification shares the title within 5s.
      if (input.dedupeKey) {
        const newest = state.notifications[0];
        if (
          newest &&
          newest.title === input.title &&
          now.getTime() - new Date(newest.createdAt).getTime() < 5000
        ) {
          return state;
        }
      }
      state.notifications.unshift({
        id: `notif_${input.iconKey ?? input.type ?? "info"}_${now.getTime()}_${Math.random()
          .toString(36)
          .slice(2, 7)}`,
        title: input.title,
        description: input.description,
        time: "Just now",
        type: input.type ?? "info",
        read: false,
        createdAt: now.toISOString(),
        actionUrl: input.actionUrl,
        iconKey: input.iconKey,
        badgeId: input.badgeId,
      });
      if (state.notifications.length > 100) {
        state.notifications = state.notifications.slice(0, 100);
      }
      return state;
    });
    set({ notifications: next.notifications });
  },

  dismissNotification: async (id: string) => {
    const next = await runGamificationStateMutation((state) => {
      state.notifications = state.notifications.filter((n) => n.id !== id);
      return state;
    });
    set({ notifications: next.notifications });
  },

  markAllNotificationsRead: async () => {
    const next = await runGamificationStateMutation((state) => {
      state.notifications = state.notifications.map((n) => ({ ...n, read: true }));
      return state;
    });
    set({ notifications: next.notifications });
  },

  clearAllNotifications: async () => {
    const next = await runGamificationStateMutation((state) => {
      state.notifications = [];
      return state;
    });
    set({ notifications: next.notifications });
  },
}));
