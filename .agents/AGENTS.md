# Comma App Workspace Customizations & Rules

## Design System Standards

- **Onboarding Highlights**: The onboarding flow uses `#ffffff` (white default page highlight/accent color) instead of the semantic green `#22c55e` for logos, buttons, borders, and progress indicator states.
- **Backgrounds**: Dark Slate theme (`#12110f`) as standard.
- **AMOLED Dark Mode**: For screens configured with pure black `#000000` backgrounds (such as the Onboarding Wizard), nested card/tile containers must use dark AMOLED gray backgrounds (`#0d0d0d`) and subtle slate border outlines (`#1f1f1f`) instead of lighter warm-slate `#1c1b18` and warm-grey `#3d3a35` presets.
- **Custom Brand Icons (SVGs)**:
  - **Analytics**: Uses the custom pie chart SVG (`viewBox="0 0 24 24"`) instead of standard bar chart icons.
  - **Expenses**: Uses the custom receipt/clipboard SVG (`viewBox="0 0 1024 1024"`) instead of standard Lucide icons.
  - **About Comma**: Uses the custom pixel-block chip SVG (`viewBox="0 0 1024 1024"`) instead of standard Lucide `Info` icons.
  - These icons should support dynamic `fill={color}` rather than standard Lucide outline strokes.

## Technical Rules & Common Fixes

- **Supported Countries**:
  - The type of `country` is `"US" | "CA" | "UK" | "NP"`.
  - When referencing allowed countries in state, type assertions, or drop-downs, ensure `"NP"` (Nepal) is explicitly supported along with `"CA"`, `"US"`, and `"UK"` to prevent TypeScript compile-time union mismatches.
