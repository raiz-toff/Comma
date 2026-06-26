/**
 * usePlatformTheme — React Native port of the PWA's adaptive-theme.js
 *
 * Subscribes to `activePlatformFilter` in the settings store and returns
 * derived color values.
 *
 * DESIGN DECISION: The app previously used a fixed accent color. It now uses the platform context and semantic colors (e.g. #22c55e) for
 * all UI chrome (buttons, active states, selections). Platform brand colors
 * are available via `platformColor` for use ONLY in the platform selector
 * pills — they do NOT bleed into the rest of the interface.
 *
 *  - `accentColor`        → current active platform brand color — use for active/primary interactions
 *  - `accentColorDim`     → 18% opacity version of accent
 *  - `accentColorMid`     → 30% opacity version of accent
 *  - `accentColorContrast`→ contrast text on accentColor background
 *  - `platformColor`      → the platform's brand color (platform pills only)
 */

import { useMemo } from "react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { PLATFORMS, type PlatformKey } from "@/src/registry/platforms";


/** Luminance-based contrast: white on dark, near-black on light. */
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
  /** Fixed app accent color — use for buttons, selections, active states */
  accentColor: string;
  /** 18% opacity tint of accent */
  accentColorDim: string;
  /** 30% opacity tint of accent */
  accentColorMid: string;
  /** Contrast text on accentColor background */
  accentColorContrast: string;
  /** Platform brand color — use ONLY for platform selector pills */
  platformColor: string;
  /** true when a specific platform is active (not "all") */
  isPlatformFiltered: boolean;
  /** The active platform key, or null when "all" */
  activePlatformId: string | null;
  /** Human-readable platform label */
  activePlatformLabel: string;
}

export function blendColors(c1: string, c2: string): string {
  const norm = (c: string) => {
    let hex = c.replace("#", "");
    if (hex.length === 3) {
      hex = hex.split("").map((x) => x + x).join("");
    }
    return hex;
  };
  
  const h1 = norm(c1);
  const h2 = norm(c2);

  const r1 = parseInt(h1.slice(0, 2), 16);
  const g1 = parseInt(h1.slice(2, 4), 16);
  const b1 = parseInt(h1.slice(4, 6), 16);

  const r2 = parseInt(h2.slice(0, 2), 16);
  const g2 = parseInt(h2.slice(2, 4), 16);
  const b2 = parseInt(h2.slice(4, 6), 16);

  const r = Math.round((r1 + r2) / 2).toString(16).padStart(2, "0");
  const g = Math.round((g1 + g2) / 2).toString(16).padStart(2, "0");
  const b = Math.round((b1 + b2) / 2).toString(16).padStart(2, "0");

  return `#${r}${g}${b}`;
}

export function usePlatformTheme(): PlatformTheme {
  const activePlatformFilter = useSettingsStore((s) => s.activePlatformFilter);
  const rawAccent = useSettingsStore((s) => s.profile?.avatarData);
  const userAccentColor = (rawAccent && rawAccent.startsWith("#")) ? rawAccent : "#ffffff";

  return useMemo<PlatformTheme>(() => {
    const isFiltered = activePlatformFilter !== "all";
    const platformParts = activePlatformFilter.split(",");
    const firstPlatformId = platformParts[0];
    const cfg = isFiltered ? PLATFORMS[firstPlatformId as PlatformKey] : null;

    // Resolve the platform brand color (for pills only)
    let platformColor = userAccentColor;
    if (isFiltered) {
      if (platformParts.length === 2) {
        const c1 = PLATFORMS[platformParts[0] as PlatformKey]?.color ?? userAccentColor;
        const c2 = PLATFORMS[platformParts[1] as PlatformKey]?.color ?? userAccentColor;
        try {
          platformColor = blendColors(c1, c2);
        } catch {
          platformColor = c1;
        }
      } else {
        platformColor = cfg?.color ?? userAccentColor;
      }
    }

    let label = "All Platforms";
    if (isFiltered) {
      if (platformParts.length > 1) {
        label = platformParts
          .map((p) => PLATFORMS[p as PlatformKey]?.label || p)
          .join(" + ");
      } else {
        label = cfg?.label ?? activePlatformFilter;
      }
    }

    return {
      // App chrome always uses the user's custom accent color!
      accentColor: userAccentColor,
      accentColorDim: hexWithAlpha(userAccentColor, 0.12),
      accentColorMid: hexWithAlpha(userAccentColor, 0.25),
      accentColorContrast: getContrastColor(userAccentColor),
      // Platform brand color — only for platform selector pills
      platformColor,
      isPlatformFiltered: isFiltered,
      activePlatformId: isFiltered ? activePlatformFilter : null,
      activePlatformLabel: label,
    };
  }, [activePlatformFilter, userAccentColor]);
}

