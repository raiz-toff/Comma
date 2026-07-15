# Countries

The single market Comma ships today, and how a new one gets added.

<StatRow accent="emerald" items={[{ value: "$0.73/km", label: "first 5,000 km" }, { value: "$0.67/km", label: "every km after" }, { value: "CAD · km", label: "currency and distance" }, { value: "CRA", label: "tax authority" }]} caption="Canada is the only market Comma ships. Adding another means writing a new country definition from scratch — none are waiting in the codebase." />

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

## Adding another market

Canada is the only country in the codebase. Earlier definitions for the United States, the United Kingdom, and Nepal were removed, because their tax and mileage rules had not been verified and Comma will not offer a country whose numbers have not been signed off.

Adding a market means writing a new country definition from scratch, using Canada as the template — it is data, not new logic, since nothing in the app branches on the country id. For how a country is defined and what has to be confirmed before it can ship, see [Adding a country](../development/adding-a-country.md).
