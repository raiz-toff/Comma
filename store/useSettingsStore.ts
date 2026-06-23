import { create } from "zustand";
import { Platform } from "react-native";
import { db } from "../src/database/client";
import { settings, vehicles, shifts, expenses, goals } from "../src/database/schema";
import { eq } from "drizzle-orm";

const isWeb = Platform.OS === "web";

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
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  isOnboardingCompleted: false,
  profile: DEFAULT_PROFILE,
  activeVehicle: null,
  isLoading: true,
  isDemoMode: false,
  activePlatformFilter: "all",

  setActivePlatformFilter: (filter: string) => set({ activePlatformFilter: filter }),

  loadSettings: async () => {
    set({ isLoading: true });
    if (isWeb) {
      // In-memory or localStorage fallback for Web
      try {
        const rawCompleted = localStorage.getItem("comma_onboarding_completed");
        const rawProfile = localStorage.getItem("comma_profile");
        const rawVehicle = localStorage.getItem("comma_vehicle");
        const rawDemoMode = localStorage.getItem("comma_demo_mode");
        
        set({
          isOnboardingCompleted: rawCompleted === "true",
          profile: rawProfile ? JSON.parse(rawProfile) : DEFAULT_PROFILE,
          activeVehicle: rawVehicle ? JSON.parse(rawVehicle) : null,
          isDemoMode: rawDemoMode === "true",
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

      const onboardingCompleted = onboardingCompletedRow[0]?.value === "true";
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

      set({
        isOnboardingCompleted: onboardingCompleted,
        profile,
        activeVehicle,
        isDemoMode,
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
      const vehicleId = "demo_vehicle_1";
      const demoVehicle = {
        id: vehicleId,
        name: "Toyota Prius (Demo)",
        type: "hybrid",
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem("comma_vehicle", JSON.stringify(demoVehicle));
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

      for (let i = 1; i <= 20; i++) {
        const shiftDate = new Date();
        shiftDate.setDate(now.getDate() - i);

        const startTime = new Date(shiftDate);
        startTime.setHours(11, 0, 0, 0);
        const endTime = new Date(shiftDate);
        endTime.setHours(15, 0, 0, 0);

        const platform = platforms[i % platforms.length];
        const shiftId = `demo_shift_${i}`;
        const gross = 80 + (i * 7) % 40;
        const tips = 15 + (i * 3) % 15;
        const activeMil = 20 + (i * 4) % 20;
        const deadMil = 5 + (i * 2) % 10;
        const duration = 4 * 3600; // 4 hours

        demoShifts.push({
          id: shiftId,
          vehicleId: vehicleId,
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
        });

        if (i % 5 === 0) {
          demoExpenses.push({
            id: `demo_expense_${i}`,
            shiftId: shiftId,
            category: "fuel",
            amount: 45.5 + (i * 1.5),
            date: shiftDate.toISOString(),
            isDeductible: true,
          });
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

      const existingVehicles = await db.select().from(vehicles).limit(1);
      let vehicleId = existingVehicles[0]?.id;
      if (!vehicleId) {
        vehicleId = "demo_vehicle_1";
        await db.insert(vehicles).values({
          id: vehicleId,
          name: "Toyota Prius (Demo)",
          type: "hybrid",
          isActive: true,
          createdAt: new Date(),
          make: "Toyota",
          model: "Prius",
          year: 2020,
        });
      }

      const now = new Date();
      const demoShifts = [];
      const demoExpenses = [];
      const platforms = ["doordash", "ubereats", "skip"];

      for (let i = 1; i <= 20; i++) {
        const shiftDate = new Date();
        shiftDate.setDate(now.getDate() - i);

        const startTime = new Date(shiftDate);
        startTime.setHours(11, 0, 0, 0);
        const endTime = new Date(shiftDate);
        endTime.setHours(15, 0, 0, 0);

        const platform = platforms[i % platforms.length];
        const shiftId = `demo_shift_${i}`;
        const gross = 80 + (i * 7) % 40;
        const tips = 15 + (i * 3) % 15;
        const activeMil = 20 + (i * 4) % 20;
        const deadMil = 5 + (i * 2) % 10;
        const duration = 4 * 3600;

        demoShifts.push({
          id: shiftId,
          vehicleId: vehicleId,
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
        });

        if (i % 5 === 0) {
          demoExpenses.push({
            id: `demo_expense_${i}`,
            shiftId: shiftId,
            category: "fuel",
            amount: 45.5 + (i * 1.5),
            date: shiftDate,
            isDeductible: true,
          });
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
