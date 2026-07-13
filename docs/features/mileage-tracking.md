# Mileage Tracking

How Comma records the distance you drive, splits it into active and dead kilometres, and turns it into a CRA-aligned deduction. Distance is measured in km in Canada.

<RouteSplit caption="Your car doesn't know the difference. Comma does — only active kilometres earn, but both cost you fuel." />

---

## The phone GPS engine

When a live shift is running on the phone, a native location service records your route. It is tuned to reconstruct where you drove without draining the battery or storing noise:

| Behaviour | Detail |
|---|---|
| Sampling | A fix roughly every 10 seconds or every 20 metres. |
| Jitter guard | Fixes implying speeds above about 150 km/h are discarded as GPS error. |
| Movement check | Speeds under 5 km/h are classified as not driving — waiting, parked, or on foot. |
| Route simplification | The saved path is thinned with the Ramer-Douglas-Peucker algorithm at about 10 metres, keeping the shape and dropping redundant points. |

---

## Active vs dead distance

Comma splits your distance two ways at once:

- By the **Got First Order** tap on the live console — everything before it is dead, everything after is active.
- By **speed** — the engine treats movement below 5 km/h as not driving, so time spent idling doesn't inflate your distance.

Both active and dead kilometres are legitimate business distance and both are deductible. The split exists so you can see your true cost per delivery, not to decide what counts. [Core Concepts](../getting-started/core-concepts.md) explains why the ratio matters.

---

## The web tracker

The web app tracks GPS through the browser's `watchPosition` API in high-accuracy mode, while the tab is open. Its filters are set for browser location data:

| Behaviour | Detail |
|---|---|
| Accuracy floor | Fixes with accuracy worse than 25 metres are discarded. |
| Jitter guard | Movements under 10 metres, or ones implying more than 150 km/h, are rejected. |
| Route cap | A route is capped at 2,000 points. |
| Scope | Foreground only — tracking runs while the tab is open and stops when it closes. |

Use the web tracker for convenience at a desk or as a backup. For a real driving shift, the phone's background service is the right tool. See [Shift Tracking](./shift-tracking.md).

---

## Manual entry

You can always type distance by hand instead of using GPS. Enter the active and dead distance directly when you log or edit a shift. This is the fallback when you forgot to track, drove without signal, or prefer to read your odometer.

---

## Odometer reconciliation

GPS is close but never perfect, so Comma periodically checks its recorded distance against your real odometer. After a shift ends, it asks for your current odometer reading when either of these is true:

- It's the **1st of the month**, or
- The **oldest unreconciled GPS-only shift is 14 or more days old**.

Comma then computes the drift between your odometer change (new reading minus the previous one) and the total GPS distance over the same span, and distributes that drift **proportionally** across the unreconciled shifts. Longer shifts absorb more of the correction than short ones, so every shift's distance stays realistic without you editing each one by hand.

---

## The deductible summary

Comma totals your business distance and applies the CRA automobile rate to produce a mileage deduction:

| Distance | Rate |
|---|---|
| First 5,000 km | $0.73 / km |
| Beyond 5,000 km | $0.67 / km |

This deduction reduces your taxable income; it is never shown as cash earned. Bicycles, e-bikes, and scooters are not automobiles under CRA rules and do not qualify for this rate — Comma won't offer a deduction you can't take. The full tax picture is in the [Tax Center](./tax-center.md).

---

## Related

- [Shift Tracking](./shift-tracking.md) — the live console and the Got First Order tap
- [Tax Center](./tax-center.md) — how the mileage deduction feeds your estimate
