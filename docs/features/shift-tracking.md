# Shift Tracking

A shift is one work session, tracked live from start to finish. This page covers the live console on the phone, the Big Clock on the web, and how to log a shift you forgot to start.

<ShiftStrip accent="blue" blocks={[{ label: "dead — driving to the zone", pct: 20, kind: "idle" }, { label: "active — Got First Order", pct: 45 }, { label: "paused", pct: 12, kind: "idle" }, { label: "active", pct: 23 }]} caption="One shift, start to end swipe. Got First Order splits dead distance from active; paused time is excluded from your hourly rate." />

---

## Starting a live shift (phone)

Tap **Start Shift** in the bottom bar. A short wizard collects only what it needs:

| Step | What you choose |
|---|---|
| Platform | Pick the app or apps you're working. An **All** option selects every active platform at once. |
| Vehicle | Only asked if you have more than one vehicle. With a single vehicle, Comma skips this step. |
| Duration target | Optional. Presets of 4, 8, or 10 hours, or a custom value. Meeting the target later earns XP if Goals is on. |

Comma then starts the timer, the GPS service, and the floating overlay, and gets out of your way.

---

## The live console

While the shift runs, the console shows the numbers the delivery app never does:

- A running timer in **HH:MM:SS**.
- The current mileage split — **active** versus **dead** distance.
- A live **write-off value** in CAD, updating as you drive.

The controls:

| Control | What it does |
|---|---|
| **Got First Order** | Marks the point your first delivery begins. Distance before the tap is dead; distance after is active. |
| **Pause / Resume** | Stops the clock for a break. Paused time is excluded from your hourly rate. |
| **Minimize** | Shrinks the console so you can use your phone normally. |
| **Swipe to end** | A deliberate slider, so you can't end a shift by accident. |

Until you tap **Got First Order**, every kilometre counts as dead — driving to a hotspot doesn't earn anything. After the tap, distance is active. See [Mileage Tracking](./mileage-tracking.md) for how the split is measured.

---

## Background tracking

On the phone, tracking runs in a native **foreground service** with an ongoing notification, plus a **floating overlay** that sits on top of your delivery app. You can watch time and distance without switching back to Comma, and the service keeps running with the screen off. The shift doesn't stop until you end it.

---

## Ending a shift

Swipe to end, and Comma saves the route immediately. The shift is stored as **pending reconciliation**: the time and distance are real and complete, but earnings sit at zero until you fill them in.

This is deliberate. A GPS-tracked shift knows how long you were out and how far you drove, but only you know what you were paid. The dashboard reminds you about pending shifts, and the bottom bar's main button becomes **Reconcile** while any exist. See [Core Concepts](../getting-started/core-concepts.md) for the full model.

---

## The web app: the Big Clock

The web PWA has its own live console, the **Big Clock** overlay. It does the same job as the phone: a timer, a progress ring, **Got First Order**, **Pause**, **Minimize** to a sticky timer bar, and **Stop & Save**. It tracks GPS while the browser tab is open.

The difference is background behaviour. The web app has **no background service**, so closing the tab stops distance tracking. Use the web app to review and to log shifts from a laptop; use the phone for a real driving shift.

---

## Log a past shift

Forgot to hit start? Tap **Log Shift** and enter the details by hand: platform and vehicle, date and times, earnings, distance, and notes. Most drivers log a few shifts this way before the habit sticks. A logged shift is saved as **reconciled** — money and distance are both known up front.

---

## Reconciliation states

Every shift is in one of three states:

| Status | Meaning |
|---|---|
| `tracking` | Running right now. |
| `pending_reconciliation` | GPS finished; earnings not entered yet. |
| `reconciled` | Complete — money and distance both confirmed. |

---

## Editing, duplicating, and deleting

Open any shift from the Shifts list to change its platform, times, earnings, distance, or notes. You can **duplicate** a shift to reuse it as the basis for a similar one, and **delete** a shift you no longer want. Deletions propagate across your devices as tombstones, so a shift removed on the phone doesn't reappear from the browser.

---

## Related

- [Mileage Tracking](./mileage-tracking.md) — how distance is recorded and split
- [Core Concepts](../getting-started/core-concepts.md) — shifts, active vs dead, reconciliation
