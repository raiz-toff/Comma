import { GPS_CONFIG } from "../src/registry/gpsConfig";

export interface LatLng {
  lat: number;
  lng: number;
}

export function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (a.lat * Math.PI) / 180;
  const phi2 = (b.lat * Math.PI) / 180;
  const deltaPhi = ((b.lat - a.lat) * Math.PI) / 180;
  const deltaLambda = ((b.lng - a.lng) * Math.PI) / 180;

  const aa =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));

  return R * c; // in meters
}

export function classifyMiles(speedKmh: number): "active" | "dead" {
  return speedKmh < GPS_CONFIG.deadSpeedThresholdKmh ? "dead" : "active";
}

export function isGPSJitter(distanceM: number, elapsedMs: number): boolean {
  if (elapsedMs <= 0) return true;
  const speedMps = distanceM / (elapsedMs / 1000.0);
  return speedMps > GPS_CONFIG.jitterThresholdMps;
}
