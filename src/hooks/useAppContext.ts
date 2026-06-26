import { useMemo } from "react";
import { useSettingsStore } from "@/store/useSettingsStore";
import {
  PERSONAS,
  getCountryDef,
  getPlatformsByCountry,
  FEATURE_MODULES,
  type PersonaConfig,
  type PersonaKey,
  type CountryDef,
  type VocabularyKey,
  type FeatureKey,
  type PlatformDef,
} from "@/src/registry/index";

export interface ResolvedAppContext {
  persona: PersonaConfig;
  country: CountryDef;           // existing type — not a new CountryConfig
  vocabulary: Record<VocabularyKey, string>;
  features: Record<FeatureKey, boolean>;
  platforms: PlatformDef[];      // filtered to country.defaultAvailablePlatforms
}

export function resolveAppContext(
  personaKey: PersonaKey,
  countryKey: string,
  userOverrides: Partial<Record<FeatureKey, boolean>>
): ResolvedAppContext {
  const persona = PERSONAS[personaKey] || PERSONAS.gig_worker;
  const country = getCountryDef(countryKey);        // existing helper

  // 1. Start with persona defaults
  const features = { ...persona.defaultFeatures };

  // 2. Apply country hard overrides
  for (const key of country.featureOverrides.force_on) {
    features[key] = true;
  }
  for (const key of country.featureOverrides.force_off) {
    features[key] = false;
  }

  // 3. Apply user overrides (country force_off wins)
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

  // 5. Merge vocabulary — country overrides win
  const vocabulary: Record<VocabularyKey, string> = {
    ...persona.vocabulary,
    ...country.vocabularyOverrides,
  };

  // 6. Filter platforms to this country
  const platforms = getPlatformsByCountry(countryKey);   // existing helper

  return { persona, country, vocabulary, features, platforms };
}

export function useAppContext(): ResolvedAppContext {
  const profile = useSettingsStore((state) => state.profile);
  const featureOverrides = useSettingsStore((state) => state.featureOverrides);

  return useMemo(
    () => resolveAppContext(profile.persona || "gig_worker", profile.country || "CA", featureOverrides || {}),
    [profile.persona, profile.country, featureOverrides]
  );
}
