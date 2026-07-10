# Adding a country

Countries are **static catalog entries** in `src/registry/countries/`. They drive **currency, distance defaults, tax-installment hints, and the `tax` profile** consumed by onboarding, the tax module, notifications, and `Intl` formatting (`formatCurrency` when a 2-letter country code is passed).

For registry background, see [`docs/Registry_arch.md`](Registry_arch.md). After a country exists, you can attach **provinces** whose `countryId` matches — see [`adding-a-province.md`](adding-a-province.md).

---

## Checklist

1. Copy [`src/registry/countries/_TEMPLATE.country.js`](../src/registry/countries/_TEMPLATE.country.js) to `src/registry/countries/{ISO}.country.js` (e.g. `AU.country.js`). Prefer **`CA.country.js`** or **`US.country.js`** as a real-world shape: the template may lag minor optional keys.
2. Set **`id`** to a **two-letter uppercase** ISO market code (`CA`, `US`, `AU`). This must match `user.countryId` / `user.locale.country` wherever you persist that market.
3. Set **`labelKey`** and add the same path under **`strings.en`** and **`strings.fr`** in [`src/utils/strings.js`](../src/utils/strings.js) (e.g. `onboarding.steps.countryUS` — follow existing country keys).
4. Fill **required** top-level fields validated by [`validateCountryDefinition`](../src/registry/countries/index.js): **`currency`**, **`symbol`**, **`distanceUnit`** (`'km'` | `'mi'`), plus **`id`**.
5. Provide **`taxInstallmentDates`** (array of `{ month, day, label }`, optional `followYear`) for [`getNextTaxDeadline`](../src/utils/locale.js) / tax notifications — use `[]` only if truly N/A.
6. Provide a full **`tax`** object (see below). Code paths such as [`getCountryTaxProfile`](../src/registry/countries/index.js) assume **`def.tax`** exists.
7. Optional top-level flags merged into locale-style config via [`countryDefToLocaleConfig`](../src/registry/countries/index.js): e.g. **`hasCPP`**, **`hasHST`**, **`hasSETax`** (see [`CA.country.js`](../src/registry/countries/CA.country.js)). Omit legacy keys you do not use (the template still mentions `mileageRateSource`; current CA omits it — align with how existing countries are written).
8. Register in [`src/registry/countries/index.js`](../src/registry/countries/index.js): `import` + add to **`COUNTRIES`**.
9. If this country has subdivisions in the app, add matching [**province**](../src/registry/provinces/) defs with the same **`countryId`**.
10. Optional **`defaultAvailablePlatforms`**: array of `PlatformRegistry` ids used when **no** province row applies yet (see [`market_resolution.md`](market_resolution.md)). Stripped from locale config via [`countryDefToLocaleConfig`](../src/registry/countries/index.js) so it never leaks into `Intl` / currency helpers.
11. Run `node build.js --prod` and confirm boot passes **`assertCountryRegistryValid()`** ([`main.js`](../src/main.js)).

---

## `tax` profile (required in practice)

`getCountryTaxProfile(countryCode)` returns **`CountryRegistry.getById(code).tax`**. Mirror a peer country and adjust:

| Field | Purpose |
|--------|---------|
| `intlLocaleTag` | BCP-47 tag for `Intl.NumberFormat` when formatting with a country code ([`formatters.js`](../src/utils/formatters.js)). |
| `hstOnboarding` | Whether GST/HST-style onboarding / expense HST UI applies (`true` for Canada). |
| `regionPresetType` | Drives preset behaviour in onboarding / tax copy (`'CA'`, `'US'`, or `null`). |
| Withholding preset tables | CA/US per-region **set-aside %** hints live in [`src/registry/tax/withholding-presets.js`](../src/registry/tax/withholding-presets.js) — do not duplicate maps in country files or modules. |
| `regionLabel` | `'province'` vs `'state'` (wording in onboarding). |
| `defaultWithholdingPct` | Suggested set-aside percentage. |
| `fallbackCurrency` | Same idea as top-level `currency` for tax-specific fallbacks. |
| `hstRateWhenRegistered` | Used where HST-on-goods logic applies (0 when N/A). |
| `calcCpp` / `calcSeTax` | Feature flags for estimator paths. |
| `defaultRegionCode` | Default subdivision code when you need a seed (e.g. `'ON'` for CA). |
| `footnote` / `secondaryEstimator` | Strings consumed by tax / copy layers — copy naming from CA/US/UK until those modules are generalized. |

