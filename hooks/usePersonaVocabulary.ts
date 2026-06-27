import { useSettingsStore } from "../store/useSettingsStore";
import { PERSONAS } from "../src/registry/personas";
import type { VocabularyKey } from "../src/registry/vocabulary";

export function usePersonaVocabulary() {
  const persona = useSettingsStore((s) => s.profile?.persona ?? "gig_worker");
  const cfg = PERSONAS[persona] ?? PERSONAS.gig_worker;
  return (key: VocabularyKey): string => cfg.vocabulary[key] ?? "";
}
