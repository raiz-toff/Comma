# Adding a province, territory, or state

Provinces — and by the same pattern **states** — are static catalog data attached to a country. Add the **country first** ([adding-a-country.md](adding-a-country.md)) before any province that references its `countryId`. Use Ontario (**`ON`**) as the reference.

---

## Steps

Provinces live **inside their country's folder** and are collected into that country's `_PROVINCES` array.

1. Create `src/registry/countries/{ISO}/provinces/{CODE}.ts` (short uppercase subdivision code, e.g. `BC.ts`). Copy [`CA/provinces/ON.ts`](../../src/registry/countries/CA/provinces/ON.ts) for the shape.
2. `export const {CODE}: ProvinceDef`. Required by the type: **`id`** (uppercase), **`label`**, **`countryId`** (matches the country's `id`), **`salesTaxRate`**, **`isHarmonized`**. Optional: `withholdingPct`, `usesPensionPlan`, `bannedPlatforms`, `secondarySalesTaxRate`, `incomeTaxRate`, and the other fields in [`types.ts`](../../src/registry/countries/types.ts).
3. Add it to the country's list in `{ISO}/index.ts`: `import { {CODE} } from "./provinces/{CODE}"` then include `{CODE}` in `{ISO}_PROVINCES`.
4. That array is spread into `ALL_REGIONS` in [`src/registry/countries/index.ts`](../../src/registry/countries/index.ts) at registration time, which is what `resolveProvinceDef` / `getRegionsByCountry` read.
5. `npx tsc --noEmit` passes.

Every rate is a number a driver acts on. Put the source and the year in a comment next to it.

---

## QA

- Set the profile's region to the new code (Settings → Profile) and reload: the tax screen shows the new region with no error.
- Add an expense: the category list and sales-tax handling match the region.

---

## Related files

| File | Role |
|------|------|
| [`src/registry/countries/CA/provinces/ON.ts`](../../src/registry/countries/CA/provinces/ON.ts) | Reference province. |
| [`src/registry/countries/types.ts`](../../src/registry/countries/types.ts) | `ProvinceDef` type. |
| [`src/registry/countries/index.ts`](../../src/registry/countries/index.ts) | Registry — `ALL_REGIONS`, `resolveProvinceDef`. |