**v3 note:** Self-employed Canada is **actual vehicle costs**, not CRA standard mileage, in product copy and tax summaries. New `CA`-like defs should stay consistent with [`CA.country.js`](../src/registry/countries/CA.country.js) (no revived `stdMileageChoice` for Ontario-first flows unless you intentionally support another product line).

---

## Fallback behaviour

`CountryRegistry.getById(unknown)` returns **`FALLBACK_ID` (`CA`)** when the code is missing. Changing `FALLBACK_ID` in [`index.js`](../src/registry/countries/index.js) affects every unresolved country code system-wide.

---

## Wiring outside the registry

| Area | Notes |
|------|--------|
| **User / DB defaults** | [`DEFAULT_USER` / migrations](../src/core/db.js) — set `countryId` and `locale.country` / currency consistently when this country should be a default. |
| **`countryDef` in store** | [`store`](../src/core/store.js) resolves `countryDef` from `user.countryId` (and related locale fields). No extra hook is needed if only the catalog row was added. |
| **Onboarding** | Uses [`resolveAvailablePlatformIds`](../src/registry/market/resolve.js) and shared withholding presets — see [`market_resolution.md`](market_resolution.md). |
| **Provinces** | `ProvinceRegistry.getByCountry('XX')` is empty until you add at least one province with `countryId: 'XX'`. |

---

## Minimal skeleton (abbreviated)

```js
// src/registry/countries/AU.country.js
export default {
  id: 'AU',
  labelKey: 'onboarding.steps.countryAU',
  currency: 'AUD',
  symbol: '$',
  distanceUnit: 'km',
  taxInstallmentDates: [
    /* PAYG-ish due dates — research real schedule */
  ],
  tax: {
    taxInstallmentReminderDays: 10,
    hstOnboarding: false,
    intlLocaleTag: 'en-AU',
    defaultWithholdingPct: 25,
    regionPresetType: null,
    fallbackCurrency: 'AUD',
    hstRateWhenRegistered: 0,
    calcCpp: false,
    calcSeTax: false,
    regionLabel: 'state',
    secondaryEstimator: 'none',
    footnote: 'generic',
    defaultRegionCode: '',
  },
};
```

Register:

```js
import AU from './AU.country.js';
const COUNTRIES = [CA, US, UK, AU];
```

---

## QA

- Temporarily set `user.locale.country` / `countryId` to the new code and reload: currency symbol and distance unit should match the def.
- Open **Tax** and **onboarding** flows: no thrown errors from `getCountryTaxProfile`.
- Add at least one **province** (or document “no subdivisions yet”) before shipping a country that expects region-scoped tax UX.

---

## Related files

| File | Role |
|------|------|
| [`src/registry/countries/_TEMPLATE.country.js`](../src/registry/countries/_TEMPLATE.country.js) | Starter file (verify against CA/US). |
| [`src/registry/countries/CA.country.js`](../src/registry/countries/CA.country.js) | Reference for Canada / HST / CPP flags. |
| [`src/registry/countries/US.country.js`](../src/registry/countries/US.country.js) | Reference for `regionPresetType: 'US'`, quarterly labels. |
| [`src/registry/countries/index.js`](../src/registry/countries/index.js) | Registry, `getCountryTaxProfile`, `countryDefToLocaleConfig`, fallback. |
| [`src/utils/locale.js`](../src/utils/locale.js) | `getCountryDef`, tax deadline helpers from installment arrays. |

---

## See also

- [`adding-a-province.md`](adding-a-province.md) — subdivisions; **`countryId`** must match this country’s **`id`**.
- [`adding-a-platform.md`](adding-a-platform.md) — platforms listed on province defs, not usually on the country file itself.
