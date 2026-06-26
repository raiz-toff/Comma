# Comma App — v1.0 Registry Architecture Plan

> **Status**: Refined after codebase audit (2026-06-26).
> Replaces the original ContractorModeRegistry draft — that design is superseded by this one.

---

## 1. Architectural Vision

Three composing registries resolve at runtime into a single `AppContext`. Screens only ever
read from `AppContext` via hooks. No screen imports from a registry directly.

```
Persona registry    ─┐
Country registry    ──► resolveAppContext() ──► AppContext ──► hooks ──► screens
User overrides (DB) ─┘
```

**Resolution priority (highest wins):**
```
country.force_off  >  country.force_on  >  persona.defaults  >  user.overrides
```

---

## 2. What Already Exists — Do Not Recreate

The following are already built and production-ready. The new work must compose
with these, not duplicate them.

| Already in codebase | File | What it does |
|---|---|---|
| `CountryDef` + `TaxProfile` | `src/registry/countries/index.ts` | Currency, distance unit, tax installment dates, HST/CPP/SE flags |
| `getCountryDef()`, `listCountries()` | same | Country lookup helpers |
| `OperationalModelDef` | `src/registry/operationalModels/index.ts` | 6 models: `delivery_fixed`, `rideshare_metered`, `rideshare_bidding`, `delivery_negotiated`, `grocery_batch`, `parcel_route` |
| `resolveTerminology()` | same | Merges platform overrides onto model defaults for `driverTerm`, `sessionTerm`, `tripTerm` |
| `PlatformDef` | `src/registry/platforms/index.ts` | Per-platform config, links to an `operationalModel` |
| `getPlatformsByCountry()` | same | Filters platform list to a country |
| `usePlatformContext(platformId)` | `src/hooks/usePlatformContext.ts` | Resolves platform + model + terminology + revenue fields + flags for a given platform |
| Badge, expense category, province, withholding registries | `src/registry/` | Various |

**Key insight on terminology:** `OperationalModelDef` already owns shift-form terminology
(`driverTerm`, `sessionTerm`, `tripTerm`) at the platform level. The new `VocabularyKey`
system covers app-wide UI text that changes by *persona* — tab labels, CTAs, empty states,
history headings. These are complementary, not overlapping.

---

## 3. What Needs to Be Built

### 3.1 Persona Registry
**File**: `src/registry/personas.ts`

Four personas. Each defines:
- Default feature flags (which features are on/off by default for this worker type)
- Vocabulary strings for app-wide UI text (not shift-form terminology — that lives in OperationalModelDef)
- Whether to show the platform grid in onboarding

```typescript
export type PersonaKey =
  | 'gig_worker'       // DoorDash, UberEats, Skip, Instacart
  | 'rideshare'        // Uber, Lyft, InDriver, Pathao
  | 'business_driver'  // Sales reps, realtors, consultants — MileIQ territory
  | 'contractor'       // Trades, freelance, field service

export interface PersonaConfig {
  key: PersonaKey
  label: string
  description: string
  showPlatformSelectorInOnboarding: boolean
  vocabulary: Record<VocabularyKey, string>
  defaultFeatures: Record<FeatureKey, boolean>
}
```

**Persona vocabulary** covers only strings that change across personas at the app level:

```typescript
export type VocabularyKey =
  | 'session'            // shift / drive / job
  | 'session_plural'     // shifts / drives / jobs
  | 'platform'           // platform / purpose / client / app
  | 'active_miles'       // active miles / business miles / work miles / fare miles
  | 'dead_miles'         // dead miles / personal miles / deadhead miles
  | 'revenue'            // earnings / reimbursable / revenue
  | 'start_cta'          // Start shift / Start drive / Start job / Go online
  | 'end_cta'            // End shift / End drive / End job / Go offline
  | 'history_tab'        // Shifts / Drives / Jobs
  | 'active_indicator'   // Active shift / On drive / On job / Online
  | 'no_sessions_yet'    // No shifts yet / No drives yet / No jobs yet
```

**Do not** add `driverTerm`, `tripTerm` here — those belong to `OperationalModelDef`.

**Persona defaults** (`gig_worker` example):
```typescript
defaultFeatures: {
  // Core — always on
  session_tracking_gps:    true,
  session_tracking_manual: true,
  expense_tracking:        true,
  analytics_basic:         true,
  vehicle_profiles:        true,
  csv_export:              true,
  google_drive_backup:     true,
  // Optional — gig worker defaults
  analytics_advanced:      false,
  tax_workspace:           false,
  goals:                   false,
  schedule:                false,
  gamification:            false,
  pdf_reports:             false,
  csv_import:              false,
  android_widget:          false,
  business_personal_split: false,
  mileage_log_export:      false,
}
```

`business_driver` turns `business_personal_split`, `mileage_log_export`, and `tax_workspace`
on by default — this is the MileIQ competitive pitch.

`contractor` turns `tax_workspace` and `mileage_log_export` on by default.

