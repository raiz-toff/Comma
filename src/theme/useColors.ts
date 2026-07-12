/**
 * Comma Design System — the React side of theming.
 *
 * Split out from ./colors.ts on purpose. colors.ts is a leaf that ~65 modules
 * import; these hooks need the settings store, whose import graph is 109 files
 * deep. Keeping them apart means a component that just wants a hex does not
 * drag the store into its module graph.
 *
 *   In a component:  const C = useColors();      // re-renders on theme change
 *   Styles:          const s = useThemedStyles(makeStyles);
 *   Outside React:   getColors() from ./colors   // point-in-time read
 */

import { useMemo } from "react";
import { useColorScheme } from "nativewind";
import { PALETTES, type Palette, type Scheme, type ThemePref } from "./colors";

export type { Palette, Scheme, ThemePref };

/**
 * The scheme actually being rendered, straight from NativeWind.
 *
 * Read it here and nowhere else, so the hexes below can never disagree with the
 * `dark` class driving the className tokens — they are now the same subscription.
 *
 * Do NOT be tempted to re-derive this from the preference plus React Native's
 * useColorScheme(). That was the first attempt and it is subtly broken: setting
 * the theme writes RN's global Appearance, so reading Appearance back just
 * returns our own write, not the phone's setting — and "auto" would latch onto
 * whatever was last applied instead of following the OS. ThemeSync hands "auto"
 * to NativeWind as "system" and lets it own the OS relationship. See ./scheme.ts.
 *
 * Dark is the fallback: NativeWind reports `undefined` before it has resolved.
 */
export function useResolvedScheme(): Scheme {
  const { colorScheme } = useColorScheme();
  return colorScheme === "light" ? "light" : "dark";
}

/**
 * The palette for the active theme. This subscribes, so a component that reads
 * a colour through it re-renders the moment the driver switches theme.
 */
export function useColors(): Palette {
  return PALETTES[useResolvedScheme()];
}

/**
 * Memoize a StyleSheet factory against the active palette. This is the shape a
 * module-scope `StyleSheet.create` has to be rewritten into — at module scope
 * it would capture one theme's hexes at import and never change again.
 *
 *   const makeStyles = (C: Palette) => StyleSheet.create({ … });
 *   // inside the component:
 *   const s = useThemedStyles(makeStyles);
 *
 * `factory` must be defined at module scope (a stable reference), or the memo
 * re-runs every render.
 */
export function useThemedStyles<T>(factory: (c: Palette) => T): T {
  const C = useColors();
  return useMemo(() => factory(C), [C, factory]);
}
