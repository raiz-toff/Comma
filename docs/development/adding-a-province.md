# Adding a province or territory

Provinces — and by the same pattern **states / regions** — are static catalog data attached to a country. Like countries, they are **mirrored across both apps** ([AGENTS.md §1](../../AGENTS.md)): the phone app and the web app each carry their own copy, and the two must share the same `id` and `countryId`. A region one app knows and the other doesn't means mismatched tax hints and platform allow-lists on the same vault.

<StepFlow accent="amber" steps={[{ title: "Phone", body: "Add src/registry/countries/{ISO}/provinces/{CODE}.ts and list it in the country's _PROVINCES." }, { title: "Web", body: "Add web/src/registry/provinces/{ISO}/{CODE}.province.js, then rebuild the generated index." }, { title: "Gate", body: "npx tsc --noEmit and node scripts/check-country-parity.mjs must both pass." }]} caption="Same subdivision, two mirrored files. Add the country first — a province's countryId must point at a country that already exists on both sides." />

**Currently registered: Canada provinces only.** US state stubs were removed with the US country pending accurate tax research. Use Ontario (**`ON`**) as your reference on both sides. Add the **country first** ([adding-a-country.md](adding-a-country.md)) before any province that references its `countryId`.

---

## Part A — Phone app (TypeScript)

On the phone, provinces live **inside their country's folder** and are collected into that country's `_PROVINCES` array.

1. Create `src/registry/countries/{ISO}/provinces/{CODE}.ts` (short uppercase subdivision code, e.g. `BC.ts`). Copy [`CA/provinces/ON.ts`](../../src/registry/countries/CA/provinces/ON.ts) for the shape.
2. `export const {CODE}: ProvinceDef`. Required by the type: **`id`** (uppercase), **`label`**, **`countryId`** (matches the country's `id`), **`salesTaxRate`**, **`isHarmonized`**. Optional: `withholdingPct`, `usesPensionPlan`, `bannedPlatforms`, `secondarySalesTaxRate`, and the other fields in [`types.ts`](../../src/registry/countries/types.ts).
3. Add it to the country's list in [`{ISO}/index.ts`](../../src/registry/countries/CA/index.ts): `import { {CODE} } from "./provinces/{CODE}"` then include `{CODE}` in `{ISO}_PROVINCES`.
4. That array is spread into `ALL_REGIONS` in [`src/registry/countries/index.ts`](../../src/registry/countries/index.ts) at registration time (see the country guide), which is what `resolveProvinceDef` / `getRegionsByCountry` read.
5. `npx tsc --noEmit` passes.

---

## Part B — Web app (JavaScript)

On the web, provinces live under `web/src/registry/provinces/{ISO}/` and `index.js` is **generated** by a script.

1. Create folder `web/src/registry/provinces/{ISO}/` if it does not exist (two-letter country id).
2. Copy [`web/src/registry/provinces/CA/_TEMPLATE.province.js`](../../web/src/registry/provinces/CA/_TEMPLATE.province.js) to `web/src/registry/provinces/{ISO}/{CODE}.province.js`. Use a short uppercase `id` inside the file.
3. Set **`countryId`** to a country that already exists in the web `CountryRegistry`.
4. Fill **`labelKey`** (e.g. `provinces.bc`) and add the same path under **`strings.en`** and **`strings.fr`** in `web/src/utils/strings.js` — mirror every key in both locales.
5. Set **`availablePlatforms`** to an array of `PlatformRegistry` ids (same strings as the platform files' `id`). Only listed platforms count as "available" for that market.
6. Define **`expenseCategories`** (recommended): each row needs a stable **`id`**, an i18n **`labelKey`** (usually under `expenses.cat`), and optional `craLine`, `mixedUse`, `vehicleTypes`. These feed `getAllCategories()`.
7. Optional blocks: `salesTax`, `incomeTax`, `pensionContribution`, `vehicleExpenseMethod`, `referenceUrl`, `vehicleNotes`, `onboardingExtras` — mirror [`CA/ON.province.js`](../../web/src/registry/provinces/CA/ON.province.js).
8. If the region has a withholding hint, add it to the country's table in [`withholding-presets.js`](../../web/src/registry/tax/withholding-presets.js).
9. **Regenerate the index** (see below), then `npm run build` (from `web/`) and ensure `assertProvinceRegistryValid` passes at boot.

### Regenerate the web index

Province modules live under `web/src/registry/provinces/{ISO}/`. After you add or remove a `*.province.js`, regenerate the index (run from `web/`):

```bash
npm run rebuild:provinces
```

This rewrites [`web/src/registry/provinces/index.js`](../../web/src/registry/provinces/index.js): it scans **every two-letter country folder** and imports each `*.province.js` except names starting with `_` (templates). It is country-agnostic — no per-country special cases. Canada keeps Ontario first (it is the fallback), then A–Z. Any other country's folder is picked up automatically once it exists.

---

## Registry rules (enforced)

`validateProvinceDefinition` on the web requires:

| Field | Rule |
|--------|------|
| `id` | Present; looked up with `.toUpperCase()` — keep ids uppercase. |
| `countryId` | Present; must match how you filter with `ProvinceRegistry.getByCountry('CA')`. |
| `availablePlatforms` | Non-empty array of platform id strings. |
| `expenseCategories` | Required key; use a non-empty list for real provinces. An empty array passes the validator but is useless to drivers. |

**Unknown ids:** `ProvinceRegistry.getById(x)` falls back to `FALLBACK_ID` (`ON`). If your primary market is no longer Ontario, change that fallback deliberately — it affects every unresolved `provinceId`.

---

## Wiring outside the registry

| Area | What to do |
|------|------------|
| User default | `DEFAULT_USER` / migrations (web) and phone store defaults — if a new province should be the default, set `provinceId` (and `countryId` / `locale`) consistently. |
| Store | Web `syncLocaleDefsFromUser` already loads `provinceDef` — no change if only catalog data was added. |
| Onboarding | v3 onboarding is Ontario-oriented (`steps.js`). Multi-region onboarding means new steps / selectors — not automatic from the def alone. |
| Tax module | Province-aware summaries may still need updates in `tax.js` for a new tax regime. |

---

## QA

- **Parity:** `node scripts/check-country-parity.mjs` green; `npx tsc --noEmit` clean.
- Set `provinceId` to the new code on **each** app and reload: the active `provinceDef.id` matches.
- Open Expenses then add an expense: the category grid prefers the province `expenseCategories` list.

---

## Related files

| File | Role |
|------|------|
| [`src/registry/countries/CA/provinces/ON.ts`](../../src/registry/countries/CA/provinces/ON.ts) | Phone reference province. |
| [`src/registry/countries/types.ts`](../../src/registry/countries/types.ts) | Phone `ProvinceDef` type. |
| [`web/src/registry/provinces/CA/_TEMPLATE.province.js`](../../web/src/registry/provinces/CA/_TEMPLATE.province.js) | Web starter def. |
| [`web/src/registry/provinces/CA/ON.province.js`](../../web/src/registry/provinces/CA/ON.province.js) | Web full reference implementation. |
| [`web/src/registry/provinces/index.js`](../../web/src/registry/provinces/index.js) | Web registry + validation + fallback (generated). |
| [`web/scripts/rebuild-province-index.js`](../../web/scripts/rebuild-province-index.js) | Regenerates the web index from the folders. |

---

## See also

- [adding-a-country.md](adding-a-country.md) — add the country (both apps) before provinces that reference `countryId`.
- [adding-a-platform.md](../../web/docs/adding-a-platform.md) — add a platform before listing it in `availablePlatforms`.
