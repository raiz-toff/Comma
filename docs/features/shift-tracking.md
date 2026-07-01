# Shift Tracking

Comma's shift tracker is the core of the app. It records time, mileage (via GPS), and earnings for every work session.

---

## Starting a shift

Tap **Start Shift** on the Dashboard bottom bar. A three-step wizard opens:

1. **Platform** — Choose the gig app you're working on. If you work multiple platforms in one session, pick the primary one; you can add others later.
2. **Vehicle** — Select the vehicle you're driving. Comma uses this for mileage rate and odometer tracking.
3. **Target time** *(optional)* — Set a target duration (e.g. 4 hours). Comma notifies you when you've hit it.

Tap **Start** and the shift begins. Comma immediately requests location permissions and starts the GPS service.

---

## The live shift overlay

While a shift is running, a **fullscreen clock overlay** is available. Tap the clock icon to bring it up. It shows:

- Elapsed time (total and net-of-pauses)
- Current active and dead mileage
- Live earnings (if you've entered them)
- A mini GPS route map that updates in real time
- Platform badge and vehicle label

The overlay can be dismissed — the shift continues running in the background.

---

## Active vs. dead miles mid-shift

When you start a shift, Comma is in **dead-mile mode** — the GPS is recording but mileage is counted as dead (commute) miles.

Tap **"First Order Received"** when you pick up your first delivery. Comma switches to **active-mile mode**. Tapping again toggles back.

The toggle is visible on the bottom action bar and on the live overlay. You can flip it as many times as you need during a shift.

---

## Pausing a shift

Tap **Pause** to pause the timer. Paused time is not counted in your total duration or hourly-rate calculation. The GPS continues recording during a pause — mileage still accumulates.

Use pause for:
- Meal breaks
- Waiting at a long pickup
- Personal errands mid-shift (note: miles during a personal errand should not be counted as business miles; you may need to manually adjust)

Tap **Resume** to continue.

---

## Ending a shift

Tap **End Shift**. A summary screen appears showing:

- Total duration and net active time (duration minus paused seconds)
- GPS-tracked mileage (active + dead)
- A prompt to enter **gross revenue** and **tips**

Review the numbers, edit if needed, then tap **Save**. The shift is saved with status `reconciled`.

---

## The foreground service (Android)

On Android, Comma runs a **foreground service** while a shift is active. This is the small persistent notification in your notification tray that says "Shift in progress."

The foreground service is required for reliable GPS tracking. Android aggressively kills background processes; the foreground service tells the OS that this app is doing important work and should not be terminated.

Tapping the notification opens the live overlay.

---

## Wake lock

While a shift is running, Comma acquires a **wake lock** to keep the device CPU active. This prevents the device from sleeping and dropping GPS updates. The wake lock is automatically released when the shift ends.

If you're concerned about battery, you can keep your phone plugged in while working (most gig workers use a car charger anyway).

---

## Logging a past shift

If you forgot to start Comma before your shift, use **Log Past Shift**:

1. Tap **Log Past Shift** on the Dashboard.
2. Enter:
   - Platform and vehicle
   - Start and end date/time
   - Gross revenue and tips
   - Mileage (or estimate — you can edit it later)
3. Tap **Save**.

Past shifts don't have GPS routes but are otherwise identical to tracked shifts in all reports and calculations.

---

## Editing a shift

Open the **Shifts** tab and tap any shift to open its detail screen.

Editable fields:
- Start/end time
- Platform
- Vehicle
- Gross revenue and tips
- Active mileage and dead mileage
- Notes
- Reconciliation status

Changes are saved immediately and reflected across all analytics.

---

## Reconciliation

Shifts that ended unexpectedly (app crash, GPS service killed) may appear with status **"Pending Reconciliation"**. Open the shift, review the GPS-calculated mileage and duration, confirm the earnings, and tap **Confirm** to mark it reconciled.

---

## Deleting a shift

From the shift detail screen, tap the trash icon (top right). This is a hard delete — the shift is permanently removed from your local database.

If cloud sync is enabled, the deletion is propagated as a soft delete (tombstone) so it disappears on your other devices too.

---

## Multi-platform shifts

If you run two apps simultaneously during a shift (e.g. DoorDash and Uber Eats):

1. Start the shift on your primary platform.
2. Tap the platform badge during the shift to open the platform switcher.
3. Add a second platform. Comma starts recording separate online-time and earnings for it.

Each platform sub-record tracks its own online seconds, gross revenue, tips, and trip count. The shift's total mileage covers all platforms combined.

---

## Home screen widget (Android)

Comma includes an Android home screen widget that shows your current shift status — elapsed time, live mileage, and platform badge. Add it from your launcher's widget picker. The widget updates automatically as the shift progresses.
