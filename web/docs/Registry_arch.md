# COMMA — Registry Architecture
### Modular Platform & Country System
#### Add a new company or country by adding ONE file. Zero engine changes.

> **Note:** This document represents the original architectural spec for the registry pattern. While the core philosophy holds true, some implementation details may have evolved in the actual source code. Refer to the active codebase for current schemas.

---

## THE PROBLEM WITH PHASE 2 (AS-BUILT)

Right now the code has this pattern scattered everywhere:

```js
// In tax.js
if (user.country === 'CA') { showHSTSection() }
if (user.country === 'US') { showScheduleC() }

// In shift-form.js
if (platformId === 'doordash') { showPeakPayField() }
if (platformId === 'ubereats') { showSurgeField() }

// In analytics.js
if (platformId === 'amazonflex') { calcBlockEarnings() }
```

This is **hardcoded branching**. Every new country = hunt through 8 files and add more if/else.
Every new platform = same problem. It breaks the open/closed principle and kills future velocity.

---

## THE REGISTRY PATTERN (THE FIX)

Instead of the engine knowing about specific platforms and countries,
**the engine reads from definition files**. The definition IS the feature config.

```
┌─────────────────────────────────────────────────────────┐
│                    REGISTRY LAYER                        │
│                                                          │
│  /src/registry/                                          │
│    platforms/                                            │
│      doordash.platform.js    ←── definition file         │
│      ubereats.platform.js    ←── definition file         │
│      foodora.platform.js     ←── definition file         │
│      ...                                                 │
│      index.js                ←── loads + exports all     │
│    countries/                                            │
│      CA.country.js           ←── definition file         │
│      US.country.js           ←── definition file         │
│      UK.country.js           ←── definition file         │
│      ...                                                 │
│      index.js                ←── loads + exports all     │
│                                                          │
└──────────────────┬──────────────────────────────────────┘
                   │  engine reads definitions
                   ▼
┌─────────────────────────────────────────────────────────┐
│                    ENGINE LAYER                          │
│                                                          │
│  shift-form.js reads:  platform.customFields[]           │
│  tax.js reads:         country.taxModules.*              │
│  analytics.js reads:   platform.analyticsModules.*       │
│  onboarding.js reads:  country.onboardingSteps[]         │
│                                                          │
│  Engine has ZERO hardcoded platform or country names.    │
│  Engine only knows the SCHEMA. Definitions fill it.      │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Adding a new platform** = create one file + register it. Done.
**Adding a new country** = create one file + register it. Done.
**The engine never changes.**

---

## PART 1 — PLATFORM DEFINITION

### File Location
```
src/registry/platforms/{platformId}.platform.js
```

### Full Schema (Required + Optional)

```js
// TEMPLATE: src/registry/platforms/_TEMPLATE.platform.js
// Copy this file, rename it, fill it in.

