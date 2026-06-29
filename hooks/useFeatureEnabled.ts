import { useAppContext } from "@/src/hooks/useAppContext";
import { type FeatureKey } from "@/src/registry/index";

export function useFeatureEnabled(key: FeatureKey): boolean {
  return useAppContext().features[key] ?? false;
}
