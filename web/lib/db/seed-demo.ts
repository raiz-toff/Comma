import { eq } from "drizzle-orm";
import { getDb, getSqlDb } from "./index";
import { saveDbToIDB } from "./persist";
import { vehicles, shifts, expenses, goals, platforms, settings } from "./schema";

/**
 * Seeds the in-browser SQLite database with realistic sample data so a visitor
 * can explore the dashboard without signing in with Google or restoring a backup.
 *
 * Mirrors the mobile app's `loadSampleData` (store/useSettingsStore.ts) — same
 * profile, vehicles, 14 days of shifts, expenses, and goals — so the web demo
 * matches what a real user's data looks like.
 */

const DEMO_PROFILE = {
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
  operationalModelId: "delivery_fixed",
};

// Canonical platform definitions (from src/registry/platforms). The web reads
// label/color/active from the `platforms` table, so the demo must seed them.
const DEMO_PLATFORMS = [
  { id: "doordash", label: "DoorDash",      color: "#FF3008", textColor: "#FFFFFF", country: "CA", isActive: true,  sortPriority: 1 },
  { id: "ubereats",  label: "Uber Eats",     color: "#06C167", textColor: "#000000", country: "CA", isActive: true,  sortPriority: 2 },
  { id: "skip",      label: "SkipTheDishes", color: "#ED5A1F", textColor: "#FFFFFF", country: "CA", isActive: true,  sortPriority: 3 },
  { id: "instacart", label: "Instacart",     color: "#0AAD0A", textColor: "#FFFFFF", country: "CA", isActive: false, sortPriority: 4 },
];

const DEMO_VEHICLE_IDS = ["demo_vehicle_car", "demo_vehicle_scooter", "demo_vehicle_ebike"];

export async function seedDemoData(): Promise<void> {
  const db = await getDb();
  const now = new Date();

  // Wipe anything already present so re-seeding is idempotent.
  await db.delete(expenses);
  await db.delete(shifts);
  await db.delete(goals);
  await db.delete(vehicles);
  await db.delete(platforms);

  await db.insert(platforms).values(
    DEMO_PLATFORMS.map((p) => ({
      id: p.id,
      label: p.label,
      color: p.color,
      textColor: p.textColor,
      country: p.country,
      isActive: p.isActive,
      hourlyRate: "20",
      mileageRate: "0.62",
      sortPriority: p.sortPriority,
    })),
  );

  await db.insert(vehicles).values([
    { id: "demo_vehicle_car",     name: "Toyota Prius",     type: "hybrid",  isActive: true,  createdAt: now, make: "Toyota",    model: "Prius",   year: 2020, currentOdometer: 84200 },
    { id: "demo_vehicle_scooter", name: "Honda Ruckus",     type: "scooter", isActive: false, createdAt: now, make: "Honda",     model: "Ruckus",  year: 2022, currentOdometer: 6100 },
    { id: "demo_vehicle_ebike",   name: "Rad Power RadCity", type: "ebike",  isActive: false, createdAt: now, make: "Rad Power", model: "RadCity", year: 2023, currentOdometer: 1450 },
  ]);

  const demoShifts: (typeof shifts.$inferInsert)[] = [];
  const demoExpenses: (typeof expenses.$inferInsert)[] = [];
  const platformIds = ["doordash", "ubereats", "skip"];

  let shiftCounter = 0;
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const shiftDate = new Date();
    shiftDate.setDate(now.getDate() - dayOffset);

    const dayOfWeek = shiftDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
    const dayShiftsToCreate = isWeekend
      ? ["lunch", "dinner"]
      : dayOffset % 3 === 0
        ? ["lunch"]
        : ["lunch", "dinner"];

    for (const type of dayShiftsToCreate) {
      shiftCounter++;
      const shiftId = `demo_shift_${shiftCounter}`;
      const platform = platformIds[(dayOffset + (type === "lunch" ? 0 : 1)) % platformIds.length];

      const startHour = type === "lunch" ? 11 : 17;
      const durationHours = type === "lunch" ? 3.5 : 4.5;

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
        vehicleId: DEMO_VEHICLE_IDS[shiftCounter % 3],
        platform,
        startTime,
        endTime,
        grossRevenue: gross,
        tipsRevenue: tips,
        trackedMileage: activeMil,
        activeMileage: activeMil,
        deadMileage: deadMil,
        durationSeconds: duration,
        pausedSeconds: 0,
        notes: "[COMMA Sample Data]",
      });

      if (shiftCounter % 4 === 0) {
        demoExpenses.push({
          id: `demo_expense_${shiftCounter}`,
          shiftId,
          category: "fuel",
          amount: 45.0 + (shiftCounter % 15),
          date: shiftDate,
          isDeductible: true,
          merchant: "Petro-Canada",
          merchantNormalized: "petro-canada",
        });
      }
    }
  }

  if (demoShifts.length) await db.insert(shifts).values(demoShifts);
  if (demoExpenses.length) await db.insert(expenses).values(demoExpenses);

  await db.insert(goals).values([
    { id: "goal_weekly",  label: "Weekly Revenue Goal",  targetValue: 500,   unit: "currency", period: "weekly",  isActive: true, createdAt: now },
    { id: "goal_monthly", label: "Monthly Revenue Goal", targetValue: 2165,  unit: "currency", period: "monthly", isActive: true, createdAt: now },
    { id: "goal_yearly",  label: "Yearly Revenue Goal",  targetValue: 26000, unit: "currency", period: "yearly",  isActive: true, createdAt: now },
  ]);

  await db
    .insert(settings)
    .values({ key: "comma_profile", value: JSON.stringify(DEMO_PROFILE) })
    .onConflictDoUpdate({ target: settings.key, set: { value: JSON.stringify(DEMO_PROFILE) } });

  await db
    .insert(settings)
    .values({ key: "demo_mode", value: "true" })
    .onConflictDoUpdate({ target: settings.key, set: { value: "true" } });

  // Persist immediately so a page reload keeps the demo data.
  const sqlDb = getSqlDb();
  if (sqlDb) await saveDbToIDB(sqlDb.export());
}

export async function isDemoMode(): Promise<boolean> {
  const db = await getDb();
  const rows = await db.select().from(settings).where(eq(settings.key, "demo_mode")).limit(1);
  return rows[0]?.value === "true";
}