export default {

  // ═══════════════════════════════════════════
  // REQUIRED — app will not load this platform without these
  // ═══════════════════════════════════════════

  id: 'REQUIRED_UNIQUE_SLUG',       // e.g. 'doordash', 'mytaxi', 'glovo'
  name: 'REQUIRED_DISPLAY_NAME',    // e.g. 'DoorDash', 'My Taxi', 'Glovo'
  color: '#REQUIRED_HEX',           // brand color for badges, charts, tabs

  terminology: {
    driver: 'REQUIRED',             // 'Dasher', 'Courier', 'Driver', 'Rider'
    delivery: 'REQUIRED',           // 'order', 'trip', 'delivery', 'batch'
    bonus: null,                    // 'Peak Pay', 'Surge', 'Boost' — null if platform has none
    surge: null,                    // null if platform has no surge concept
  },


  // ═══════════════════════════════════════════
  // OPTIONAL — fill in as you research the platform
  // ═══════════════════════════════════════════

  logo: null,                       // SVG string for the platform logo
  helpUrl: null,                    // URL to driver earnings support page

  payoutSchedule: null,
  // payoutSchedule: {
  //   type: 'weekly' | 'daily' | 'instant' | 'biweekly',
  //   dayOfWeek: 1,                 // 1=Monday (for weekly payouts)
  //   instantFeePercent: null,      // e.g. 0.015 for 1.5% instant cashout fee
  // },

  ratingSystem: null,
  // ratingSystem: {
  //   label: 'Customer Rating',     // what the platform calls it
  //   minThreshold: 4.2,           // alert driver below this
  //   scale: 5,                    // out of 5 stars
  //   trackWeekly: true,           // log once per week
  // },

  acceptanceSystem: null,
  // acceptanceSystem: {
  //   label: 'Acceptance Rate',
  //   minThreshold: null,          // null = no enforced minimum
  //   trackPerShift: true,
  // },

  completionSystem: null,
  // completionSystem: {
  //   label: 'Completion Rate',
  //   minThreshold: 0.95,          // 95%
  //   trackWeekly: true,
  // },

  cityScore: null,
  // cityScore: {
  //   label: 'City Score',         // Skip the Dishes calls it this
  //   minThreshold: null,
  //   trackWeekly: true,
  // },

  attendanceScore: null,
  // attendanceScore: {
  //   label: 'Attendance Score',   // Foodora calls it this
  //   minThreshold: null,
  //   trackWeekly: true,
  // },

  statusTiers: null,
  // statusTiers: {
  //   label: 'Pro Status',         // Uber Eats calls it this
  //   tiers: ['Blue', 'Gold', 'Platinum', 'Diamond'],
  //   trackHistory: true,
  // },

  // Extra fields that appear on the shift form for THIS platform only.
  // These are rendered by shift-form.js automatically — no code changes.
  customShiftFields: [],
  // customShiftFields: [
  //   {
  //     key: 'peakPayAmount',
  //     label: 'Peak Pay',
  //     type: 'currency',          // 'currency' | 'number' | 'text' | 'select' | 'toggle'
  //     required: false,
  //     options: null,             // for type: 'select' — array of { value, label }
  //     defaultValue: null,
  //     analyticsGroup: 'bonus',   // how analytics aggregates this field
  //   },
  //   {
  //     key: 'dashZone',
  //     label: 'Dash Zone',
  //     type: 'text',
  //     required: false,
  //   },
  //   {
  //     key: 'surgeMultiplier',
  //     label: 'Surge Multiplier',
  //     type: 'number',
  //     required: false,
  //     defaultValue: 1.0,
  //   },
  // ],

  // Analytics modules enabled for this platform.
  // Engine checks these flags — no hardcoded platform names in analytics.js
  analyticsModules: {
    bonusTracking: false,          // true if platform pays separate bonuses
    surgeAnalysis: false,          // true if surge multiplier affects earnings
    blockEarnings: false,          // true for Amazon Flex block-style pay
    batchTracking: false,          // true for Instacart multi-item batches
    orderTypeTracking: false,      // true for Foodora pickup vs delivery split
    questTracking: false,          // true for Uber Eats quests / online time targets
    promotionsTracking: false,     // true for Skip Credits / platform promos
  },

  // Countries where this platform operates.
  // Drives "is this platform available in my country" during onboarding.
  availableIn: [],                 // e.g. ['CA', 'US', 'AU'] — empty = worldwide

  // Platforms this one competes with for cross-platform arbitrage alert (Feature 217)
  competingPlatforms: [],          // e.g. ['ubereats', 'skip']

}
```

### Registry Index
```js
// src/registry/platforms/index.js
// Add one line here when you create a new platform file. Nothing else changes.

import doordash   from './doordash.platform.js'
import ubereats   from './ubereats.platform.js'
import foodora    from './foodora.platform.js'
import skip       from './skip.platform.js'
import instacart  from './instacart.platform.js'
import amazonflex from './amazonflex.platform.js'
// import glovo   from './glovo.platform.js'   ← new platform: ONE line
// import stuart  from './stuart.platform.js'  ← new platform: ONE line

const PLATFORMS = [doordash, ubereats, foodora, skip, instacart, amazonflex]

export const PlatformRegistry = {
  getAll: ()          => PLATFORMS,
  getById: (id)       => PLATFORMS.find(p => p.id === id),
  getActive: (ids)    => PLATFORMS.filter(p => ids.includes(p.id)),
  getByCountry: (cc)  => PLATFORMS.filter(p => !p.availableIn.length || p.availableIn.includes(cc)),
  validate: (def)     => validatePlatformDefinition(def),   // checks required fields
}

