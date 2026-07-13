# Countries

The markets Comma supports, the one that is enabled, and the ones written but deliberately held back.

<StatRow accent="emerald" items={[{ value: "$0.73/km", label: "first 5,000 km" }, { value: "$0.67/km", label: "every km after" }, { value: "CAD · km", label: "currency and distance" }, { value: "CRA", label: "tax authority" }]} caption="Canada is the only enabled market. The US, UK, and Nepal are written but held back until their tax rules are verified." />

---

## Canada

Canada is the only enabled market. Every default in the app reflects it.

| Property | Value |
|---|---|
| Currency | CAD |
| Distance unit | km |
| Tax authority | Canada Revenue Agency (CRA) |
| Sales tax | HST and GST supported, including input tax credits when registered |
| Provinces | All Canadian provinces, with Ontario fully defined |
| Pension | Canada Pension Plan, with Quebec using QPP |

Ontario is the fully defined province and the default. Other provinces are available and fall back to sensible defaults where a specific value is not yet set.

---

## Mileage rate

Canada uses the CRA automobile allowance rate to value business kilometres.

| Distance in the tax year | Rate per km |
|---|---|
| First 5,000 km | $0.73 |
| Beyond 5,000 km | $0.67 |

The rate applies to automobiles only. A bicycle or e-scooter is not an automobile under CRA rules, so it does not receive the per-kilometre allowance; those vehicles use actual expenses instead. Vehicle type therefore affects whether the mileage deduction is available at all. See [Core concepts](../getting-started/core-concepts.md).

---

## Markets that are not enabled

The codebase contains country definitions for the United States, the United Kingdom, and Nepal. These are written but deliberately not enabled, because their tax rules have not been verified. They do not appear as choices in the app, and their platforms and categories are not available to drivers.

They exist so that adding a market later is a matter of verifying and switching on an existing definition rather than building one from scratch. For how a country is defined and what has to be confirmed before it can be enabled, see [Contributing](../development/contributing.md).
