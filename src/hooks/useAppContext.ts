/** Reactive wrapper over the pure resolver in registry/featureResolution.ts. */

import { useMemo } from "react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { resolveAppContext, type ResolvedAppContext } from "@/src/registry/featureResolution";

export { resolveAppContext, type ResolvedAppContext };

export function useAppContext(): ResolvedAppContext {
  const profile = useSettingsStore((state) => state.profile);

  return useMemo(
    () => resolveAppContext(profile.operationalModelId || "delivery_fixed", profile.country || "CA"),
    [profile.operationalModelId, profile.country]
  );
}
