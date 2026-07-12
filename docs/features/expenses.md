# Expenses

Log the business costs of driving — fuel, maintenance, phone, and the rest — so they reduce your taxable income and sit alongside your earnings. Amounts are in CAD.

---

## The expense form

Add an expense from the Expenses tab. The form collects:

| Field | Detail |
|---|---|
| Amount | The cost in CAD. |
| Date | When you paid it. |
| Merchant / Vendor | Free text, with autocomplete from merchants you've entered before. |
| Category | Chosen from a grid — see the table below. |
| Tax Deductible | Yes or no. |
| Business Use % | 0 to 100, with quick picks of 25, 50, 75, and 100. Drives how much of the amount is deductible. |
| Vehicle | Optional link to one of your vehicles. |
| Shift | Optional link to a shift. Comma suggests shifts within seven days either side of the date. |
| Notes | Optional free text. |
| Receipt photo | Optional image of the receipt. |
| Recurring | Optional toggle with a weekly, monthly, or yearly interval. |

Business use is stored as a percentage rather than a yes/no flag because real costs are mixed-use. A phone bill that is half personal is 50%, and only half of it reduces your taxable income.

---

## Categories

There are 20 categories:

| | | |
|---|---|---|
| Fuel | Maintenance | Parking |
| Tolls | Insurance | Licensing |
| Interest | Leasing | Fees |
| Phone | Data plan | Wash |
| Supplies | Meals | Bank fees |
| Software | Accounting | Bike maintenance |
| Out of pocket (non-deductible) | Other | |

---

## The standard-mileage guardrail

If you log a **fuel**, **maintenance**, or **insurance** expense against a vehicle that uses the standard mileage method, Comma warns you. Those costs are already covered by the per-km rate, so deducting them again would double-count. The warning is informational — Comma still saves the expense for your own records; it just won't let it inflate your deduction. See [Standard mileage vs actual expenses](../getting-started/core-concepts.md#standard-mileage-vs-actual-expenses).

---

## Year-to-date tiles

The Expenses screen shows two running totals for the current year:

| Tile | Meaning |
|---|---|
| **Deductible YTD** | Total deductible expense, weighted by each item's business-use percentage. |
| **Standard YTD** | Total spend regardless of deductibility. |

---

## Filtering

Filter the expense list by **category** and by **deductibility**, so you can pull up, for example, every deductible fuel expense this year.

---

## A note on receipt scanning

On the phone, the "scan receipt to auto-fill" option is a **placeholder today**. It simulates a capture and fills the form with **sample values** — it is not real optical character recognition of your receipt. Treat it as a demonstration and correct the fields before saving. Attaching a **receipt photo** works as expected and keeps the image with the expense.

---

## Related

- [Tax Center](./tax-center.md) — how expenses flow into your tax estimate
- [Vehicles](./vehicles.md) — deduction methods and vehicle tax profiles
