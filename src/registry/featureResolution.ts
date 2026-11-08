/**
 * Pure app-context resolution (country, vocabulary, platforms) — NO React, NO store.
 * Imports leaf modules rather than the `registry/index` barrel to stay dependency-free.
 */

import { getCountryDef, type CountryDef } from "./countries/index";
import { type VocabularyKey } from "./vocabulary";
import { getPlatformsByCountry, type PlatformDef } from "./platforms/index";
import {
getOperationalModel,
type OperationalModelDef,
type OperationalModelId,
} from "./operationalModels";

export interface ResolvedAppContext {
  operationalModel: OperationalModelDef;
  country: CountryDef;
  vocabulary: Record<VocabularyKey, string>;
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
  countryKey: string
): ResolvedAppContext {
  const model = getOperationalModel(operationalModelId);
  const country = getCountryDef(countryKey);

  // Build vocabulary from operational model + country overrides
  const vocabulary = buildVocabulary(model, country.vocabularyOverrides || {});

  // Filter platforms to this country
  const platforms = getPlatformsByCountry(countryKey);

  return { operationalModel: model, country, vocabulary, platforms };
}
