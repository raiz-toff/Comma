# Vehicles

Each shift is driven in one vehicle, and each vehicle carries its own tax treatment. This page covers the default vehicle Comma creates for you, adding your real one, and the tax profile that decides how your driving is deducted.

---

## The default vehicle

So nothing blocks you at setup, Comma auto-creates a petrol car called **"My Car"**. You can start tracking immediately without answering a single vehicle question. Later, the activation checklist prompts **"tell us your real vehicle"** — because your actual vehicle decides whether the mileage write-off applies at all. A bike, for instance, doesn't qualify for the CRA automobile rate, so replacing the placeholder matters.

---

## Adding or editing a vehicle

Open Vehicles and add or edit one. The fields:

| Field | Detail |
|---|---|
| Nickname | Required. How the vehicle appears throughout the app. |
| Type | Gas, Hybrid, EV, Motorcycle, Bicycle, E-bike, Scooter, or Walking. |
| Make | Optional. |
| Model | Optional. |
| Year | Optional. |
| License plate | Optional, for your own records. |

You can set an **active vehicle** — the one selected by default on a new shift — and **delete** a vehicle you no longer use.

---

## Annual tax profiles

Each vehicle carries a tax profile per tax year, which tells the Tax Center how to deduct it:

| Setting | Detail |
|---|---|
| Deduction method | Standard mileage or Actual expenses. |
| Primary rate | The per-km rate applied to your distance. |
| Secondary rate | Optional. A second rate for distance beyond a threshold. |
| Rate threshold distance | Optional. The distance at which the secondary rate takes over. |

A saved profile always **overrides** the researched default — including an explicit opt-out. If you decide a vehicle takes no mileage deduction and save that choice, Comma respects it rather than reapplying a default.

---

## Eligibility

Under CRA rules a **bicycle, e-bike, or scooter is not an automobile**, so it does not get the automobile mileage rate. Comma knows this and will not offer a deduction you can't take. If you set one of those vehicle types, the standard automobile rate is not presented. See the [Tax Center](./tax-center.md) for how the deduction is calculated.

---

## Maintenance logs

Keep a service record per vehicle. Each maintenance entry has a type and a few fields:

| Field | Detail |
|---|---|
| Type | Oil change, Tires, Brakes, Fuel, Wash, or Other. |
| Cost | Amount in CAD. |
| Date | When the work was done. |
| Odometer | Reading at the time, for interval tracking. |
| Notes | Shop, part numbers, anything worth remembering. |

---

## Related

- [Tax Center](./tax-center.md) — how a vehicle's profile drives its deduction
- [Expenses](./expenses.md) — logging vehicle costs against the standard-mileage guardrail
