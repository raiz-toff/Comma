# GPS Engine

Comma reconstructs a shift's route from GPS: on the phone through a native Kotlin foreground service driven by a JavaScript hook, and on the web through a foreground, tab-open geolocation tracker.

The split on the phone exists because mobile OSes aggressively suspend background JavaScript. Reliable tracking when the screen is off needs a native foreground service; JavaScript only orchestrates and post-processes.

<StepFlow accent="emerald" steps={[{ title: "Collect", body: "A Kotlin foreground service writes raw fixes straight to SQLite — no JS on the hot path." }, { title: "Filter", body: "At shift end: Haversine distance, and any fix implying over 150 km/h is a spike, not movement." }, { title: "Split and simplify", body: "Active vs dead by speed, then Ramer–Douglas–Peucker to ~10 m — a thousand points become a few dozen." }]} caption="The native layer is deliberately thin. All the intelligence is in JavaScript, where it can be changed without a native build." />

---

## Phone architecture

```
┌──────────────────────────────────────────────────────┐
│ JavaScript (React Native)                             │
│   hooks/useGPSTracking.ts                             │
│     ├─ walks the permission ladder                    │
│     ├─ starts / stops the native service              │
│     ├─ polls active distance every 10s                │
│     └─ feeds live distance into useActiveShift        │
│   store/useActiveShift.ts (on end)                    │
│     ├─ reads tempNativePoints                          │
│     ├─ filters jitter, splits active / dead           │
│     └─ simplifies the route, writes the shift         │
└──────────────────────────┬───────────────────────────┘
                           │ Expo Modules bridge
┌──────────────────────────▼───────────────────────────┐
│ Native module: comma-tracker (Kotlin)                 │
│   Foreground service                                  │
│     ├─ FusedLocationProviderClient                    │
│     ├─ writes raw points to tempNativePoints          │
│     ├─ ticks its own shift clock (survives JS freeze) │
│     └─ shows the ongoing notification + live overlay  │
└──────────────────────────────────────────────────────┘
```

**Module:** [`modules/comma-tracker/`](../../modules/comma-tracker/)
**Hook:** [`hooks/useGPSTracking.ts`](../../hooks/useGPSTracking.ts)

---

## The native service

A foreground service runs while a shift is active. Android does not kill foreground services — they carry an ongoing notification — so tracking continues with the screen off. It uses `FusedLocationProviderClient` for best-available location, sampling on the order of every 10 seconds or 20 meters, and is movement-gated: when activity recognition reports the driver as still, the service can idle the GPS radio to save power.

The native code is deliberately thin. It writes raw coordinates straight into the `tempNativePoints` table and does nothing clever; all classification and simplification happen later, in JavaScript, at shift end. The service also ticks its own copy of the shift clock, so the live time keeps moving even when the JavaScript thread is frozen in the background.

Bridge surface used by the hook:

```ts
CommaTracker.startTracking()
CommaTracker.stopTracking()
CommaTracker.getActiveDistanceMeters()
CommaTracker.setDistanceUnit(unit)
CommaTracker.setShiftTiming(startTime, pausedSeconds, isPaused, elapsedSeconds)
CommaTracker.hasOverlayPermission() / requestOverlayPermission()
CommaTracker.requestBatteryOptimizationExemption()
```

### Live overlay

When the "display over other apps" permission is granted, the service floats a compact live time-and-distance overlay over other apps such as Maps and the delivery app, so the driver can glance at the shift without switching back to Comma.

---

## The permission ladder

`useGPSTracking.startTracking()` requests permissions in order, and is careful never to hard-gate tracking on anything but the first rung:

