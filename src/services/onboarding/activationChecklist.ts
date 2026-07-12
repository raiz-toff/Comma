/**
 * The activation checklist — where the setup we cut from the wizard actually lives.
 *
 * Nothing here is asked before the driver has seen their first number, because none of it is an
 * input to that number. Each item is instead surfaced on the dashboard next to the value it
 * unlocks, so the ask arrives with a reason attached.
 *
 * Done-ness is DERIVED FROM THE TABLE THAT ACTUALLY STORES THE THING, never from the settings
 * profile. That distinction matters and got this wrong once already: active platforms live in the
 * `platforms` table (isActive), and the weekly target is a row in the `goals` table — the profile
 * copies are stale defaults written at onboarding. Deriving from the profile meant the driver
 * could go set a goal, come back, and find the item still unticked, because the thing they changed
 * was never the thing being read.
 *
 * The card cannot be dismissed: it stays until every item is genuinely done, because a driver
 * who waves it away is exactly the one who forgets to come back and set any of it up.
 */

import { Platform } from "react-native";
import { eq } from "drizzle-orm";
import { db } from "../../database/client";
import { settings } from "../../database/schema";
import { isSyncEnabled } from "../../database/syncState";
import { getLocationAccessLevel } from "../permissions/locationAccess";
import { getVehicles } from "../../database/queries/vehicles";
import { getDBPlatforms } from "../../database/queries/platforms";
import { getGoalsWithProgress } from "../../database/queries/goals";
import { type DriverProfile } from "../../../store/useSettingsStore";

const isWeb = Platform.OS === "web";

/**
 * Items the driver has explicitly completed, for the ones we cannot infer from state alone.
 *
 * The goal is the case in point: onboarding seeds a 500 default, so "target !== 500" is the only
 * signal available — which would trap a driver who genuinely *wants* 500 with an item they can
 * never tick. Since the card can no longer be dismissed, that trap would be permanent. The Goals
 * screen calls markActivationDone("goal") when it saves, so any deliberate choice counts.
 */
const DONE_KEY = "activation_checklist_done";

/** The weekly goal onboarding writes by default; used to tell "untouched" from "chosen". */
export const DEFAULT_WEEKLY_GOAL = 500;

export type ActivationItemId = "platforms" | "vehicle" | "goal" | "gps" | "backup";

export type ActivationItem = {
  id: ActivationItemId;
  title: string;
  /** Why it's worth doing — stated as the value unlocked, never as a chore. */
  detail: string;
  done: boolean;
  /** The screen that actually configures this. Omitted for gps, which is handled in-place. */
  route?: string;
};

async function readDoneOverrides(): Promise<Set<string>> {
  let raw: string | null = null;
  if (isWeb) {
    raw = localStorage.getItem(`comma_${DONE_KEY}`);
  } else {
    const row = await db.select().from(settings).where(eq(settings.key, DONE_KEY)).limit(1);
    raw = row[0]?.value ?? null;
  }
  try {
    const list = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.map(String) : []);
  } catch {
    return new Set();
  }
}

/** Called by the screen that satisfies an item, at the moment it actually saves. */
export async function markActivationDone(id: ActivationItemId): Promise<void> {
  const done = await readDoneOverrides();
  if (done.has(id)) return;
  done.add(id);
  const value = JSON.stringify([...done]);

  if (isWeb) {
    localStorage.setItem(`comma_${DONE_KEY}`, value);
    return;
  }
  await db
    .insert(settings)
    .values({ key: DONE_KEY, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

/**
 * Only a *full* grant counts. "While using the app" reads like a yes but pauses tracking the
 * moment the driver switches to their delivery app — ticking this off for a foreground-only grant
 * would tell them mileage tracking is handled when it quietly isn't.
 */
async function hasFullLocationAccess(): Promise<boolean> {
  if (isWeb) return false;
  return (await getLocationAccessLevel()) === "full";
}

/** The weekly earnings target, read from the goals table — the row the Goals screen writes. */
async function getWeeklyGoalTarget(): Promise<number | null> {
  try {
    const goals = await getGoalsWithProgress();
    const weekly = goals.find(
      (g: any) => g.period === "weekly" && (g.unit === "currency" || g.id === "goal_weekly")
    );
    const target = Number(weekly?.targetValue);
    return Number.isFinite(target) ? target : null;
  } catch {
    return null;
  }
}

/** Active platforms, read from the platforms table — the rows the Settings screen writes. */
async function countActivePlatforms(country: string): Promise<number> {
  try {
    const rows = await getDBPlatforms(country);
    return rows.filter((p: any) => p.isActive).length;
  } catch {
    return 0;
  }
}

export async function buildActivationItems(
  profile: DriverProfile | null
): Promise<ActivationItem[]> {
  const country = profile?.country ?? "CA";

  const [vehicles, syncOn, gpsOn, weeklyGoal, activePlatforms, doneOverrides] = await Promise.all([
    getVehicles(),
    isSyncEnabled(),
    hasFullLocationAccess(),
    getWeeklyGoalTarget(),
    countActivePlatforms(country),
    readDoneOverrides(),
  ]);

  // Onboarding creates one placeholder gas car so the app has something to hang shifts and tax
  // profiles off. It counts as "told us" once ANY vehicle carries real details — checking only the
  // active/first one meant a driver who added a second vehicle still couldn't tick this off,
  // because the untouched placeholder was the one being read.
  const vehicleIsReal = vehicles.some((v: any) => String(v?.make ?? "").trim());

  const distanceUnit = profile?.distanceUnit ?? "km";

  return [
    {
      id: "platforms",
      title: "Add your other apps",
      detail: "Compare what each one really pays you per hour.",
      done: doneOverrides.has("platforms") || activePlatforms > 1,
      route: "/setup/platforms",
    },
    {
      id: "vehicle",
      title: "Tell us your real vehicle",
      detail: `We assumed a gas car. Your actual one sets the right rate per ${distanceUnit}.`,
      done: doneOverrides.has("vehicle") || vehicleIsReal,
      route: "/setup/vehicle",
    },
    {
      id: "goal",
      title: "Set a weekly goal",
      detail: "Track every shift against a target instead of a blank week.",
      // Either they changed it from the seeded default, or they saved the Goals screen at all —
      // the latter so that deliberately choosing 500 still counts. See DONE_KEY.
      done: doneOverrides.has("goal") || (weeklyGoal != null && weeklyGoal !== DEFAULT_WEEKLY_GOAL),
      route: "/setup/goal",
    },
    {
      id: "gps",
      title: "Track shifts automatically",
      detail:
        'Comma clocks your hours and distance for you. Needs "Allow all the time" to keep going while you drive.',
      done: gpsOn,
    },
    {
      id: "backup",
      title: "Back up your data",
      detail: "Everything is on this phone only. One tap puts a copy in your Drive.",
      done: syncOn,
      route: "/settings/backup",
    },
  ];
}
