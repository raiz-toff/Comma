/**
 * Reactive wrapper over the pure resolver in registry/featureResolution.ts.
 * Re-exports its API so existing import sites (utils/reportGenerator, app/settings) keep working.
 */

import { useMemo } from "react";
import { useSettingsStore } from "@/store/useSettingsStore";
import {
  resolveAppContext,
  GIG_DRIVER_DEFAULTS,
  type ResolvedAppContext,
} from "@/src/registry/featureResolution";

export { resolveAppContext, GIG_DRIVER_DEFAULTS, type ResolvedAppContext };

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