1. **Foreground location** (`ACCESS_FINE_LOCATION`) — the only hard requirement. If permanently denied, Comma deep-links to system settings instead of silently doing nothing.
2. **Location services on.** Even with permission, if the system GPS toggle is off the shift would record nothing, so Comma checks and prompts.
3. **Display-over-other-apps** — offered before the background prompts (which would background the app and hide it), for the live overlay.
4. **Background location** (`ACCESS_BACKGROUND_LOCATION`, "Allow all the time") — requested with a plain-language disclosure first, but **not required**: a foreground service with its notification can collect location on a while-in-use grant. On Android 11+ this can only be granted from Settings, so hard-gating on it would break tracking for most users.
5. **Notifications** (`POST_NOTIFICATIONS`, Android 13+) — so the ongoing service notification is actually visible.
6. **Activity recognition** (`ACTIVITY_RECOGNITION`, Android 10+) — powers the movement-gated GPS. If denied, the service falls back to GPS-on for the whole shift.
7. **Battery-optimization exemption** — requested so OEM battery killers (Samsung, Xiaomi, and others) cannot terminate the service when the app is swiped from recents.

The tracking effect intentionally has no cleanup that stops the service on unmount: the foreground service must survive JavaScript remounts (fast refresh, navigation resets) while a shift is active. Tracking is stopped explicitly only when the shift ends or `isActive` flips to false.

---

## Processing at shift end

`useActiveShift.endShift()` reads the raw points from `tempNativePoints` in timestamp order and, for each consecutive pair:

1. **Distance** via the Haversine great-circle formula, in meters.
2. **Jitter filter.** If the implied speed exceeds roughly 150 km/h, the segment is discarded as a GPS spike (`isGPSJitter`), so one bad fix cannot inflate distance.
3. **Active / dead split.** Each surviving segment is classified by `classifyMiles(speedKmh)` and added to either active or dead distance. The `isFirstOrderReceived` flag marks the live transition from dead-distance mode to active during the shift.
4. **Unit conversion.** Meters are converted once per shift using 1609.344 (miles) or 1000 (km), from the driver's `distanceUnit`.

The totals are rounded and written to the shift's `activeMileage` and `deadMileage`.

### Route simplification and storage

The route is simplified with `simplify-js` (Ramer–Douglas–Peucker) at a tolerance of about 10 meters, carrying each point's timestamp through the simplification, and stored on `shifts.routePath` as a JSON array of `{ latitude, longitude, timestamp }`. A two-hour shift's thousand-plus raw points collapse to a few dozen — enough for the route minimap and the detail-screen route view. The individual filtered points also live in the device-local `locationPoints` table for replay and recalculation.

---

## Wake lock

While a shift is active Comma holds a wake lock (`hooks/useWakeLock.ts`) so the CPU does not enter a deep-sleep state that would pause the JavaScript timer or slow polling. It is acquired on shift start and released on shift end, and does not keep the screen on.

---

## Battery

GPS plus the wake lock are the biggest draw while a shift runs. Practical guidance:

- Keep the phone on a car charger or power bank during shifts.
- Grant the battery-optimization exemption so the OS does not throttle GPS with the screen off.
- Movement-gated sampling and the ~10s/20m cadence keep the radio off when the driver is stationary.
- A driver who does not want GPS can enter odometer readings instead; a shift with odometer start and end reconciles without any GPS.

---

## The web counterpart

The web app has its own tracker, [`web/src/core/gps-tracker.js`](../../web/src/core/gps-tracker.js), and it is **foreground and tab-open only** — there is no background service a browser can offer. It uses `navigator.geolocation.watchPosition` with high accuracy and, on each update:

- ignores updates while the shift timer is paused or stopped;
- discards fixes with accuracy worse than 25 meters;
- applies the same guardrails as the phone — a minimum movement of about 10 meters and a maximum speed of 150 km/h;
- classifies distance as dead before the first order is marked and active afterward (`markFirstOrderReceived`).

Accumulated distance, the active/dead splits, and the route points are persisted to `localStorage` (route points capped at 2000) so the tracker survives a reload mid-shift. The recorded route uses the same `{ latitude, longitude, timestamp }` point shape the phone app's route parser accepts, so a shift moved between the apps renders the same way. `stop()` returns the final `{ total, dead, active, routePoints }`.

The practical rule stands: track on the phone while driving; use the web tracker while the app stays open in front, or enter distance manually.
