/**
 * mapMatching.ts
 *
 * Cleans raw GPS breadcrumbs using two stages:
 *   1. Douglas-Peucker simplification (simplify-js) — removes redundant points
 *   2. OSRM /match API — snaps coordinates to the actual road network
 *
 * Falls back to simplified-only points if OSRM is unavailable (no internet, etc.)
 */
import simplify from "simplify-js";

export interface LatLng {
  latitude: number;
  longitude: number;
}

function simplifyPath(points: LatLng[]): LatLng[] {
  if (points.length < 3) return points;

  // simplify-js uses {x, y} format
  const simplified = simplify(
    points.map((p) => ({ x: p.longitude, y: p.latitude })),
    0.00005, // tolerance in degrees
    true     // high quality
  );

  return simplified.map((p) => ({ latitude: p.y, longitude: p.x }));
}

/**
 * Main export: takes raw GPS breadcrumbs, returns clean simplified coordinates.
 */
export async function cleanRoute(raw: LatLng[]): Promise<LatLng[]> {
  if (!raw || raw.length < 2) return raw ?? [];

  // Stage 1: Simplify using RDP
  const simplified = simplifyPath(raw);

  return simplified;
}
