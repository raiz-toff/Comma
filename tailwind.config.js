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
        // Core semantic colors (HSL variable references)
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",

        // ── Cool-neutral design-system ramp (Comma) ──
        // Use these directly: bg-surface-02, text-content-secondary, border-subtle, etc.
        surface: {
          "01": "hsl(var(--surface-01))",
          "02": "hsl(var(--surface-02))",
          "03": "hsl(var(--surface-03))",
          "04": "hsl(var(--surface-04))",
          "05": "hsl(var(--surface-05))",
        },
        content: {
          primary: "hsl(var(--text-primary))",
          secondary: "hsl(var(--text-secondary))",
          muted: "hsl(var(--text-muted))",
          disabled: "hsl(var(--text-disabled))",
        },
        line: {
          subtle: "hsl(var(--border-subtle))",
          strong: "hsl(var(--border-strong))",
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
