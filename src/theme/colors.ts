/**
 * Comma Design System — JS color mirror.
 *
 * Single source of truth for DS colors in JS contexts (StyleSheet, SVG props,
 * chart palettes, placeholderTextColor, ActivityIndicator, home-screen
 * widgets) where NativeWind classes can't reach.
 *
 * MUST stay in sync with src/global.css (:root) / tailwind.config.js.
 * In className contexts always prefer the token classes
 * (bg-surface-02, text-content-secondary, border-line-subtle, …).
 */

export const COLORS = {
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
  /** #45454C — inactive, placeholders on light surfaces. NEVER body text. */
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
} as const;

/**
 * KPI accents — one color per metric, used identically in every widget/chart.
 * A metric must never change color between widgets.
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
 * Performance-tier scale (Elite/Pro/Active/base) — shared by every widget
 * that ranks output, so "Elite" is always the same color app-wide.
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
