/**
 * Ask this device for location if this device has never been asked.
 *
 * Mounted on the dashboard, which is where a driver lands after restoring onto a
 * new phone — the exact path that used to skip the request entirely, because a
 * restored vault marks onboarding complete and the wizard is what asks. See
 * src/services/permissions/deviceSetup.ts for why that is a money bug and not a
 * cosmetic one.
 *
 * Waits for `isOnboardingCompleted`, because that is precisely the state in which
 * the wizard will NOT run and so nothing else is going to ask. Silent in demo
 * mode: a driver kicking the tyres has no shift to track and should not be met
 * with an OS permission dialog.
 */

import { useEffect, useRef } from "react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { ensureDeviceLocationSetup } from "@/src/services/permissions/deviceSetup";

export function useDeviceLocationSetup(): void {
  const isOnboardingCompleted = useSettingsStore((s) => s.isOnboardingCompleted);
  const isDemoMode = useSettingsStore((s) => s.isDemoMode);
  const ran = useRef(false);

  useEffect(() => {
    if (!isOnboardingCompleted || isDemoMode || ran.current) return;
    // Guards this mount; deviceSetup's persisted marker guards across launches.
    ran.current = true;
    void ensureDeviceLocationSetup();
  }, [isOnboardingCompleted, isDemoMode]);
}
