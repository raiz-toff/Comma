/**
 * Automatic sync triggers (cloud-sync P4 — see sync-design.md §4).
 *
 * Mounted once at the app root. Listens to AppState session boundaries — NOT a
 * setInterval loop — and drives sync per the user's chosen cadence:
 *   - FOREGROUND (background → active): PULL + merge (the cheap "check on open"),
 *     and also PUSH if a scheduled push is due.
 *   - BACKGROUND (active → background): PUSH if a scheduled push is due (best-effort;
 *     the OS may cut background time short — the next foreground catches up).
 *
 * Every trigger is gated: sync must be enabled, Drive connected, and a backup password
 * present (it's the encryption key). If any is missing the trigger is a silent no-op —
 * background sync must never prompt or crash. Errors are swallowed (logged), since an
 * auto-sync failure is not something to surface mid-session; the manual button surfaces
 * errors instead.
 */

import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { getTokens } from "../src/services/googleDrive";
import { getBackupPassword } from "../src/services/backupPassword";
import {
  isSyncEnabled,
  isDemoModeActive,
  getSyncSchedule,
  getLastPushRunAt,
} from "../src/database/syncState";
import { isSyncDue } from "../src/services/sync/schedule";
import { syncNow } from "../src/services/sync/syncNow";

/** Resolve the gate + passphrase, or null if auto-sync can't run right now. */
async function resolveAutoSync(): Promise<string | null> {
  if (await isDemoModeActive()) return null; // demo data must never reach the user's cloud
  if (!(await isSyncEnabled())) return null;
  const tokens = await getTokens();
  if (!tokens) return null; // Drive not connected
  const passphrase = await getBackupPassword();
  if (!passphrase) return null; // no encryption key on this device
  return passphrase;
}

export function useAutoSync() {
  // Guard against overlapping auto-runs (AppState can fire repeatedly). The syncNow queue
  // already serializes, but this avoids piling identical no-op triggers onto it.
  const busyRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const runAuto = async (event: "foreground" | "background") => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        const passphrase = await resolveAutoSync();
        if (!passphrase || !mounted) return;

        const [schedule, lastPushRunAt] = await Promise.all([
          getSyncSchedule(),
          getLastPushRunAt(),
        ]);
        const pushDue = isSyncDue(schedule, lastPushRunAt, Date.now());

        if (event === "foreground") {
          // Always pull on open; push too if the schedule says it's due.
          await syncNow(passphrase, { pull: true, push: pushDue });
        } else if (pushDue) {
          // Background: push only, and only if due.
          await syncNow(passphrase, { pull: false, push: true });
        }
      } catch (e) {
        console.warn("[autoSync] trigger failed:", e);
      } finally {
        busyRef.current = false;
      }
    };

    // Treat mount as the first "foreground" (app open).
    runAuto("foreground");

    let prev: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener("change", (next) => {
      const wasBackground = prev === "background" || prev === "inactive";
      const isActive = next === "active";
      const goingBackground = (next === "background" || next === "inactive") && prev === "active";

      if (wasBackground && isActive) runAuto("foreground");
      else if (goingBackground) runAuto("background");

      prev = next;
    });

    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
}
