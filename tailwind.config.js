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

      // ── Border radius matching web's --radius-* tokens ──
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "16px",
        xl: "24px",
        pill: "999px",
      },

      // ── Font families (closest React Native equivalents) ──
      fontFamily: {
        display: ["System"],  // Maps to web's DM Serif Display
        body: ["System"],     // Maps to web's DM Sans
        mono: ["monospace"],  // Maps to web's DM Mono
      },

      // ── Font sizes matching web's typographic scale ──
      fontSize: {
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
