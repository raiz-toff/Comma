/**
 * ThemeTransition — makes a theme change a fade rather than a flash.
 *
 * HOW IT WORKS
 *   A theme swap is instantaneous by nature: every className re-resolves and every
 *   useColors() consumer re-renders in the same commit, so the screen snaps from
 *   black to white in a single frame. Fading something in afterwards is pointless
 *   — the flash has already happened by the time any effect can run.
 *
 *   So the swap is held back:
 *
 *     1. The target scheme changes.
 *     2. In a LAYOUT effect — before React paints — the old palette is PINNED and
 *        a veil is raised over the screen, opaque, in the colour the driver is
 *        already looking at. Nothing visibly changes. (A passive useEffect would
 *        be too late: React would have painted the new theme first, which is the
 *        very flash we are hiding.)
 *     3. The veil fades in over FADE_OUT_MS. The screen settles to a flat colour.
 *     4. Behind it, the swap happens: NativeWind's class flips and the pin lifts,
 *        so classNames and JS colours change together, unseen.
 *     5. Two frames later — long enough for React to have repainted the tree in
 *        the new palette — the veil fades away over FADE_IN_MS, revealing it.
 *
 *   The driver sees the screen dim to its own background colour and the new theme
 *   rise out of it. No snap.
 *
 * FAILURE MODE
 *   Safe by construction. The pin defaults to null, and null means "use the
 *   target". If this component never mounts, or throws, or an animation callback
 *   never fires, the pin is never set and the theme still changes — instantly,
 *   the way it did before. Nothing can strand the app on the wrong palette. The
 *   watchdog below covers the same ground for a dropped callback.
 *
 * This component also OWNS the scheme write (applyThemePref). It has to: if
 * NativeWind's class flipped on the preference change while the JS palette was
 * still pinned, classNames and StyleSheet colours would disagree for the length
 * of the fade, and the driver would watch half the app change ahead of the rest.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSettingsStore } from "@/store/useSettingsStore";
import { PALETTES, type Scheme, type ThemePref } from "./colors";
import { setPinnedScheme } from "./pinnedScheme";
import { applyThemePref } from "./scheme";
import { useResolvedScheme } from "./useColors";

/** Dimming to the veil. Quick — this half is just getting out of the way. */
const FADE_OUT_MS = 140;
/** Revealing the new theme. Slower, because this half is the one you watch. */
const FADE_IN_MS = 260;
/** If an animation callback is ever dropped, unpin anyway. Never strand a theme. */
const WATCHDOG_MS = 1200;

export function ThemeTransition() {
  const target = useResolvedScheme();
  const pref = (useSettingsStore((s) => s.profile?.theme) as ThemePref | undefined) ?? "auto";

  /** The scheme currently on screen. null until the first one is applied. */
  const applied = useRef<Scheme | null>(null);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opacity = useSharedValue(0);
  const [veilColor, setVeilColor] = useState(PALETTES[target].background);

  /** The swap, performed behind an opaque veil: classNames and JS colours together. */
  const commit = useCallback(
    (next: Scheme) => {
      if (watchdog.current) clearTimeout(watchdog.current);
      applyThemePref(pref); // NativeWind's `dark` class
      setPinnedScheme(null); // release the JS palette
      applied.current = next;

      // Let React actually repaint in the new palette before lifting the veil.
      // One frame schedules the work; the second is the one it lands on. Lifting
      // early would show the old theme through the last frames of the fade.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          opacity.value = withTiming(0, {
            duration: FADE_IN_MS,
            easing: Easing.out(Easing.cubic),
          });
        });
      });
    },
    [pref, opacity]
  );

  useLayoutEffect(() => {
    if (applied.current === target) return;

    // First run. There is no old theme to fade FROM, so just apply it — a veil on
    // a cold start would be a flash of its own.
    if (applied.current === null) {
      applyThemePref(pref);
      applied.current = target;
      return;
    }

    // Hold the old palette and cover the screen, before React paints. The veil
    // takes the colour the driver is currently looking at, so it starts from what
    // is already on screen rather than jumping to it.
    setPinnedScheme(applied.current);
    setVeilColor(PALETTES[applied.current].background);

    if (watchdog.current) clearTimeout(watchdog.current);
    watchdog.current = setTimeout(() => commit(target), WATCHDOG_MS);

    opacity.value = withTiming(
      1,
      { duration: FADE_OUT_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(commit)(target);
      }
    );
  }, [target, pref, commit, opacity]);

  useEffect(() => {
    return () => {
      if (watchdog.current) clearTimeout(watchdog.current);
      // Never leave the app pinned to a palette nobody is going to release.
      setPinnedScheme(null);
    };
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: veilColor }, style]}
    />
  );
}
