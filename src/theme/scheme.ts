/**
 * Pushing the driver's Appearance preference into NativeWind.
 *
 * NativeWind's `colorScheme` observable is the single source of truth for the
 * rendered theme: it drives the `dark` class (and so every `bg-surface-02` /
 * `text-content-*` className) AND useColors(). Nothing else may decide.
 *
 * BEWARE: colorScheme.set() is not a plain setter. It writes React Native's
 * global `Appearance`, and Appearance's change listener SYNCHRONOUSLY fans a
 * state update out to every styled component in the tree. Two consequences:
 *
 *   1. Never call it during render. Expo Router requires route modules while
 *      rendering, so a module-scope call inside a route's import graph lands
 *      mid-render and React (rightly) complains about a side-effect updating
 *      components. Call it from an effect, or from the entry file before the
 *      router renders.
 *
 *   2. Never call it redundantly. The app suspends on SQLite, so during the
 *      first commit there are components that have rendered but not mounted; a
 *      pointless re-set pushes an update into them.
 *
 * Hence: idempotent, and the only two callers are index.ts (boot) and
 * ThemeSync's effect.
 *
 * "auto" maps to NativeWind's "system", which calls Appearance.setColorScheme
 * ("unspecified") and hands scheme control back to the OS. That is the ONLY way
 * to follow the phone — you cannot read the OS value out of Appearance yourself
 * once you have written to it, because you would just read your own write back.
 */

import { colorScheme } from "nativewind";
import type { ThemePref } from "./colors";

let applied: "light" | "dark" | "system" | null = null;

export function applyThemePref(pref: ThemePref): void {
  const target = pref === "auto" ? "system" : pref;
  if (target === applied) return;
  applied = target;
  colorScheme.set(target);
}
