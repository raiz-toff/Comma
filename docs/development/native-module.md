# Native Module: comma-tracker

The `comma-tracker` native module provides reliable background GPS tracking. It is the only native code in Comma — everything else runs in JavaScript.

**Location:** [`modules/comma-tracker/`](../../modules/comma-tracker/)

---

## Why a native module?

Mobile operating systems aggressively stop background JavaScript processes to save battery. On Android, a JS process not attached to a foreground service can be killed within seconds of the screen turning off. On iOS, background JS execution is severely limited.

GPS tracking needs to continue reliably for hours while the screen is off. The only way to guarantee this on both platforms is to use a native foreground service (Android) or a native background location task (iOS).

Comma's native module is as thin as possible — it does only what JS cannot do reliably. All data processing, filtering, and mileage calculation stays in JavaScript.

---

## TypeScript interface

The module exposes three methods via the Expo Modules API:

```ts
// modules/comma-tracker/src/index.ts

export function startTracking(): void
export function stopTracking(): void
export function isTracking(): boolean
```

These are called by `hooks/useGPSTracking.ts`.

---

## How it works

### Data flow

```
GPS hardware
  → Native module receives location update
  → Writes row to `tempNativePoints` SQLite table
  → (immediately, no JS involved)

JS polling loop (useGPSTracking, every ~5s)
  → SELECT new rows FROM tempNativePoints WHERE id > lastProcessedId
  → Apply jitter filter
  → INSERT clean points INTO locationPoints
  → DELETE processed rows FROM tempNativePoints
  → Recalculate mileage totals
```

The native module writes to `tempNativePoints` directly. It does not communicate with JS via the bridge for each GPS point — bridge calls have overhead and are not suitable for high-frequency data. The polling model keeps the bridge usage to a low-frequency `SELECT`.

---

## Android implementation

**File:** `modules/comma-tracker/android/src/main/java/com/comma/tracker/`

### Foreground Service

The Android implementation runs as a `Service` with `startForeground()` called immediately on creation. The persistent notification (required by Android) shows "Shift in progress — tap to open Comma."

Location updates come from `FusedLocationProviderClient` (Google Play Services):
- Update interval: 5 seconds
- Fastest interval: 2 seconds
- Priority: `PRIORITY_HIGH_ACCURACY` (GPS chip + network)

### SQLite access

The native service accesses the same SQLite database file as the JS side. It uses Android's built-in `SQLiteDatabase` API to write to `tempNativePoints`. Both JS and native code access the database concurrently — WAL (Write-Ahead Logging) mode is enabled to prevent lock contention.

### Battery optimization

On Android 6+, apps can be "optimized" (battery saver kills them). Comma's onboarding requests `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` permission to exclude itself from battery optimization. Without this, the foreground service may be stopped on aggressive OEM variants (Xiaomi, Samsung, Huawei).

### Required permissions in `AndroidManifest.xml`

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
```

---

## iOS implementation

**File:** `modules/comma-tracker/ios/CommaTracker.swift`

### Background location

The iOS implementation uses `CLLocationManager` with:
- `requestAlwaysAuthorization()` — required for background location
- `allowsBackgroundLocationUpdates = true` — enables background delivery
- `pausesLocationUpdatesAutomatically = false` — prevents iOS from auto-pausing
- `desiredAccuracy = kCLLocationAccuracyBest`
- `distanceFilter = 10` — only trigger for movements > 10 meters

### Background task registration

The module registers a background task via Expo's `expo-task-manager` in addition to `CLLocationManager`. This provides a fallback that ensures data is persisted even if the main process is suspended.

### Required entitlements in `app.json`

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "UIBackgroundModes": ["location"]
      }
    }
  }
}
```

### SQLite access

The native Swift code accesses the SQLite database using the `SQLite.swift` library. It writes GPS points to `tempNativePoints` using the same WAL-enabled database file.

---

## Building the native module

The native module is built automatically when you run `npx expo run:android` or `npx expo run:ios`. It uses the Expo Modules API build system.

### Android

The module is an Android library module at `modules/comma-tracker/android/`. It is included automatically via the Expo plugin system.

Build dependencies are declared in `modules/comma-tracker/android/build.gradle`:
```groovy
dependencies {
    implementation 'com.google.android.gms:play-services-location:21.0.1'
}
```

### iOS

The module is an Xcode framework at `modules/comma-tracker/ios/`. Run `pod install` from the `ios/` directory to install it.

---

## Overlay permission (Android)

On Android, Comma optionally requests `SYSTEM_ALERT_WINDOW` permission to display a floating shift info overlay on top of other apps. This is surfaced as "Display over other apps" in device settings.

This permission is optional — GPS tracking works without it. The overlay is a convenience feature for seeing shift time/earnings while using the delivery platform's app.

---

## Debugging the native module

### Android

Enable verbose logging in the native service:
```kotlin
Log.d("CommaTracker", "GPS point: $lat, $lon at $timestamp")
```

View logs in Android Studio's Logcat filtered to `CommaTracker` tag, or via:
```bash
adb logcat -s CommaTracker
```

### iOS

Use Xcode's console with the filter `CommaTracker`.

### Verifying GPS writes

Check that `tempNativePoints` is being populated:
```bash
# Android emulator
adb shell run-as app.comma.tracker sqlite3 databases/comma.db "SELECT COUNT(*) FROM temp_native_points;"
```

If the count isn't growing while the shift is running, the native service isn't writing. Common causes:
- Location permissions denied
- Battery optimization blocking the service (Android)
- `UIBackgroundModes: location` missing from `app.json` (iOS)
