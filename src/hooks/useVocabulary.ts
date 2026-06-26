import { useAppContext } from "./useAppContext";
import { type VocabularyKey } from "@/src/registry/index";

export function useVocabulary() {
  const { vocabulary } = useAppContext();
  return {
    t: (key: VocabularyKey): string => vocabulary[key] || "",
  };
}
