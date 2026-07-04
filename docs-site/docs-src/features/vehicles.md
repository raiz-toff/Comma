# Vehicles

Comma supports multiple vehicles. Each shift is associated with one vehicle, enabling per-vehicle mileage tracking, expense allocation, and tax deduction calculations.

---

## Adding a vehicle

Go to **Vehicles** in the navigation drawer (or **Settings → Vehicles**) and tap **+ Add Vehicle**.

Fields:

| Field | Required | Notes |
|---|---|---|
| **Name** | Yes | Display name — e.g. "My Civic", "Work Truck" |
| **Type** | Yes | Car / Bike / Scooter / Van / Other |
| **Make** | No | e.g. "Honda" |
| **Model** | No | e.g. "Civic" |
| **Year** | No | Manufacturing year |
| **Fuel type** | No | Gas / Electric / Hybrid / Other |
| **License plate** | No | For your own records |
| **Current odometer** | No | Starting odometer (used as baseline for business-use calculations) |

---

## Default vehicle

One vehicle is your **active vehicle**. It auto-selects in the shift creation wizard. You can change the default in **Vehicles → [Vehicle] → Set as Default**.

---

## Vehicle detail screen

Tap any vehicle to open its detail screen. You'll see:

- Total lifetime miles tracked through Comma
- Total lifetime active miles vs. dead miles
- All shifts associated with this vehicle (filterable)
- Maintenance logs
- Tax profile link

---

## Maintenance logs

Track your vehicle's maintenance history to support actual-expense deduction claims and to stay on top of service intervals.

Tap **+ Log Maintenance** on the vehicle detail screen.

Fields:

| Field | Notes |
|---|---|
| **Type** | Oil change · Tires · Brakes · Fuel fill · Car wash · Other |
| **Cost** | Total cost in local currency |
| **Date** | Date of service |
| **Odometer** | Reading at time of service (optional, for interval tracking) |
| **Notes** | Mechanic name, shop, any details |

Maintenance logs are included in the **Google Drive backup** and in cloud sync (when enabled).

---

## Odometer tracking

Comma can track your odometer automatically if you enter readings at the start and end of each shift. This gives you:

- **Annual miles driven** — total odometer delta for the year
- **Business miles** — sum of all shift mileage
- **Business-use percentage** — business miles ÷ total miles (used for actual-expense deduction)

For best accuracy:
1. Enter your vehicle's **current odometer** when you add the vehicle.
2. Set a **start odometer** on each shift.
3. Set an **end odometer** when ending the shift.

If you prefer GPS-only tracking and don't want to enter odometer readings, leave those fields blank — Comma will use GPS mileage for deduction calculations instead.

---

## Vehicle Tax Profile

Each vehicle needs a **Tax Profile** per tax year for the Tax Center to generate accurate deduction estimates. See [Tax Center](./tax-center.md#vehicle-tax-profile) for full details.

Quick summary:
- Standard mileage rate: the IRS (or CRA/HMRC) rate × business miles
- Actual expenses: total vehicle expenses × business-use percentage

Set your profile at **Vehicles → [Vehicle] → Tax Profile**.

---

## Multiple vehicles

If you use different vehicles on different days or shifts:

- Each shift records which vehicle was used
- Analytics can break down earnings and mileage per vehicle
- Tax Center shows a separate deduction calculation per vehicle per year
- Expenses can be associated with a specific vehicle

This is useful if you have a car and a bike, or switch between a personal vehicle and a cargo van for different platforms.

---

## Deactivating a vehicle

If you sell or stop using a vehicle, tap **Deactivate** on its detail screen. Deactivated vehicles:
- No longer appear in the shift creation wizard
- Still appear in historical analytics (their past shifts are unchanged)
- Can be reactivated at any time

To permanently delete a vehicle and all its associated shifts and expenses, tap **Delete** (destructive — use with caution).
