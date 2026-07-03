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
import { defaultRangeForPreset } from '../utils/date-range-presets.js';
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

/**
 * @param {Record<string, unknown>} s
 * @param {Array<Record<string, unknown>>} [platformRows] Non-deleted `shiftPlatforms` rows for
 *   this shift (interop plan Workstream 4). When there's more than one, a per-platform breakdown
 *   is shown instead of the plain single-platform badge; 0 or 1 rows keeps today's display as-is.
 */
function shiftCardHtml(s, platformRows = []) {
  const pid = String(s.platformId || 'other');
  const pl = getPlatformConfig(pid);
  const badge =
    platformRows.length > 1
      ? `<span class="shift-card-platform-breakdown">${platformBreakdownChipsHtml(platformRows)}</span>`
      : `<span class="shift-badge" data-platform-id="${escapeAttr(pid)}">${escapeHtml(pl.name || pid)}</span>`;
  return `
    <article class="shift-card" data-shift-id="${escapeAttr(String(s.id))}">
      <div class="shift-card-top">
        <div class="shift-card-date">${escapeHtml(String(s.date || ''))}</div>
        <div class="shift-card-platform">${badge}</div>
      </div>
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
        ${(() => {
          const storedFilter = localStorage.getItem('comma_shifts_toolbar_collapsed');
          const filterCollapsed = storedFilter === null ? true : storedFilter === 'true';
          const storedShortcuts = localStorage.getItem('comma_shifts_shortcuts_collapsed');
          const shortcutsCollapsed = storedShortcuts === null ? true : storedShortcuts === 'true';
          return `
        <div class="financial-filter-container card" style="margin-bottom: var(--space-4); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); overflow: hidden; padding: 0;">
          <button type="button" class="financial-dash-filter-summary" data-shifts-toggle-shortcuts aria-expanded="${!shortcutsCollapsed}" style="display: flex; justify-content: space-between; align-items: center; width: 100%; padding: var(--space-3) var(--space-4); background: transparent; border: none; cursor: pointer; color: inherit; text-align: left;">
            <span class="financial-dash-summary-left" style="display: flex; align-items: center; gap: var(--space-2); font-weight: 600;">
              <span class="financial-dash-summary-icon" style="color: var(--color-brand, #10b981);">${getIcon('calendar', 18)}</span>
              <span class="financial-dash-summary-text" data-shifts-summary></span>
            </span>
            <span class="financial-dash-summary-right" style="display: flex; align-items: center; gap: var(--space-2);">
              <span class="financial-dash-summary-preset badge badge--secondary" data-shifts-summary-preset style="text-transform: capitalize;"></span>
              <span class="financial-dash-summary-chevron" data-shifts-summary-chevron style="display: flex; align-items: center; transition: transform 0.2s ease;">${getIcon(shortcutsCollapsed ? 'chevron-down' : 'chevron-up', 18)}</span>
            </span>
          </button>

          <div class="financial-filter-body" data-shifts-shortcut-bar style="display: ${shortcutsCollapsed ? 'none' : 'block'}; border-top: 1px solid var(--color-border); padding: var(--space-3) var(--space-4); background: var(--color-surface-raised);">
            <div class="filter-shortcut-bar" style="display: flex; gap: var(--space-3); align-items: center; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none;">
              <div class="shifts-presets-group">
                <button type="button" class="btn shifts-preset-btn" data-shifts-preset="day">${escapeHtml(t('views.dashboard.financial.presetDay'))}</button>
                <button type="button" class="btn shifts-preset-btn" data-shifts-preset="week">${escapeHtml(t('views.dashboard.financial.presetWeek'))}</button>
                <button type="button" class="btn shifts-preset-btn" data-shifts-preset="month">${escapeHtml(t('views.dashboard.financial.presetMonth'))}</button>
                <button type="button" class="btn shifts-preset-btn" data-shifts-preset="q1">${escapeHtml(t('views.dashboard.financial.presetQ1'))}</button>
                <button type="button" class="btn shifts-preset-btn" data-shifts-preset="q2">${escapeHtml(t('views.dashboard.financial.presetQ2'))}</button>
                <button type="button" class="btn shifts-preset-btn" data-shifts-preset="q3">${escapeHtml(t('views.dashboard.financial.presetQ3'))}</button>
                <button type="button" class="btn shifts-preset-btn" data-shifts-preset="q4">${escapeHtml(t('views.dashboard.financial.presetQ4'))}</button>
                <button type="button" class="btn shifts-preset-btn" data-shifts-preset="year">${escapeHtml(t('views.dashboard.financial.presetYear'))}</button>
                <button type="button" class="btn shifts-preset-btn" data-shifts-preset="ytd">${escapeHtml(t('views.dashboard.financial.presetYtd'))}</button>
              </div>
              <button type="button" class="btn ${filterCollapsed ? 'btn-ghost' : 'btn-primary'} btn-sm" data-shifts-toggle-filter style="white-space:nowrap;">${escapeHtml(t('views.dashboard.financial.presetCustom'))} <span data-shifts-custom-chevron>${getIcon(filterCollapsed ? 'chevron-down' : 'chevron-up', 14)}</span></button>
            </div>
            <div class="shifts-filter" data-shifts-filter style="display: ${filterCollapsed || shortcutsCollapsed ? 'none' : 'block'}; margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px dashed var(--color-border);">
              <div class="shifts-filter-content" style="padding: 0;">
                <div class="shifts-filter-bar" style="flex-wrap: wrap; align-items: center; justify-content: space-between;">
                  <div class="shifts-filter-left">
                    <div class="shifts-filter-dates" style="display: flex; gap: var(--space-2); align-items: center;">
                      <div class="input-with-icon" style="position: relative;">
                        <input type="text" class="input shifts-filter-date-start" id="shifts-filter-start" placeholder="Start date" readonly style="width: 130px; padding-left: 32px; cursor: pointer;" />
                        <span style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); color: var(--color-primary, #10b981); pointer-events: none;">${getIcon('calendar', 16)}</span>
                      </div>
                      <span style="color: var(--color-text-muted, #a1a1aa); font-weight: 600;">&ndash;</span>
                      <div class="input-with-icon" style="position: relative;">
                        <input type="text" class="input shifts-filter-date-end" id="shifts-filter-end" placeholder="End date" readonly style="width: 130px; padding-left: 32px; cursor: pointer;" />
                        <span style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); color: var(--color-primary, #10b981); pointer-events: none;">${getIcon('calendar', 16)}</span>
                      </div>
                    </div>
                  </div>
                  <div class="shifts-filter-right" style="display: flex; gap: var(--space-3); align-items: center;">
                    <label class="shifts-sort-inline">
                      <span class="shifts-sort-inline-label">${escapeHtml(t('shifts.sortByDate'))}</span>
                      <select class="input shifts-sort-select" data-shifts-sort aria-label="${escapeHtml(t('shifts.sortByDate'))}">
                        <option value="desc">${escapeHtml(t('shifts.sortNewest'))}</option>
                        <option value="asc">${escapeHtml(t('shifts.sortOldest'))}</option>
                      </select>
                    </label>
                    <button type="button" class="btn btn-primary btn-sm shifts-filter-apply" data-shifts-apply style="height: 36px;">${getIcon('filter', 16)} ${escapeHtml(t('views.dashboard.financial.apply'))}</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>`;
        })()}
        <div class="shifts-list" data-slot="list"></div>
        <div class="shifts-pager-slot" data-slot="pager" hidden></div>
      </div>
    </section>
  `;

  const listSlot = /** @type {HTMLElement | null} */ (root.querySelector('[data-slot="list"]'));
  const pagerSlot = /** @type {HTMLElement | null} */ (root.querySelector('[data-slot="pager"]'));
  const summaryEl = /** @type {HTMLElement | null} */ (root.querySelector('[data-shifts-summary]'));
  const countSlot = /** @type {HTMLElement | null} */ (root.querySelector('[data-slot="shifts-count"]'));

  const paint = async () => {
    if (!listSlot || !pagerSlot) return;
    const user = store.get('user');
    const weekStartDay = Number(user?.locale?.weekStartDay ?? 0);
    const range = loadShiftsRange(weekStartDay);
    const sortDir = /** @type {'asc'|'desc'} */ (loadShiftsSortDir());

    // Update summary text
    if (summaryEl) {
      summaryEl.textContent = `${range.start} – ${range.end}`;
    }
    const presetSummary = root.querySelector('[data-shifts-summary-preset]');
    if (presetSummary) {
      const p = range.preset;
      presetSummary.textContent = p === 'custom' ? 'Custom' : (p === 'ytd' ? 'YTD' : p.charAt(0).toUpperCase() + p.slice(1));
    }

    const storedFilter = localStorage.getItem('comma_shifts_toolbar_collapsed');
    const filterCollapsed = storedFilter === null ? true : storedFilter === 'true';
    const storedShortcuts = localStorage.getItem('comma_shifts_shortcuts_collapsed');
    const shortcutsCollapsed = storedShortcuts === null ? true : storedShortcuts === 'true';

    const shortcutBarEl = root.querySelector('[data-shifts-shortcut-bar]');
    if (shortcutBarEl) shortcutBarEl.style.display = shortcutsCollapsed ? 'none' : 'block';

    const filterEl = root.querySelector('[data-shifts-filter]');
    if (filterEl) filterEl.style.display = filterCollapsed || shortcutsCollapsed ? 'none' : 'block';

    const summaryChevron = root.querySelector('[data-shifts-summary-chevron]');
    if (summaryChevron) summaryChevron.innerHTML = getIcon(shortcutsCollapsed ? 'chevron-down' : 'chevron-up', 18);

    const customChevron = root.querySelector('[data-shifts-custom-chevron]');
    if (customChevron) customChevron.innerHTML = getIcon(filterCollapsed ? 'chevron-down' : 'chevron-up', 14);

    const customBtn = root.querySelector('[data-shifts-toggle-filter]');
    if (customBtn) {
      customBtn.className = `btn ${filterCollapsed ? 'btn-ghost' : 'btn-primary'} btn-sm`;
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
    const filtered = filterAndSortShifts(all, range.start, range.end, sortDir);
    const total = filtered.length;

    if (countSlot) {
      countSlot.textContent = String(total);
      countSlot.hidden = false;
      countSlot.setAttribute('aria-label', `${total} shifts loaded`);
    }
    const totalPages = total > 0 ? Math.ceil(total / SHIFTS_PER_PAGE) : 1;
    let pageIdx = total > SHIFTS_PER_PAGE ? loadShiftsPageIdx(range.start, range.end, range.preset) : 0;
    if (pageIdx >= totalPages) pageIdx = Math.max(0, totalPages - 1);
    if (total > SHIFTS_PER_PAGE) saveShiftsPageIdx(range.start, range.end, range.preset, pageIdx);

    const startInput = /** @type {HTMLInputElement | null} */ (root.querySelector('#shifts-filter-start'));
    const endInput = /** @type {HTMLInputElement | null} */ (root.querySelector('#shifts-filter-end'));
    if (startInput) {
      startInput.value = range.start;
      if (window.flatpickr) {
        if (!startInput._fp) {
          startInput._fp = window.flatpickr(startInput, {
            dateFormat: 'Y-m-d',
            defaultDate: range.start,
            locale: { firstDayOfWeek: weekStartDay },
            onChange: function(selectedDates) {
              if (selectedDates.length === 1) {
                const s = window.flatpickr.formatDate(selectedDates[0], "Y-m-d");
                // Read current end date from the live input, not from closed-over range
                const currentEnd = endInput ? endInput.value : range.end;
                saveShiftsRange({ start: s, end: currentEnd, preset: 'custom' });
                saveShiftsPageIdx(s, currentEnd, 'custom', 0);
                void paint();
              }
            }
          });
        } else {
          startInput._fp.setDate(range.start, false);
        }
      }
    }
    if (endInput) {
      endInput.value = range.end;
      if (window.flatpickr) {
        if (!endInput._fp) {
          endInput._fp = window.flatpickr(endInput, {
            dateFormat: 'Y-m-d',
            defaultDate: range.end,
            locale: { firstDayOfWeek: weekStartDay },
            onChange: function(selectedDates) {
              if (selectedDates.length === 1) {
                const e = window.flatpickr.formatDate(selectedDates[0], "Y-m-d");
                // Read current start date from the live input, not from closed-over range
                const currentStart = startInput ? startInput.value : range.start;
                saveShiftsRange({ start: currentStart, end: e, preset: 'custom' });
                saveShiftsPageIdx(currentStart, e, 'custom', 0);
                void paint();
              }
            }
          });
        } else {
          endInput._fp.setDate(range.end, false);
        }
      }
    }

    const sortEl = /** @type {HTMLSelectElement | null} */ (root.querySelector('select[data-shifts-sort]'));
    if (sortEl) sortEl.value = sortDir;

    root.querySelectorAll('[data-shifts-preset]').forEach((btn) => {
      const p = btn.getAttribute('data-shifts-preset');
      btn.className = `btn shifts-preset-btn ${p === range.preset ? 'is-active' : ''}`;
    });

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
    const toggleShortcuts = e.target instanceof Element ? e.target.closest('[data-shifts-toggle-shortcuts]') : null;
    if (toggleShortcuts) {
      const stored = localStorage.getItem('comma_shifts_shortcuts_collapsed');
      const isCollapsed = stored === null ? true : stored === 'true';
      const nextCollapsed = !isCollapsed;
      localStorage.setItem('comma_shifts_shortcuts_collapsed', nextCollapsed ? 'true' : 'false');
      if (nextCollapsed) {
        localStorage.setItem('comma_shifts_toolbar_collapsed', 'true');
      }
      await paint();
      return;
    }

    const toggle = e.target instanceof Element ? e.target.closest('[data-shifts-toggle-filter]') : null;
    if (toggle) {
      const stored = localStorage.getItem('comma_shifts_toolbar_collapsed');
      const isCollapsed = stored === null ? true : stored === 'true';
      localStorage.setItem('comma_shifts_toolbar_collapsed', isCollapsed ? 'false' : 'true');
      await paint();
      return;
    }

    const applyBtn = e.target instanceof Element ? e.target.closest('[data-shifts-apply]') : null;
    if (applyBtn) {
      localStorage.setItem('comma_shifts_shortcuts_collapsed', 'true');
      localStorage.setItem('comma_shifts_toolbar_collapsed', 'true');
      await paint();
      return;
    }

    const navEl = /** @type {HTMLElement | null} */ (
      e.target && /** @type {HTMLElement} */ (e.target).closest('[data-shifts-preset],[data-shifts-action],[data-shifts-page],[data-shifts-apply]')
    );
    if (navEl && root.contains(navEl)) {
      const preset = navEl.getAttribute('data-shifts-preset');
      if (preset && preset !== 'custom') {
        const user = store.get('user');
        const wsd = Number(user?.locale?.weekStartDay ?? 0);
        // @ts-ignore
        const r = defaultRangeForPreset(preset, shiftsFilterAnchorDate(), wsd);
        saveShiftsRange(r);
        saveShiftsPageIdx(r.start, r.end, r.preset, 0);
        localStorage.setItem('comma_shifts_shortcuts_collapsed', 'true');
        localStorage.setItem('comma_shifts_toolbar_collapsed', 'true');
        await paint();
        return;
      }
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

