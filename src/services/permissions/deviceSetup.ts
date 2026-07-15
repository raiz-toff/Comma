/**
 * Per-device setup — the things a restore cannot bring with it.
 *
 * THE BUG THIS EXISTS TO FIX
 *   `onboardingComplete` is synced (see sync/profileBridge.ts), and applied
 *   one-way: a vault that says "onboarded" completes onboarding on whatever
 *   device it lands on. That is right for the driver's *data* — having restored
 *   three years of shifts, nobody should be marched back through the wizard.
 *
 *   But it is wrong for the driver's *permissions*. An OS location grant belongs
 *   to an app on a phone. It cannot be exported, synced, or inherited. And the
 *   wizard is the only place Comma proactively asks for one — so restoring onto
 *   a new phone skipped the wizard and therefore skipped the request, leaving a
 *   device that believed it was fully set up and had no location access at all.
 *
 *   That failure is silent, and it costs money. Nothing errors. Background
 *   tracking simply never starts, mileage stops the moment the driver switches
 *   to their delivery app, shifts log short, and they under-claim the write-off.
 *   They would have no reason to suspect the app.
 *
 * THE RULE
 *   Device-local state must never be inherited from the wire. The marker below
 *   lives in the local `settings` table and is deliberately absent from
 *   profileBridge's FROM_LOCAL map, which is the exhaustive list of what crosses
 *   the wire. Do not add it there. If a device has never itself been asked, it
 *   has never been asked, no matter what any vault claims.
 */

import { Platform } from "react-native";
import { eq } from "drizzle-orm";
import { db } from "../../database/client";
import { settings } from "../../database/schema";
import { isDemoModeActive } from "../../database/syncState";
import {
  getLocationAccessLevel,
  requestFullLocationAccess,
  type LocationAccessLevel,
} from "./locationAccess";

const isWeb = Platform.OS === "web";

/**
 * Device-local. NEVER add this key to profileBridge's FROM_LOCAL — putting it on
 * the wire would recreate the exact bug this module exists to fix, except worse,
 * because then the new device would have positive proof it had been asked.
 */
const ASKED_KEY = "device_location_asked_v1";

async function readAsked(): Promise<boolean> {
  if (isWeb) return localStorage.getItem(`comma_${ASKED_KEY}`) === "true";
  const row = await db.select().from(settings).where(eq(settings.key, ASKED_KEY)).limit(1);
  return row[0]?.value === "true";
}

async function markAsked(): Promise<void> {
  if (isWeb) {
    localStorage.setItem(`comma_${ASKED_KEY}`, "true");
    return;
  }
  await db
    .insert(settings)
    .values({ key: ASKED_KEY, value: "true" })
    .onConflictDoUpdate({ target: settings.key, set: { value: "true" } });
}

/**
 * Ask this device for location, if this device has never been asked.
 *
 * Call it once the app knows onboarding is complete — that is precisely the
 * state in which the wizard will not run, so nothing else is going to ask.
 *
 * Asks at most once per device, ever. A driver who says no is not nagged on
 * every launch: the activation checklist on the dashboard still carries the
 * item, live-checked against the OS, so the route back is always open.
 *
 * Returns the access level this device ended up with, or null if it had already
 * been asked and nothing was done.
 */
export async function ensureDeviceLocationSetup(): Promise<LocationAccessLevel | null> {
  if (isWeb) return null;
  // Never prompt in demo mode — sample data has no shift to track. The dashboard hook
  // already guards on the `isDemoMode` React flag, but that races the two-step store update
  // when Demo Mode is first entered (isOnboardingCompleted flips true a tick before
  // isDemoMode). Reading the persisted `demo_mode` marker here is authoritative and closes
  // that window, so no caller can surface a location dialog behind the demo.
  if (await isDemoModeActive()) return null;
  if (await readAsked()) return null;

  const level = await getLocationAccessLevel();

  // Already granted — this device is set up, it just predates the marker
  // (every install that upgrades into this version is in exactly that boat).
  // Record it and stay silent.
  if (level === "full") {
    await markAsked();
    return level;
  }

  // Either a fresh restore that never got asked, or an older install sitting on
  // a foreground-only grant and quietly under-recording. Both want the same
  // thing: ask, explain what a partial grant costs, and offer the way to fix it.
  const granted = await requestFullLocationAccess();
  await markAsked();
  return granted;
}
