/**
 * Comma Design System — the React side of theming.
 *
 * Split out from ./colors.ts on purpose: colors.ts is an import-free leaf that
 * ~65 modules depend on, and these hooks need the settings store.
 *
 *   In a component:  const C = useColors();      // re-renders on theme change
 *   Styles:          const s = useThemedStyles(makeStyles);
 *   Outside React:   getColors() from ./colors   // point-in-time read
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DO NOT resolve the scheme with NativeWind's useColorScheme(). It was tried,
 * and it is a trap. react-native-css-interop's implementation is:
 *
 *     function useColorScheme() {
 *       const [effect, setEffect] = useState(() => ({
 *         run: () => setEffect((s) => ({ ...s })),   // a bare setState
 *         dependencies: new Set(),
 *       }));
 *       cleanupEffect(effect);
 *       return { colorScheme: colorScheme.get(effect), ... };   // subscribes DURING RENDER
 *     }
 *
 * It subscribes from the render body, its notification is a raw setState, and it
 * registers NO unmount cleanup — no useEffect, no useSyncExternalStore. Every
 * component instance that renders leaves a live effect in the observable's Set
 * forever. Put that in the ~60 components that read a colour and every theme
 * change fans a setState out across a pile of fibers that never mounted:
 * "Can't perform a React state update on a component that hasn't mounted yet",
 * once per component, RootLayout first.
 *
 * So the scheme is resolved from two sources that ARE safe — Zustand and React
 * Native's own useColorScheme, both useSyncExternalStore-backed and both cleaned
 * up on unmount.
 *
 * This does not reintroduce the "auto latches" bug that sent me to NativeWind's
 * hook in the first place. That bug was real: setting a theme writes RN's global
 * Appearance, so reading Appearance back returns our own write rather than the
 * phone's setting. It does not bite here, because the two cases never overlap:
 *
 *   - pref is light or dark → returned straight from the preference. Appearance
 *     is never consulted, so it cannot lie to us.
 *   - pref is auto → ThemeSync hands NativeWind "system", which calls
 *     Appearance.setColorScheme("unspecified") and gives scheme control BACK to
 *     the OS. Appearance is then reporting the phone, not us — which is exactly
 *     what we want to read.
 */

import { useMemo } from "react";
import { useColorScheme as useSystemScheme } from "react-native";
import { useSettingsStore } from "@/store/useSettingsStore";
import { PALETTES, type Palette, type Scheme, type ThemePref } from "./colors";
import { usePinnedScheme } from "./pinnedScheme";

export type { Palette, Scheme, ThemePref };

/**
 * The TARGET scheme — where the driver's preference says we should be.
 *
 * Not what is on screen during a theme transition; for that, see
 * useDisplayedScheme below. Dark is the fallback wherever a scheme cannot be
 * resolved: an OS that reports nothing lands on dark, which is where most gig
 * drivers want to be anyway.
 */
export function useResolvedScheme(): Scheme {
  const pref = (useSettingsStore((s) => s.profile?.theme) as ThemePref | undefined) ?? "auto";
  const system = useSystemScheme();

  if (pref === "light" || pref === "dark") return pref;
  return system === "light" ? "light" : "dark";
}

/**
 * The scheme actually on screen.
 *
 * Equal to the target, except during a theme transition, where it is held at the
 * OLD scheme until ThemeTransition's veil has covered the screen — so the swap
 * lands behind the veil rather than as a flash in the driver's face.
 *
 * When nothing is transitioning the pin is null and this IS the target, which is
 * also what happens if the transition machinery is absent or fails. It cannot get
 * stuck on the wrong palette. See ./pinnedScheme.ts.
 */
export function useDisplayedScheme(): Scheme {
  const target = useResolvedScheme();
  const pinned = usePinnedScheme();
  return pinned ?? target;
}

/**
 * The palette for the theme on screen. Subscribes, so a component that reads a
 * colour through it re-renders the moment the theme changes.
 */
export function useColors(): Palette {
  return PALETTES[useDisplayedScheme()];
}

/**
 * Memoize a StyleSheet factory against the active palette. This is the shape a
 * module-scope `StyleSheet.create` has to be rewritten into — at module scope it
 * would capture one theme's hexes at import and never change again.
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
