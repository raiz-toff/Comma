# Adding a platform

This guide describes how to add a **new gig platform** to Macadam. Platforms are **data-only**: one definition file plus registry wiring. The shift form, terminology merge, and analytics gates read from `PlatformRegistry`—they should not need new `if (platformId === '…')` branches for a normal addition.

For broader registry philosophy, see [`Registry_arch.md`](Registry_arch.md) in this folder.

---

## Checklist

1. Copy [`src/registry/platforms/_TEMPLATE.platform.js`](../src/registry/platforms/_TEMPLATE.platform.js) to `src/registry/platforms/{id}.platform.js` (use a **lowercase** slug for `id`, e.g. `glovo`).
2. Fill **required** fields and optional sections (`specificSchema`, `alertChecks`, etc.).
3. Add or reuse a **logo** SVG in [`src/registry/platforms/_logos.js`](../src/registry/platforms/_logos.js).
4. Register the module in [`src/registry/platforms/index.js`](../src/registry/platforms/index.js): `import` + entry in the `PLATFORMS` array (**keep `other` last**).
5. If the platform should appear for a **province-first** market (e.g. Ontario), add its `id` to that province’s `availablePlatforms` (e.g. [`src/registry/provinces/CA/ON.province.js`](../src/registry/provinces/CA/ON.province.js)).
6. Run `node build.js --prod` and fix any validation issues reported at startup (`assertPlatformRegistryValid` in `main.js`).

---

## Definition file

**Path:** `src/registry/platforms/{id}.platform.js`  
**Export:** `export default { … }` (one catalog object per file).

### Required fields

These are enforced by `validatePlatformDefinition` in [`src/registry/platforms/index.js`](../src/registry/platforms/index.js):

| Field | Notes |
|--------|--------|
| `id` | Unique string slug, lowercase (e.g. `skip`). Used everywhere: Dexie `platforms.id`, shift `platformId`, and other stable string keys. |
| `name` | Human-readable label (e.g. `SkipTheDishes`). |
| `color` | CSS hex for badges, charts, tabs (e.g. `#ED5A1F`). |
| `terminology` | Object with at least **`driver`** and **`delivery`** non-empty strings. Optional: `bonus`, `surge` (used in copy and live labels). |
| `logo` | SVG string (typically imported from `_logos.js`). |
| `relevantFields` | Array of string keys for metrics/UI hints; may be `[]`. |
| `helpUrl` | Support URL string; use `''` if none. |

### Common optional fields

| Field | Notes |
|--------|--------|
| `payoutWeekday` | `0`–`6` (Sunday–Saturday) or omit; used where payout hints exist. |
| `analyticsModules` | Feature flags analytics may consult via `platformAnalyticsEnabled` (see below). Prefer listing every key for clarity, matching existing platforms. |
| `specificSchema` | Per-platform **extra shift fields** rendered automatically on the shift form for this `platformId`. **Not** used on `id === 'other'` by validation rules for schema rows—keep `other` minimal. |
| `alertChecks` | Optional rules for notification-style checks (see schema in [`src/registry/types.js`](../src/registry/types.js) `PlatformAlertCheckDef`). |

The canonical TypeScript-style shape is documented as **`PlatformCatalogEntry`** in [`src/registry/types.js`](../src/registry/types.js).

---

## `specificSchema` (platform-only shift fields)

Each entry drives an extra control on the advanced shift form:

```js
specificSchema: [
  { key: 'creditsPromos', kind: 'number', min: 0 },
  { key: 'cityScore', kind: 'number', min: 0, max: 100 },
  { key: 'notes', kind: 'string' },
  { key: 'tags', kind: 'stringArray' },
  { key: 'meta', kind: 'object' },
],
```

Supported **`kind`** values: `'number' | 'string' | 'object' | 'stringArray'`.

Optional: `min`, `max`, `labelKey` (i18n key under `shifts.ps.*` or your own `t()` key).

Values are stored with the shift under **`customFields`** (merged with legacy `platformSpecific` during save/migration). Do not invent parallel storage keys unless you extend the pipeline.

---

## `analyticsModules`

Boolean map used by [`src/modules/analytics/analytics.js`](../src/modules/analytics/analytics.js) via **`platformAnalyticsEnabled(platformId, module)`** from [`src/registry/platforms/terminology.js`](../src/registry/platforms/terminology.js).

