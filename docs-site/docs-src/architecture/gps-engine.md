# GPS Engine

Comma's GPS tracking is handled by a combination of a **native module** (Kotlin/Swift) and a **JavaScript tracking hook**. The split exists because mobile OSes aggressively kill background JS processes — reliable GPS during a shift requires a native foreground service.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│ JavaScript (React Native)                             │
│                                                       │
│  useGPSTracking hook                                  │
│    ├─ starts/stops native module                      │
│    ├─ polls tempNativePoints (SQLite) every N seconds │
│    ├─ applies jitter filter                           │
│    ├─ writes clean points to locationPoints           │
│    └─ updates mileage in useActiveShift store         │
└──────────────────────────┬───────────────────────────┘
                           │ Native Bridge (Expo Modules API)
┌──────────────────────────▼───────────────────────────┐
│ Native Module: comma-tracker                          │
│                                                       │
│  Android (Kotlin)                                     │
│    └─ Foreground Service                              │
│         ├─ LocationManager / FusedLocationClient      │
│         ├─ Persists GPS points to tempNativePoints    │
│         └─ Shows persistent notification              │
│                                                       │
│  iOS (Swift)                                          │
│    └─ Background Location Task                        │
│         ├─ CLLocationManager                          │
│         └─ Persists GPS points to tempNativePoints    │
└──────────────────────────────────────────────────────┘
```

---

## Native module: `comma-tracker`

**Location:** [`modules/comma-tracker/`](../../modules/comma-tracker/)

Built with the **Expo Modules API** — a modern TypeScript-first way to write Expo native modules. It exposes a simple interface to JavaScript:

```ts
CommaTracker.startTracking()   // start the foreground service / background task
CommaTracker.stopTracking()    // stop and clean up
CommaTracker.isTracking()      // check if running
```

Internally, the module writes GPS coordinates directly to the `tempNativePoints` SQLite table. This is intentionally simple — the native code is as thin as possible, doing only what JS cannot reliably do in the background.

### Android implementation

A **Foreground Service** runs continuously while tracking is active. The Android OS is not allowed to kill foreground services (they show a persistent notification). The service uses `FusedLocationProviderClient` (Google Play Services) for best-available location, requesting updates every few seconds.

Required permissions (declared in `app.json`):
- `ACCESS_FINE_LOCATION` — precise GPS
- `ACCESS_BACKGROUND_LOCATION` — background GPS (Android 10+)
- `FOREGROUND_SERVICE` — run as foreground service
- `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` — request exemption from battery saver

### iOS implementation

A background location task using `CLLocationManager` with `allowsBackgroundLocationUpdates = true`. iOS's "background location" capability must be enabled in the app's entitlements (`UIBackgroundModes: location`).

---

## JavaScript: `useGPSTracking`

**Location:** [`hooks/useGPSTracking.ts`](../../hooks/useGPSTracking.ts)

This hook manages the tracking lifecycle from the JavaScript side:

1. **Start tracking:** calls `CommaTracker.startTracking()` via the native bridge.
2. **Poll loop:** every few seconds, runs a query to fetch new rows from `tempNativePoints`.
3. **Jitter filter:** applies two filters:
   - **Speed filter:** if the implied speed between consecutive points exceeds 150 km/h, discard the newer point as a GPS spike.
   - **Accuracy filter:** points with accuracy > threshold (configurable) are marked `isFiltered = true`.
4. **Write to `locationPoints`:** clean points are inserted with the current `sessionId` and `shiftId`.
5. **Update mileage:** calls `useActiveShift.updateMileage(activeMiles, deadMiles)` with the new totals. The active vs. dead classification is based on the current `isFirstOrderReceived` state.
6. **Stop tracking:** on shift end, calls `CommaTracker.stopTracking()` and runs a final mileage calculation.

---

## Distance calculation

Comma uses the **Haversine formula** to compute the great-circle distance between consecutive GPS points:

```ts
function haversineDistance(lat1, lon1, lat2, lon2): number {
  const R = 6371e3 // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180

  const a = Math.sin(Δφ/2)² + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2)²
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c  // meters
}
```

The sum of all segment distances (filtered points only) gives the total route distance.

---

## Route storage

The GPS route is stored in two ways:

1. **`locationPoints` table** — individual filtered points with full metadata (lat, lon, altitude, accuracy, speed, timestamp). Used for detailed route replay and distance recalculation.

2. **`shifts.routePath`** — an encoded **polyline** (Google's Encoded Polyline Algorithm) of the route, stored directly on the shift record. This compact representation is used for the route minimap in the shift list and the SVG route visualization on the shift detail screen.

The polyline is generated from the filtered location points using `simplify-js` (Douglas-Peucker algorithm) to reduce point count before encoding — a 2-hour shift might generate 1,000+ raw GPS points but the simplified polyline might have 50–200, sufficient for visualization.

---

## Wake lock

**Location:** [`hooks/useWakeLock.ts`](../../hooks/useWakeLock.ts)

While a shift is active, Comma acquires a **wake lock** — a request to the OS to keep the CPU running and prevent deep sleep. Without a wake lock, the device may enter a low-power state that pauses the JS timer (causing the displayed elapsed time to drift) or slows GPS polling.

On Android: `PowerManager.WakeLock` via `expo-keep-awake`.  
On iOS: `UIApplication.shared.isIdleTimerDisabled = true`.

The wake lock is acquired on shift start and released on shift end. It does not prevent the screen from turning off — only prevents the CPU from sleeping.

---

## Battery considerations

GPS tracking + wake lock is the single biggest contributor to battery drain while Comma is running. Practical guidance:

- Use a car charger or power bank while tracking.
- Android: battery optimization exemption prevents the OS from throttling GPS when the screen is off. Comma requests this permission during onboarding.
- iOS: background location requires the "Location" background mode — iOS is generally better at keeping location services alive than background JS tasks.
- If battery is a concern and you don't need GPS, switch to **manual mileage mode** in Settings — no GPS is used, you enter odometer readings manually.

---

## Permissions

Comma requests location permissions at shift start:

| Permission | Platform | Required for |
|---|---|---|
| `ACCESS_FINE_LOCATION` | Android | Precise GPS |
| `ACCESS_BACKGROUND_LOCATION` | Android 10+ | GPS while screen is off |
| `NSLocationWhenInUseUsageDescription` | iOS | GPS during active use |
| `NSLocationAlwaysAndWhenInUseUsageDescription` | iOS | GPS in background |

If permissions are denied, Comma falls back to manual mileage mode for the shift and prompts the user to grant permissions in device Settings.
