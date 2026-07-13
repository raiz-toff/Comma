/**
 * ThemeSync — the two things that follow the scheme once it is on screen.
 *
 *   1. applyScheme() — keeps the live palette in colors.ts current, for code
 *      outside React that reads it through getColors().
 *   2. The status bar glyphs, which are the inverse of the canvas.
 *
 * Both track the DISPLAYED scheme, not the target — so during a theme fade the
 * status bar changes with the rest of the app, at the moment the veil hides the
 * swap, rather than flipping ahead of it while the old theme is still up.
 *
 * It does NOT write the colour scheme. ThemeTransition owns that, because the
 * write has to happen behind the veil, together with the JS palette. Read
 * ./ThemeTransition.tsx before moving it back here — it lived here, and the
 * result was a flash.
 *
 * Components need nothing from this file. They call useColors(), which subscribes
 * through Zustand and React Native's own useColorScheme — NOT NativeWind's, which
 * leaks. See ./useColors.ts.
 */

import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { applyScheme } from "./colors";
import { useDisplayedScheme } from "./useColors";

export function ThemeSync() {
  const scheme = useDisplayedScheme();

  // Mirror whatever is on screen into the live palette, for non-React readers.
  // A plain object mutation — no React state, so it cannot fan anything out.
  useEffect(() => {
    applyScheme(scheme);
  }, [scheme]);

  // `style` is the colour of the status bar CONTENT, so it is the inverse of the
  // canvas: dark glyphs on light, light glyphs on dark.
  return <StatusBar style={scheme === "light" ? "dark" : "light"} />;
}
