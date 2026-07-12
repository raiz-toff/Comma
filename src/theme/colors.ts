/**
 * Comma Design System — JS color mirror.
 *
 * Single source of truth for DS colors in JS contexts (StyleSheet, SVG props,
 * chart palettes, placeholderTextColor, ActivityIndicator, home-screen
 * widgets) where NativeWind classes can't reach.
 *
 * MUST stay in sync with src/global.css — DARK mirrors `.dark:root`,
 * LIGHT mirrors `:root`. In className contexts always prefer the token classes
 * (bg-surface-02, text-content-secondary, border-line-subtle, …): those flip
 * with the theme on their own and need nothing from this file.
 *
 * HOW TO READ A COLOR
 *   In a component:  const C = useColors();      // re-renders on theme change
 *   Outside React:   const C = getColors();      // point-in-time read
 *
 * Do NOT read colors into a module-scope initializer — `const s = StyleSheet
 * .create({ card: { backgroundColor: C.surface02 } })` at module scope is
 * evaluated once, at import, and freezes whichever theme happened to be active
 * then. Use a factory instead, memoized on the palette:
 *
 *   const makeStyles = (C: Palette) => StyleSheet.create({ … });
 *   // inside the component:
 *   const C = useColors();
 *   const s = useThemedStyles(makeStyles);
 *
 * THIS FILE HAS NO IMPORTS, AND MUST KEEP IT THAT WAY. It is a leaf that ~65
 * modules depend on. The React hooks that read the driver's preference live in
 * ./useColors.ts, because they need the settings store — and pulling the store
 * (a 109-module graph) in here would drag it into every one of those importers.
 */

/** The two rendered themes. The user's *preference* may also be "auto". */
export type Scheme = "light" | "dark";
/** What the driver picked in Appearance — "auto" follows the OS. */
export type ThemePref = Scheme | "auto";

export interface Palette {
  background: string;
  foreground: string;
  surface01: string;
  surface02: string;
  surface03: string;
  surface04: string;
  surface05: string;
  card: string;
  contentPrimary: string;
  contentSecondary: string;
  contentMuted: string;
  contentDisabled: string;
  lineSubtle: string;
  lineStrong: string;
  primary: string;
  success: string;
  warning: string;
  info: string;
  destructive: string;
  scrim: string;
}

/** Dark — the app's default. Gig driver = night driving. */
export const DARK: Palette = {
  /** #000000 — canvas, true black for OLED */
  background: "#000000",
  /** #F6F6F7 — foreground on canvas */
  foreground: "#F6F6F7",

  // ── Surfaces (elevation = surface step + hairline border, never shadow) ──
  /** #0A0A0C — recessed wells, page sections */
  surface01: "#0A0A0C",
  /** #0F0F12 — default card background */
  surface02: "#0F0F12",
  /** #16161A — raised cards, inputs, sheets */
  surface03: "#16161A",
  /** #1C1C21 — pressed/hover, segmented bg, progress tracks */
  surface04: "#1C1C21",
  /** #26262C — highest: menus, tooltips */
  surface05: "#26262C",
  /** alias: card = surface02 */
  card: "#0F0F12",

  // ── Text ──
  /** #F6F6F7 — headlines, money, key values */
  contentPrimary: "#F6F6F7",
  /** #9B9BA4 — body, supporting copy */
  contentSecondary: "#9B9BA4",
  /** #65656E — labels, captions, meta; minimum for readable text */
  contentMuted: "#65656E",
  /** #45454C — inactive, placeholders. NEVER body text. */
  contentDisabled: "#45454C",

  // ── Lines (borders only — never use as text color) ──
  /** #1E1E23 — default hairline */
  lineSubtle: "#1E1E23",
  /** #2E2E36 — inputs, focus rings */
  lineStrong: "#2E2E36",

  // ── Semantic (fixed — never re-themed by user accent) ──
  /** #22c55e — primary actions */
  primary: "#22c55e",
  /** #1FC16B — net positive, goals hit */
  success: "#1FC16B",
  /** #F5A623 — write-offs, reconcile due */
  warning: "#F5A623",
  /** #3B82F6 — tips, neutral notices */
  info: "#3B82F6",
  /** #FF5247 — end shift, destructive */
  destructive: "#FF5247",

  /** rgba scrim behind modals/sheets — the one sanctioned overlay value */
  scrim: "rgba(0, 0, 0, 0.7)",
};

/**
 * Light — opt-in, from the Appearance control in onboarding and Settings.
 *
 * Same cool-neutral hue family (240) as DARK, so the two themes read as one
 * system. The text steps are not eyeballed: each was solved to reproduce its
 * dark counterpart's contrast ratio against the canvas, so neither theme is
 * more legible than the other.
 *
 * The semantic colors are the exception. They carry money and status TEXT on
 * white, so they use the standard 600/700 tints and clear WCAG AA (>=4.5:1).
 * They deliberately do NOT match their dark counterparts' ratio — doing that
 * would drag `warning` to a near-black brown and destroy the hue's identity.
 */
