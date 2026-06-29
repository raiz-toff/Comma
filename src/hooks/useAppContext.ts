import { useMemo } from "react";
import { useSettingsStore } from "@/store/useSettingsStore";
import {
  getCountryDef,
  getPlatformsByCountry,
  FEATURE_MODULES,
  getOperationalModel,
  type CountryDef,
  type VocabularyKey,
  type FeatureKey,
  type PlatformDef,
  type OperationalModelDef,
  type OperationalModelId,
} from "@/src/registry/index";

export interface ResolvedAppContext {
  operationalModel: OperationalModelDef;
  country: CountryDef;
  vocabulary: Record<VocabularyKey, string>;
  features: Record<FeatureKey, boolean>;
  platforms: PlatformDef[];
}

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
  gamification: false,
  pdf_reports: false,
  csv_import: false,
  android_widget: false,
  business_personal_split: false,
  mileage_log_export: false,
};

function buildVocabulary(
  model: OperationalModelDef,
  countryOverrides: Partial<Record<VocabularyKey, string>>
): Record<VocabularyKey, string> {
  const s = model.sessionTerm; // "Shift", "Session", "Block", "Batch"
  const sLow = s.toLowerCase();

  const base: Record<VocabularyKey, string> = {
    session: sLow,
    session_plural: sLow + "s",
    platform: "Platform",
    active_miles: "Active Miles",
    dead_miles: "Dead Miles",
    revenue: "Earnings",
    start_cta: `Start ${s}`,
    end_cta: `End ${s}`,
    history_tab: s + "s",
    active_indicator: `Active ${s}`,
    no_sessions_yet: `No ${sLow}s yet`,
  };

  return { ...base, ...countryOverrides };
}

export function resolveAppContext(
  operationalModelId: OperationalModelId,
  countryKey: string,
  userOverrides: Partial<Record<FeatureKey, boolean>>
): ResolvedAppContext {
  const model = getOperationalModel(operationalModelId);
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

  // 4. Resolve dependency chain — enabling X auto-enables its requires[]
  for (const mod of FEATURE_MODULES) {
    if (features[mod.key]) {
      for (const dep of mod.requires) {
        features[dep] = true;
      }
    }
  }

  // 5. Build vocabulary from operational model + country overrides
  const vocabulary = buildVocabulary(model, country.vocabularyOverrides || {});

  // 6. Filter platforms to this country
  const platforms = getPlatformsByCountry(countryKey);

  return { operationalModel: model, country, vocabulary, features, platforms };
}

export function useAppContext(): ResolvedAppContext {
  const profile = useSettingsStore((state) => state.profile);
  const featureOverrides = useSettingsStore((state) => state.featureOverrides);

  return useMemo(
    () =>
      resolveAppContext(
        profile.operationalModelId || "delivery_fixed",
        profile.country || "CA",
        featureOverrides || {}
      ),
    [profile.operationalModelId, profile.country, featureOverrides]
  );
}
