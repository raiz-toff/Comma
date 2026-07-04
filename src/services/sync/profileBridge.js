/**
 * Profile ↔ sync bridge (design doc "bucket b", built 2026-07-04). Web twin of mobile's
 * `src/services/sync/profileBridge.ts` — see that file's doc for the model. Bridges the
 * `users` id-1 row ↔ the synced `profile` KV table so the cloud copy carries the WHOLE user
 * (identity + preferences + onboarding flag), not just records.
 *
 * Unit note: web stores goals in CENTS on the users row; the canonical wire values are
 * DOLLARS (mobile's unit), converted at this boundary. Keys only one platform understands
 * (e.g. mobile's operationalModelId) simply rest in the table untouched.
 */

import { db } from '../../core/db.js';

/** canonical key → read from the users row (undefined = don't export) */
const FROM_USER = {
  displayName: (u) => u.displayName,
  country: (u) => u.countryId,
  region: (u) => u.provinceId,
  weeklyGoal: (u) => (u.weeklyGoal != null ? Math.round(Number(u.weeklyGoal) || 0) / 100 : undefined),
  monthlyGoal: (u) => (u.monthlyGoal != null ? Math.round(Number(u.monthlyGoal) || 0) / 100 : undefined),
  annualGoal: (u) => (u.annualGoal != null ? Math.round(Number(u.annualGoal) || 0) / 100 : undefined),
  taxWithholdingPct: (u) => u.taxWithholdingPct,
  hstRegistered: (u) => u.hstRegistered,
  theme: (u) => u.theme,
  weekStartDay: (u) => u.locale?.weekStartDay,
  timeFormat: (u) => u.locale?.timeFormat,
  avatarType: (u) => u.avatarType,
  avatarData: (u) => u.avatarData,
  selectedPlatforms: (u) => (Array.isArray(u.platforms) ? u.platforms : undefined),
  onboardingComplete: (u) => u.onboardingComplete === true,
};

/** canonical key → patch onto the users row */
const TO_USER = {
  displayName: (u, v) => (u.displayName = v),
  country: (u, v) => (u.countryId = v),
  region: (u, v) => (u.provinceId = v),
  weeklyGoal: (u, v) => (u.weeklyGoal = Math.round((Number(v) || 0) * 100)),
  monthlyGoal: (u, v) => (u.monthlyGoal = Math.round((Number(v) || 0) * 100)),
  annualGoal: (u, v) => (u.annualGoal = Math.round((Number(v) || 0) * 100)),
  taxWithholdingPct: (u, v) => (u.taxWithholdingPct = v),
  hstRegistered: (u, v) => (u.hstRegistered = v === true),
  theme: (u, v) => (u.theme = v),
  weekStartDay: (u, v) => ((u.locale ??= {}).weekStartDay = v),
  timeFormat: (u, v) => ((u.locale ??= {}).timeFormat = v),
  avatarType: (u, v) => (u.avatarType = v),
  avatarData: (u, v) => (u.avatarData = v),
  selectedPlatforms: (u, v) => {
    if (Array.isArray(v)) {
      u.platforms = v.map(String);
      if (!v.includes(u.primaryPlatform)) u.primaryPlatform = v[0] || null;
    }
  },
  onboardingComplete: (u, v) => {
    // One-way: a synced profile can COMPLETE onboarding, never un-complete it.
    if (v === true) u.onboardingComplete = true;
  },
};

/** Mirror users row → synced table. Only keys whose VALUE changed get (re)stamped. */
export async function exportLocalProfile() {
  const user = await db.users.get(1);
  if (!user || user.onboardingComplete !== true) return; // nothing meaningful to export yet

  const rows = await db.profile.toArray();
  const byKey = new Map(rows.map((r) => [r.key, r]));
  for (const [key, get] of Object.entries(FROM_USER)) {
    const v = get(user);
    if (v === undefined) continue;
    const value = JSON.stringify(v);
    const existing = byKey.get(key);
    if (existing && existing.value === value && existing.syncDeletedAt == null) continue;
    await db.profile.put({
      ...(existing || {}),
      key,
      value,
      syncUpdatedAt: Date.now(),
      syncDeletedAt: null,
    });
  }
}

/** Write synced profile rows → users row. Returns true when anything changed locally. */
export async function importSyncedProfile() {
  const rows = (await db.profile.toArray()).filter((r) => r.syncDeletedAt == null);
  if (!rows.length) return false;
  const user = (await db.users.get(1)) || { id: 1 };

  let changed = false;
  for (const row of rows) {
    const apply = TO_USER[row.key];
    if (!apply) continue; // other platform's key — leave it for its owner
    let v;
    try {
      v = JSON.parse(row.value);
    } catch {
      continue;
    }
    const before = JSON.stringify(FROM_USER[row.key]?.(user));
    if (before === row.value) continue;
    apply(user, v);
    changed = true;
  }

  if (changed) {
    user.updatedAt = new Date().toISOString();
    await db.users.put({ ...user, id: 1 });
  }
  return changed;
}
