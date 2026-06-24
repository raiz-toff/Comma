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

// Public OSRM demo server — good enough for personal/non-commercial use.
// Replace with a self-hosted instance for production.
const OSRM_BASE = "https://router.project-osrm.org";

/**
 * Step 1: Reduce point count using Douglas-Peucker.
 * tolerance = 0.00005 degrees ≈ ~5 metres — keeps meaningful curves, drops jitter.
 */
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
 * Step 2: OSRM map matching — snaps the simplified path to actual roads.
 * Returns the matched geometry (array of LatLng) or null on failure.
 */
async function osrmMatch(points: LatLng[]): Promise<LatLng[] | null> {
  try {
    // OSRM accepts max 100 coordinates per request
    const sample = points.length > 100
      ? points.filter((_, i) => i % Math.ceil(points.length / 100) === 0)
      : points;

    const coords = sample.map((p) => `${p.longitude},${p.latitude}`).join(";");
    const url = `${OSRM_BASE}/match/v1/driving/${coords}?overview=full&geometries=geojson&annotations=false&gaps=ignore`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const json = await response.json();

    if (json.code !== "Ok" || !json.matchings?.length) return null;

    // The matched geometry comes back as GeoJSON [lng, lat] pairs — flip to LatLng
    const coords_matched: LatLng[] = json.matchings[0].geometry.coordinates.map(
      ([lng, lat]: [number, number]) => ({ latitude: lat, longitude: lng })
    );

    return coords_matched;
  } catch {
    return null;
  }
}

/**
 * Main export: takes raw GPS breadcrumbs, returns clean road-snapped coordinates.
 * Falls back gracefully to simplified-only if OSRM is unreachable.
 */
export async function cleanRoute(raw: LatLng[]): Promise<LatLng[]> {
  if (!raw || raw.length < 2) return raw ?? [];

  // Stage 1: Simplify
  const simplified = simplifyPath(raw);

  if (simplified.length < 2) return simplified;

  // Stage 2: Road snapping (optional, graceful fallback)
  const matched = await osrmMatch(simplified);

  return matched ?? simplified;
}
