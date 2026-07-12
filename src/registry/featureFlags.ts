/**
 * Pure feature-flag resolution. NO React, NO React Native, NO store, NO platform logos —
 * imports only the country + module registries, so these rules stay unit-testable.
 */

import { getCountryDef } from "./countries/index";
import { FEATURE_MODULES, type FeatureKey } from "./modules";

// Default features for all gig/delivery workers — country and user can override
export const GIG_DRIVER_DEFAULTS: Record<FeatureKey, boolean> = {
  session_tracking_gps: true,
  session_tracking_manual: true,
  expense_tracking: true,
  analytics_basic: true,
  vehicle_profiles: true,
  csv_export: true,
  google_drive_backup: true,
  analytics_advanced: true,
  tax_workspace: true,
  goals: true,
  schedule: false,
  gamification: true, // Bulletin Mode — celebrate milestones/streaks (data already computes)
  pdf_reports: false,
  csv_import: false,
  android_widget: false,
  business_personal_split: false,
  mileage_log_export: false,
};

/**
 * Resolve the FEATURE FLAGS for a country + the user's overrides.
 *
 * Split out from resolveAppContext (which also needs platforms, and therefore React Native
 * logo components) so these rules — the fiddly, bug-prone part — stay pure and unit-testable.
 */
export function resolveFeatures(
  countryKey: string,
  userOverrides: Partial<Record<FeatureKey, boolean>>
): Record<FeatureKey, boolean> {
  const country = getCountryDef(countryKey);

  // 1. Start with delivery driver defaults
  const features = { ...GIG_DRIVER_DEFAULTS };

  // 2. Apply country hard overrides
  for (const key of country.featureOverrides.force_on) {
    features[key] = true;
  }
  for (const key of country.featureOverrides.force_off) {
    features[key] = false;
  }

  // 3. Apply user overrides (country force_off always wins)
  for (const [key, val] of Object.entries(userOverrides)) {
    const fKey = key as FeatureKey;
    if (!country.featureOverrides.force_off.includes(fKey)) {
      features[fKey] = !!val;
    }
  }

  // A feature the user (or the country) has explicitly switched OFF. Step 4 must never
  // resurrect one of these — that's what silently pinned "goals" on forever: `gamification`
  // defaults on, is NOT user-toggleable, and declares requires:['goals'], so the old
  // dependency pass flipped goals back to true immediately after the user turned it off.
  // The Settings switch (which reads the raw override) showed OFF while the drawer (which
  // reads the resolved context) still showed Goals.
  const blocked = new Set<FeatureKey>(country.featureOverrides.force_off);
  for (const [key, val] of Object.entries(userOverrides)) {
    const fKey = key as FeatureKey;
    if (val === false && !country.featureOverrides.force_on.includes(fKey)) {
      blocked.add(fKey);
    }
  }

  // 4. Resolve the dependency chain.
  //
  // Enabling X auto-enables its requires[] — but ONLY for dependencies the user never
  // touched. When a dependency is explicitly blocked, we disable the DEPENDENT instead
  // (cascade down), because that's the direction that honours the user's choice: "no Goals
  // screen" must mean the goal-derived badges go too, not that Goals comes back.
  //
  // Iterated to a fixpoint so transitive chains settle (A requires B requires C).
  for (let pass = 0; pass < FEATURE_MODULES.length + 1; pass++) {
    let changed = false;

    for (const mod of FEATURE_MODULES) {
      if (blocked.has(mod.key)) {
        if (features[mod.key]) {
          features[mod.key] = false;
          changed = true;
        }
        continue;
      }
      if (!features[mod.key]) continue;

      const blockedDep = mod.requires.find((dep) => blocked.has(dep));
      if (blockedDep) {
        // Its dependency is off by user/country choice → this module can't run either.
        features[mod.key] = false;
        blocked.add(mod.key); // and it now blocks anything that depends on IT
        changed = true;
        continue;
      }

      for (const dep of mod.requires) {
        if (!features[dep]) {
          features[dep] = true;
          changed = true;
        }
      }
    }

    if (!changed) break;
  }

  return features;
}
