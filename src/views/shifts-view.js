import PapaMod from '../libs/papaparse.min.js';
import { db } from '../core/db.js';
import { bus, PLATFORM_CHANGED, SHIFT_DELETED, SHIFT_SAVED } from '../core/events.js';
import { store } from '../core/store.js';
import { t } from '../utils/strings.js';
import { showDrawer, showModal, showToast, renderEmptyState, renderSkeleton } from '../ui/components.js';
import { getIcon } from '../ui/icons.js';
import { getPlatformConfig } from '../registry/platforms/terminology.js';
import { renderShiftForm } from '../modules/shifts/shift-form.js';
import {
  applyTemplate,
  checkHoursWarning,
  deleteShift,
  duplicateShift,
  getTemplates,
  purgeShifts,
  restoreShift,
  restoreShiftTimerFromLocalStorage,
  saveAsTemplate,
  saveShift,
  shiftRowToFormTimeFields,
  startShiftTimer,
  stopShiftTimer,
  updateShift,
} from '../modules/shifts/shifts.js';
import { formatRegisteredMetricValue } from '../modules/analytics/analytics.js';
import { MetricRegistry, getMetricValue } from '../registry/metrics/index.js';
import { defaultRangeForPreset, enumerateWeekDates, ymd, startOfWeekDate } from '../utils/date-range-presets.js';
import { demoSampleRangeOverlaps, getDemoAnalyticsAnchorDate } from '../modules/demo/sample-year.js';

const Papa = /** @type {any} */ (PapaMod).default || PapaMod;

const SHIFTS_RANGE_KEY = 'comma-shifts-list-range-v1';
const SHIFTS_PAGE_KEY = 'comma-shifts-list-page-v1';
const SHIFTS_SORT_KEY = 'comma-shifts-list-sort-v1';
const SHIFTS_PER_PAGE = 15;