export const LIGHT: Palette = {
  /** #FFFFFF — canvas, true white */
  background: "#FFFFFF",
  /** #0E0E11 — foreground on canvas (19.3:1) */
  foreground: "#0E0E11",

  // ── Surfaces (elevation steps DOWN in lightness, mirroring dark stepping up) ──
  /** #FCFCFD — recessed wells, page sections */
  surface01: "#FCFCFD",
  /** #F6F6F9 — default card background */
  surface02: "#F6F6F9",
  /** #F0F0F4 — raised cards, inputs, sheets */
  surface03: "#F0F0F4",
  /** #E8E8ED — pressed/hover, segmented bg, progress tracks */
  surface04: "#E8E8ED",
  /** #DFDFE7 — highest: menus, tooltips */
  surface05: "#DFDFE7",
  /** alias: card = surface02 */
  card: "#F6F6F9",

  // ── Text (ratios vs #FFFFFF; matched to DARK's ratios vs #000000) ──
  /** #0E0E11 — headlines, money, key values (19.3:1) */
  contentPrimary: "#0E0E11",
  /** #53535A — body, supporting copy (7.6:1) */
  contentSecondary: "#53535A",
  /** #878792 — labels, captions, meta (3.6:1); minimum for readable text */
  contentMuted: "#878792",
  /** #AEAEB7 — inactive, placeholders (2.2:1). NEVER body text. */
  contentDisabled: "#AEAEB7",

  // ── Lines (borders only — never use as text color) ──
  /** #E5E5EB — default hairline */
  lineSubtle: "#E5E5EB",
  /** #D2D2DB — inputs, focus rings */
  lineStrong: "#D2D2DB",

  // ── Semantic — 600/700 tints, WCAG AA on white ──
  /** #22c55e — primary actions (button fill; foreground text supplies contrast) */
  primary: "#22c55e",
  /** #15803D — net positive, goals hit (5.0:1) */
  success: "#15803D",
  /** #B45309 — write-offs, reconcile due (5.0:1) */
  warning: "#B45309",
  /** #2563EB — tips, neutral notices (5.2:1) */
  info: "#2563EB",
  /** #DC2626 — end shift, destructive (4.8:1) */
  destructive: "#DC2626",

  /** A modal scrim stays dark in light mode — it darkens the page behind. */
  scrim: "rgba(0, 0, 0, 0.7)",
};

export const PALETTES: Record<Scheme, Palette> = { light: LIGHT, dark: DARK };

/**
 * The live palette, for code that runs outside React and so cannot use the
 * hook. Kept current by ThemeSync (src/theme/ThemeSync.tsx).
 *
 * Read it at call time — `getColors().background`. Never capture it into a
 * module-scope initializer; see the file header.
 */
const active: Palette = { ...DARK };

/** Point-in-time read of the active palette. Non-React callers only. */
export function getColors(): Palette {
  return active;
}

/** Swap the live palette. Called by ThemeSync; nothing else should call it. */
export function applyScheme(scheme: Scheme): void {
  Object.assign(active, PALETTES[scheme]);
}

/**
 * KPI accents — one color per metric, used identically in every widget/chart.
 * A metric must never change color between widgets, so these are deliberately
 * theme-invariant: `gross` is the same teal in light and in dark.
 */
export const KPI = {
  /** teal — gross earnings (bars, sparklines, per-delivery, avg earnings) */
  gross: "#14b8a6",
  /** amber — avg rate/hr, streaks */
  rate: "#f59e0b",
  /** cyan — expenses */
  expenses: "#06b6d4",
  /** sky — tax set-aside */
  tax: "#0ea5e9",
  /** blue — net take-home, projections */
  net: "#3b82f6",
  /** indigo — hours / time */
  hours: "#6366f1",
} as const;

/**
 * Performance-tier scale (Elite/Pro/Active/base) — shared by every widget that
 * ranks output, so "Elite" is always the same color app-wide. Theme-invariant,
 * for the same reason as KPI.
 */
export const TIERS = {
  /** gold — top tier */
  elite: "#F5A623",
  /** blue — mid tier */
  pro: "#3B82F6",
  /** green — baseline-good tier */
  active: "#1FC16B",
  /** muted — no/low data */
  base: "#65656E",
} as const;

/**
 * Adds alpha to a 6-digit hex color. `opacity` is 0–1.
 * Replaces the ad-hoc `color + "20"` string-concat idiom.
 */
export function withAlpha(hex: string, opacity: number): string {
  const alpha = Math.round(Math.max(0, Math.min(1, opacity)) * 255)
    .toString(16)
    .padStart(2, "0");
  return hex + alpha;
}
