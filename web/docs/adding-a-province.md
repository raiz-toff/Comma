# Adding a province or territory

Provinces (and, by the same pattern, **states / regions**) are **static catalog data** in `src/registry/provinces/`. The app resolves `user.provinceId` through **`ProvinceRegistry`** and exposes the active row as **`store` → `provinceDef`** for tax hints, expense categories, and platform allow-lists.

**Country-first overrides:** when a province row exists, its **`availablePlatforms`** (and future per-province keys) win over the country’s **`defaultAvailablePlatforms`** — see [`market_resolution.md`](market_resolution.md). If no province row matches `(countryId, provinceId)`, `store.provinceDef` may be **`null`**; features should tolerate that. **Folder layout:** `src/registry/provinces/{CA|US|…}/**/*.province.js` — one country folder per ISO market, then one module per subdivision (see [`CA/ON.province.js`](../src/registry/provinces/CA/ON.province.js) and [`US/TX.province.js`](../src/registry/provinces/US/TX.province.js)).

For registry philosophy, see [`docs/Registry_arch.md`](Registry_arch.md). For plan-level intent (Ontario-first v3), see [`docs/planv3.md`](planv3.md).

---

## Checklist

1. Create folder `src/registry/provinces/{ISO}/` if it does not exist (two-letter country id, same as [`CountryRegistry`](../src/registry/countries/index.js)).
2. Copy [`src/registry/provinces/CA/_TEMPLATE.province.js`](../src/registry/provinces/CA/_TEMPLATE.province.js) to `src/registry/provinces/{ISO}/{CODE}.province.js` (e.g. `CA/BC.province.js`, `UK/ENG.province.js`). For **US** states, add `US/{CODE}.province.js` using the one-line pattern in an existing state file (see [`US/_usStateProvince.js`](../src/registry/provinces/US/_usStateProvince.js) + e.g. [`US/TX.province.js`](../src/registry/provinces/US/TX.province.js)). Use a **short uppercase** `id` inside the file for the subdivision code.
3. Set **`countryId`** to a country that already exists in [`CountryRegistry`](../src/registry/countries/index.js) (`CA`, `US`, …).
4. Fill **`labelKey`** (e.g. `provinces.bc`) and add the same path under **`strings.en`** and **`strings.fr`** in [`src/utils/strings.js`](../src/utils/strings.js) — `t()` walks dot segments, so `provinces.bc` maps to nested `provinces → bc` string leaves (mirror every key in both locales).
5. Set **`availablePlatforms`** to an array of **`PlatformRegistry` ids** (same strings as `doordash.platform.js` `id`). Only listed platforms are treated as “available” for that market when building picker / province-driven UX.
6. Define **`expenseCategories`** (recommended): each row needs stable **`id`**, i18n **`labelKey`** (usually under `expenses.cat.*` — see [`CA/ON.province.js`](../src/registry/provinces/CA/ON.province.js)), and optional **`craLine`**, **`mixedUse`**, **`vehicleTypes`** for driver guidance. These feed [`getAllCategories()`](../src/modules/expenses/expenses.js) when `store.get('provinceDef')` is set.
7. Optional blocks: **`salesTax`**, **`incomeTax`**, **`pensionContribution`**, **`vehicleExpenseMethod`**, **`referenceUrl`**, **`vehicleNotes`**, **`onboardingExtras`** — mirror the shape used in [`CA/ON.province.js`](../src/registry/provinces/CA/ON.province.js) where applicable.
8. Run **`npm run rebuild:provinces`** so [`index.js`](../src/registry/provinces/index.js) imports the new file (all country folders are scanned). For **US** states using the shared factory, also add a row to [`withholding-presets.js`](../src/registry/tax/withholding-presets.js) when a withholding hint applies.
9. Run `node build.js --prod` and ensure startup validation passes (`assertProvinceRegistryValid` in [`main.js`](../src/main.js)).

### Regenerate `index.js` (all countries) + US stubs

Province modules live under **`src/registry/provinces/{ISO}/`** (e.g. `CA/`, `US/`, `UK/`). After you add or remove a `*.province.js` there, or you change **`WITHHOLDING_PRESETS_US`**, run:

```bash
npm run rebuild:provinces
```

This **rewrites** [`index.js`](../src/registry/provinces/index.js): it scans **every two-letter country folder** and imports each `*.province.js` except names starting with **`_`** (templates). **Canada:** Ontario stays first in the `CA/` list, then other provinces A–Z. **US:** order follows the withholding map; **missing** `US/{CODE}.province.js` stubs are created (factory one-liner). Other countries (e.g. **`UK/`**) are picked up automatically once the folder and files exist.

To **overwrite every** US stub:

```bash
node scripts/rebuild-province-index.js --force-us
```

Then run `npm run build` as usual.

## Registry rules (enforced)

[`validateProvinceDefinition`](../src/registry/provinces/index.js) requires:

