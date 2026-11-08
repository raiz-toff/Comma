# Adding a country

A country is one folder in the registry. Every tax, mileage, currency, and onboarding path reads from the country definition, so adding a market means writing data, not new logic.

Use **`CA`** as the reference implementation. After a country exists you attach **provinces / states** whose `countryId` matches — see [adding-a-province.md](adding-a-province.md).

Every number in a country definition is one a driver acts on. Put the source and the year in a comment next to it, and never copy a neighbouring country's figure.

---

## Steps

A country is a **folder** modelled on [`src/registry/countries/CA/`](../../src/registry/countries/CA/). Copy it and adjust — it is the canonical shape, and the shared `CountryDef` type is enforced by `tsc`, so the compiler guides you.

1. Create `src/registry/countries/{ISO}/` (two-letter uppercase ISO code, e.g. `AU/`).
2. **`{ISO}/index.ts`** — export two things, exactly like `CA/index.ts`:
   - `export const {ISO}: CountryDef` — fill every field the type requires. `mileage` is **required**: give a real `MileageTable`, or `null` for "no researched rates" (the app then reports the driver ineligible instead of inventing a rate). Never copy a neighbouring country's number.
   - `export const {ISO}_PROVINCES: ProvinceDef[]` — the subdivisions (see Part C).
3. **`{ISO}/provinces/{CODE}.ts`** — one file per subdivision, each `export const {CODE}: ProvinceDef`. Copy a file from [`CA/provinces/`](../../src/registry/countries/CA/provinces/) for the shape.
4. **`{ISO}/tax/index.ts`** — if this country uses per-region withholding presets, export `WITHHOLDING_PRESETS_{ISO}` here (mirror [`CA/tax/index.ts`](../../src/registry/countries/CA/tax/index.ts)).
5. **Widen the id unions in [`types.ts`](../../src/registry/countries/types.ts)** if your code isn't already listed: `CountryDef["id"]`, and where relevant `TaxProfile.regionPresetType` and `TaxProfile.footnote`. `tsc` will tell you if you missed one.
6. **Register in [`src/registry/countries/index.ts`](../../src/registry/countries/index.ts):**
   - `import { {ISO}, {ISO}_PROVINCES } from "./{ISO}"`
   - add `{ISO}` to `COUNTRY_MAP` — e.g. `const COUNTRY_MAP = { CA, {ISO} }`
   - spread its regions into `ALL_REGIONS` — `[...CA_PROVINCES, ...{ISO}_PROVINCES]`, or its province picker comes back empty.
7. `npx tsc --noEmit` passes. `assertCountryRegistryValid()` (called at boot) throws on a half-added country — every registered country must carry `id`, `label`, `currency`, `symbol`, `distanceUnit`, a `tax` object, and an explicit `mileage` decision.

---

## Provinces / states

A country with subdivisions needs at least one province, with `countryId` matching the country `id`. Full instructions: [adding-a-province.md](adding-a-province.md).

---

## The `tax` profile

Mirror a peer country (`CA`) and adjust:

| Field | Purpose |
|--------|---------|
| `intlLocaleTag` | BCP-47 tag for `Intl.NumberFormat` when formatting with a country code. |
| `hstOnboarding` | Whether GST/HST-style onboarding and expense HST UI apply (`true` for Canada). |
| `regionPresetType` | Drives preset behaviour in onboarding / tax copy (`CA` or `null`; add a new arm when you introduce another country's presets). |
| Withholding presets | Per-region set-aside percent hints, in `{ISO}/tax/index.ts`. Do not duplicate maps elsewhere. |
| `regionLabel` | `province` vs `state` vs `region` (onboarding wording). |
| `defaultWithholdingPct` | Suggested set-aside percentage. |
| `fallbackCurrency` | Tax-specific currency fallback (same idea as top-level `currency`). |
| `hstRateWhenRegistered` | Used where HST-on-goods logic applies (0 when N/A). |
| `calcCpp` / `calcSeTax` / `calcNI` | Feature flags for estimator paths. |
| `defaultRegionCode` | Default subdivision seed (e.g. `ON` for CA). |
| `footnote` / `secondaryEstimator` | Strings consumed by tax / copy layers — copy naming from `CA` until those modules are generalized. |

---

## Fallback behaviour

An unregistered country code resolves to **`CA`** — loudly (`console.error`), never silently — so a missing country reads as a reported bug, not a plausible-looking wrong number. See `getCountryDef` / `findCountryDef` in [`index.ts`](../../src/registry/countries/index.ts). Changing the fallback id affects every unresolved country code system-wide.

---

## QA

- `npx tsc --noEmit` is clean, and the app boots (`assertCountryRegistryValid()` runs at start).
- Set the profile's country to the new code: currency symbol and distance unit match the def; Tax and onboarding open with no error.
- Add at least one **province / state** before shipping a country that expects region-scoped tax.

---

## Related files

| File | Role |
|------|------|
| [`src/registry/countries/CA/`](../../src/registry/countries/CA/) | Reference (folder: `index.ts` + `provinces/` + `tax/`). |
| [`src/registry/countries/index.ts`](../../src/registry/countries/index.ts) | Registry — `COUNTRY_MAP`, `ALL_REGIONS`, fallback, `assertCountryRegistryValid`. |
| [`src/registry/countries/types.ts`](../../src/registry/countries/types.ts) | `CountryDef` / `TaxProfile` / `ProvinceDef` types + id unions. |

---

## See also

- [adding-a-province.md](adding-a-province.md) — subdivisions; `countryId` must match this country's `id`.
- [contributing.md](contributing.md) — conventions.
