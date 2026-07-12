/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      /*
       * ──────────────────────────────────────────────────────────────
       * COMMA Design System — mapped from web PWA (src/css/tokens.css)
       * Every semantic color references an HSL variable from global.css
       * ──────────────────────────────────────────────────────────────
       */
      colors: {
        // Core semantic colors (HSL variable references).
        // `/ <alpha-value>` lets opacity modifiers work: bg-primary/90, bg-destructive/10.
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        success: {
          DEFAULT: "hsl(var(--success) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "hsl(var(--warning) / <alpha-value>)",
        },
        info: {
          DEFAULT: "hsl(var(--info) / <alpha-value>)",
        },
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",

        // ── Cool-neutral design-system ramp (Comma) ──
        // Use these directly: bg-surface-02, text-content-secondary, border-subtle, etc.
        surface: {
          "01": "hsl(var(--surface-01) / <alpha-value>)",
          "02": "hsl(var(--surface-02) / <alpha-value>)",
          "03": "hsl(var(--surface-03) / <alpha-value>)",
          "04": "hsl(var(--surface-04) / <alpha-value>)",
          "05": "hsl(var(--surface-05) / <alpha-value>)",
        },
        content: {
          primary: "hsl(var(--text-primary) / <alpha-value>)",
          secondary: "hsl(var(--text-secondary) / <alpha-value>)",
          muted: "hsl(var(--text-muted) / <alpha-value>)",
          disabled: "hsl(var(--text-disabled) / <alpha-value>)",
        },
        line: {
          subtle: "hsl(var(--border-subtle) / <alpha-value>)",
          strong: "hsl(var(--border-strong) / <alpha-value>)",
        },

        // ── Platform brand colors (static, no CSS var needed) ──
        platform: {
          doordash: "#ff3008",
          ubereats: "#142328",
          foodora: "#e2006a",
          skip: "#f96302",
          instacart: "#43b02a",
          amazonflex: "#ff9900",
          other: "#6b7280",
        },

        // ── KPI accent colors (used in dashboard sparkline cards) ──
        kpi: {
          gross: "#14b8a6",     // teal — gross earnings
          rate: "#f59e0b",      // amber — avg rate/hr
          expenses: "#06b6d4",  // cyan — expenses
          tax: "#0ea5e9",       // sky — tax set-aside
          net: "#3b82f6",       // blue — net take-home
          hours: "#6366f1",     // indigo — total hours
        },
      },

      // ── Border radius (Comma DS — paired to component size) ──
      borderRadius: {
        sm: "8px",     // pills, chips, badges
        md: "12px",    // buttons, inputs, list rows
        lg: "16px",    // cards, banners
        xl: "20px",    // hero cards, sheets
        "2xl": "28px", // modals, phone surface
        pill: "999px",
      },

      // ── Font families (closest React Native equivalents) ──
      // System sans = Inter on Android / SF on iOS. Neutral and fast.
      fontFamily: {
        display: ["System"],
        body: ["System"],
        mono: ["monospace"],
      },

      // ── Font sizes ──
      // Base-style semantic ramp (Comma DS) is the canonical scale — prefer the
      // `display`/`heading-*`/`label-*`/`paragraph-*` keys (and the matching
      // <Text variant> props) in new code. The abstract `2xs…5xl` keys are
      // retained as harmless size aliases for the ~168 existing className call
      // sites that still reference them; they map to sane sizes and need not be
      // churned. New work should use the semantic ramp.
      fontSize: {
        // Semantic ramp
        display: ["44px", { lineHeight: "48px" }],
        "heading-xl": ["28px", { lineHeight: "34px" }],
        "heading-l": ["22px", { lineHeight: "28px" }],
        "heading-m": ["18px", { lineHeight: "24px" }],
        "heading-s": ["16px", { lineHeight: "22px" }],
        "label-l": ["15px", { lineHeight: "20px" }],
        "label-m": ["13px", { lineHeight: "18px" }],
        "label-xs": ["11px", { lineHeight: "14px" }],
        "paragraph-l": ["16px", { lineHeight: "24px" }],
        "paragraph-m": ["14px", { lineHeight: "20px" }],
        "paragraph-s": ["12px", { lineHeight: "16px" }],

        // ── Legacy aliases (do not use in new code; pending removal) ──
        "2xs": ["10px", { lineHeight: "14px" }],
        xs: ["11px", { lineHeight: "16px" }],
        sm: ["13px", { lineHeight: "18px" }],
        base: ["15px", { lineHeight: "22px" }],
        lg: ["17px", { lineHeight: "24px" }],
        xl: ["20px", { lineHeight: "28px" }],
        "2xl": ["24px", { lineHeight: "32px" }],
        "3xl": ["30px", { lineHeight: "36px" }],
        "4xl": ["38px", { lineHeight: "42px" }],
        "5xl": ["48px", { lineHeight: "52px" }],
      },

      // ── Spacing (extended from Tailwind defaults) ──
      spacing: {
        "0.5": "2px",
        "1": "4px",
        "1.5": "6px",
        "2": "8px",
        "2.5": "10px",
        "3": "12px",
        "4": "16px",
        "5": "20px",
        "6": "24px",
        "8": "32px",
        "10": "40px",
        "12": "48px",
        "16": "64px",
      },
    },
  },
  plugins: [],
}
