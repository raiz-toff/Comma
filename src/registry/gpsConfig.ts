import * as Location from "expo-location";

/**
 * GPS tuning constants.
 *
 * NOTE: the live location subscription is driven by the native Kotlin foreground service
 * (LocationTrackingService.kt), which currently HARDCODES its own cadence (10s interval, 20m
 * min-distance, 42 m/s jitter cutoff). Keep those in sync with `timeInterval`,
 * `distanceInterval`, and `jitterThresholdMps` here. The values actively consumed by JS are
 * `jitterThresholdMps` and `deadSpeedThresholdKmh` (via utils/geoCalculations in endShift).
 */
export const GPS_CONFIG = {
  accuracy: Location.Accuracy.Balanced,
  timeInterval: 10_000,   // ms between updates (mirrored in LocationTrackingService.kt)
  distanceInterval: 20,       // meters minimum movement (mirrored in LocationTrackingService.kt)
  jitterThresholdMps: 42,       // m/s — discard coords implying >150 km/h (GPS jitter)
  deadSpeedThresholdKmh: 5,        // below this speed = dead miles
} as const;
