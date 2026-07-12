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
import { useSettingsStore } from "../store/useSettingsStore";

/**
 * Resolve the gate, returning the passphrase to sync with — or null if auto-sync can't run.
 *
 * The passphrase may legitimately be an EMPTY STRING: that's the default one-tap mode (no
 * E2E password), where change-logs are written as plain envelopes into the Drive
 * appDataFolder sandbox. Returning null here for a missing password — as this used to —
 * silently disabled auto-sync for every default user while the UI still said "Syncing
 * automatically", which is the worst possible failure: a silent lie about data safety.
 */
async function resolveAutoSync(): Promise<{ passphrase: string } | null> {
  if (await isDemoModeActive()) return null; // demo data must never reach the user's cloud
  if (!(await isSyncEnabled())) return null;
  const tokens = await getTokens();
  if (!tokens) return null; // Drive not connected
  return { passphrase: (await getBackupPassword()) ?? "" };
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
        const gate = await resolveAutoSync();
        if (!gate || !mounted) return;
        const { passphrase } = gate;

        const [schedule, lastPushRunAt] = await Promise.all([
          getSyncSchedule(),
          getLastPushRunAt(),
        ]);
        const pushDue = isSyncDue(schedule, lastPushRunAt, Date.now());

        if (event === "foreground") {
          // Always pull on open; push too if the schedule says it's due.
          const res = await syncNow(passphrase, { pull: true, push: pushDue });
          // The pull may have imported the synced profile (name, country, onboarding
          // flag…) — re-hydrate the store so the UI reacts. Without this a restoring
          // device stays stuck on the onboarding wizard even though the DB says the
          // user is fully set up (issue #11).
          if (res.profileImported && mounted) {
            await useSettingsStore.getState().loadSettings();
          }
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