function validatePlatformDefinition(def) {
  const required = ['id', 'name', 'color', 'terminology']
  const missing = required.filter(k => !def[k])
  if (missing.length) throw new Error(`Platform definition missing: ${missing.join(', ')}`)
  if (!def.terminology.driver || !def.terminology.delivery)
    throw new Error(`Platform ${def.id} missing terminology.driver or terminology.delivery`)
  return true
}
```

---

## PART 2 — COUNTRY DEFINITION

### File Location
```
src/registry/countries/{ISO_CODE}.country.js
```

### Full Schema (Required + Optional)

```js
// TEMPLATE: src/registry/countries/_TEMPLATE.country.js
// Copy this file, rename to ISO country code (CA, US, GB, AU, FR, DE…)

export default {

  // ═══════════════════════════════════════════
  // REQUIRED — app will not function without these
  // ═══════════════════════════════════════════

  id: 'XX',                          // ISO 3166-1 alpha-2 code: 'CA', 'US', 'GB'
  name: 'REQUIRED',                  // 'Canada', 'United States', 'United Kingdom'
  flag: '🏳️',                        // emoji flag

  currency: {
    code: 'REQUIRED',                // 'CAD', 'USD', 'GBP', 'EUR', 'AUD'
    symbol: 'REQUIRED',              // '$', '£', '€'
    symbolPosition: 'before',        // 'before' | 'after'
    thousandsSeparator: ',',         // ',' (US/CA) | '.' (EU) | ' ' (FR)
    decimalSeparator: '.',           // '.' (US/CA) | ',' (EU)
    decimalPlaces: 2,
  },

  distanceUnit: 'REQUIRED',          // 'km' | 'mi'

  dateFormat: 'REQUIRED',            // 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
  weekStartDay: 1,                   // 0=Sunday, 1=Monday

  timeFormat: '12h',                 // '12h' | '24h'


  // ═══════════════════════════════════════════
  // OPTIONAL TAX MODULES
  // Each module is null (not applicable) or a config object (enabled).
  // The engine checks if module exists — no hardcoded country names in tax.js.
  // Fill in as you research each country's tax system.
  // ═══════════════════════════════════════════

  taxModules: {

    // Self-employment income tax (applies in most countries)
    incomeTax: null,
    // incomeTax: {
    //   label: 'Income Tax',
    //   filingFrequency: 'annual',        // 'annual' | 'quarterly'
    //   defaultWithholdingPct: 25,        // suggested set-aside %
    //   filingHelperType: 'T2125',        // 'T2125' | 'ScheduleC' | 'SelfAssessment' | null
    //   annualDeadline: 'June 15',        // for self-employed filers (display string)
    //   referenceUrl: 'https://...',      // official tax authority URL
    // },

    // Quarterly installment payments
    quarterlyInstallments: null,
    // quarterlyInstallments: {
    //   label: 'Tax Installments',
    //   authority: 'CRA',                 // display name of tax authority
    //   dates: [                          // array of { month, day, label }
    //     { month: 3,  day: 15, label: 'March 15' },
    //     { month: 6,  day: 15, label: 'June 15'  },
    //     { month: 9,  day: 15, label: 'Sep 15'   },
    //     { month: 12, day: 15, label: 'Dec 15'   },
    //   ],
    //   reminderDaysBefore: 14,
    // },

    // Mileage / vehicle deduction
    mileageDeduction: null,
    // mileageDeduction: {
    //   method: 'standard' | 'actual' | 'both',   // what's available
    //   standardRate: {
    //     source: 'CRA' | 'IRS' | 'HMRC',
    //     currentRatePer100km: null,       // set if km-based (CRA)
    //     currentRatePerMile: null,        // set if mile-based (IRS, HMRC)
    //     tiers: null,                     // null or [{ upToKm: 5000, rate: 0.70 }, { rate: 0.64 }]
    //     rateYear: 2024,
    //     updateNote: 'CRA updates this annually — check CRA website each January',
    //     referenceUrl: 'https://...',
    //   },
    //   actualCostAllowed: true,
    //   comparisonEnabled: true,           // show "standard vs actual" comparison (Feature 99)
    //   perVehiclePerYear: true,           // CRA: tracked per vehicle per calendar year
    // },

    // Sales tax registered businesses (HST/GST/VAT)
    salesTax: null,
    // salesTax: {
    //   label: 'HST/GST',                 // 'HST/GST', 'VAT', 'GST'
    //   registrationThreshold: 30000,     // annual earnings above this = must register
    //   thresholdCurrency: 'CAD',
    //   thresholdNote: '$30,000/year for Canadian self-employed',
    //   rates: {                          // province/state-level rates if applicable
    //     default: 0.13,                  // 13% Ontario HST
    //     provinces: {
    //       'ON': 0.13, 'BC': 0.12, 'AB': 0.05, 'QC': 0.14975,
    //       // etc.
    //     }
    //   },
    //   hasITC: true,                     // Input Tax Credits (Canada) — deduct GST on expenses
    //   itcLabel: 'ITC (Input Tax Credit)',
    //   filingFrequency: 'quarterly',     // 'monthly' | 'quarterly' | 'annual'
    //   reminderDaysBefore: 14,
    //   referenceUrl: 'https://...',
    // },

    // Social security / pension contributions
    socialSecurity: null,
    // socialSecurity: {
    //   label: 'CPP Contributions',       // 'CPP', 'SE Tax', 'National Insurance'
    //   type: 'CPP' | 'SE_TAX' | 'NI',
    //   selfEmployedRate: 0.1190,         // CPP rate for self-employed (both halves)
    //   exemptionAmount: 3500,            // basic CPP exemption
    //   maxContributableEarnings: 68500,  // 2024 CPP max
    //   note: 'Self-employed pay both employee and employer portions',
    //   referenceUrl: 'https://...',
    // },

    // Province/State sub-regions (for tax rate presets — Feature 112)
    subRegions: null,
    // subRegions: {
    //   label: 'Province',               // 'Province', 'State', 'Territory'
    //   regions: [
    //     { code: 'ON', name: 'Ontario',         taxRatePct: 28 },
    //     { code: 'BC', name: 'British Columbia', taxRatePct: 26 },
    //     { code: 'AB', name: 'Alberta',          taxRatePct: 22 },
    //     // etc.
    //   ]
    // },

  }, // end taxModules


  // ═══════════════════════════════════════════
  // OPTIONAL — ONBOARDING EXTRAS
  // Extra steps injected into onboarding for this country only.
  // Engine reads this array — no hardcoded country checks in onboarding.js.
  // ═══════════════════════════════════════════

  onboardingExtras: [],
  // onboardingExtras: [
  //   {
  //     stepId: 'hst_registration',
  //     insertAfter: 'tax_withholding',   // step key it follows
  //     component: 'HSTRegistrationStep', // component key in steps.js
  //     condition: (user) => user.country === 'CA',  // optional extra condition
  //   }
  // ],


  // ═══════════════════════════════════════════
  // OPTIONAL — LANGUAGE/LOCALE
  // ═══════════════════════════════════════════

  languages: ['en'],                 // supported language codes for this country
  // languages: ['en', 'fr'],        // Canada supports English + French
  defaultLanguage: 'en',

  numberFormat: {
    // How large numbers are written in this country
    // 1234567.89 →
    example: '1,234,567.89',         // for display in settings
  },


  // ═══════════════════════════════════════════
  // OPTIONAL — PLATFORM AVAILABILITY HINT
  // Which platforms are commonly used in this country.
  // Drives the platform selection screen ordering/filtering.
  // ═══════════════════════════════════════════

  commonPlatforms: [],
  // commonPlatforms: ['doordash', 'ubereats', 'skip', 'instacart'],

  // ═══════════════════════════════════════════
  // OPTIONAL — WELLBEING / LEGAL CONTEXT
  // ═══════════════════════════════════════════

  maxHoursPerDayWarning: 12,        // Feature 55 — hours cap warning
  // Some countries have legal limits worth surfacing, others don't

}
```

### Registry Index
```js
// src/registry/countries/index.js

