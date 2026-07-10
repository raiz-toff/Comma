/**
 * GPSTracker - Real-time geolocation tracking and Haversine distance calculation.
 * Locally persistent, battery-efficient, and highly resilient to reloads.
 * Supports dead-mile categorization before the first order is received.
 */

const LS_DISTANCE_KEY = 'comma_active_gps_distance';
const LS_LAST_COORD_KEY = 'comma_active_gps_last_coord';
const LS_WATCH_ID_KEY = 'comma_active_gps_watch_id';
const LS_FIRST_ORDER_KEY = 'comma_active_gps_first_order';
const LS_DEAD_DIST_KEY = 'comma_active_gps_dead_distance';
const LS_ACTIVE_DIST_KEY = 'comma_active_gps_active_distance';
/**
 * Raw route point log for the active shift (interop plan Workstream 5 — GPS route display).
 * JSON array of `{latitude, longitude, timestamp}`, the same point shape mobile's
 * `parseRoutePath` accepts (`commaApp/utils/polyline.ts`). Only accepted (non-jitter) position
 * updates are appended — same gate as the distance accumulator below — so the path lines up with
 * the reported distance. Capped at MAX_ROUTE_POINTS so a very long shift can't grow this without
 * bound (~150KB of localStorage at the cap).
 */
const LS_ROUTE_POINTS_KEY = 'comma_active_gps_route_points';
const MAX_ROUTE_POINTS = 2000;

let activeWatchId = null;

