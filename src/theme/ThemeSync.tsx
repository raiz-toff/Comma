/**
 * ThemeSync — the one place that turns the driver's Appearance preference into
 * the theme actually on screen.
 *
 * Three things have to agree, and they are updated in different ways:
 *   1. NativeWind's `dark` class  → drives every `bg-surface-02` / `text-content-*`
 *      className. Set via colorScheme.set().
 *   2. The live palette in colors.ts → read by non-React code via getColors().
 *   3. The status bar icons → dark glyphs on a light canvas, and vice versa.
 *
 * Components themselves need nothing from this file: they call useColors(),
 * which subscribes to the preference directly and re-renders on change.
 *
 * BOOT ORDER: the app boots dark, synchronously, at the import below — before
 * the first paint. NativeWind otherwise defaults to following the OS, which
 * would flash a light frame on a light-mode device even though dark is Comma's
 * default. A driver whose saved preference is light still sees one dark frame
 * while the profile loads out of SQLite; that is the cheap direction to be
 * wrong in, since dark is both the default and the common case.
 */

import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { colorScheme } from "nativewind";
import { applyScheme } from "./colors";
import { useResolvedScheme } from "./useColors";

// Runs at import, before RootLayout's first render. See BOOT ORDER above.
colorScheme.set("dark");

export function ThemeSync() {
  const scheme = useResolvedScheme();

  useEffect(() => {
    colorScheme.set(scheme);
    applyScheme(scheme);
  }, [scheme]);

  // `style` is the colour of the status bar CONTENT, so it is the inverse of
  // the canvas: dark glyphs on light, light glyphs on dark.
  return <StatusBar style={scheme === "light" ? "dark" : "light"} />;
}