---

### 3.2 Feature Module Registry
**File**: `src/registry/modules.ts`

Every feature compiled into the binary has an entry here. Core features are always on and
not shown in settings. Optional features are user-toggleable unless the country locks them.

```typescript
export type FeatureKey =
  // Core — always on, not shown in settings
  | 'session_tracking_gps'
  | 'session_tracking_manual'
  | 'expense_tracking'
  | 'analytics_basic'
  | 'vehicle_profiles'
  | 'csv_export'
  | 'google_drive_backup'
  // Optional — compiled in, gated by persona/country/user
  | 'analytics_advanced'
  | 'tax_workspace'
  | 'goals'
  | 'schedule'
  | 'gamification'
  | 'pdf_reports'
  | 'csv_import'
  | 'android_widget'
  | 'business_personal_split'
  | 'mileage_log_export'

export interface FeatureModule {
  key: FeatureKey
  label: string
  description: string
  category: 'tracking' | 'financial' | 'analytics' | 'tax' | 'export' | 'productivity' | 'platform_native'
  core: boolean
  userToggleable: boolean
  requires: FeatureKey[]   // enabling this auto-enables these deps
}
```

`mileage_log_export` requires `['business_personal_split']` — enabling the export auto-enables
the classification UI.

---

### 3.3 Extend CountryDef — Do Not Create a New CountryConfig

**File**: `src/registry/countries/index.ts` (extend existing)

Add two fields to the existing `CountryDef` interface:

```typescript
featureOverrides: {
  force_on:  FeatureKey[]   // country hard-enables these (user cannot turn off)
  force_off: FeatureKey[]   // country hard-disables these (user cannot turn on)
}
vocabularyOverrides: Partial<Record<VocabularyKey, string>>
```

**Country override examples:**
- `NP` force_off: `['tax_workspace', 'mileage_log_export', 'google_drive_backup']`
- `UK` force_off: `['tax_workspace']` (UK tax logic deferred to phase 2)
- `CA` vocabularyOverrides: `{ active_miles: 'active km', dead_miles: 'dead km' }`
- `NP` vocabularyOverrides: `{ active_miles: 'active km', dead_miles: 'dead km' }`

This keeps the country registry as a single source of truth rather than duplicating it.

---

### 3.4 Resolution Function + useAppContext Hook
**File**: `src/hooks/useAppContext.ts`

```typescript
export interface ResolvedAppContext {
  persona: PersonaConfig
  country: CountryDef           // existing type — not a new CountryConfig
  vocabulary: Record<VocabularyKey, string>
  features: Record<FeatureKey, boolean>
  platforms: PlatformDef[]      // filtered to country.defaultAvailablePlatforms
}

export function resolveAppContext(
  personaKey: PersonaKey,
  countryKey: string,
  userOverrides: Partial<Record<FeatureKey, boolean>>
): ResolvedAppContext {
  const persona = PERSONAS[personaKey]
  const country = getCountryDef(countryKey)        // existing helper

  // 1. Start with persona defaults
  const features = { ...persona.defaultFeatures }

  // 2. Apply country hard overrides
  for (const key of country.featureOverrides.force_on)  features[key] = true
  for (const key of country.featureOverrides.force_off) features[key] = false

  // 3. Apply user overrides (country force_off wins)
  for (const [key, val] of Object.entries(userOverrides)) {
    if (!country.featureOverrides.force_off.includes(key as FeatureKey)) {
      features[key as FeatureKey] = val
    }
  }

  // 4. Resolve dependency chain — enabling X auto-enables its requires[]
  for (const mod of FEATURE_MODULES) {
    if (features[mod.key]) {
      for (const dep of mod.requires) features[dep] = true
    }
  }

  // 5. Merge vocabulary — country overrides win
  const vocabulary: Record<VocabularyKey, string> = {
    ...persona.vocabulary,
    ...country.vocabularyOverrides,
  }

  // 6. Filter platforms to this country
  const platforms = getPlatformsByCountry(countryKey)   // existing helper

  return { persona, country, vocabulary, features, platforms }
}

export function useAppContext(): ResolvedAppContext {
  const { profile, featureOverrides } = useSettingsStore()
  return useMemo(
    () => resolveAppContext(profile.persona, profile.country, featureOverrides),
    [profile.persona, profile.country, featureOverrides]
  )
}
```

---

### 3.5 Convenience Hooks
**File**: `src/hooks/useFeatureFlag.ts`

```typescript
export function useFeatureEnabled(key: FeatureKey): boolean {
  return useAppContext().features[key] ?? false
}
```

**File**: `src/hooks/useVocabulary.ts`

```typescript
export function useVocabulary() {
  const { vocabulary } = useAppContext()
  return { t: (key: VocabularyKey): string => vocabulary[key] }
}
```

---

### 3.6 Zustand Store — Two New Fields
**File**: `store/useSettingsStore.ts`

