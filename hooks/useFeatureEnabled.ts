import { useSettingsStore } from "../store/useSettingsStore";
import { PERSONAS } from "../src/registry/personas";
import type { FeatureKey } from "../src/registry/modules";

export function useFeatureEnabled(key: FeatureKey): boolean {
  const profile = useSettingsStore((s) => s.profile);
  const featureOverrides = useSettingsStore((s) => s.featureOverrides || {});
  const persona = profile?.persona ?? "platform_driver";
  const cfg = PERSONAS[persona] ?? PERSONAS.platform_driver;
  const defaultVal = cfg.defaultFeatures[key] ?? false;
  return key in featureOverrides ? !!featureOverrides[key] : defaultVal;
}
