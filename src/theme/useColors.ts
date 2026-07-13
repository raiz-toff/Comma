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
 * So the scheme is resolved from a source that IS safe — React Native's own
 * useColorScheme, which is useSyncExternalStore-backed and cleans up on unmount.
 *
 * There is no manual override to resolve here: the app always follows the OS.
 * A `theme` field still exists on the synced profile (the web app has its own
 * picker and needs it), but the phone never reads it — see ThemeSync/scheme.ts
 * for why: writing a pin to RN's global Appearance and then reading Appearance
 * back to resolve "auto" is exactly the kind of write-then-read-your-own-write
 * trap a fixed preference used to create here. Always-system sidesteps it
 * entirely — Appearance only ever reflects the phone.
 */

import { useMemo } from "react";
import { useColorScheme as useSystemScheme } from "react-native";
import { PALETTES, type Palette, type Scheme, type ThemePref } from "./colors";
import { usePinnedScheme } from "./pinnedScheme";

export type { Palette, Scheme, ThemePref };

/**
 * The TARGET scheme — always the phone's own setting. There is no manual
 * override: the app follows the OS, full stop. Dark is the fallback wherever
 * a scheme cannot be resolved: an OS that reports nothing lands on dark,
 * which is where most gig drivers want to be anyway.
 */
export function useResolvedScheme(): Scheme {
  const system = useSystemScheme();
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
