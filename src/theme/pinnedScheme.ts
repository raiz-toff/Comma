/**
 * The scheme the app is PINNED to while a theme transition is playing.
 *
 * A theme swap is instantaneous: every className re-resolves and every useColors()
 * consumer re-renders in the same commit, so the screen snaps from black to white
 * in one frame. Fading a veil in afterwards is useless — the flash has already
 * happened by the time any effect runs.
 *
 * So the old palette is HELD. ThemeTransition pins it, raises a veil in the colour
 * the driver is already looking at, and only then lets go: the swap happens behind
 * the veil, unseen, and the new theme is revealed by fading the veil away.
 *
 * `null` means "not transitioning", and every colour then falls through to the
 * real target. That is deliberately both the default AND the failure mode: if
 * ThemeTransition never mounts, or throws, or its animation callback never fires,
 * the pin is simply never set and the theme still changes. It just changes
 * instantly, the way it did before. Nothing can get stuck on the wrong palette.
 *
 * useSyncExternalStore subscribes from an effect and cleans up on unmount — which
 * is precisely what NativeWind's own useColorScheme fails to do, and why it could
 * not be used for this (see ./useColors.ts).
 */

import { useSyncExternalStore } from "react";
import type { Scheme } from "./colors";

let pinned: Scheme | null = null;
const listeners = new Set<() => void>();

/** Called only by ThemeTransition. */
export function setPinnedScheme(scheme: Scheme | null): void {
  if (scheme === pinned) return;
  pinned = scheme;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Scheme | null {
  return pinned;
}

export function usePinnedScheme(): Scheme | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
