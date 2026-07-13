/**
 * ThemeSync — turns the driver's Appearance preference into the theme on screen.
 *
 * Flow is strictly one-way, with NativeWind in the middle as the single source
 * of truth for what is actually rendered:
 *
 *   profile.theme  ──effect──▶  colorScheme  ──▶  the `dark` class (classNames)
 *   (auto|light|dark)              │              useColors()  (StyleSheet, SVG)
 *                                  │              the status bar below
 *                                  └──▶  applyScheme() — the live palette that
 *                                        non-React code reads via getColors()
 *
 * Both writes happen in effects, never during render. colorScheme.set() reaches
 * into React Native's global Appearance and synchronously updates every styled
 * component in the tree, which is not something you may do while rendering — see
 * the warning in ./scheme.ts.
 *
 * Components need nothing from this file. They call useColors(), which
 * subscribes to NativeWind directly and re-renders on change.
 *
 * BOOTING DARK. `pref` below falls back to dark until the profile arrives from
 * SQLite, so the effect applies dark on the very first commit — NativeWind's
 * only chance to be wrong is the initial frame, where it starts on the OS
 * scheme. That is at most one frame, and only on a light phone.
 *
 * Do not "improve" this by setting the scheme at the entry point instead. That
 * was tried: importing the theme from index.ts hoists NativeWind's runtime ahead
 * of expo-router/entry and kills the app at startup ("property is not writable").
 * See ./scheme.ts. One frame is not worth a crash.
 */

import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { useSettingsStore } from "@/store/useSettingsStore";
import { applyScheme, type ThemePref } from "./colors";
import { applyThemePref } from "./scheme";
import { useResolvedScheme } from "./useColors";

export function ThemeSync() {
  const pref = (useSettingsStore((s) => s.profile?.theme) as ThemePref | undefined) ?? "dark";
  const scheme = useResolvedScheme();

  /*
   * Preference → NativeWind, deferred out of the commit ON PURPOSE.
   *
   * colorScheme.set() writes React Native's global Appearance, whose change
   * listener runs react-native-css-interop's observable.set() — which fans out
   * SYNCHRONOUSLY and without batching:
   *
   *     set(newValue) {
   *       if (Object.is(newValue, value)) return;
   *       value = newValue;
   *       for (const effect of Array.from(effects)) effect.run();   // setState
   *     }
   *
   * and NativeWind subscribes those effects during RENDER, not from an effect.
   *
   * So firing it from inside a commit pushes a state update into components in
   * that very commit which have rendered but not yet mounted, and React rightly
   * objects: "Can't perform a React state update on a component that hasn't
   * mounted yet." It happens at boot whenever the saved preference is light or
   * auto, because the profile arrives from SQLite in the same commit that first
   * mounts the app tree.
   *
   * Dark hid the bug completely: `Object.is` makes set() a no-op when the value
   * does not change, and a dark-preference driver on a dark phone changes nothing.
   *
   * A macrotask puts the write after the commit has fully settled, when every
   * subscriber is genuinely mounted. The cost is one frame of the previous theme,
   * which is the correct thing to trade for not crashing.
   */
  useEffect(() => {
    const id = setTimeout(() => applyThemePref(pref), 0);
    return () => clearTimeout(id);
  }, [pref]);

  // Whatever actually rendered → the live palette, for the code outside React.
  useEffect(() => {
    applyScheme(scheme);
  }, [scheme]);

  // `style` is the colour of the status bar CONTENT, so it is the inverse of the
  // canvas: dark glyphs on light, light glyphs on dark.
  return <StatusBar style={scheme === "light" ? "dark" : "light"} />;
}