// Haversine formula
function calculateHaversineDistance(c1, c2) {
  const R = 6371; // km
  const dLat = ((c2.lat - c1.lat) * Math.PI) / 180;
  const dLon = ((c2.lon - c1.lon) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((c1.lat * Math.PI) / 180) *
      Math.cos((c2.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** @param {{lat: number, lon: number, time: number}} coord */
function appendRoutePoint(coord) {
  try {
    const raw = localStorage.getItem(LS_ROUTE_POINTS_KEY);
    const points = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(points)) throw new Error('corrupt route point log');
    points.push({ latitude: coord.lat, longitude: coord.lon, timestamp: coord.time });
    if (points.length > MAX_ROUTE_POINTS) points.splice(0, points.length - MAX_ROUTE_POINTS);
    localStorage.setItem(LS_ROUTE_POINTS_KEY, JSON.stringify(points));
  } catch (e) {
    console.warn('[GPSTracker] Failed to append route point', e);
  }
}

export const GPSTracker = {
  /**
   * Helper to initialize standard high-accuracy watch position query.
   * @param {boolean} resetState If true, resets current distance.
   * @private
   */
  _watch(resetState) {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      console.warn('[GPSTracker] Geolocation not supported by this browser.');
      return;
    }

    this.pause(); // Clean up any existing watch

    if (resetState) {
      localStorage.setItem(LS_DISTANCE_KEY, '0');
      localStorage.setItem(LS_FIRST_ORDER_KEY, 'false');
      localStorage.setItem(LS_DEAD_DIST_KEY, '0');
      localStorage.setItem(LS_ACTIVE_DIST_KEY, '0');
      localStorage.setItem(LS_ROUTE_POINTS_KEY, '[]');
    }
    localStorage.removeItem(LS_LAST_COORD_KEY);

    const success = (position) => {
      // Discard coordinate updates if the shift timer is paused or stopped
      let isTimerActive = false;
      try {
        const rawTimer = localStorage.getItem('comma_active_shift_timer');
        if (rawTimer) {
          const timer = JSON.parse(rawTimer);
          if (timer && timer.startTime && !timer.pausedAt) {
            isTimerActive = true;
          }
        }
      } catch (err) {
        console.warn('[GPSTracker] Failed to parse active shift timer state', err);
      }

      if (!isTimerActive) {
        console.log('[GPSTracker] Distance update ignored: Shift timer is not actively running (paused or stopped).');
        localStorage.removeItem(LS_LAST_COORD_KEY);
        return;
      }

      const accuracy = position.coords.accuracy;
      // Discard coordinates with poor accuracy (over 25 meters)
      if (accuracy > 25) {
        console.log('[GPSTracker] Position discarded due to poor accuracy:', accuracy);
        return;
      }

      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      const time = position.timestamp || Date.now();
      const current = { lat, lon, time };

      let distance = parseFloat(localStorage.getItem(LS_DISTANCE_KEY) || '0');
      let deadDist = parseFloat(localStorage.getItem(LS_DEAD_DIST_KEY) || '0');
      let activeDist = parseFloat(localStorage.getItem(LS_ACTIVE_DIST_KEY) || '0');
      const isFirstOrder = localStorage.getItem(LS_FIRST_ORDER_KEY) === 'true';

      let lastRaw = localStorage.getItem(LS_LAST_COORD_KEY);

      if (lastRaw) {
        try {
          const last = JSON.parse(lastRaw);
          const d = calculateHaversineDistance(last, current);
          const elapsedHours = (time - last.time) / 3600000;
          const speed = elapsedHours > 0 ? d / elapsedHours : 0;

          // Noise reduction and validation filters:
          // 1. Minimum distance change of 10 meters (0.01 km) to avoid stationary jitter
          // 2. Maximum physical speed limit (150 km/h) to filter out telemetry jumping
          if (d >= 0.01 && speed < 150) {
            distance += d;
            localStorage.setItem(LS_DISTANCE_KEY, distance.toFixed(4));

            if (isFirstOrder) {
              activeDist += d;
              localStorage.setItem(LS_ACTIVE_DIST_KEY, activeDist.toFixed(4));
            } else {
              deadDist += d;
              localStorage.setItem(LS_DEAD_DIST_KEY, deadDist.toFixed(4));
            }

            console.log(`[GPSTracker] Distance update: +${d.toFixed(3)} km (Total: ${distance.toFixed(3)} km, Dead: ${deadDist.toFixed(3)} km, Active: ${activeDist.toFixed(3)} km)`);
            // Route point log (Workstream 5) — same acceptance gate as the distance accumulator
            // above, so the polyline doesn't record stationary jitter either.
            appendRoutePoint(current);
          } else {
            console.log('[GPSTracker] Movement ignored (jitter filter or invalid speed)', { d, speed });
          }
        } catch (e) {
          console.warn('[GPSTracker] Failed to compute distance delta', e);
        }
      } else {
        // First accepted position of a new tracking leg (shift start, or resume after a pause) —
        // always record it as a route anchor so the mini-map doesn't drop the segment's start.
        appendRoutePoint(current);
      }

      localStorage.setItem(LS_LAST_COORD_KEY, JSON.stringify(current));
    };

    const error = (err) => {
      console.warn('[GPSTracker] Geolocation error:', err.message);
    };

    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    };

    activeWatchId = navigator.geolocation.watchPosition(success, error, options);
    try {
      localStorage.setItem(LS_WATCH_ID_KEY, String(activeWatchId));
    } catch {}
    console.log('[GPSTracker] Geolocation watch active with ID:', activeWatchId);
  },

  /**
   * Request permission and start watching position from zero.
   */
  async start() {
    this._watch(true);
  },

  /**
   * Resume watching position after a pause, preserving accumulated distance.
   */
  async resume() {
    this._watch(false);
  },

  /**
   * Pause watching position, keeping accumulated distance intact.
   */
  pause() {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      if (activeWatchId !== null) {
        navigator.geolocation.clearWatch(activeWatchId);
        activeWatchId = null;
      }
      const savedWatch = localStorage.getItem(LS_WATCH_ID_KEY);
      if (savedWatch) {
        navigator.geolocation.clearWatch(Number(savedWatch));
        localStorage.removeItem(LS_WATCH_ID_KEY);
      }
    }
    localStorage.removeItem(LS_LAST_COORD_KEY);
    console.log('[GPSTracker] Geolocation tracking paused.');
  },

  /**
   * Stop tracking completely and return the final distance splits plus the recorded route.
   * @returns {{ total: number, dead: number, active: number, routePoints: Array<{latitude: number, longitude: number, timestamp: number}> }}
   */
  stop() {
    this.pause();
    const total = parseFloat(localStorage.getItem(LS_DISTANCE_KEY) || '0');
    const dead = parseFloat(localStorage.getItem(LS_DEAD_DIST_KEY) || '0');
    const active = parseFloat(localStorage.getItem(LS_ACTIVE_DIST_KEY) || '0');
    const routePoints = this.getRoutePoints();

    localStorage.removeItem(LS_DISTANCE_KEY);
    localStorage.removeItem(LS_FIRST_ORDER_KEY);
    localStorage.removeItem(LS_DEAD_DIST_KEY);
    localStorage.removeItem(LS_ACTIVE_DIST_KEY);
    localStorage.removeItem(LS_ROUTE_POINTS_KEY);

    console.log('[GPSTracker] Geolocation watch stopped. Final splits:', { total, dead, active, points: routePoints.length });
    return { total, dead, active, routePoints };
  },

  /**
   * Get the raw route points recorded so far for the active shift (Workstream 5).
   * @returns {Array<{latitude: number, longitude: number, timestamp: number}>}
   */
  getRoutePoints() {
    try {
      const raw = localStorage.getItem(LS_ROUTE_POINTS_KEY);
      const points = raw ? JSON.parse(raw) : [];
      return Array.isArray(points) ? points : [];
    } catch {
      return [];
    }
  },

  /**
   * Get the current accumulated total distance in kilometers.
   * @returns {number}
   */
  getAccumulatedDistance() {
    return parseFloat(localStorage.getItem(LS_DISTANCE_KEY) || '0');
  },

  /**
   * Get the accumulated dead mile distance in kilometers.
   * @returns {number}
   */
  getDeadDistance() {
    return parseFloat(localStorage.getItem(LS_DEAD_DIST_KEY) || '0');
  },

  /**
   * Get the accumulated active delivery distance in kilometers.
   * @returns {number}
   */
  getActiveDistance() {
    return parseFloat(localStorage.getItem(LS_ACTIVE_DIST_KEY) || '0');
  },

  /**
   * Check if the first order has been received yet.
   * @returns {boolean}
   */
  isFirstOrderReceived() {
    return localStorage.getItem(LS_FIRST_ORDER_KEY) === 'true';
  },

  /**
   * Mark the first order as received, shifting telemetry categorizing to active miles.
   */
  markFirstOrderReceived() {
    localStorage.setItem(LS_FIRST_ORDER_KEY, 'true');
    // Clear baseline so resume starts fresh without drawing teleportation line
    localStorage.removeItem(LS_LAST_COORD_KEY);
    console.log('[GPSTracker] First order marked! Transitioning all future telemetry to Active Miles.');
  },

  /**
   * Check if tracker is currently running.
   * @returns {boolean}
   */
  isActive() {
    return activeWatchId !== null || localStorage.getItem(LS_WATCH_ID_KEY) !== null;
  }
};