import CA from './CA.country.js'
import US from './US.country.js'
import GB from './GB.country.js'
// import AU from './AU.country.js'   ← new country: ONE line
// import FR from './FR.country.js'   ← new country: ONE line
// import DE from './DE.country.js'   ← new country: ONE line

const COUNTRIES = [CA, US, GB]

export const CountryRegistry = {
  getAll:    ()    => COUNTRIES,
  getById:   (id)  => COUNTRIES.find(c => c.id === id),
  validate:  (def) => validateCountryDefinition(def),
  hasModule: (countryId, moduleName) => {
    const country = COUNTRIES.find(c => c.id === countryId)
    return country?.taxModules?.[moduleName] != null
  }
}

function validateCountryDefinition(def) {
  const required = ['id', 'name', 'currency', 'distanceUnit', 'dateFormat']
  const missing = required.filter(k => !def[k])
  if (missing.length) throw new Error(`Country definition missing: ${missing.join(', ')}`)
  if (!def.currency.code || !def.currency.symbol)
    throw new Error(`Country ${def.id} missing currency.code or currency.symbol`)
  return true
}
```

---

## PART 3 — HOW THE ENGINE READS REGISTRIES

This is the key shift. Replace every `if (country === 'CA')` with a registry lookup.

### Before (hardcoded — bad):
```js
// tax.js — BEFORE
function renderTaxDashboard(user) {
  if (user.country === 'CA') {
    renderHSTSection()
    renderCPPSection()
    renderCRAMileage()
  }
  if (user.country === 'US') {
    renderSEtaxSection()
    renderIRSMileage()
  }
}
```

### After (registry-driven — good):
```js
// tax.js — AFTER
import { CountryRegistry } from '../registry/countries/index.js'

