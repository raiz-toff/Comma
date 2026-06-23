import * as Location from "expo-location";

export const GPS_CONFIG = {
  accuracy: Location.Accuracy.Balanced,
  timeInterval: 10_000,   // ms between updates
  distanceInterval: 20,       // meters minimum movement to trigger update
  jitterThresholdMps: 42,       // m/s — discard coords implying >150 km/h (GPS jitter)
  deadSpeedThresholdKmh: 5,        // below this speed = dead miles
} as const;
