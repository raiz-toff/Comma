/**
 * Profile ↔ sync bridge (design doc "bucket b", built 2026-07-04).
 *
 * The user's profile (name, country, units, goals, theme, onboarding-complete…) lives
 * device-locally in the `settings` KV (one JSON blob under key `profile` + the
 * `onboarding_completed` flag). This bridge mirrors it into the SYNCED `profile` table —
 * one row per canonical key, JSON-encoded value, standard sync columns — so the cloud copy
 * is a TOTAL user snapshot: a fresh device that connects gets records AND identity, no
 * setup wizard needed.
 *
 * Flow (wired in syncNow, both directions each run):
 *   1. `exportLocalProfile()` BEFORE pull — stamp local changes into the table first, so
 *      the record engine's per-row LWW protects fresh local edits against older pulls.
 *   2. `importSyncedProfile()` AFTER pull — write newly-won rows back into the local KV.
 * Convergence: both sides compare by VALUE, so a bridge write never re-stamps unchanged
 * keys and the loop settles immediately.
 *
 * Deliberately NOT bridged (stay device-local): sync_* identity/cursors (syncing them
 * would break sync itself), demo_mode, active-shift scratch, preferred vehicle, GPS data.
 */

import { Platform } from "react-native";
import { eq } from "drizzle-orm";
import { db } from "../../database/client";
import { settings, profile } from "../../database/schema";
import { stampInsert, stampUpdate, isNotDeleted } from "../../database/syncedWrites";

const isWeb = Platform.OS === "web";

/** canonical key → getter from the local DriverProfile JSON */
const FROM_LOCAL: Record<string, (p: any) => unknown> = {
  displayName: (p) => p.displayName,
  country: (p) => p.country,
  region: (p) => p.taxRegion,
  distanceUnit: (p) => p.distanceUnit,
  weeklyGoal: (p) => p.weeklyGoal,
  monthlyGoal: (p) => p.monthlyGoal,
  annualGoal: (p) => p.annualGoal,
  taxWithholdingPct: (p) => p.taxWithholdingPct,
  hstRegistered: (p) => p.hstRegistered,
  theme: (p) => p.theme,
  accentColor: (p) => p.accentColor,
  weekStartDay: (p) => p.locale?.weekStartDay,
  timeFormat: (p) => p.locale?.timeFormat,
  avatarType: (p) => p.avatarType,
  avatarData: (p) => p.avatarData,
  workSchedulePreset: (p) => p.workSchedulePreset,
  operationalModelId: (p) => p.operationalModelId,
  selectedPlatforms: (p) => p.selectedPlatforms,
};

/** canonical key → patch applied onto the local DriverProfile JSON */
const TO_LOCAL: Record<string, (p: any, v: any) => void> = {
  displayName: (p, v) => (p.displayName = v),
  country: (p, v) => (p.country = v),
  region: (p, v) => (p.taxRegion = v),
  distanceUnit: (p, v) => (p.distanceUnit = v),
  weeklyGoal: (p, v) => (p.weeklyGoal = v),
  monthlyGoal: (p, v) => (p.monthlyGoal = v),
  annualGoal: (p, v) => (p.annualGoal = v),
  taxWithholdingPct: (p, v) => (p.taxWithholdingPct = v),
  hstRegistered: (p, v) => (p.hstRegistered = v),
  theme: (p, v) => (p.theme = v),
  accentColor: (p, v) => (p.accentColor = v),
  weekStartDay: (p, v) => ((p.locale ??= {}).weekStartDay = v),
  timeFormat: (p, v) => ((p.locale ??= {}).timeFormat = v),
  avatarType: (p, v) => (p.avatarType = v),
  avatarData: (p, v) => (p.avatarData = v),
  workSchedulePreset: (p, v) => (p.workSchedulePreset = v),
  operationalModelId: (p, v) => (p.operationalModelId = v),
  selectedPlatforms: (p, v) => (p.selectedPlatforms = v),
};

async function readSetting(key: string): Promise<string | null> {
  if (isWeb) return localStorage.getItem(`comma_${key}`);
  const row = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return row[0]?.value ?? null;
}

async function writeSetting(key: string, value: string): Promise<void> {
  if (isWeb) {
    localStorage.setItem(`comma_${key}`, value);
    return;
  }
  await db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
}

async function readProfileRows(): Promise<Array<{ key: string; value: string; syncDeletedAt: number | null }>> {
  if (isWeb) {
    const raw = localStorage.getItem("comma_profile_sync");
    return raw ? JSON.parse(raw) : [];
  }
  return (await db.select().from(profile)) as any;
}

/** Mirror local profile → synced table. Only keys whose VALUE changed get (re)stamped. */
export async function exportLocalProfile(): Promise<void> {
  const rawProfile = await readSetting("profile");
  if (!rawProfile) return; // not onboarded yet — nothing to export
  let local: any;
  try {
    local = JSON.parse(rawProfile);
  } catch {
    return;
  }
  const onboarded = (await readSetting("onboarding_completed")) === "true";

  const canonical: Record<string, unknown> = { onboardingComplete: onboarded };
  for (const [key, get] of Object.entries(FROM_LOCAL)) {
    const v = get(local);
    if (v !== undefined) canonical[key] = v;
  }

  const rows = await readProfileRows();
  const byKey = new Map(rows.map((r) => [r.key, r]));
  for (const [key, v] of Object.entries(canonical)) {
    const value = JSON.stringify(v);
    const existing = byKey.get(key);
    if (existing && existing.value === value && existing.syncDeletedAt == null) continue;
    if (isWeb) {
      const idx = rows.findIndex((r) => r.key === key);
      const next = stampUpdate({ ...(idx >= 0 ? rows[idx] : { key }), key, value, syncDeletedAt: null });
      if (idx >= 0) rows[idx] = next as any;
      else rows.push(stampInsert({ key, value }) as any);
    } else if (existing) {
      await db.update(profile).set(stampUpdate({ value, syncDeletedAt: null })).where(eq(profile.key, key));
    } else {
      await db.insert(profile).values(stampInsert({ key, value }));
    }
  }
  if (isWeb) localStorage.setItem("comma_profile_sync", JSON.stringify(rows));
}

/** Write synced profile rows → local KV. Returns true when anything changed locally. */
export async function importSyncedProfile(): Promise<boolean> {
  const rows = (await readProfileRows()).filter(isNotDeleted);
  if (!rows.length) return false;

  const rawProfile = await readSetting("profile");
  let local: any = {};
  try {
    local = rawProfile ? JSON.parse(rawProfile) : {};
  } catch {
    local = {};
  }

  let changed = false;
  let completeOnboarding = false;
  for (const row of rows) {
    let v: unknown;
    try {
      v = JSON.parse(row.value);
    } catch {
      continue;
    }
    if (row.key === "onboardingComplete") {
      // One-way: a synced profile can COMPLETE onboarding, never un-complete it.
      if (v === true && (await readSetting("onboarding_completed")) !== "true") completeOnboarding = true;
      continue;
    }
    const apply = TO_LOCAL[row.key];
    if (!apply) continue; // app-specific key from another platform — leave for its owner
    const before = JSON.stringify(FROM_LOCAL[row.key]?.(local));
    if (before === row.value) continue;
    apply(local, v);
    changed = true;
  }

  if (changed) await writeSetting("profile", JSON.stringify(local));
  if (completeOnboarding) {
    await writeSetting("onboarding_completed", "true");
    changed = true;
  }
  return changed;
}
