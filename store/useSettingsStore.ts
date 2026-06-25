import { create } from "zustand";
import { Platform } from "react-native";
import { db } from "../src/database/client";
import { settings, vehicles, shifts, expenses, goals } from "../src/database/schema";
import { eq } from "drizzle-orm";
import { DEMO_ROUTES } from './demoRoutes';

import { type ExpenseCategory } from "../src/registry/expenseCategories";

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
  country: "US" | "CA";
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

  // Actions
  loadSettings: () => Promise<void>;
  completeOnboarding: (
    profile: DriverProfile,
    vehicle: VehicleDraft,
    vehicle2?: VehicleDraft | null
  ) => Promise<void>;
  resetSettings: () => Promise<void>;
  loadSampleData: () => Promise<void>;
  clearSampleData: () => Promise<void>;
  setActivePlatformFilter: (filter: string) => void;
  setPreferredVehicle: (vehicleId: string) => Promise<void>;
}

const DEFAULT_PROFILE: DriverProfile = {
  displayName: "",
  country: "CA",
  taxRegion: "",
  avatarType: "emoji",
  avatarData: "🚗",
  selectedPlatforms: [],
  workSchedulePreset: "flexible",
  weeklyGoal: 500,
  monthlyGoal: 2000,
  annualGoal: 24000,
  taxWithholdingPct: 25,
  hstRegistered: false,
  distanceUnit: "km",
  theme: "dark",
  customCategories: [],
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  isOnboardingCompleted: false,
  profile: DEFAULT_PROFILE,
  activeVehicle: null,
  isLoading: true,
  isDemoMode: false,
  activePlatformFilter: "all",
  preferredVehicleId: null,

  setActivePlatformFilter: (filter: string) => set({ activePlatformFilter: filter }),

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
        
        set({
          isOnboardingCompleted: true,
          profile: rawProfile ? JSON.parse(rawProfile) : DEFAULT_PROFILE,
          activeVehicle: rawVehicle ? JSON.parse(rawVehicle) : null,
          isDemoMode: rawDemoMode === "true",
          preferredVehicleId: localStorage.getItem("comma_preferred_vehicle_id") || null,
          isLoading: false,
        });
      } catch {
        set({ isLoading: false });
      }
      return;
    }

    try {
      // Fetch from SQLite via Drizzle
      const onboardingCompletedRow = await db
        .select()
        .from(settings)
        .where(eq(settings.key, "onboarding_completed"))
        .limit(1);

      const onboardingCompleted = onboardingCompletedRow[0]?.value === "true";

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

      const profileRow = await db
        .select()
        .from(settings)
        .where(eq(settings.key, "profile"))
        .limit(1);

      const demoModeRow = await db
        .select()
        .from(settings)
        .where(eq(settings.key, "demo_mode"))
        .limit(1);

      // Fetch vehicle
      const vehicleRows = await db
        .select()
        .from(vehicles)
        .where(eq(vehicles.isActive, true))
        .limit(1);

      // Fetch preferred vehicle id
      const preferredVehicleRow = await db
        .select()
        .from(settings)
        .where(eq(settings.key, "preferred_vehicle_id"))
        .limit(1);

      const profile = profileRow[0]?.value
        ? (JSON.parse(profileRow[0].value) as DriverProfile)
        : DEFAULT_PROFILE;
      const isDemoMode = demoModeRow[0]?.value === "true";
      const activeVehicle = vehicleRows[0]
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
      const storedPrefId = preferredVehicleRow[0]?.value || null;
      const vehicleIdExists = vehicleRows.some((v: { id: string }) => v.id === storedPrefId);
      const preferredVehicleId = vehicleIdExists
        ? storedPrefId
        : vehicleRows[0]?.id || null;

      set({
        isOnboardingCompleted: true,
        profile,
        activeVehicle,
        isDemoMode,
        preferredVehicleId,
        isLoading: false,
      });
    } catch (error) {
      console.error("Failed to load settings from DB:", error);
      set({ isLoading: false });
    }
  },

  completeOnboarding: async (
    profile: DriverProfile,
    vehicle: VehicleDraft,
    vehicle2?: VehicleDraft | null
  ) => {
    set({ isLoading: true });
    
    // Auto distance unit setting based on country
    const finalProfile = {
      ...profile,
      distanceUnit: profile.country === "US" ? ("mi" as const) : ("km" as const),
    };

    if (isWeb) {
      localStorage.setItem("comma_onboarding_completed", "true");
      localStorage.setItem("comma_profile", JSON.stringify(finalProfile));
      localStorage.setItem("comma_vehicle", JSON.stringify(vehicle));
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

      set({
        isOnboardingCompleted: true,
        profile: finalProfile,
        activeVehicle: vehicle,
        isLoading: false,
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

      set({
        isOnboardingCompleted: true,
        profile: finalProfile,
        activeVehicle: vehicle,
        isLoading: false,
      });
    } catch (error) {
      console.error("Failed to complete onboarding in DB:", error);
      set({ isLoading: false });
    }
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

      const demoGoals = [
        {
          id: "goal_weekly_" + Date.now(),
          label: "Weekly Revenue Goal",
          targetValue: 500,
          unit: "currency",
          period: "weekly",
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: "goal_monthly_" + (Date.now() + 1),
          label: "Monthly Revenue Goal",
          targetValue: 2165,
          unit: "currency",
          period: "monthly",
          isActive: true,
          createdAt: new Date().toISOString(),
        }
      ];
      localStorage.setItem("comma_goals", JSON.stringify(demoGoals));

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

      await db.insert(goals).values({
        id: "goal_weekly_" + Date.now(),
        label: "Weekly Revenue Goal",
        targetValue: 500,
        unit: "currency",
        period: "weekly",
        isActive: true,
        createdAt: new Date(),
      });
      await db.insert(goals).values({
        id: "goal_monthly_" + (Date.now() + 1),
        label: "Monthly Revenue Goal",
        targetValue: 2165,
        unit: "currency",
        period: "monthly",
        isActive: true,
        createdAt: new Date(),
      });

      await get().loadSettings();
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

      set({
        isOnboardingCompleted: false,
        profile: DEFAULT_PROFILE,
        activeVehicle: null,
        isDemoMode: false,
        isLoading: false,
      });
    } catch (error) {
      console.error("Failed to clear sample data:", error);
      set({ isLoading: false });
    }
  },
}));
