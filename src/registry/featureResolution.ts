/**
 * Pure feature/context resolution — NO React, NO React Native, NO store.
 *
 * Extracted from useAppContext so the dependency-resolution rules (the fiddly part) can be
 * unit-tested without booting the app. The hook is now a thin reactive wrapper over this.
 */

// Imported from the leaf modules, NOT the `registry/index` barrel: the barrel also re-exports
// the badge SVGs, which pull in react-native — that would drag the whole RN runtime into what
// is meant to be pure, dependency-free logic (and makes it untestable outside the app).
import { getCountryDef, type CountryDef } from "./countries/index";
import { type VocabularyKey } from "./vocabulary";
import { getPlatformsByCountry, type PlatformDef } from "./platforms/index";
import { type FeatureKey } from "./modules";
import {
  getOperationalModel,
  type OperationalModelDef,
  type OperationalModelId,
} from "./operationalModels";
import { resolveFeatures, GIG_DRIVER_DEFAULTS } from "./featureFlags";

export { resolveFeatures, GIG_DRIVER_DEFAULTS };

export interface ResolvedAppContext {
  operationalModel: OperationalModelDef;
  country: CountryDef;
  vocabulary: Record<VocabularyKey, string>;
  features: Record<FeatureKey, boolean>;
  platforms: PlatformDef[];
}

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

  const features = resolveFeatures(countryKey, userOverrides);

  // 5. Build vocabulary from operational model + country overrides
  const vocabulary = buildVocabulary(model, country.vocabularyOverrides || {});

  // 6. Filter platforms to this country
  const platforms = getPlatformsByCountry(countryKey);

  return { operationalModel: model, country, vocabulary, features, platforms };
}
