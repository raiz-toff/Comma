# Tax Center

Comma estimates what you'll owe so nothing is a surprise at filing time. These are estimates to bring to an accountant, **not tax advice and not a filing service** — always verify with a professional before you file.

<MoneySplit total="$142.00 gross" parts={[{ label: "set aside for the CRA", pct: 28, accent: "amber" }, { label: "yours to keep", pct: 72, accent: "emerald" }]} caption="Estimates to bring to an accountant — not tax advice. The mileage write-off is a deduction, never cash: it lowers the income you are taxed on." />

---

## What it estimates

Comma builds your estimate from your own records, using CRA rules. The starting point is taxable income:

```
  taxable income = gross + tips + bonus
                 − deductible expenses (each weighted by its business-use %)
                 − mileage deduction
```

From that taxable income, Comma estimates the pieces below.

---

## CPP and QPP

Canada Pension Plan contributions on your self-employment income, including the **CPP2** upper tier for earnings above the first ceiling. If your province is **Quebec**, Comma uses the Quebec Pension Plan (QPP) instead.

---

## Income tax

Estimated as your taxable income multiplied by the **set-aside / withholding rate** you set. This is a planning figure, not a bracket-by-bracket return — it tells you roughly how much to hold back from each dollar.

---

## HST / GST

Remittable sales tax is estimated **only if you mark yourself HST-registered**. When you do, Comma estimates what you owe as tax collected minus your input tax credits. In Ontario the rate is 13%. If you're not registered, this section stays out of your way.

---

## The mileage write-off is a deduction, never cash

The mileage write-off **reduces your taxable income** and appears as a deduction line. It is never presented as money earned. Driving 100 km at the CRA rate lowers the income you're taxed on — it does not add to your take-home. This distinction is load-bearing throughout Comma; see [Standard mileage vs actual](../getting-started/core-concepts.md#standard-mileage-vs-actual-expenses).

---

## The Tax Jar

The Tax Jar is a manual set-aside balance you keep per year. Its **target** is your gross earnings times your rate — the amount you should have parked for taxes. A **quick-add** button lets you record money as you move it aside, and the jar shows how close you are to the target. Nothing moves real money; it's a tracker for the habit of setting tax aside.

---

## Deadlines

Comma tracks the Canadian dates and reminds you roughly ten days ahead of each:

| Deadline | Date |
|---|---|
| Quarterly instalment | March 15 |
| Quarterly instalment | June 15 |
| Quarterly instalment | September 15 |
| Quarterly instalment | December 15 |
| Self-employed filing | June 15 the following year |

---

## Threshold alerts

When a platform that issues a **T4A** passes **CAD 500** in earnings for the year, Comma flags it — that's the point the slip becomes relevant to your return.

---

## Export

Export a tax summary as **JSON** or **CSV** to hand to an accountant or keep for your records.

---

## A note on other countries

Comma ships for Canada only, and every number above uses CRA rules. Definitions for other countries were removed until their tax numbers can be verified — see [Countries](../reference/countries.md).

---

## Related

- [Vehicles](./vehicles.md) — tax profiles and deduction methods per vehicle
- [Core Concepts](../getting-started/core-concepts.md) — standard mileage vs actual expenses
