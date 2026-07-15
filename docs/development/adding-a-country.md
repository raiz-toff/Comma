# Adding a country

Comma is **two apps that share one vault** ([AGENTS.md §1](../../AGENTS.md)): a TypeScript phone app and a plain-JavaScript web app that read and write the same Drive files. A country is not one change — it is **two mirrored definitions**, one per app, that must agree on every driver-visible number. Register it on one side only and a driver who picks it on the other silently gets the fallback country's currency and tax rate (Canada) — a confidently wrong number on their income.

<VaultFlow accent="emerald" nodes={["Phone — CountryDef folder (TypeScript)", "Web — .country.js file (JavaScript)"]} hub="One shared vault" caption="A country lives twice: src/registry/countries/CA/ on the phone and web/src/registry/countries/CA.country.js on the web. The parity check is the only thing standing between a mismatch and a driver's wrong tax number." />

**Currently registered: Canada only.** US, UK, and NP were removed pending accurate, signed-off tax and mileage research — the app must not offer a country whose numbers aren't verified. Use **`CA`** as your reference implementation on both sides. After a country exists you attach **provinces / states** whose `countryId` matches — see [adding-a-province.md](adding-a-province.md).

---

## The parity contract

Add the country to **both** apps:

| App | Where the country lives |
|---|---|
| Phone (TypeScript) | `src/registry/countries/{ISO}/` — a folder |
| Web (JavaScript) | `web/src/registry/countries/{ISO}.country.js` — one file |

Then run the gate before you commit:

```bash
node scripts/check-country-parity.mjs   # phone and web must register the same ids + numbers
npx tsc --noEmit                        # phone types
```

There is no automated cross-app check beyond parity, so the numbers themselves are on you: same currency, same distance unit, same withholding percentages on both sides.

---

## Part A — Phone app (TypeScript)

The phone side of a country is a **folder** modelled on [`src/registry/countries/CA/`](../../src/registry/countries/CA/). Copy it and adjust — it is the canonical shape, and the shared `CountryDef` type is enforced by `tsc`, so the compiler guides you.

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

## Part B — Web app (JavaScript)

The web side is a single file. Keep it **equivalent in meaning** to the phone def — same id, same currency and unit, same withholding numbers.

1. Copy [`web/src/registry/countries/_TEMPLATE.country.js`](../../web/src/registry/countries/_TEMPLATE.country.js) to `web/src/registry/countries/{ISO}.country.js`. Prefer [`CA.country.js`](../../web/src/registry/countries/CA.country.js) as the real-world shape — the template may lag optional keys.
2. Set **`id`** to the same two-letter uppercase ISO code as the phone side. It must match `user.countryId` / `user.locale.country` wherever you persist that market.
3. Set **`labelKey`** and add the same path under **`strings.en`** and **`strings.fr`** in `web/src/utils/strings.js` (follow the existing country keys).
4. Fill the **required** top-level fields validated by `validateCountryDefinition` in [`web/src/registry/countries/index.js`](../../web/src/registry/countries/index.js): **`id`**, **`currency`**, **`symbol`**, **`distanceUnit`** (`km` or `mi`), and a **`mileage`** key (a table, or `null`).
5. Provide **`taxInstallmentDates`** (`month`, `day`, `label`, optional `followYear`) for tax deadline helpers / notifications — an empty array only if truly N/A.
6. Provide a full **`tax`** object (see below). `getCountryTaxProfile` assumes `def.tax` exists.
7. Optional flags merged into locale-style config via `countryDefToLocaleConfig`: e.g. `hasCPP`, `hasHST`, `hasSETax` (see `CA.country.js`). Omit legacy keys you don't use.
8. **Register** in [`web/src/registry/countries/index.js`](../../web/src/registry/countries/index.js): add the `import` and append to **`COUNTRIES`** — e.g. `const COUNTRIES = [CA, {ISO}]`.
9. Optional **`defaultAvailablePlatforms`**: `PlatformRegistry` ids used when no province row applies yet (see [market_resolution.md](../../web/docs/market_resolution.md)).
10. If the country uses per-region withholding hints, add its table to [`web/src/registry/tax/withholding-presets.js`](../../web/src/registry/tax/withholding-presets.js) and teach `getWithholdingPresetPct` / `buildRegionOptions` its `regionPresetType`. Do **not** duplicate maps in country files or modules.
11. `npm run build` (from `web/`) and confirm boot passes `assertCountryRegistryValid()`.

