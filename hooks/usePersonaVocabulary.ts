import { useSettingsStore } from "../store/useSettingsStore";
import { PERSONAS, RIDESHARE_VOCABULARY, DELIVERY_VOCABULARY, BOTH_VOCABULARY } from "../src/registry/personas";
import type { VocabularyKey } from "../src/registry/vocabulary";

export function usePersonaVocabulary() {
  const profile = useSettingsStore((s) => s.profile);
  const persona = profile?.persona ?? "platform_driver";
  const transportType = profile?.transportType ?? "both";

  const cfg = PERSONAS[persona] ?? PERSONAS.platform_driver;

  return (key: VocabularyKey): string => {
    if (persona === "platform_driver") {
      if (transportType === "passengers") {
        return RIDESHARE_VOCABULARY[key] ?? "";
      } else if (transportType === "delivery") {
        return DELIVERY_VOCABULARY[key] ?? "";
      } else {
        return BOTH_VOCABULARY[key] ?? "";
      }
    }
    return cfg.vocabulary[key] ?? "";
  };
}