function renderTaxDashboard(user) {
  const country = CountryRegistry.getById(user.country)

  if (country.taxModules.salesTax)          renderSalesTaxSection(country.taxModules.salesTax)
  if (country.taxModules.socialSecurity)    renderSocialSecuritySection(country.taxModules.socialSecurity)
  if (country.taxModules.mileageDeduction)  renderMileageSection(country.taxModules.mileageDeduction)
  if (country.taxModules.incomeTax)         renderIncomeTaxSection(country.taxModules.incomeTax)
}
```

**Adding Australia** (no HST, no CPP, has GST at 10%, uses km):
- Create `AU.country.js` with `salesTax: { label: 'GST', rate: 0.10, ... }` and `socialSecurity: null`
- Tax dashboard auto-shows GST section, hides CPP section, no code changes

### Shift Form Engine Pattern:
```js
// shift-form.js — AFTER
import { PlatformRegistry } from '../registry/platforms/index.js'

function renderShiftForm(platformId) {
  const platform = PlatformRegistry.getById(platformId)

  // Standard fields always render
  renderStandardFields()

  // Custom fields: platform definition drives this, not if/else
  platform.customShiftFields.forEach(field => {
    renderCustomField(field)
  })

  // Analytics modules
  if (platform.analyticsModules.surgeAnalysis) renderSurgeField(platform)
  if (platform.analyticsModules.blockEarnings)  renderBlockField(platform)
  if (platform.analyticsModules.batchTracking)  renderBatchField(platform)
}
```

### Onboarding Engine Pattern:
```js
// onboarding.js — AFTER
import { CountryRegistry } from '../registry/countries/index.js'

function buildOnboardingSteps(user) {
  const country = CountryRegistry.getById(user.country)

  const baseSteps = [
    'platform_selection', 'driver_name', 'vehicle_setup',
    'work_schedule', 'weekly_goal', 'tax_withholding',
    'distance_unit', 'theme', 'notifications'
  ]

  // Country injects its own extra steps at the right position
  const extras = country.onboardingExtras || []
  extras.forEach(extra => {
    const insertIdx = baseSteps.indexOf(extra.insertAfter) + 1
    baseSteps.splice(insertIdx, 0, extra.stepId)
  })

  return baseSteps
}
```

---

## PART 4 — CONCRETE FILE STRUCTURE ADDITION

Add this to the existing project structure. Slot into Phase 1 as task **F1b** (runs alongside F1).

```
src/
  registry/                         ← NEW FOLDER
    platforms/
      _TEMPLATE.platform.js         ← copy this to add a platform
      doordash.platform.js
      ubereats.platform.js
      foodora.platform.js
      skip.platform.js
      instacart.platform.js
      amazonflex.platform.js
      index.js                      ← PlatformRegistry
    countries/
      _TEMPLATE.country.js          ← copy this to add a country
      CA.country.js
      US.country.js
      GB.country.js
      index.js                      ← CountryRegistry
