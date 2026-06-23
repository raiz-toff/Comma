/**
 * usePlatformTheme — React Native port of the PWA's adaptive-theme.js
 *
 * Subscribes to `activePlatformFilter` in the settings store and returns
 * derived brand-color values that exactly mirror what the PWA does:
 *  - `accentColor`        → the platform hex (falls back to #10b981 for "all")
 *  - `accentColorDim`     → 18% opacity version  (replaces color-mix(...18%))
 *  - `accentColorMid`     → 30% opacity version  (replaces color-mix(...30%))
 *  - `accentColorContrast`→ white or near-black based on luminance
 *
 * Usage:
 *   const { accentColor, accentColorDim, accentColorContrast } = usePlatformTheme();
 */

import { useMemo } from "react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { PLATFORMS, type PlatformKey } from "@/src/registry/platforms";

/** Default brand color — used when "all" is selected (matches PWA default #10b981) */
const DEFAULT_ACCENT = "#10b981";

/** Luminance-based contrast: white on dark, near-black on light. Mirrors adaptive-theme.js */
function getContrastColor(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 155 ? "#1a1916" : "#ffffff";
}

/** Adds alpha to a 6-digit hex color. `opacity` is 0–1. */
function hexWithAlpha(hex: string, opacity: number): string {
  const alpha = Math.round(Math.max(0, Math.min(1, opacity)) * 255)
    .toString(16)
    .padStart(2, "0");
  return hex + alpha;
}

export interface PlatformTheme {
  /** Full platform color, e.g. #FF3008 */
  accentColor: string;
  /** 18% opacity tint — use as subtle background */
  accentColorDim: string;
  /** 30% opacity tint — use for borders / rings */
  accentColorMid: string;
  /** Contrast text on accentColor background */
  accentColorContrast: string;
  /** true when a specific platform is active (not "all") */
  isPlatformFiltered: boolean;
  /** The active platform key, or null when "all" */
  activePlatformId: string | null;
  /** Human-readable platform label */
  activePlatformLabel: string;
}

export function usePlatformTheme(): PlatformTheme {
  const activePlatformFilter = useSettingsStore((s) => s.activePlatformFilter);

  return useMemo<PlatformTheme>(() => {
    const isFiltered = activePlatformFilter !== "all";
    const cfg = isFiltered ? PLATFORMS[activePlatformFilter as PlatformKey] : null;
    const accent = cfg?.color ?? DEFAULT_ACCENT;
    const label = cfg?.label ?? "All Platforms";

    return {
      accentColor: accent,
      accentColorDim: hexWithAlpha(accent, 0.18),
      accentColorMid: hexWithAlpha(accent, 0.30),
      accentColorContrast: getContrastColor(accent),
      isPlatformFiltered: isFiltered,
      activePlatformId: isFiltered ? activePlatformFilter : null,
      activePlatformLabel: label,
    };
  }, [activePlatformFilter]);
}
