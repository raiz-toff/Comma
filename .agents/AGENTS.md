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

- **App Reset → Onboarding Gate**:
  - `store/useSettingsStore.ts` `loadSettings()` must NOT auto-bootstrap demo data when `onboarding_completed` is missing/false.
  - When `onboardingCompleted` is false (both web `localStorage` path and native SQLite path), set `isOnboardingCompleted: false` and return — the dashboard (`app/(tabs)/index.tsx`) will render `<OnboardingWizard />` automatically.
  - The old auto-demo bootstrap (`completeOnboarding(demoProfile, ...)` + `loadSampleData()`) has been permanently removed.

## Settings Screen Patterns (`app/settings/index.tsx`)

- **Input Text Visibility**: All `inlineInput` and `fullInput` stylesheet entries must use `color: "#ffffff"` (literal white string, NOT `DS.textPrimary`) and an explicit `height` (38 for inline, 44 for full) instead of `paddingVertical`. This prevents invisible text on Android where `paddingVertical` can cause the text baseline to shift off-screen.
- **Color Picker**: Custom platforms use the `<ColorPicker>` component (defined as a `ScrollView` of `PRESET_COLORS` swatches). Do not use a raw `InlineInput` for hex-only color entry — always pair it with the swatch row.
- **Emoji Picker**: Custom platforms use the `<EmojiPicker>` component (defined as a `ScrollView` of `PRESET_EMOJIS` tiles). Always pair the manual text input with the emoji grid.
- **Platform Rate Labels**: Hourly rate row is labelled "Default Hourly Pay" with segmented options "Hourly Rate" / "N/A". Mileage rate row is "Default Mileage Rate" with options "Per Distance" / "N/A". Both show `{countryDef.symbol}` prefix and `/ hr` or `/ {distanceUnit}` suffix when active.
