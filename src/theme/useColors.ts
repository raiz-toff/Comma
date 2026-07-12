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
import { useColorScheme as useSystemScheme } from "react-native";
import { useSettingsStore } from "@/store/useSettingsStore";
import { PALETTES, type Palette, type Scheme, type ThemePref } from "./colors";

export type { Palette, Scheme, ThemePref };

/**
 * Resolve the driver's Appearance preference to the scheme actually rendered.
 * Dark is both the default and the fallback: an unset profile, or an OS that
 * reports no preference, land on dark.
 */
export function useResolvedScheme(): Scheme {
  const pref = useSettingsStore((s) => s.profile?.theme) as ThemePref | undefined;
  const system = useSystemScheme();
  if (pref === "light" || pref === "dark") return pref;
  if (pref === "auto") return system === "light" ? "light" : "dark";
  return "dark";
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
