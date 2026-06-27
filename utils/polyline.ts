import { LatLng } from "./geoCalculations";

/**
 * Encodes a list of LatLng coordinates into a Google Polyline string.
 */
export function encodePolyline(points: LatLng[]): string {
  let result = "";
  let lastLat = 0;
  let lastLng = 0;

  function encodeValue(value: number): string {
    let val = Math.round(value * 1e5);
    val = val < 0 ? ~(val << 1) : val << 1;
    let chunks = "";
    while (val >= 0x20) {
      chunks += String.fromCharCode(((val & 0x1f) | 0x20) + 63);
      val >>= 5;
    }
    chunks += String.fromCharCode(val + 63);
    return chunks;
  }

  for (const p of points) {
    const latDiff = p.lat - lastLat;
    const lngDiff = p.lng - lastLng;
    result += encodeValue(latDiff);
    result += encodeValue(lngDiff);
    lastLat = p.lat;
    lastLng = p.lng;
  }

  return result;
}

/**
 * Decodes a Google Polyline string back into a list of LatLng coordinates.
 */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
    });
  }

  return points;
}

interface LatLonObj {
  latitude: number;
  longitude: number;
}

/**
 * Smooths coordinate array using Catmull-Rom spline interpolation.
 */
export function catmullRomSpline(points: LatLonObj[], steps = 8): LatLonObj[] {
  if (points.length < 3) return points;

  const result: LatLonObj[] = [];
  
  const getPoint = (i: number) => {
    const idx = Math.max(0, Math.min(points.length - 1, i));
    return points[idx];
  };

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = getPoint(i - 1);
    const p1 = getPoint(i);
    const p2 = getPoint(i + 1);
    const p3 = getPoint(i + 2);

    for (let step = 0; step < steps; step++) {
      const t = step / steps;
      const t2 = t * t;
      const t3 = t2 * t;

      const lat = 0.5 * (
        (2 * p1.latitude) +
        (-p0.latitude + p2.latitude) * t +
        (2 * p0.latitude - 5 * p1.latitude + 4 * p2.latitude - p3.latitude) * t2 +
        (-p0.latitude + 3 * p1.latitude - 3 * p2.latitude + p3.latitude) * t3
      );

      const lon = 0.5 * (
        (2 * p1.longitude) +
        (-p0.longitude + p2.longitude) * t +
        (2 * p0.longitude - 5 * p1.longitude + 4 * p2.longitude - p3.longitude) * t2 +
        (-p0.longitude + 3 * p1.longitude - 3 * p2.longitude + p3.longitude) * t3
      );

      result.push({ latitude: lat, longitude: lon });
    }
  }

  result.push(points[points.length - 1]);
  return result;
}

export function parseRoutePath(routePath: string | null | undefined): Array<{ latitude: number; longitude: number }> | null {
  if (!routePath) return null;
  try {
    const trimmed = routePath.trim();
    if (trimmed.startsWith("[")) {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length >= 2) {
        return parsed.map((p: any) => {
          const timestamp = p.timestamp ? Number(p.timestamp) : undefined;
          if (p.latitude !== undefined && p.longitude !== undefined) {
            return { latitude: Number(p.latitude), longitude: Number(p.longitude), timestamp };
          }
          if (p.lat !== undefined && p.lng !== undefined) {
            return { latitude: Number(p.lat), longitude: Number(p.lng), timestamp };
          }
          if (p.lat !== undefined && p.lon !== undefined) {
            return { latitude: Number(p.lat), longitude: Number(p.lon), timestamp };
          }
          return null;
        }).filter(Boolean) as Array<{ latitude: number; longitude: number; timestamp?: number }>;
      }
    }
  } catch (e) {
    // Ignore and fallback to polyline
  }

  try {
    const decoded = decodePolyline(routePath);
    if (Array.isArray(decoded) && decoded.length >= 2) {
      return decoded.map((p) => ({ latitude: p.lat, longitude: p.lng }));
    }
  } catch (e) {
    // Ignore
  }

  return null;
}