Keys used today (mirror a real platform file, e.g. [`skip.platform.js`](../src/registry/platforms/skip.platform.js)):

- `bonusTracking`
- `surgeAnalysis`
- `blockEarnings`
- `batchTracking`
- `orderTypeTracking`
- `questTracking`
- `promotionsTracking`

Set a flag to `true` only if analytics logic for that module is meaningful for the new platform.

---

## Logos

1. Add something like `export const SVG_XX = \`<svg …></svg>\`;` to [`_logos.js`](../src/registry/platforms/_logos.js), or reuse an existing export.
2. In `{id}.platform.js`: `import { SVG_XX } from './_logos.js';` then `logo: SVG_XX`.

Keep SVG compact; it is bundled as a string.

---

## Registry registration

Edit [`src/registry/platforms/index.js`](../src/registry/platforms/index.js):

```js
import myplatform from './myplatform.platform.js';

const PLATFORMS = [
  doordash,
  ubereats,
  // …
  myplatform,
  other, // must remain last: fallback catalog entry
];
```

`PlatformRegistry.getById(unknown)` resolves unknown ids to **`other`**, so `other` stays the safe tail.

---

## Province / market availability

Ontario (and other provinces) expose **`availablePlatforms`**: an array of platform **`id`** strings. If your platform operates in that market, append its `id` there (e.g. [`CA/ON.province.js`](../src/registry/provinces/CA/ON.province.js) `availablePlatforms`).

If you skip this step, the catalog still loads, but onboarding and province-driven UX may not surface the platform where you expect.

For **country-level** defaults when no province row exists (e.g. many US states), add **`defaultAvailablePlatforms`** on the country definition; resolution order is in [`market_resolution.md`](market_resolution.md).

---

## Exports and stable ids

- **Onboarding setup JSON** uses `exportKind: 'macadam_setup'`, a numeric **`version`**, and arrays of platform ids in the same **lowercase** form as the registry. **`countryId`** and **`provinceId`** (or tax region code) travel with the export for portable imports.
- Treat **`id`** as immutable once users have data; renaming requires a Dexie migration mapping old → new ids.
- Full rules: [market_resolution.md](market_resolution.md) (exports and portability).

---

## Terminology overrides (Dexie)

Base terminology comes from the platform definition. Active rows in IndexedDB `platforms` can carry a per-user **`terminology`** object; at runtime those merge in **`syncPlatformTerminologyFromRows`** (see [`terminology.js`](../src/registry/platforms/terminology.js)). You normally do not change code for that—only the default def in `{id}.platform.js`.

---

## Validation and QA

- **Startup:** `assertPlatformRegistryValid()` walks every definition; invalid `specificSchema` / `alertChecks` throws during boot.
- **Build:** `node build.js --prod` must succeed.
- **Manual:** Enable the platform in Settings, open **Add shift**, pick the platform, and confirm `specificSchema` fields render and save; reload and edit to confirm round-trip.

---

## Minimal real-world references

| Example | Use when |
|---------|-----------|
| [`other.platform.js`](../src/registry/platforms/other.platform.js) | Fallback: no `specificSchema`. |
| [`skip.platform.js`](../src/registry/platforms/skip.platform.js) | Small schema + `promotionsTracking`. |
| [`doordash.platform.js`](../src/registry/platforms/doordash.platform.js) | Schema + `alertChecks`. |

---

## Related files (quick map)

| Area | File |
|------|------|
| Template | `src/registry/platforms/_TEMPLATE.platform.js` |
| Registry + validation | `src/registry/platforms/index.js` |
| Logo strings | `src/registry/platforms/_logos.js` |
| Typedefs | `src/registry/types.js` (`PlatformCatalogEntry`) |
| Terminology merge | `src/registry/platforms/terminology.js` |
| Shift form extras | `src/modules/shifts/shift-form.js` (reads `specificSchema`) |
| Ontario market list | `src/registry/provinces/CA/ON.province.js` |

If you add a new **analytics module** name, you must implement the corresponding checks in analytics (or leave the flag `false` until you do).

---

## See also

- [`adding-a-province.md`](adding-a-province.md) — province registry, `availablePlatforms`, and expense categories.
- [`adding-a-country.md`](adding-a-country.md) — country registry and `tax` profile before wiring provinces.
