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
 * The app boots dark in index.ts, before the router renders. A driver whose
 * saved preference is light still gets a dark first frame while the profile
 * loads out of SQLite — that read is async, and there is no synchronous store to
 * cache the answer in. Dark is the default and the common case, so it is the
 * cheap direction to be wrong in.
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

  // Preference → NativeWind. Idempotent, so the common case (pref is dark, which
  // index.ts already applied at boot) writes nothing at all on mount.
  useEffect(() => {
    applyThemePref(pref);
  }, [pref]);

  // Whatever actually rendered → the live palette, for the code outside React.
  useEffect(() => {
    applyScheme(scheme);
  }, [scheme]);

  // `style` is the colour of the status bar CONTENT, so it is the inverse of the
  // canvas: dark glyphs on light, light glyphs on dark.
  return <StatusBar style={scheme === "light" ? "dark" : "light"} />;
}