function escapeAttr(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function escapeHtml(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** @type {WeakMap<HTMLElement, () => void>} */
const teardownByRoot = new WeakMap();

function shiftsFilterAnchorDate() {
  return store.get('demoMode') ? getDemoAnalyticsAnchorDate() : new Date();
}

/** @param {number} weekStartDay */
function loadShiftsRange(weekStartDay) {
  try {
    const raw = sessionStorage.getItem(SHIFTS_RANGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p.start === 'string' && typeof p.end === 'string' && typeof p.preset === 'string') {
        let start = p.start;
        let end = p.end;
        if (String(start) > String(end)) {
          const t0 = start;
          start = end;
          end = t0;
        }
        const normalized = { ...p, start, end };
        if (store.get('demoMode') && !demoSampleRangeOverlaps(start, end)) {
          /* Saved range (e.g. real-world week) misses 2025 demo data — ignore. */
        } else {
          // Week-nav presets carry their own anchor and must NOT be re-pinned to "today" — they are
          // recomputed from the stored anchorYmd so prev/next stepping and day selection persist.
          if ((p.preset === 'week' || p.preset === 'shift-day') && typeof p.anchorYmd === 'string') {
            if (p.preset === 'shift-day') return { ...normalized, preset: 'shift-day' };
            return weekRangeFor(p.anchorYmd, weekStartDay);
          }
          if (p.preset && p.preset !== 'custom') {
            return defaultRangeForPreset(p.preset, shiftsFilterAnchorDate(), weekStartDay);
          }
          return normalized;
        }
      }
    }
  } catch {
    /* ignore */
  }
  return defaultRangeForPreset('week', shiftsFilterAnchorDate(), weekStartDay);
}

/** @param {{ start: string; end: string; preset: string }} s */
function saveShiftsRange(s) {
  try {
    sessionStorage.setItem(SHIFTS_RANGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/* ── Mobile-style week navigation ──────────────────────────────────────────────────────────────
 * The list is driven by a single "anchor" date (any day inside the shown week). Prev/next step the
 * anchor by ±7 days; tapping a day-bar narrows to that one date. State is persisted in the same
 * `saveShiftsRange` slot the rest of the view already reads, using two of its presets:
 *   - preset 'week'      → whole week [weekStart … weekEnd] containing the anchor
 *   - preset 'shift-day' → a single date [d … d]  (mobile: tapping a bar; distinct from the old
 *                          'day' preset which defaultRangeForPreset pins to *today*)
 * `anchorYmd` (the tapped/selected date, or the week's chosen day) is stashed alongside so prev/next
 * and re-selection are stable across repaints.
 * ──────────────────────────────────────────────────────────────────────────────────────────── */

/** Full week range containing `anchorYmd`, tagged so it round-trips through saveShiftsRange. */
function weekRangeFor(anchorYmd, weekStartDay) {
  const days = enumerateWeekDates(anchorYmd, weekStartDay);
  const start = days[0];
  const end = days[days.length - 1];
  return { start, end, preset: 'week', anchorYmd, weekStartYmd: start };
}

/** Read the current shifts range as a week-nav model (anchor + whether a single day is selected). */
function loadWeekNav(weekStartDay) {
  const today = ymd(shiftsFilterAnchorDate());
  let raw = null;
  try {
    const s = sessionStorage.getItem(SHIFTS_RANGE_KEY);
    if (s) raw = JSON.parse(s);
  } catch {
    /* ignore */
  }
  const anchor = raw && typeof raw.anchorYmd === 'string' ? raw.anchorYmd : today;
  const week = weekRangeFor(anchor, weekStartDay);
  const selectedDay = raw && raw.preset === 'shift-day' && typeof raw.anchorYmd === 'string' ? raw.anchorYmd : null;
  return { anchor, week, selectedDay, weekStartDay };
}

/** Persist the week-nav selection into the shared range slot and reset paging. */
function saveWeekNav(anchorYmd, weekStartDay, { selectDay = false } = {}) {
  const week = weekRangeFor(anchorYmd, weekStartDay);
  const range = selectDay
    ? { start: anchorYmd, end: anchorYmd, preset: 'shift-day', anchorYmd, weekStartYmd: week.weekStartYmd }
    : { ...week, anchorYmd };
  saveShiftsRange(range);
  saveShiftsPageIdx(range.start, range.end, range.preset, 0);
}

/** @param {string} start @param {string} end @param {string} preset */
function loadShiftsPageIdx(start, end, preset) {
  try {
    const raw = sessionStorage.getItem(SHIFTS_PAGE_KEY);
    if (!raw) return 0;
    const p = JSON.parse(raw);
    if (
      p &&
      p.start === start &&
      p.end === end &&
      p.preset === preset &&
      typeof p.page === 'number' &&
      Number.isFinite(p.page) &&
      p.page >= 0
    ) {
      return Math.floor(p.page);
    }
  } catch {
    /* ignore */
  }
  return 0;
}

/** @param {string} start @param {string} end @param {string} preset @param {number} page */
function saveShiftsPageIdx(start, end, preset, page) {
  try {
    sessionStorage.setItem(SHIFTS_PAGE_KEY, JSON.stringify({ start, end, preset, page }));
  } catch {
    /* ignore */
  }
}

function loadShiftsSortDir() {
  try {
    const v = sessionStorage.getItem(SHIFTS_SORT_KEY);
    if (v === 'asc' || v === 'desc') return v;
  } catch {
    /* ignore */
  }
  return 'desc';
}

/** @param {'asc'|'desc'} dir */
function saveShiftsSortDir(dir) {
  try {
    sessionStorage.setItem(SHIFTS_SORT_KEY, dir);
  } catch {
    /* ignore */
  }
}

/**
 * @param {Record<string, unknown>[]} list
 * @param {string} start
 * @param {string} end
 * @param {'asc'|'desc'} sortDir
 */
function filterAndSortShifts(list, start, end, sortDir) {
  const out = list.filter((s) => {
    const d = String(s.date || '');
    return d >= start && d <= end;
  });
  out.sort((a, b) => {
    let cmp = String(a.date).localeCompare(String(b.date));
    // ids are opaque client-generated strings (Fix 2 — interop plan), not sortable numbers —
    // fall back to createdAt (ISO string) for a stable same-date tiebreak.
    if (cmp === 0) cmp = String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    return sortDir === 'desc' ? -cmp : cmp;
  });
  return out;
}

async function loadAllShiftsForPlatform() {
  const platform = String(store.get('activePlatformId') ?? 'all');
  const rows = await db.shifts.toArray();
  return rows.filter((s) => s.deletedAt == null).filter((s) => platform === 'all' || String(s.platformId) === platform);
}

/**
 * Bulk-fetch `shiftPlatforms` rows for a set of shift ids, grouped by shiftId (interop plan
 * Workstream 4 — multi-platform shift breakdown display).
 * @param {Array<string>} shiftIds
 * @param {{ includeDeleted?: boolean }} [opts] `includeDeleted`: trash view still wants the
 *   breakdown for a soft-deleted shift, whose own `shiftPlatforms` rows are tombstoned in lockstep
 *   (see `deleteShift`) — the active shift list should NOT show tombstoned rows.
 * @returns {Promise<Map<string, Array<Record<string, unknown>>>>}
 */
async function loadShiftPlatformsMap(shiftIds, opts = {}) {
  // shift ids are opaque client-generated strings (Fix 2 — interop plan), not numbers.
  const ids = shiftIds.filter((id) => typeof id === 'string' && id);
  /** @type {Map<string, Array<Record<string, unknown>>>} */
  const map = new Map();
  if (!ids.length) return map;
  const rows = await db.shiftPlatforms.where('shiftId').anyOf(ids).toArray();
  for (const row of rows) {
    if (!opts.includeDeleted && row.syncDeletedAt != null) continue;
    const key = String(row.shiftId);
    const list = map.get(key) || [];
    list.push(row);
    map.set(key, list);
  }
  return map;
}

/**
 * Platform breakdown chips for a multi-platform shift (interop plan Workstream 4). Only meant to
 * be called when `platformRows.length > 1` — single-platform shifts keep the plain `.shift-badge`.
 * @param {Array<Record<string, unknown>>} platformRows
 */
function platformBreakdownChipsHtml(platformRows) {
  const user = store.get('user');
  const sym = user && user.locale && typeof user.locale.currencySymbol === 'string' ? user.locale.currencySymbol : '$';
  return platformRows
    .map((r) => {
      const pid = String(r.platform || 'other');
      const pl = getPlatformConfig(pid);
      const amount = Number(r.grossRevenue || 0) + Number(r.tipsRevenue || 0);
      return `<span class="shift-breakdown-chip" data-platform-id="${escapeAttr(pid)}">
        <span>${escapeHtml(pl.name || pid)}</span>
        <span class="shift-breakdown-chip-amount">${escapeHtml(sym)}${amount.toFixed(2)}</span>
      </span>`;
    })
    .join('');
}

function shiftCardMetricsHtml(s) {
  const user = store.get('user');
  const localeCountry = user?.locale?.country || 'US';
  const currency = user?.locale?.currency || 'USD';
  return [...MetricRegistry.getAll()]
    .filter((m) => m.showOnShiftCard)
    .sort((a, b) => (a.shiftCardOrder || 0) - (b.shiftCardOrder || 0))
    .map((m) => {
      const raw = getMetricValue(m.id, { shift: s });
      const valueStr = formatRegisteredMetricValue(m, raw, localeCountry, currency);
      const label = m.messageKey ? t(String(m.messageKey)) : m.label;
      return `<div class="shift-card-metric">
          <div class="shift-card-metric-label">${escapeHtml(label)}</div>
          <div class="shift-card-metric-value">${escapeHtml(valueStr)}</div>
        </div>`;
    })
    .join('');
}

/* ============================================================================================
 * Workstream 5 (interop plan — GPS route + odometer, read-only in web)
 *
 * Read-only display of the `routePath` / `startOdometer` / `endOdometer` / `distanceSource` /
 * `reconciliationStatus` fields a future sync will populate from mobile (mobile's schema:
 * `commaApp/src/database/schema.ts`). No editing, no "reconcile" action — see the interop plan's
 * decisions table ("GPS route / odometer reconciliation" row): the reconciliation *editing*
 * workflow stays mobile-only, web only stores + displays what it's given.
 *
 * Kept as a self-contained block (own helpers, one call site in `shiftCardHtml`) so it merges
 * cleanly against any other in-flight edits to this file.
 * ========================================================================================== */

/**
 * Google-encoded-polyline decoder — fallback shape for `routePath` alongside the JSON-array
 * shape below. Mirrors mobile's `decodePolyline` (`commaApp/utils/polyline.ts`) byte-for-byte.
 * @param {string} encoded
 * @returns {{lat: number, lng: number}[]}
 */
function decodeGooglePolyline(encoded) {
  const points = [];
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
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

/**
 * Parses a shift's `routePath` field into a normalized list of `{lat, lng}` points.
 * Canonical shape (matches mobile's `parseRoutePath`, `commaApp/utils/polyline.ts`): a JSON
 * array of point objects accepting `{latitude,longitude}`, `{lat,lng}`, or `{lat,lon}` —
 * whichever a given writer used — with a Google-encoded-polyline string as a fallback shape.
 * Returns `null` if there's nothing renderable (fewer than 2 valid points).
 * @param {unknown} routePath
 * @returns {{lat: number, lng: number}[] | null}
 */
function parseShiftRoutePath(routePath) {
  if (typeof routePath !== 'string' || !routePath.trim()) return null;
  const trimmed = routePath.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        const pts = parsed
          .map((p) => {
            if (!p || typeof p !== 'object') return null;
            const lat = p.latitude ?? p.lat;
            const lng = p.longitude ?? p.lng ?? p.lon;
            const latN = Number(lat);
            const lngN = Number(lng);
            if (!Number.isFinite(latN) || !Number.isFinite(lngN)) return null;
            return { lat: latN, lng: lngN };
          })
          .filter(Boolean);
        return pts.length >= 2 ? pts : null;
      }
    } catch {
      /* not JSON — fall through to polyline decode below */
    }
    return null;
  }
  try {
    const decoded = decodeGooglePolyline(trimmed);
    return decoded.length >= 2 ? decoded : null;
  } catch {
    return null;
  }
}

/**
 * Builds a small static inline-SVG polyline mini-map from normalized route points.
 * Visual concept matches mobile's `RouteMinimap` (`commaApp/app/(tabs)/shifts/index.tsx`) —
 * min/max-normalized points in a small viewBox, light gridlines, green start dot, accent end
 * dot — re-themed with web's CSS custom properties (widget SVG convention, see
 * `src/registry/widgets/*.widget.js`) instead of mobile's hardcoded dark-mode hex colors.
 * @param {{lat: number, lng: number}[]} points
 */
function shiftRouteMinimapSvg(points) {
  const W = 220;
  const H = 120;
  const PAD = 12;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = maxLat - minLat || 0.0005;
  const lngRange = maxLng - minLng || 0.0005;

  const toXY = (p) => ({
    x: PAD + ((p.lng - minLng) / lngRange) * (W - 2 * PAD),
    y: PAD + (1 - (p.lat - minLat) / latRange) * (H - 2 * PAD),
  });

  const svgPoints = points
    .map((p) => {
      const { x, y } = toXY(p);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const start = toXY(points[0]);
  const end = toXY(points[points.length - 1]);
  const mapAriaLabel = t('shifts.route.mapAria') || 'Shift route map';

  return `
    <svg class="shift-route-minimap-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escapeAttr(mapAriaLabel)}">
      <line x1="0" y1="${(H / 3).toFixed(1)}" x2="${W}" y2="${(H / 3).toFixed(1)}" class="shift-route-minimap-grid"></line>
      <line x1="0" y1="${((H / 3) * 2).toFixed(1)}" x2="${W}" y2="${((H / 3) * 2).toFixed(1)}" class="shift-route-minimap-grid"></line>
      <line x1="${(W / 3).toFixed(1)}" y1="0" x2="${(W / 3).toFixed(1)}" y2="${H}" class="shift-route-minimap-grid"></line>
      <line x1="${((W / 3) * 2).toFixed(1)}" y1="0" x2="${((W / 3) * 2).toFixed(1)}" y2="${H}" class="shift-route-minimap-grid"></line>
      <polyline points="${svgPoints}" class="shift-route-minimap-line"></polyline>
      <circle cx="${start.x.toFixed(1)}" cy="${start.y.toFixed(1)}" r="4" class="shift-route-minimap-start"></circle>
      <circle cx="${end.x.toFixed(1)}" cy="${end.y.toFixed(1)}" r="4.5" class="shift-route-minimap-end"></circle>
    </svg>
  `;
}

/** Known `distanceSource` values (mobile default: `gps_only`) → display label i18n keys. */
const DISTANCE_SOURCE_LABEL_KEYS = {
  gps_only: 'shifts.route.sourceGps',
  manual: 'shifts.route.sourceManual',
  odometer_only: 'shifts.route.sourceOdometer',
  gps_and_odometer: 'shifts.route.sourceGpsOdometer',
  odometer_reconciled: 'shifts.route.sourceOdometerReconciled',
};

/** Known `reconciliationStatus` values (mobile default: `reconciled`) → i18n key + badge tone. */
const RECONCILIATION_STATUS_META = {
  tracking: { key: 'shifts.route.statusTracking', tone: 'info' },
  pending_reconciliation: { key: 'shifts.route.statusPending', tone: 'warning' },
  reconciled: { key: 'shifts.route.statusReconciled', tone: 'success' },
};

/** Title-cases an unrecognized snake_case enum value so new mobile values degrade gracefully. */
function humanizeEnumFallback(value) {
  return String(value)
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** @param {number} n */
function formatOdometerReading(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '';
  return Math.round(v).toLocaleString();
}

/**
 * Read-only route mini-map + odometer/reconciliation badges for one shift's card. Returns ''
 * when the shift has none of `routePath`/`startOdometer`/`endOdometer`/`distanceSource`/
 * `reconciliationStatus` set — true for the overwhelming majority of manually-entered web shifts,
 * so this section stays invisible until real GPS/odometer data arrives (web's own GPS-tracked
 * shifts, or a future sync pull from mobile).
 * @param {Record<string, unknown>} s
 */
function shiftRouteAndOdometerHtml(s) {
  const points = parseShiftRoutePath(s.routePath);

  const hasStartOdo = s.startOdometer != null && s.startOdometer !== '';
  const hasEndOdo = s.endOdometer != null && s.endOdometer !== '';
  const hasSource = typeof s.distanceSource === 'string' && s.distanceSource.trim() !== '';
  const hasStatus = typeof s.reconciliationStatus === 'string' && s.reconciliationStatus.trim() !== '';

  if (!points && !hasStartOdo && !hasEndOdo && !hasSource && !hasStatus) return '';

  const mapHtml = points
    ? `<div class="shift-route-minimap">${shiftRouteMinimapSvg(points)}</div>`
    : '';

  const badges = [];
  if (hasStartOdo) {
    badges.push(
      `<span class="shift-route-badge"><span class="shift-route-badge-label">${escapeHtml(t('shifts.route.startOdometer'))}</span><span class="shift-route-badge-value">${escapeHtml(formatOdometerReading(s.startOdometer))}</span></span>`,
    );
  }
  if (hasEndOdo) {
    badges.push(
      `<span class="shift-route-badge"><span class="shift-route-badge-label">${escapeHtml(t('shifts.route.endOdometer'))}</span><span class="shift-route-badge-value">${escapeHtml(formatOdometerReading(s.endOdometer))}</span></span>`,
    );
  }
  if (hasSource) {
    const key = DISTANCE_SOURCE_LABEL_KEYS[s.distanceSource];
    const label = key ? t(key) : humanizeEnumFallback(s.distanceSource);
    badges.push(
      `<span class="shift-route-badge"><span class="shift-route-badge-label">${escapeHtml(t('shifts.route.sourceLabel'))}</span><span class="shift-route-badge-value">${escapeHtml(label)}</span></span>`,
    );
  }
  if (hasStatus) {
    const meta = RECONCILIATION_STATUS_META[s.reconciliationStatus];
    const label = meta ? t(meta.key) : humanizeEnumFallback(s.reconciliationStatus);
    const tone = meta ? meta.tone : 'info';
    badges.push(
      `<span class="shift-route-badge shift-route-status shift-route-status--${escapeAttr(tone)}"><span class="shift-route-badge-label">${escapeHtml(t('shifts.route.statusLabel'))}</span><span class="shift-route-badge-value">${escapeHtml(label)}</span></span>`,
    );
  }

  return `
    <div class="shift-route-section">
      ${mapHtml}
      ${badges.length ? `<div class="shift-route-badges">${badges.join('')}</div>` : ''}
    </div>
  `;
}
/* ============================================================================ end Workstream 5 */

/** User's currency symbol (defaults to `$`). */
function currencySymbol() {
  const user = store.get('user');
  return user && user.locale && typeof user.locale.currencySymbol === 'string' ? user.locale.currencySymbol : '$';
}

/** Net earnings for a shift = gross + tips + bonus (matches shift_gross metric). */
function shiftNetEarnings(s) {
  return Number(s?.grossRevenue ?? 0) + Number(s?.tipsRevenue ?? 0) + (Number(s?.bonusAmount) || 0);
}

/** Friendly day label like mobile's "Monday, Jul 4"; falls back to the raw YYYY-MM-DD string. */
function shiftDayLabel(s) {
  const raw = String(s?.date || '');
  if (!raw) return '';
  const d = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) return raw;
  try {
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  } catch {
    return raw;
  }
}

/** Minutes worked for a shift (durationSeconds, falling back to onlineMinutes) — matches metrics. */
function shiftMinutes(s) {
  return Math.round(Number(s?.durationSeconds) / 60) || Number(s?.onlineMinutes) || 0;
}

/** Short "MMM D – MMM D" label for the week pill (mobile shows the current week span). */
function weekPillLabel(week) {
  const fmt = (ymdStr) => {
    const d = new Date(`${ymdStr}T00:00:00`);
    if (Number.isNaN(d.getTime())) return ymdStr;
    try {
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return ymdStr;
    }
  };
  return `${fmt(week.start)} – ${fmt(week.end)}`;
}

/**
 * 7-day earnings bar chart for the week containing the nav anchor. Each bar is a day; height is the
 * day's net earnings relative to the week's best day. Tapping a bar filters the list to that day
 * (data-shifts-day="<ymd>"); the selected day is highlighted, others dimmed (mobile parity).
 * @param {Array<Record<string, unknown>>} allShifts  all (platform-filtered) shifts
 * @param {{ week: any, selectedDay: string|null }} nav
 * @param {number} weekStartDay
 */
function shiftsWeekChartHtml(allShifts, nav, weekStartDay) {
  const sym = currencySymbol();
  const days = enumerateWeekDates(nav.week.start, weekStartDay);
  const totals = days.map((d) => allShifts.filter((s) => String(s.date) === d).reduce((sum, s) => sum + shiftNetEarnings(s), 0));
  const maxTotal = Math.max(0, ...totals);
  const dayLetter = (d) => {
    const dt = new Date(`${d}T00:00:00`);
    try {
      return dt.toLocaleDateString(undefined, { weekday: 'narrow' });
    } catch {
      return d.slice(-2);
    }
  };
  const anySelected = !!nav.selectedDay;
  const high = maxTotal > 0
    ? `<div class="shifts-chart-high"><span class="shifts-chart-high-line"></span><span class="shifts-chart-high-badge sh-eyebrow">${escapeHtml(t('shifts.chartHigh'))}: ${escapeHtml(sym)}${maxTotal.toFixed(2)}</span></div>`
    : '';
  const cols = days
    .map((d, i) => {
      const val = totals[i];
      const pct = maxTotal > 0 ? (val / maxTotal) * 100 : 0;
      const h = Math.max(pct, val > 0 ? 8 : 2);
      const isSel = nav.selectedDay === d;
      const dim = anySelected && !isSel ? ' is-dim' : '';
      const selCls = isSel ? ' is-selected' : '';
      const title = `${d}: ${sym}${val.toFixed(2)}`;
      return `
        <button type="button" class="shifts-chart-col${selCls}" data-shifts-day="${escapeAttr(d)}" title="${escapeAttr(title)}" aria-pressed="${isSel ? 'true' : 'false'}">
          <span class="shifts-chart-track"><span class="shifts-chart-fill${dim}" style="height:${h}%"></span></span>
          <span class="shifts-chart-daylabel">${escapeHtml(dayLetter(d))}</span>
        </button>`;
    })
    .join('');
  return `<div class="shifts-chart-card">${high}<div class="shifts-chart-row">${cols}</div></div>`;
}

/**
 * Mobile-style stats grid summarising the shifts currently in range: total earnings, hours,
 * distance and orders. Mirrors the mobile shifts tab's 4-card stat block (Online/Active/Miles/
 * Orders), adapted for web's data (net earnings + total distance + total orders).
 * @param {Array<Record<string, unknown>>} shifts
 */
function shiftsStatsHtml(shifts) {
  const sym = currencySymbol();
  const user = store.get('user');
  const unit = user && user.locale && typeof user.locale.distanceUnit === 'string' ? user.locale.distanceUnit : 'mi';
  let earn = 0;
  let minutes = 0;
  let distance = 0;
  let orders = 0;
  for (const s of shifts) {
    earn += shiftNetEarnings(s);
    minutes += shiftMinutes(s);
    distance += Number(s?.activeMileage || 0) + Number(s?.deadMileage || 0);
    orders += Number(s?.deliveryCount || 0);
  }
  const hours = (minutes / 60).toFixed(1);
  const cell = (label, value) => `
    <div class="shifts-stat-card">
      <div class="sh-eyebrow shifts-stat-label">${escapeHtml(label)}</div>
      <div class="shifts-stat-value">${value}</div>
    </div>`;
  return (
    cell(t('shifts.gross'), `${escapeHtml(sym)}${earn.toFixed(2)}`) +
    cell(t('shifts.statHours'), `${hours}`) +
    cell(t('shifts.statDistance'), `${distance.toFixed(1)} ${escapeHtml(unit)}`) +
    cell(t('shifts.statOrders'), `${orders}`)
  );
}

/**
 * @param {Record<string, unknown>} s
 * @param {Array<Record<string, unknown>>} [platformRows] Non-deleted `shiftPlatforms` rows for
 *   this shift (interop plan Workstream 4). When there's more than one, a per-platform breakdown
 *   is shown instead of the plain single-platform badge; 0 or 1 rows keeps today's display as-is.
 */
function shiftCardHtml(s, platformRows = []) {
  const pid = String(s.platformId || 'other');
  const pl = getPlatformConfig(pid);
  const platName = String(pl.name || pid);
  // Platform icon chip: first letter of the platform name, tinted by the platform brand color.
  const iconGlyph = escapeHtml((platName.trim()[0] || '·').toUpperCase());
  const earn = `${escapeHtml(currencySymbol())}${shiftNetEarnings(s).toFixed(2)}`;
  const breakdown =
    platformRows.length > 1
      ? `<div class="shift-card-platform"><span class="shift-card-platform-breakdown">${platformBreakdownChipsHtml(platformRows)}</span></div>`
      : '';
  return `
    <article class="shift-card" data-shift-id="${escapeAttr(String(s.id))}">
      <div class="shift-card-top">
        <div class="shift-card-ident">
          <span class="shift-card-plat-icon" data-platform-id="${escapeAttr(pid)}" title="${escapeAttr(platName)}">${iconGlyph}</span>
          <span class="shift-card-date">${escapeHtml(shiftDayLabel(s))}</span>
        </div>
        <div class="shift-card-earn">${earn}</div>
      </div>
      ${breakdown}
      <div class="shift-card-main">
        ${shiftCardMetricsHtml(s)}
      </div>
      ${shiftRouteAndOdometerHtml(s)}
      <div class="shift-card-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-action="edit">${escapeHtml(t('common.edit'))}</button>
        <button type="button" class="btn btn-ghost btn-sm" data-action="duplicate">${escapeHtml(t('shifts.duplicateShift'))}</button>
        <button type="button" class="btn btn-danger btn-sm" data-action="delete">${escapeHtml(t('common.delete'))}</button>
      </div>
    </article>
  `;
}

/**
 * @param {{ getValue: () => Record<string, unknown>; getWeekSaveDates?: () => string[] | null }} formApi
 * @param {(val: Record<string, unknown>) => Promise<unknown>} onSaved
 */
async function submitShiftFromForm(formApi, onSaved) {
  const val = formApi.getValue();
  const weekDates = typeof formApi.getWeekSaveDates === 'function' ? formApi.getWeekSaveDates() : null;
  if (weekDates && weekDates.length === 0) {
    showToast({ type: 'error', message: t('shifts.weekNoDays'), duration: 2200 });
    return null;
  }
  if (weekDates && weekDates.length > 0) {
    let ok = 0;
    let skip = 0;
    for (const d of weekDates) {
      try {
        await onSaved({ ...val, date: d });
        ok += 1;
      } catch (err) {
        console.warn('[comma shifts] weekly row save failed', err);
        skip += 1;
      }
    }
    if (skip === 0) {
      showToast({ type: 'success', message: t('shifts.savedManyToast').replace('{count}', String(ok)), duration: 2200 });
    } else if (ok === 0) {
      showToast({ type: 'error', message: t('errors.generic'), duration: 2600 });
      return null;
    } else {
      showToast({
        type: 'success',
        message: t('shifts.weekPartialToast').replace('{ok}', String(ok)).replace('{skip}', String(skip)),
        duration: 3600,
      });
    }
    return 1;
  }
  try {
    await onSaved(val);
    showToast({ type: 'success', message: t('shifts.savedToast'), duration: 1800 });
    return 1;
  } catch (err) {
    console.warn('[comma shifts] save failed', err);
    showToast({ type: 'error', message: t('errors.generic'), duration: 2200 });
    return null;
  }
}

/**
 * Week-picker popup — built as the SAME bottom-sheet as the Expenses month picker (it reuses the
 * `expenses-m-modal*` / `expenses-m-mcard*` classes), so the two pickers are visually identical.
 * Lists every week of the chosen year (most recent first, current year is YTD), each row showing
 * the date range + weekly net-earnings total and a mini 7-day bar graph; a footer pages by year.
 * Tapping a week calls `onPick(weekStartYmd)` and closes.
 * @param {{ selectedWeekStart: string, weekStartDay: number, onPick: (weekStartYmd: string) => void }} opts
 */
async function openWeekSelector({ selectedWeekStart, weekStartDay, onPick }) {
  const sym = currencySymbol();
  const all = await loadAllShiftsForPlatform();
  const realYear = shiftsFilterAnchorDate().getFullYear();

  // Net earnings per date, computed once.
  const byDate = new Map();
  for (const s of all) {
    const d = String(s.date || '');
    if (!d) continue;
    byDate.set(d, (byDate.get(d) || 0) + shiftNetEarnings(s));
  }

  const selectedYear = Number(String(selectedWeekStart).slice(0, 4)) || realYear;
  let viewYear = Number.isFinite(selectedYear) ? selectedYear : realYear;

  // Host element (fixed bottom-sheet). Reuses the expenses month-modal chrome. Remove any prior
  // instance first so rapid re-opens can't stack sheets.
  document.querySelectorAll('.shifts-week-modal').forEach((n) => n.remove());
  const host = document.createElement('div');
  host.className = 'expenses-m-modal shifts-week-modal';

  /** Build the sheet markup for `viewYear`. */
  const build = () => {
    // All week-starts whose week overlaps viewYear, from the last (YTD if current year) back to Jan.
    const lastDay = viewYear >= realYear ? shiftsFilterAnchorDate() : new Date(viewYear, 11, 31);
    let cursor = startOfWeekDate(lastDay, weekStartDay);
    const yearStart = new Date(viewYear, 0, 1);
    const cards = [];
    while (cursor.getFullYear() >= viewYear || cursor >= startOfWeekDate(yearStart, weekStartDay)) {
      if (cursor.getFullYear() < viewYear && cursor < startOfWeekDate(yearStart, weekStartDay)) break;
      const wsYmd = ymd(cursor);
      const days = enumerateWeekDates(wsYmd, weekStartDay);
      const dayTotals = days.map((d) => byDate.get(d) || 0);
      const total = dayTotals.reduce((a, b) => a + b, 0);
      const maxDay = Math.max(0, ...dayTotals);
      const isSel = wsYmd === selectedWeekStart;
      const mini = days
        .map((d, di) => {
          const h = maxDay > 0 ? Math.max((dayTotals[di] / maxDay) * 100, dayTotals[di] > 0 ? 8 : 2) : 2;
          return `<span class="expenses-m-mini-col"><span class="expenses-m-mini-track"><span class="expenses-m-mini-fill" style="height:${h}%"></span></span></span>`;
        })
        .join('');
      const range = weekPillLabel({ start: days[0], end: days[days.length - 1] });
      cards.push(`<button type="button" class="expenses-m-mcard${isSel ? ' is-selected' : ''}" data-week-pick="${escapeAttr(wsYmd)}">
        <span class="expenses-m-mcard-info">
          <span class="expenses-m-mcard-name">${escapeHtml(range)}</span>
          <span class="expenses-m-mcard-total">${escapeHtml(sym)}${total.toFixed(2)}</span>
        </span>
        <span class="expenses-m-mini">${mini}</span>
      </button>`);
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 7);
      if (cursor < startOfWeekDate(yearStart, weekStartDay)) break;
    }

    const nextDisabled = viewYear >= realYear;
    host.innerHTML = `
      <div class="expenses-m-modal-backdrop" data-week-close></div>
      <div class="expenses-m-modal-sheet" role="dialog" aria-modal="true" aria-label="${escapeAttr(t('shifts.selectWeek'))}">
        <div class="expenses-m-modal-head">
          <h2 class="expenses-m-modal-title">${escapeHtml(t('shifts.selectWeek'))}</h2>
          <button type="button" class="expenses-m-modal-done" data-week-close>${escapeHtml(t('common.done') || 'Done')}</button>
        </div>
        <div class="expenses-m-modal-subhead">
          <span>${escapeHtml(t('shifts.weeklyEarnings'))}</span>
          <span>${viewYear}</span>
        </div>
        <div class="expenses-m-modal-list">${cards.join('')}</div>
        <div class="expenses-m-modal-foot">
          <button type="button" class="expenses-m-modal-year" data-week-year="prev">${escapeHtml(t('expenses.previousYear') || 'Previous Year')}</button>
          <span class="expenses-m-modal-yearlbl">${viewYear}</span>
          <button type="button" class="expenses-m-modal-year${nextDisabled ? ' is-disabled' : ''}" data-week-year="next"${nextDisabled ? ' disabled' : ''}>${escapeHtml(t('expenses.nextYear') || 'Next Year')}</button>
        </div>
      </div>`;
  };

  build();
  document.body.appendChild(host);

  const close = () => {
    host.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (ev) => {
    if (ev.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);

  host.addEventListener('click', (ev) => {
    const el = ev.target instanceof Element ? ev.target : null;
    if (!el) return;
    if (el.closest('[data-week-close]')) {
      close();
      return;
    }
    const yearBtn = el.closest('[data-week-year]');
    if (yearBtn) {
      if (yearBtn.hasAttribute('disabled')) return;
      viewYear += yearBtn.getAttribute('data-week-year') === 'next' ? 1 : -1;
      build();
      return;
    }
    const pick = el.closest('[data-week-pick]');
    if (pick) {
      const ws = pick.getAttribute('data-week-pick');
      if (ws) {
        onPick(ws);
        close();
      }
    }
  });
}

async function openShiftFormModal({ initial, onSaved, title, mode = 'full', submitLabel }) {
  const editingId =
    initial && typeof initial === 'object' && typeof /** @type {{ id?: unknown }} */ (initial).id === 'string'
      ? /** @type {{ id?: string }} */ (initial).id
      : null;

  if (editingId) {
    const oopExpense = await db.expenses
      .filter((e) => e.deletedAt == null && e.shiftId === editingId && e.category === 'out_of_pocket')
      .first();
    if (oopExpense && oopExpense.amount != null) {
      initial.outOfPocketExpense = oopExpense.amount;
    }
    // Multi-platform breakdown (interop plan Workstream 4) — feed the existing shiftPlatforms
    // rows back into the form so row 1 + any additional platform rows re-populate on edit.
    const platformRows = await db.shiftPlatforms
      .where('shiftId')
      .equals(editingId)
      .filter((r) => r.syncDeletedAt == null)
      .toArray();
    if (platformRows.length) {
      initial.shiftPlatforms = platformRows.map((r) => ({
        platform: r.platform,
        grossRevenue: r.grossRevenue,
        tipsRevenue: r.tipsRevenue,
        tripsCount: r.tripsCount,
        platformOnlineSeconds: r.platformOnlineSeconds,
        platformActiveSeconds: r.platformActiveSeconds,
      }));
    }
  }

  const formApi = renderShiftForm({
    mode,
    initial: initial || {},
    submitLabel: submitLabel || t('common.save'),
    onCancel: () => handle.close(),
    allowWeeklyEntry: !Number.isFinite(editingId),
  });

  const handle = showModal({
    title: title || t('shifts.addShift'),
    content: formApi.el,
    actions: [],
  });

  const formEl = formApi.el.querySelector('form');
  if (formEl) {
    formEl.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = await submitShiftFromForm(formApi, onSaved);
      if (id != null) handle.close();
    });
  }
}

function renderPagerNumbers(current, total) {
  const windowSize = 5;
  let start = Math.max(0, current - Math.floor(windowSize / 2));
  let end = Math.min(total - 1, start + windowSize - 1);
  if (end - start + 1 < windowSize) {
    start = Math.max(0, end - windowSize + 1);
  }

  let html = '';
  for (let i = start; i <= end; i++) {
    const isActive = i === current;
    html += `<button type="button" class="shifts-pager-number${isActive ? ' is-active' : ''}" data-shifts-page="${i}">${i + 1}</button>`;
  }
  return html;
}

/** @param {HTMLElement} root @param {Record<string, unknown>} ctx */
export async function render(root, ctx) {
  const prev = teardownByRoot.get(root);
  if (prev) prev();

  await restoreShiftTimerFromLocalStorage();

  root.innerHTML = `
    <section class="shifts-view">
      <header class="shifts-view-header">
        <div class="shifts-view-header-main">
          <h1 class="shifts-view-title">
            ${escapeHtml(t('views.shifts.title'))}
            <span class="shifts-count-badge" data-slot="shifts-count" hidden></span>
          </h1>
          <p class="shifts-view-subtitle">${escapeHtml(t('views.shifts.subtitle'))}</p>
        </div>
        <div class="shifts-view-header-tools" role="toolbar" aria-label="${escapeHtml(t('shifts.headerToolsAria'))}">
          <button type="button" class="btn btn-secondary btn-sm" data-action="start-timer">${escapeHtml(t('shifts.startShift'))}</button>
          <button type="button" class="btn btn-secondary btn-sm" data-action="templates">${escapeHtml(t('shifts.templates'))}</button>
          <button type="button" class="btn btn-secondary btn-sm" data-action="trash">${getIcon('trash', 14)} <span>${escapeHtml(t('shifts.trash'))}</span></button>
        </div>
      </header>

      <div class="shifts-view-body">
        <!-- Mobile-style week navigation: tappable week pill, prev/next arrows, big weekly total. -->
        <div class="shifts-weeknav">
          <button type="button" class="shifts-week-pill" data-shifts-week="pick" aria-label="${escapeAttr(t('shifts.selectWeek'))}">
            <span class="shifts-week-pill-label" data-slot="week-label"></span>
            ${getIcon('chevron-down', 14)}
          </button>
          <div class="shifts-weeknav-row">
            <button type="button" class="shifts-weeknav-arrow" data-shifts-week="prev" aria-label="${escapeAttr(t('shifts.prevWeek'))}">${getIcon('chevron-left', 22)}</button>
            <div class="shifts-weeknav-amount" data-slot="week-total" aria-live="polite">—</div>
            <button type="button" class="shifts-weeknav-arrow" data-shifts-week="next" aria-label="${escapeAttr(t('shifts.nextWeek'))}">${getIcon('chevron-right', 22)}</button>
          </div>
        </div>

        <!-- 7-day earnings bar chart. Tap a bar to filter the list to that day; tap again to clear. -->
        <div class="shifts-chart" data-slot="chart" hidden></div>

        <div class="shifts-stats" data-slot="stats" hidden></div>
        <div class="shifts-list" data-slot="list"></div>
        <div class="shifts-pager-slot" data-slot="pager" hidden></div>
      </div>
    </section>
  `;

  const listSlot = /** @type {HTMLElement | null} */ (root.querySelector('[data-slot="list"]'));
  const pagerSlot = /** @type {HTMLElement | null} */ (root.querySelector('[data-slot="pager"]'));
  const statsSlot = /** @type {HTMLElement | null} */ (root.querySelector('[data-slot="stats"]'));
  const chartSlot = /** @type {HTMLElement | null} */ (root.querySelector('[data-slot="chart"]'));
  const weekLabelEl = /** @type {HTMLElement | null} */ (root.querySelector('[data-slot="week-label"]'));
  const weekTotalEl = /** @type {HTMLElement | null} */ (root.querySelector('[data-slot="week-total"]'));
  const countSlot = /** @type {HTMLElement | null} */ (root.querySelector('[data-slot="shifts-count"]'));

  const paint = async () => {
    if (!listSlot || !pagerSlot) return;
    const user = store.get('user');
    const weekStartDay = Number(user?.locale?.weekStartDay ?? 0);
    const nav = loadWeekNav(weekStartDay);
    const range = loadShiftsRange(weekStartDay);
    const sortDir = /** @type {'asc'|'desc'} */ (loadShiftsSortDir());

    // ── Week-nav header ──────────────────────────────────────────────────────────────────────
    if (weekLabelEl) weekLabelEl.textContent = weekPillLabel(nav.week);
    // Disable "next" once we're on the current (or a future) week — mobile parity.
    const thisWeekStart = ymd(startOfWeekDate(shiftsFilterAnchorDate(), weekStartDay));
    const atCurrentOrFuture = nav.week.weekStartYmd >= thisWeekStart;
    const nextArrow = root.querySelector('[data-shifts-week="next"]');
    if (nextArrow) {
      nextArrow.toggleAttribute('disabled', atCurrentOrFuture);
      nextArrow.classList.toggle('is-disabled', atCurrentOrFuture);
    }

    listSlot.innerHTML = `
      <div class="shifts-skeleton-list" style="display: flex; flex-direction: column; gap: var(--space-4); margin-top: var(--space-2);">
        ${renderSkeleton('card')}
        ${renderSkeleton('card')}
        ${renderSkeleton('card')}
        ${renderSkeleton('card')}
      </div>
    `;

    const all = await loadAllShiftsForPlatform();
    // Whole-week set (for the bar chart + week total), independent of any single-day drill-down.
    const weekShifts = filterAndSortShifts(all, nav.week.start, nav.week.end, sortDir);
    // The list itself honors the active range (whole week, or one selected day).
    const filtered = filterAndSortShifts(all, range.start, range.end, sortDir);
    const total = filtered.length;

    // Weekly earnings total shown in the header (always the whole week, not the drilled-in day).
    const sym = currencySymbol();
    const weekTotal = weekShifts.reduce((sum, s) => sum + shiftNetEarnings(s), 0);
    if (weekTotalEl) weekTotalEl.textContent = `${sym}${weekTotal.toFixed(2)}`;

    // ── 7-day bar chart ──────────────────────────────────────────────────────────────────────
    if (chartSlot) {
      chartSlot.innerHTML = shiftsWeekChartHtml(all, nav, weekStartDay);
      chartSlot.hidden = false;
    }

    if (countSlot) {
      countSlot.textContent = String(total);
      countSlot.hidden = false;
      countSlot.setAttribute('aria-label', `${total} shifts loaded`);
    }
    const totalPages = total > 0 ? Math.ceil(total / SHIFTS_PER_PAGE) : 1;
    let pageIdx = total > SHIFTS_PER_PAGE ? loadShiftsPageIdx(range.start, range.end, range.preset) : 0;
    if (pageIdx >= totalPages) pageIdx = Math.max(0, totalPages - 1);
    if (total > SHIFTS_PER_PAGE) saveShiftsPageIdx(range.start, range.end, range.preset, pageIdx);

    if (statsSlot) {
      if (total > 0) {
        statsSlot.innerHTML = shiftsStatsHtml(filtered);
        statsSlot.hidden = false;
      } else {
        statsSlot.innerHTML = '';
        statsSlot.hidden = true;
      }
    }

    if (!total) {
      const emptyTitle = all.length === 0 ? t('shifts.emptyTitle') : t('shifts.emptyFilteredTitle');
      const emptyMsg = all.length === 0 ? t('shifts.emptyMessage') : t('shifts.emptyFilteredMessage');
      listSlot.innerHTML = renderEmptyState({ title: emptyTitle, message: emptyMsg });
      pagerSlot.innerHTML = '';
      pagerSlot.hidden = true;
      return;
    }

    const slice = filtered.slice(pageIdx * SHIFTS_PER_PAGE, pageIdx * SHIFTS_PER_PAGE + SHIFTS_PER_PAGE);
    const mpMap = await loadShiftPlatformsMap(slice.map((s) => s.id));
    listSlot.innerHTML = slice.map((s) => shiftCardHtml(s, mpMap.get(s.id) || [])).join('');

    if (total <= SHIFTS_PER_PAGE) {
      pagerSlot.innerHTML = '';
      pagerSlot.hidden = true;
    } else {
      pagerSlot.hidden = false;
      pagerSlot.innerHTML = `
        <nav class="shifts-pager" role="navigation" aria-label="${escapeHtml(t('shifts.pagerAria'))}">
          <div class="shifts-pager-controls">
            <button type="button" class="shifts-pager-btn" data-shifts-page="prev" aria-label="${escapeAttr(t('shifts.pagePrev'))}"${pageIdx === 0 ? ' disabled' : ''}>${getIcon('chevron-left', 20)}</button>
            <div class="shifts-pager-numbers">
              ${renderPagerNumbers(pageIdx, totalPages)}
            </div>
            <button type="button" class="shifts-pager-btn" data-shifts-page="next" aria-label="${escapeAttr(t('shifts.pageNext'))}"${pageIdx >= totalPages - 1 ? ' disabled' : ''}>${getIcon('chevron-right', 20)}</button>
          </div>
          <span class="shifts-pager-status">${escapeHtml(t('shifts.pageStatus').replace('{current}', String(pageIdx + 1)).replace('{total}', String(totalPages)))}</span>
        </nav>`;
    }
  };

  const onBus = () => void paint();
  const offSaved = bus.on(SHIFT_SAVED, onBus);
  const offDel = bus.on(SHIFT_DELETED, onBus);
  const offPlatform = bus.on(PLATFORM_CHANGED, onBus);

  const onSortChange = (e) => {
    const t = /** @type {HTMLElement | null} */ (e.target);
    if (t && t.matches && t.matches('select[data-shifts-sort]')) {
      const v = /** @type {HTMLSelectElement} */ (t).value === 'asc' ? 'asc' : 'desc';
      saveShiftsSortDir(v);
      const user = store.get('user');
      const wsd = Number(user?.locale?.weekStartDay ?? 0);
      const r = loadShiftsRange(wsd);
      saveShiftsPageIdx(r.start, r.end, r.preset, 0);
      void paint();
    }
  };

  const onClick = async (e) => {
    // ── Week navigation (prev / next / pick) ─────────────────────────────────────────────────
    const weekEl = e.target instanceof Element ? e.target.closest('[data-shifts-week]') : null;
    if (weekEl && root.contains(weekEl)) {
      const dir = weekEl.getAttribute('data-shifts-week');
      const user = store.get('user');
      const wsd = Number(user?.locale?.weekStartDay ?? 0);
      const cur = loadWeekNav(wsd);
      if (dir === 'pick') {
        await openWeekSelector({
          selectedWeekStart: cur.week.weekStartYmd,
          weekStartDay: wsd,
          onPick: (weekStartYmd) => {
            saveWeekNav(weekStartYmd, wsd);
            void paint();
          },
        });
        return;
      }
      if (weekEl.hasAttribute('disabled')) return;
      // Step the week's start by ±7 days (clear any single-day drill-down).
      const base = new Date(`${cur.week.weekStartYmd}T00:00:00`);
      base.setDate(base.getDate() + (dir === 'next' ? 7 : -7));
      saveWeekNav(ymd(base), wsd);
      await paint();
      return;
    }

    // ── Day bar selection (tap to drill into one day; tap the selected day again to clear) ────
    const dayEl = e.target instanceof Element ? e.target.closest('[data-shifts-day]') : null;
    if (dayEl && root.contains(dayEl)) {
      const day = dayEl.getAttribute('data-shifts-day');
      const user = store.get('user');
      const wsd = Number(user?.locale?.weekStartDay ?? 0);
      const cur = loadWeekNav(wsd);
      if (day) {
        if (cur.selectedDay === day) {
          // Toggle off → back to the whole week.
          saveWeekNav(day, wsd);
        } else {
          saveWeekNav(day, wsd, { selectDay: true });
        }
        await paint();
      }
      return;
    }

    const navEl = /** @type {HTMLElement | null} */ (
      e.target && /** @type {HTMLElement} */ (e.target).closest('[data-shifts-action],[data-shifts-page]')
    );
    if (navEl && root.contains(navEl)) {
      if (navEl.getAttribute('data-shifts-action') === 'new') {
        e.preventDefault();
        const target = '#/shifts/new';
        const cur = (window.location.hash || '').split('?')[0];
        if (cur === target) {
          void import('../core/router.js').then((m) => m.Router.refresh());
        } else {
          window.location.hash = target;
        }
        return;
      }

      const pageNav = navEl.getAttribute('data-shifts-page');
      if (pageNav != null) {
        if (navEl.hasAttribute('disabled')) return;
        const user = store.get('user');
        const wsd = Number(user?.locale?.weekStartDay ?? 0);
        const range = loadShiftsRange(wsd);
        const all = await loadAllShiftsForPlatform();
        const sortDir = /** @type {'asc'|'desc'} */ (loadShiftsSortDir());
        const filtered = filterAndSortShifts(all, range.start, range.end, sortDir);
        const totalPages = Math.max(1, Math.ceil(filtered.length / SHIFTS_PER_PAGE));
        let page = filtered.length > SHIFTS_PER_PAGE ? loadShiftsPageIdx(range.start, range.end, range.preset) : 0;
        if (page >= totalPages) page = Math.max(0, totalPages - 1);

        if (pageNav === 'prev') {
          page = Math.max(0, page - 1);
        } else if (pageNav === 'next') {
          page = Math.min(totalPages - 1, page + 1);
        } else {
          const n = parseInt(pageNav, 10);
          if (!isNaN(n)) page = n;
        }

        saveShiftsPageIdx(range.start, range.end, range.preset, page);
        await paint();
        return;
      }
    }

    const tEl = /** @type {HTMLElement | null} */ (e.target && /** @type {HTMLElement} */ (e.target).closest('[data-action],[data-shift-id]'));
    if (!tEl) return;

    const action = tEl.getAttribute('data-action');
    if (action === 'start-timer') {
      const pid = String(store.get('activePlatformId') ?? 'all');
      const platformId = pid === 'all' ? String(store.get('platforms')?.[0]?.id || 'other') : pid;
      try {
        await startShiftTimer(platformId);
        showToast({ type: 'success', message: t('shifts.timerStarted'), duration: 1800 });
      } catch (err) {
        console.warn('[comma shifts] start timer failed', err);
        showToast({ type: 'error', message: t('errors.generic'), duration: 2200 });
      }
      return;
    }

    if (action === 'templates') {
      await openTemplatesManager();
      return;
    }

    if (action === 'trash') {
      await openTrashManager();
      return;
    }

    const card = /** @type {HTMLElement | null} */ (tEl.closest('[data-shift-id]'));
    const id = card ? card.getAttribute('data-shift-id') : null;
    if (!id) return;

    if (action === 'edit') {
      const row = await db.shifts.get(id);
      if (!row) return;
      await openShiftFormModal({
        title: t('shifts.editShift'),
        // Fix 1 (interop plan) — the stored row's startTime/endTime are epoch-ms timestamps;
        // convert back to the date/HH:mm-string shape shift-form.js's `initial` expects.
        initial: shiftRowToFormTimeFields(row),
        submitLabel: t('common.save'),
        onSaved: async (val) => {
          await updateShift(id, val);
          return id;
        },
      });
      return;
    }

    if (action === 'duplicate') {
      try {
        const dup = await duplicateShift(id);
        await openShiftFormModal({
          title: t('shifts.duplicateShift'),
          initial: dup,
          submitLabel: t('common.save'),
          onSaved: async (val) => saveShift(val),
        });
      } catch (err) {
        console.warn('[comma shifts] duplicate failed', err);
        showToast({ type: 'error', message: t('errors.generic'), duration: 2200 });
      }
      return;
    }

    if (action === 'delete') {
      const ok = await new Promise((resolve) => {
        const h = showModal({
          title: t('shifts.deleteShift'),
          content: `<p>${escapeHtml(t('shifts.deleteConfirm'))}</p>`,
          actions: [
            { label: t('common.cancel'), variant: 'ghost', onClick: () => resolve(false) },
            { label: t('common.delete'), variant: 'danger', onClick: () => resolve(true) },
          ],
          onClose: () => resolve(false),
        });
        void h;
      });
      if (!ok) return;
      try {
        await deleteShift(id);
        showToast({
          type: 'success',
          message: t('shifts.deletedToast'),
          duration: 2500,
          actionLabel: t('shifts.undo'),
          onAction: async () => {
            await restoreShift(id);
            showToast({ type: 'success', message: t('shifts.restoredToast'), duration: 1600 });
          },
        });
      } catch (err) {
        console.warn('[comma shifts] delete failed', err);
        showToast({ type: 'error', message: t('errors.generic'), duration: 2200 });
      }
      return;
    }
  };

  root.addEventListener('click', onClick);
  root.addEventListener('change', onSortChange);

  const teardown = () => {
    offSaved();
    offDel();
    offPlatform();
    root.removeEventListener('click', onClick);
    root.removeEventListener('change', onSortChange);
    teardownByRoot.delete(root);
  };
  teardownByRoot.set(root, teardown);

  await paint();

  if (ctx && ctx.openNew) {
    await openShiftFormModal({
      title: t('shifts.addShift'),
      initial: {},
      submitLabel: t('common.save'),
      onSaved: async (val) => saveShift(val),
    });
  }

  return teardown;
}

async function openTrashManager() {
  const paintTrashList = async (bodyEl) => {
    const deleted = await db.shifts.toArray().then(rows => rows.filter(s => s.deletedAt != null));
    deleted.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

    const listContainer = bodyEl.querySelector('.shifts-trash-list');
    if (!listContainer) return;

    if (deleted.length === 0) {
      listContainer.innerHTML = `<div class="text-sm shifts-muted" style="text-align:center; padding:var(--space-6) 0;">${escapeHtml(t('shifts.noTrash'))}</div>`;
      const purgeBtn = bodyEl.querySelector('[data-action="purge-trash"]');
      if (purgeBtn) purgeBtn.setAttribute('disabled', '');
      return;
    }

    const mpMap = await loadShiftPlatformsMap(deleted.map((s) => s.id), { includeDeleted: true });
    listContainer.innerHTML = deleted.map((s) => {
      const pid = String(s.platformId || 'other');
      const pl = getPlatformConfig(pid);
      const grossFormatted = `$${Number(s.grossRevenue || 0).toFixed(2)}`;
      const platformRows = mpMap.get(s.id) || [];
      const platformDisplay =
        platformRows.length > 1
          ? `<span class="trash-row-platform-breakdown">${platformBreakdownChipsHtml(platformRows)}</span>`
          : `<span class="trash-row-platform badge" data-platform-id="${escapeAttr(pid)}" style="background-color: var(--color-${pid}, var(--color-other)); color: #fff; margin-left: var(--space-2);">${escapeHtml(pl.name || pid)}</span>`;
      return `
        <div class="trash-row" data-shift-id="${escapeAttr(String(s.id))}">
          <div class="trash-row-info">
            <span class="trash-row-date">${escapeHtml(s.date || '')}</span>
            ${platformDisplay}
            <span class="trash-row-gross" style="margin-left: var(--space-2); font-weight: 600;">${grossFormatted}</span>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" data-action="restore-trash">${escapeHtml(t('shifts.restore'))}</button>
        </div>
      `;
    }).join('');
    
    const purgeBtn = bodyEl.querySelector('[data-action="purge-trash"]');
    if (purgeBtn) purgeBtn.removeAttribute('disabled');
  };

  const body = document.createElement('div');
  body.className = 'shifts-trash';
  body.style.display = 'flex';
  body.style.flexDirection = 'column';
  body.style.gap = 'var(--space-4)';
  body.innerHTML = `
    <div class="shifts-trash-actions" style="display:flex; justify-content:flex-end;">
      <button type="button" class="btn btn-danger btn-sm" data-action="purge-trash">${escapeHtml(t('shifts.purgeTrash'))}</button>
    </div>
    <div class="shifts-trash-list" style="display:flex; flex-direction:column; gap:var(--space-2); max-height: 350px; overflow-y: auto;">
      <div class="text-sm shifts-muted">Loading trash...</div>
    </div>
  `;

  const handle = showModal({
    title: t('shifts.trash'),
    content: body,
    actions: [{ label: t('common.close'), variant: 'ghost', onClick: () => handle.close() }],
  });

  await paintTrashList(body);

  body.addEventListener('click', async (e) => {
    const el = /** @type {HTMLElement | null} */ (e.target && /** @type {HTMLElement} */ (e.target).closest('[data-action],[data-shift-id]'));
    if (!el) return;
    const action = el.getAttribute('data-action');
    if (action === 'purge-trash') {
      await db.shifts.filter((s) => s.deletedAt != null).delete();
      showToast({ type: 'success', message: t('shifts.purgedToast'), duration: 1600 });
      await paintTrashList(body);
      return;
    }
    if (action === 'restore-trash') {
      const row = /** @type {HTMLElement | null} */ (el.closest('[data-shift-id]'));
      const id = row ? row.getAttribute('data-shift-id') : null;
      if (id) {
        await restoreShift(id);
        showToast({ type: 'success', message: t('shifts.restoredToast'), duration: 1600 });
        await paintTrashList(body);
      }
    }
  });
}

async function openTemplatesManager() {
  const list = await getTemplates();
  const body = document.createElement('div');
  body.className = 'shifts-templates';
  body.innerHTML = `
    <div class="shifts-templates-actions">
      <button type="button" class="btn btn-ghost" data-action="purge">${escapeHtml(t('shifts.purgeTrash'))}</button>
    </div>
    <div class="shifts-templates-list">
      ${
        list.length
          ? list
              .map(
                (tpl) => `
        <button type="button" class="template-row" data-template-id="${escapeAttr(tpl.id)}">
          <span class="template-row-name">${escapeHtml(tpl.name)}</span>
          <span class="template-row-meta">${escapeHtml(t('shifts.template'))}</span>
        </button>
      `,
              )
              .join('')
          : `<div class="text-sm shifts-muted">${escapeHtml(t('shifts.noTemplates'))}</div>`
      }
    </div>
    <div class="shifts-templates-save">
      <button type="button" class="btn btn-primary" data-action="save-template">${escapeHtml(t('shifts.saveAsTemplate'))}</button>
    </div>
  `;

  const handle = showModal({
    title: t('shifts.templates'),
    content: body,
    actions: [{ label: t('common.close'), variant: 'ghost', onClick: () => handle.close() }],
  });

  body.addEventListener('click', async (e) => {
    const el = /** @type {HTMLElement | null} */ (e.target && /** @type {HTMLElement} */ (e.target).closest('[data-action],[data-template-id]'));
    if (!el) return;
    const action = el.getAttribute('data-action');
    if (action === 'purge') {
      await purgeShifts();
      showToast({ type: 'success', message: t('shifts.purgedToast'), duration: 1600 });
      return;
    }
    if (action === 'save-template') {
      // Save template from last entered values: prompt user for a name and open a fresh form to capture.
      const name = await new Promise((resolve) => {
        const wrap = document.createElement('div');
        wrap.innerHTML = `
          <label class="field">
            <span class="field-label">${escapeHtml(t('shifts.templateName'))}</span>
            <input class="input" name="name" placeholder="${escapeAttr(t('shifts.templateNamePlaceholder'))}" />
          </label>
        `;
        const h = showModal({
          title: t('shifts.saveAsTemplate'),
          content: wrap,
          actions: [
            { label: t('common.cancel'), variant: 'ghost', onClick: () => resolve('') },
            {
              label: t('common.confirm'),
              variant: 'primary',
              onClick: () => resolve(String(wrap.querySelector('input[name="name"]')?.value || '')),
            },
          ],
          onClose: () => resolve(''),
        });
        void h;
      });
      if (!String(name || '').trim()) return;

      await openShiftFormModal({
        title: t('shifts.saveAsTemplate'),
        initial: {},
        submitLabel: t('common.confirm'),
        onSaved: async (val) => {
          await saveAsTemplate(val, String(name));
          return 1;
        },
      });
      handle.close();
      return;
    }
    const tplId = el.getAttribute('data-template-id');
    if (tplId) {
      try {
        const data = await applyTemplate(tplId);
        await openShiftFormModal({
          title: t('shifts.addShift'),
          initial: data,
          submitLabel: t('common.save'),
          onSaved: async (val) => saveShift(val),
        });
      } catch (err) {
        console.warn('[comma shifts] apply template failed', err);
        showToast({ type: 'error', message: t('errors.generic'), duration: 2200 });
      }
    }
  });
}