| Field | Rule |
|--------|------|
| `id` | Present; looked up with **`.toUpperCase()`** — keep ids uppercase in the file. |
| `countryId` | Present; must match how you filter with `ProvinceRegistry.getByCountry('CA')`. |
| `availablePlatforms` | **Non-empty array** of platform id strings. |
| `expenseCategories` | Required key; use a **non-empty** list for real provinces (each entry: `id`, `labelKey`, optional `craLine`, `mixedUse`, `vehicleTypes`). An empty array `[]` is valid for the validator but useless for drivers. |

**Unknown ids:** `ProvinceRegistry.getById(x)` falls back to **`FALLBACK_ID` (`ON`)** when the id is missing from the map. If your primary market is no longer Ontario, consider changing that fallback in `index.js` deliberately (it affects every unresolved `provinceId`).

---

## Field reference (practical)

### `labelKey`

String passed to `t()`. Add nested keys in `strings.js` for both locales so UI does not show raw key paths.

### `availablePlatforms`

Subset of [`PlatformRegistry`](../src/registry/platforms/index.js) ids. If you add a **new** platform and want it in this province, add the platform file **first**, then include its `id` here.

### `expenseCategories`

Used when merging province-first categories in **`getAllCategories()`**: province rows come first; remaining global registry categories fill gaps. **`id`** values should align with expense **`category`** values saved in Dexie where possible.

### `salesTax` / `incomeTax`

Optional objects for HST/GST/PST-style metadata and rough marginal brackets (planning / UI — not legal advice). Copy structure from ON and adjust keys, rates, and `labelKey` / `infoKey` string ids.

### `onboardingExtras`

Small declarative hooks for onboarding (see ON: HST registration toggle). The orchestrator must know how to interpret each `type`; adding a new `type` requires **code changes** in onboarding, not only data.

### `vehicleNotes` / `referenceUrl`

Optional strings for province-specific copy keys and CRA/help links.

---

## Wiring outside the registry

| Area | What to do |
|------|------------|
| **User default** | [`DEFAULT_USER` / migrations](../src/core/db.js) — if a new province should be the default for new vaults, set `provinceId` (and `countryId` / `locale`) consistently. |
| **Store** | [`syncLocaleDefsFromUser`](../src/core/store.js) already loads `provinceDef` from `getProvinceDef(user.provinceId)` — no change needed if only catalog data was added. |
| **Onboarding** | Current v3 onboarding is **Ontario-oriented** in [`steps.js`](../src/modules/onboarding/steps.js) (fixed `taxRegion` / CA flow). Adding provinces for **multi-region** onboarding means new steps or selectors — not automatic from the def file alone. |
| **Tax module** | Province-aware summaries read country + user + expense data; heavy province logic may still need updates in [`tax.js`](../src/modules/tax/tax.js) for new regimes. |

---

## Minimal example skeleton

```js
// src/registry/provinces/BC.province.js
export default {
  id: 'BC',
  countryId: 'CA',
  labelKey: 'provinces.bc',
  availablePlatforms: ['doordash', 'ubereats', 'skip', 'instacart', 'other'],
  salesTax: { name: 'GST+PST', rate: 0.12, /* … */ },
  incomeTax: { suggestedSetAsidePct: 25, brackets: [/* … */] },
  expenseCategories: [
    { id: 'fuel', labelKey: 'expenses.cat.fuel', craLine: '…' },
    // …
  ],
  vehicleExpenseMethod: 'actual_costs',
  onboardingExtras: [],
};
```

Then in `index.js`:

```js
import BC from './BC.province.js';
const PROVINCES = [ON, BC];
```

---

## QA

- Set `user.provinceId` to the new code (Settings or Dexie) and reload: **`store.provinceDef.id`** should match.
- Open **Expenses → add**: category grid should prefer the province **`expenseCategories`** list.
- Grep for hardcoded `'ON'` outside migrations/fallbacks; replace with `provinceDef` or `user.provinceId` where appropriate when you truly support multiple provinces.

---

## Related files

| File | Role |
|------|------|
| [`src/registry/provinces/CA/_TEMPLATE.province.js`](../src/registry/provinces/CA/_TEMPLATE.province.js) | Empty-ish starter def (Canada). |
| [`src/registry/provinces/CA/ON.province.js`](../src/registry/provinces/CA/ON.province.js) | Full reference implementation (Canada). |
| [`src/registry/provinces/US/_usStateProvince.js`](../src/registry/provinces/US/_usStateProvince.js) | Shared factory for default US state rows. |
| [`src/registry/provinces/index.js`](../src/registry/provinces/index.js) | Registry + validation + fallback. |
| [`src/utils/locale.js`](../src/utils/locale.js) | `getProvinceDef` wrapper. |
| [`src/modules/expenses/expenses.js`](../src/modules/expenses/expenses.js) | `getAllCategories()` merges `provinceDef.expenseCategories`. |

---

## See also

- [`adding-a-platform.md`](adding-a-platform.md) — add a platform before listing it in `availablePlatforms`.
- [`adding-a-country.md`](adding-a-country.md) — add the country before provinces that reference `countryId`.
