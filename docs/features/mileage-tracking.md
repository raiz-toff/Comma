# Mileage Tracking

Comma uses a native GPS engine to automatically track how far you drive during a shift — no manual odometer entry required.

---

## How it works

When you start a shift, Comma launches a background location service and begins collecting GPS coordinates. Every coordinate is timestamped, filtered for noise, and stored in the local database. At the end of the shift, Comma calculates the total route distance using the Haversine formula and assigns miles to either the active or dead bucket.

The entire process is on-device. Your location data is never sent to a server.

---

## Active miles vs. dead miles

Comma divides every mile into one of two categories:

**Active miles** — driven while you are on a delivery (from accepting an order to completing the drop-off). These are the miles directly attributable to delivering.

**Dead miles** — driven while waiting for orders, commuting to a hotspot, or returning home after a shift. These are still deductible as business mileage under US/CA/UK rules, but they're separated so you understand your true cost per delivery.

You control the toggle:
- The shift starts in **dead-mile mode**.
- Tap **"First Order Received"** to switch to active-mile mode.
- Toggle again at any time — e.g. if you complete a delivery and are now waiting again.

---

## GPS jitter filtering

GPS accuracy varies. A phone sitting still will still show small random movements. Comma applies two filters to remove noise:

1. **Speed filter** — if a coordinate implies you traveled faster than 150 km/h since the last point, it's discarded as a GPS spike.
2. **Accuracy filter** — points with low GPS accuracy (high uncertainty radius) are flagged as filtered and excluded from distance calculations.

Filtered points are stored but excluded from the route calculation. You can see the raw vs. filtered route in the shift detail map.

---

## Route visualization

Every GPS-tracked shift includes a **route minimap** visible on the shift list and a full **route map** on the shift detail screen. The route is rendered as an SVG polyline using the encoded GPS coordinates.

The map distinguishes active segments (solid line) from dead segments (dashed line), giving you a visual breakdown of where your miles came from.

---

## Distance calculation

Comma uses the **Haversine formula** to calculate the great-circle distance between consecutive GPS points. The sum of all segment distances is the total route mileage.

For long routes with many points, Comma uses the **Ramer–Douglas–Peucker algorithm** (via `simplify-js`) to reduce the number of points stored without meaningfully changing the calculated distance. This keeps the database size manageable for workers who track hundreds of shifts per year.

---

## Odometer mode

If you prefer to track mileage the old-fashioned way, Comma supports manual odometer readings:

1. On the shift creation screen, enter your **starting odometer**.
2. When ending the shift, enter your **ending odometer**.
3. Comma calculates the miles as `endOdometer - startOdometer`.

You can also record odometer readings on your vehicle profile independently of shifts — useful for tracking total annual business miles for actual-expense deductions.

The `distanceSource` field on each shift records whether mileage came from GPS or odometer.

---

## Distance units

Comma respects your locale setting. If your country profile uses miles (US, UK), all distances display in miles. If it uses kilometers (Canada, most other countries), distances display in kilometers.

Change your unit in **Settings → Profile → Distance Unit**.

---

## Deductible mileage summary

Comma's **Tax Center** shows a deductible mileage summary:
- Total business miles (active + dead)
- Deduction value at the standard mileage rate
- Miles by vehicle (if you use multiple vehicles)
- Miles by month (for quarterly estimate breakdowns)

This summary is designed to match what you'd enter on IRS Schedule C (US), CRA T2125 (Canada), or HMRC SA103 (UK).

---

## Troubleshooting GPS

**GPS not starting**
- Ensure location permissions are set to "Always" (not "Only while using"). The background service needs this.
- On Android, verify Comma is excluded from battery optimization: Settings → Apps → Comma → Battery → Unrestricted.

**Mileage seems low**
- Check that you tapped "First Order Received" at the right moment.
- The speed filter may have discarded points during a momentary GPS spike. This typically causes <1% error.
- Urban canyons (tall buildings) reduce GPS accuracy. Comma still records but some points may be filtered.

**Shift ended with "Pending Reconciliation"**
- The GPS service was stopped by the OS before you tapped End Shift. Open the shift, review the recorded mileage, adjust if needed, and tap Confirm.

**High battery drain**
- GPS tracking is the biggest battery consumer in Comma. Use a car charger. You can disable GPS tracking entirely and use manual mileage — go to **Settings → Shift Settings → Mileage Tracking: Manual**.