---

## Part C — Provinces / states

A country with subdivisions needs at least one province on **each** side, with `countryId` matching the country `id`. Full instructions: [adding-a-province.md](adding-a-province.md).

---

## The `tax` profile

Mirror a peer country (`CA`) and adjust:

| Field | Purpose |
|--------|---------|
| `intlLocaleTag` | BCP-47 tag for `Intl.NumberFormat` when formatting with a country code. |
| `hstOnboarding` | Whether GST/HST-style onboarding and expense HST UI apply (`true` for Canada). |
| `regionPresetType` | Drives preset behaviour in onboarding / tax copy (`CA` or `null`; add a new arm when you introduce another country's presets). |
| Withholding presets | Per-region set-aside percent hints. Phone: `{ISO}/tax/index.ts`. Web: `withholding-presets.js`. Do not duplicate maps elsewhere. |
| `regionLabel` | `province` vs `state` vs `region` (onboarding wording). |
| `defaultWithholdingPct` | Suggested set-aside percentage. |
| `fallbackCurrency` | Tax-specific currency fallback (same idea as top-level `currency`). |
| `hstRateWhenRegistered` | Used where HST-on-goods logic applies (0 when N/A). |
| `calcCpp` / `calcSeTax` / `calcNI` | Feature flags for estimator paths. |
| `defaultRegionCode` | Default subdivision seed (e.g. `ON` for CA). |
| `footnote` / `secondaryEstimator` | Strings consumed by tax / copy layers — copy naming from `CA` until those modules are generalized. |

---

## Fallback behaviour

An unregistered country code resolves to **`CA`** — loudly (`console.error`), never silently — so a missing country reads as a reported bug, not a plausible-looking wrong number. Phone: `getCountryDef` / `findCountryDef` in [`index.ts`](../../src/registry/countries/index.ts). Web: `CountryRegistry.getById` / `findCountryDef` in [`index.js`](../../web/src/registry/countries/index.js). Changing the fallback id affects every unresolved country code system-wide.

---

## QA

- **Parity first:** `node scripts/check-country-parity.mjs` is green (phone and web agree).
- Temporarily set the profile's country to the new code on **each** app and reload: currency symbol and distance unit match the def; Tax and onboarding open with no thrown error from `getCountryTaxProfile`.
- Add at least one **province** on both sides (or document "no subdivisions yet") before shipping a country that expects region-scoped tax UX.

---

## Related files

| File | Role |
|------|------|
| [`src/registry/countries/CA/`](../../src/registry/countries/CA/) | Phone reference (folder: `index.ts` + `provinces/` + `tax/`). |
| [`src/registry/countries/index.ts`](../../src/registry/countries/index.ts) | Phone registry — `COUNTRY_MAP`, `ALL_REGIONS`, fallback, `assertCountryRegistryValid`. |
| [`src/registry/countries/types.ts`](../../src/registry/countries/types.ts) | Phone `CountryDef` / `TaxProfile` / `ProvinceDef` types + id unions. |
| [`web/src/registry/countries/_TEMPLATE.country.js`](../../web/src/registry/countries/_TEMPLATE.country.js) | Web starter (verify against `CA.country.js`). |
| [`web/src/registry/countries/index.js`](../../web/src/registry/countries/index.js) | Web registry, `getCountryTaxProfile`, `countryDefToLocaleConfig`, fallback. |
| [`scripts/check-country-parity.mjs`](../../scripts/check-country-parity.mjs) | The cross-app gate. Run it. |

---

## See also

- [adding-a-province.md](adding-a-province.md) — subdivisions; `countryId` must match this country's `id`, on both apps.
- [contributing.md](contributing.md) — conventions across both apps.
- [adding-a-platform.md](../../web/docs/adding-a-platform.md) — platforms listed on province defs, not usually on the country file.
