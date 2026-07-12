# Expense fields

Every field on the expense form and the full category list, with deductibility and the standard-mileage guardrail explained.

---

## Fields

| Field | Required | Unit | Notes |
|---|---|---|---|
| Amount | Yes | CAD | The total cost of the expense. |
| Date | Yes | — | The day the expense occurred. Defaults to today. |
| Merchant | No | — | The business name. Auto-completes from your history. |
| Category | Yes | — | One of the twenty categories below. |
| Tax Deductible | No | Yes / no | Whether the expense reduces taxable income. |
| Business Use % | No | 0 to 100 | The share of the expense that is business-related. Only that share is deducted. |
| Vehicle link | No | — | Associates the expense with a specific vehicle for vehicle-expense reporting. |
| Shift link | No | — | Associates the expense with a specific shift. |
| Notes | No | — | Free text. |
| Receipt image | No | — | A photo of the receipt, stored on the device. |
| Recurring | No | On / off | Marks the expense as repeating. |
| Interval | No | Weekly, monthly, yearly | Shown when Recurring is on. Reminds you when the next occurrence is due; it does not create entries automatically. |
| HST/ITC paid | No | CAD | The HST portion eligible as an input tax credit. Shown only if you are registered for HST. |

---

## Categories

Comma ships twenty expense categories aligned to the CRA T2125 form. Every category is deductible by default except Out of pocket, which is tracked for your records only. The default business-use percentage is 100 unless noted; you can override it on any expense.

The vehicle-related column marks costs of operating or owning the vehicle itself. Three of those — fuel, maintenance, and insurance — are covered by the standard-mileage rate and should not be claimed separately on a vehicle using that method (see below).

| Category | Deductible | Default business use | Vehicle-related |
|---|---|---|---|
| Fuel | Yes | 100% | Yes |
| Maintenance | Yes | 100% | Yes |
| Parking | Yes | 100% | No |
| Tolls | Yes | 100% | No |
| Insurance | Yes | 100% | Yes |
| Licensing | Yes | 100% | Yes |
| Interest | Yes | 100% | Yes |
| Leasing | Yes | 100% | Yes |
| Fees | Yes | 100% | No |
| Phone | Yes | 50% | No |
| Data plan | Yes | 50% | No |
| Wash | Yes | 100% | Yes |
| Supplies | Yes | 100% | No |
| Meals | Yes | 50% | No |
| Bank fees | Yes | 100% | No |
| Software | Yes | 100% | No |
| Accounting | Yes | 100% | No |
| Bike maintenance | Yes | 100% | Yes |
| Out of pocket | No | 0% | No |
| Other | Yes | 100% | No |

Phone, data plan, and meals default to 50% because the CRA limits mixed-use phones and business meals to half unless you keep a separate record of the split. Parking and tolls are trip costs rather than vehicle-operating costs, so they remain fully deductible even on a standard-mileage vehicle.

---

## The standard-mileage guardrail

A vehicle deducts its cost one of two ways: the per-kilometre standard rate, or actual expenses. You pick one per vehicle, per tax year, and you cannot use both. See [Core concepts](../getting-started/core-concepts.md).

If a vehicle is on the standard-mileage method, the per-kilometre rate already includes fuel, maintenance, and insurance. Logging those as separate expenses against that vehicle would double-count them. Comma warns you when you do this. The expense still saves — it stays in your records — but the tax workspace will not deduct it a second time.