Add to the existing store:
```typescript
profile: {
  // ... existing fields ...
  persona: PersonaKey          // set during onboarding, default 'gig_worker'
}
featureOverrides: Partial<Record<FeatureKey, boolean>>   // user-level toggles
```

SQLite persistence under key `'app_config'`:
```typescript
interface StoredAppConfig {
  persona: PersonaKey
  country: string                                       // existing
  featureOverrides: Partial<Record<FeatureKey, boolean>>
}
```

Only store keys that differ from persona defaults in `featureOverrides` — don't
store core features that are always true.

---

## 4. How Screens Use the System

### Vocabulary — no hardcoded strings
```typescript
// Wrong
<Text>No shifts yet</Text>

// Correct — resolves per persona
const { t } = useVocabulary()
<Text>{t('no_sessions_yet')}</Text>
```

### Feature gates
```typescript
// Wrong
{true && <TaxWorkspaceTab />}

// Correct
const showTax = useFeatureEnabled('tax_workspace')
{showTax && <TaxWorkspaceTab />}
```

### Conditional tab navigation (`app/(tabs)/_layout.tsx`)
```typescript
const taxEnabled = useFeatureEnabled('tax_workspace')

<Tabs>
  <Tabs.Screen name="index" />
  <Tabs.Screen name="shifts" />
  <Tabs.Screen name="analytics" />
  <Tabs.Screen name="expenses" />
  {taxEnabled && <Tabs.Screen name="tax" />}
  <Tabs.Screen name="more" />
</Tabs>
```

### Persona-aware onboarding
```typescript
const { persona, platforms } = useAppContext()

// business_driver and contractor skip platform grid
if (!persona.showPlatformSelectorInOnboarding) {
  return <ClientNameStep />
}
return <PlatformGrid platforms={platforms} />
```

### Shift-form terminology — use usePlatformContext, not useVocabulary
```typescript
// For shift-form labels (driver term, trip term, revenue fields):
const { terminology, revenueFields } = usePlatformContext(platformId)
// terminology.sessionTerm → "Batch" (Instacart), "Block" (Amazon Flex), "Shift" (DoorDash)

// For app-level UI text (tab labels, CTAs, empty states):
const { t } = useVocabulary()
// t('history_tab') → "Shifts" / "Drives" / "Jobs"
```

---

## 5. Settings: Feature Toggle Screen

```typescript
// app/settings/index.tsx — Features section
function FeaturesSection() {
  const { features, country } = useAppContext()
  const { updateFeatureOverride } = useSettingsStore()

  return TOGGLEABLE_FEATURE_KEYS.map(key => {
    const mod = FEATURE_MODULE_MAP[key]
    const isLocked = country.featureOverrides.force_off.includes(key)

    return (
      <FeatureToggleRow
        key={key}
        label={mod.label}
        description={mod.description}
        enabled={features[key]}
        locked={isLocked}
        lockedReason={isLocked ? 'Not available in your region' : undefined}
        onToggle={(val) => updateFeatureOverride(key, val)}
      />
    )
  })
}
```

---

## 6. Files to Create or Modify

| Action | File | What changes |
|---|---|---|
| **Create** | `src/registry/personas.ts` | `PersonaKey`, `PersonaConfig`, `PERSONAS` |
| **Create** | `src/registry/vocabulary.ts` | `VocabularyKey` type |
| **Create** | `src/registry/modules.ts` | `FeatureKey`, `FeatureModule`, `FEATURE_MODULES`, helpers |
| **Extend** | `src/registry/countries/index.ts` | Add `featureOverrides` + `vocabularyOverrides` to `CountryDef` |
| **Extend** | `src/registry/index.ts` | Re-export new types |
| **Create** | `src/hooks/useAppContext.ts` | `resolveAppContext()` + `useAppContext()` |
| **Create** | `src/hooks/useFeatureFlag.ts` | `useFeatureEnabled()` |
| **Create** | `src/hooks/useVocabulary.ts` | `useVocabulary()` → `t()` |
| **Extend** | `store/useSettingsStore.ts` | Add `profile.persona` + `featureOverrides` + SQLite persistence |

**Do not create** a new `CountryConfig` type — extend the existing `CountryDef`.

---

## 7. How to Scale Later

### New persona
1. Add key to `PersonaKey` union
2. Add entry to `PERSONAS` with vocabulary + defaultFeatures
3. Add to onboarding picker
4. Done — no screen changes

### New country
1. Add entry to `COUNTRIES` in `countries/index.ts`
2. Add to country picker in onboarding
3. Done — resolution picks up the new `featureOverrides` automatically

### New feature
1. Add key to `FeatureKey` union
2. Add entry to `FEATURE_MODULES`
3. Add boolean to `defaultFeatures` in every persona
4. Build the feature, gate with `useFeatureEnabled('your_key')`
5. Done

### New vocabulary term
1. Add key to `VocabularyKey` union
2. Add string to every persona in `PERSONAS`
3. Add country overrides where needed
4. Use `t('your_key')` in screens