```

---

## PART 5 — WHAT TO RETROFIT IN PHASE 2 (MINIMAL)

You've finished Phase 2. Here's the exact minimum to refactor. It's surgical, not a rewrite.

### Files to update:

| File | Change |
|---|---|
| `src/modules/platforms/platform-config.js` | Delete this file. Move all platform data into `src/registry/platforms/*.platform.js`. Update imports. |
| `src/utils/locale.js` | Delete country hardcoding. Import `CountryRegistry` instead. All functions accept `countryDef` object. |
| `src/modules/tax/tax.js` | Replace all `if (country === 'CA')` with `if (country.taxModules.X)` |
| `src/modules/shifts/shift-form.js` | Replace `if (platformId === 'doordash')` with `platform.customShiftFields.forEach(...)` |
| `src/modules/analytics/analytics.js` | Replace platform-specific branches with `platform.analyticsModules.*` checks |
| `src/modules/onboarding/steps.js` | Replace hardcoded HST step condition with `country.onboardingExtras` injection |
| `src/modules/notifications/notifications.js` | Replace country-specific deadline hardcoding with `country.taxModules.quarterlyInstallments.dates` |

### Files that DON'T need changes:
- `src/core/db.js` — schema is already generic
- `src/ui/components.js` — purely presentational
- `src/modules/goals/goals.js` — already generic
- `src/modules/reports/reports.js` — already generic
- `src/core/router.js` — not affected
- `src/core/store.js` — not affected

---

## PART 6 — THE "ADD A COMPANY" CHECKLIST

When you research a new delivery platform (e.g. Glovo, Stuart, Lalamove):

```
[ ] 1. Copy _TEMPLATE.platform.js → src/registry/platforms/glovo.platform.js
[ ] 2. Fill REQUIRED fields:
        id, name, color, terminology.driver, terminology.delivery
[ ] 3. Add ONE LINE to src/registry/platforms/index.js
        import glovo from './glovo.platform.js'
        const PLATFORMS = [..., glovo]
[ ] 4. Add to onboarding platform grid (auto-populated from PlatformRegistry.getAll())
[ ] 5. DONE — shift form, analytics, platform switcher, reports all work immediately

Optional as you learn more:
[ ] Fill ratingSystem if platform has driver ratings
[ ] Fill customShiftFields for platform-specific earning types  
[ ] Fill analyticsModules.bonusTracking if platform pays bonuses
[ ] Fill availableIn if platform is region-specific
[ ] Fill payoutSchedule when you know their payout cadence
```

---

## PART 7 — THE "ADD A COUNTRY" CHECKLIST

When you research a new country (e.g. Australia, France, Germany):

```
[ ] 1. Copy _TEMPLATE.country.js → src/registry/countries/AU.country.js
[ ] 2. Fill REQUIRED fields:
        id, name, currency.code, currency.symbol, distanceUnit, dateFormat
[ ] 3. Add ONE LINE to src/registry/countries/index.js
        import AU from './AU.country.js'
        const COUNTRIES = [..., AU]
[ ] 4. DONE — onboarding country picker, currency display, distance units all work

Fill tax modules as you research them (each is independent):
[ ] taxModules.incomeTax        when you know filing requirements
[ ] taxModules.mileageDeduction when you know ATO/HMRC/etc rates  
[ ] taxModules.salesTax         when you know GST/VAT thresholds
[ ] taxModules.socialSecurity   when you know pension contribution rules
[ ] taxModules.subRegions       when you have state/territory tax rates
[ ] onboardingExtras            if country needs a unique onboarding step
[ ] commonPlatforms             once you know which platforms operate there
```

---

## PART 8 — VALIDATION ON APP START

Add to `src/main.js` startup sequence:

```js
// Validate all registry definitions on startup (dev mode only)
// Catches mistakes immediately, not at runtime when a user hits a broken flow
if (process.env.NODE_ENV === 'development') {
  import { PlatformRegistry } from './registry/platforms/index.js'
  import { CountryRegistry }  from './registry/countries/index.js'

  PlatformRegistry.getAll().forEach(p => PlatformRegistry.validate(p))
  CountryRegistry.getAll().forEach(c => CountryRegistry.validate(c))

  console.log(`✓ Registry: ${PlatformRegistry.getAll().length} platforms, ${CountryRegistry.getAll().length} countries`)
}
```

---

## SUMMARY

| Concern | How it's solved |
|---|---|
| Add a new platform | 1 file + 1 import line |
| Add a new country | 1 file + 1 import line |
| Add a tax module to existing country | Edit that country's `.country.js` |
| Add a custom shift field to a platform | Edit that platform's `.platform.js` |
| Engine knows about specific platforms | Never — only reads the schema |
| Engine knows about specific countries | Never — only checks `taxModules.*` |
| Partial country data (you haven't researched tax yet) | Leave modules as `null` — features hide themselves |
| Validate new definitions | Registry validates on startup in dev mode |
| Retrofit cost from Phase 2 | 7 files, surgical find-and-replace of if/else chains |

*COMMA Registry Architecture v1.0*
*The engine never changes. The definitions grow.*