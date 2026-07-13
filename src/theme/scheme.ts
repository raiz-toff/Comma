/**
 * Pushing the driver's Appearance preference into NativeWind.
 *
 * NativeWind's `colorScheme` observable is the single source of truth for the
 * rendered theme: it drives the `dark` class (and so every `bg-surface-02` /
 * `text-content-*` className) AND useColors(). Nothing else may decide.
 *
 * BEWARE: colorScheme.set() is not a plain setter. It writes React Native's
 * global `Appearance`, whose change listener runs react-native-css-interop's
 * observable.set() — which fans a state update out to every styled component
 * SYNCHRONOUSLY and without batching:
 *
 *     set(newValue) {
 *       if (Object.is(newValue, value)) return;
 *       value = newValue;
 *       for (const effect of Array.from(effects)) effect.run();   // setState
 *     }
 *
 * and NativeWind subscribes those effects during RENDER, not from an effect.
 * Three consequences:
 *
 *   1. Never call it during render. Expo Router requires route modules while
 *      rendering, so a module-scope call inside a route's import graph lands
 *      mid-render, and React objects to a side-effect updating components.
 *
 *   2. Never call it during a commit either. The update lands on components in
 *      that commit which have rendered but not yet mounted — which is what
 *      happens at boot when the saved preference is light or auto, because the
 *      profile arrives from SQLite in the same commit that first mounts the app
 *      tree. ThemeSync defers the call by a macrotask for exactly this reason.
 *
 *   3. Never call it redundantly. Hence the idempotence below.
 *
 * Note how well dark hides all of this: `Object.is` makes set() a no-op when the
 * value does not change, so a dark-preference driver on a dark phone never fans
 * anything out and never sees a symptom. Light and auto are what expose it.
 *
 * ThemeSync's (deferred) effect is the only caller.
 *
 * AND DO NOT import this module from index.ts. It was tried, to boot dark before
 * the router renders. `import` hoists, so it dragged NativeWind's runtime into
 * the graph ahead of expo-router/entry — and NativeWind patches React Native's
 * components as it loads. Initialising it before React Native has set up its own
 * environment killed the app at startup: "TypeError: property is not writable",
 * thrown before the runtime was ready. It bought nothing anyway; see ThemeSync.
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
