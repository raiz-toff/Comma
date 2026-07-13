/**
 * ThemeSync — turns the driver's Appearance preference into the theme on screen.
 *
 *   profile.theme  ──effect──▶  colorScheme  ──▶  the `dark` class (classNames)
 *   (auto|light|dark)              │
 *                                  └──▶  applyScheme() — the live palette that
 *                                        non-React code reads via getColors()
 *
 * plus the status bar glyphs, which are the inverse of the canvas.
 *
 * The scheme write is deferred by a macrotask, and that is load-bearing — see
 * ./scheme.ts. It must not run inside a commit.
 *
 * Components need nothing from this file. They call useColors(), which subscribes
 * to the preference through Zustand and React Native's own useColorScheme — NOT
 * through NativeWind's useColorScheme, which leaks. See ./useColors.ts.
 *
 * BOOTING. The default preference is "auto", and `pref` falls back to it until
 * the profile arrives from SQLite. That is the cheapest possible default:
 * NativeWind already starts on the OS scheme, so "auto" agrees with where it
 * starts and the boot writes nothing at all — no Appearance write, no fan-out.
 * A driver who has explicitly chosen light or dark gets one frame of the OS's
 * scheme while their profile loads; there is no synchronous store to cache it in.
 *
 * Do not "improve" that away by setting the scheme at the entry point. It was
 * tried: importing the theme from index.ts hoists NativeWind's runtime ahead of
 * expo-router/entry and kills the app at startup ("property is not writable").
 * One frame is not worth a crash.
 */

import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { useSettingsStore } from "@/store/useSettingsStore";
import { applyScheme, type ThemePref } from "./colors";
import { applyThemePref } from "./scheme";
import { useResolvedScheme } from "./useColors";

export function ThemeSync() {
  const pref = (useSettingsStore((s) => s.profile?.theme) as ThemePref | undefined) ?? "auto";
  const scheme = useResolvedScheme();

  // Preference → NativeWind, on a macrotask so the write lands after the current
  // commit has settled rather than inside it. Idempotent (see ./scheme.ts), so
  // the common case writes nothing.
  useEffect(() => {
    const id = setTimeout(() => applyThemePref(pref), 0);
    return () => clearTimeout(id);
  }, [pref]);

  // Mirror whatever is rendering into the live palette, for non-React readers.
  // A plain object mutation — no React state, so it cannot fan anything out.
  useEffect(() => {
    applyScheme(scheme);
  }, [scheme]);

  // `style` is the colour of the status bar CONTENT, so it is the inverse of the
  // canvas: dark glyphs on light, light glyphs on dark.
  return <StatusBar style={scheme === "light" ? "dark" : "light"} />;
}
