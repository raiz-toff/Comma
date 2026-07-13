import { db, getUser } from '../../core/db.js';
import { getIcon } from '../../ui/icons.js';
import { t } from '../../utils/strings.js';
import { formatCurrency, formatDuration } from '../../utils/formatters.js';
import { getLocaleConfig } from '../../utils/locale.js';
import { getPlatformConfig } from '../../registry/platforms/terminology.js';
import { applySheetPresentation, resolvePlatformLogoHtml, showToast } from '../../ui/components.js';

const KM_TO_MI = 0.621371192;

function num(v, f = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : f;
}

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtClockTime(epochMs) {
  const n = Number(epochMs);
  if (!Number.isFinite(n) || n <= 0) return '';
  return new Date(n).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function fmtOnline(seconds) {
  return formatDuration(Math.round(num(seconds) / 60), 'compact');
}

/**
 * Read-only detail view for one shift — mirrors the phone app's shift-detail screen
 * (`app/shifts/[id].tsx`): a hero with net earnings, quick stats, the earnings and mileage
 * breakdowns, per-platform breakdown, notes, and linked expenses. Editing/deleting is delegated
 * back to the caller (shifts-view owns the form + delete flow) so this module stays UI-only and
 * there's no import cycle.
 *
 * @param {string} shiftId
 * @param {{ onEdit?: (id: string) => void, onDeleted?: (id: string) => (void | Promise<void>) }} [handlers]
 */
export async function openShiftDetailModal(shiftId, handlers = {}) {
  const shift = await db.shifts.get(shiftId);
  if (!shift || shift.deletedAt != null) {
    showToast({ type: 'error', message: t('errors.generic'), duration: 2000 });
    return;
  }

  const [platformRows, expenses, user] = await Promise.all([
    db.shiftPlatforms.where('shiftId').equals(shiftId).filter((r) => r.syncDeletedAt == null).toArray(),
    db.expenses.filter((e) => e.deletedAt == null && e.shiftId === shiftId).toArray(),
    getUser(),
  ]);
  const vehicle = shift.vehicleId ? await db.vehicles.get(shift.vehicleId).catch(() => null) : null;
  // locationPoints is a local-only table not yet populated by the web app (route storage is a
  // later workstream) — count defensively so the timeline section only appears if it ever fills.
  let routePoints = 0;
  try {
    routePoints = await db.locationPoints.where('shiftId').equals(shiftId).count();
  } catch {
    routePoints = 0;
  }

  const country = String(user?.locale?.country || 'US').toUpperCase();
  const distanceUnit = getLocaleConfig(country).distanceUnit === 'mi' ? 'mi' : 'km';
  const conv = distanceUnit === 'mi' ? KM_TO_MI : 1;
  const fmt = (v) => formatCurrency(v, country);

  const gross = num(shift.grossRevenue);
  const tips = num(shift.tipsRevenue);
  const bonus = num(shift.bonusAmount);
  const net = gross + tips + bonus;
  const durationMin = Math.round(num(shift.durationSeconds) / 60) || num(shift.onlineMinutes) || 0;
  const hours = durationMin / 60;
  const hourly = hours > 0 ? net / hours : 0;

  const activeKm = num(shift.activeMileage);
  const deadKm = num(shift.deadMileage);
  const totalKm = activeKm + deadKm;
  const totalDist = totalKm * conv;
  const activeDist = activeKm * conv;
  const deadDist = deadKm * conv;
  const deadRatio = totalKm > 0 ? (deadKm / totalKm) * 100 : 0;
  const distLabel = (v) => `${v.toFixed(1)} ${distanceUnit}`;

  const expTotal = expenses.reduce((s, e) => s + num(e.amount), 0);

  const platform = getPlatformConfig(shift.platformId);
  const logo = resolvePlatformLogoHtml(shift.platformId);
  const platformName = platform?.name || shift.platformId || '';

  const dateStr = new Date(`${shift.date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const start = fmtClockTime(shift.startTime);
  const end = fmtClockTime(shift.endTime);
  const timeStr = start && end ? `${start} – ${end}` : start || '';

  const statCell = (value, label) =>
    `<div class="shd-stat"><span class="shd-stat-value">${esc(value)}</span><span class="shd-stat-label">${esc(label)}</span></div>`;

  const row = (label, value, cls = '') =>
    `<div class="shd-row"><span class="shd-row-label">${esc(label)}</span><span class="shd-row-value ${cls}">${esc(value)}</span></div>`;

  const platformBreakdown = platformRows.length
    ? `
      <section class="shd-section">
        <h3 class="shd-section-title">${esc(t('shiftDetail.platformBreakdown'))}</h3>
        ${platformRows
          .map((r) => {
            const cfg = getPlatformConfig(r.platform);
            const pg = num(r.grossRevenue) + num(r.tipsRevenue);
            const online = num(r.platformOnlineSeconds);
            const trips = num(r.tripsCount);
            const payHr = online > 0 ? pg / (online / 3600) : 0;
            const payTrip = trips > 0 ? pg / trips : 0;
            const plogo = resolvePlatformLogoHtml(r.platform);
            return `
              <div class="shd-platform">
                <div class="shd-platform-head">
                  <span class="shd-chip" style="--chip:var(--color-${esc(r.platform || 'other')}, var(--color-other))">${plogo || esc((cfg?.name || r.platform || '?').charAt(0).toUpperCase())}</span>
                  <span class="shd-platform-name">${esc(cfg?.name || r.platform)}</span>
                  <span class="shd-platform-gross">${esc(fmt(pg))}</span>
                </div>
                <div class="shd-platform-grid">
                  ${statCell(fmtOnline(online), t('shiftDetail.onlineTime'))}
                  ${statCell(`${trips}`, t('shiftDetail.trips'))}
                  ${statCell(fmt(payHr), t('shiftDetail.payPerHour'))}
                  ${statCell(fmt(payTrip), t('shiftDetail.payPerTrip'))}
                </div>
              </div>`;
          })
          .join('')}
      </section>`
    : '';

  const mileageSection =
    totalKm > 0
      ? `
      <section class="shd-section">
        <h3 class="shd-section-title">${esc(t('shiftDetail.mileageBreakdown'))}</h3>
        ${row(t('shiftDetail.activeDistance'), distLabel(activeDist))}
        ${row(t('shiftDetail.deadDistance'), distLabel(deadDist))}
        ${row(t('shiftDetail.deadRatio'), `${deadRatio.toFixed(0)}%`, deadRatio > 40 ? 'is-warn' : '')}
      </section>`
      : '';

  const notesSection = shift.notes
    ? `
      <section class="shd-section">
        <h3 class="shd-section-title">${esc(t('shiftDetail.notes'))}</h3>
        <p class="shd-notes">${esc(shift.notes)}</p>
      </section>`
    : '';

  const expensesSection = expenses.length
    ? `
      <section class="shd-section">
        <h3 class="shd-section-title">${esc(t('shiftDetail.linkedExpenses'))} · ${esc(fmt(expTotal))}</h3>
        ${expenses
          .map(
            (e) => `
          <div class="shd-row">
            <span class="shd-row-label">${esc(e.category || e.merchant || t('shiftDetail.expense'))}</span>
            <span class="shd-row-value is-neg">${esc(fmt(num(e.amount)))}</span>
          </div>`,
          )
          .join('')}
      </section>`
    : '';

  // Route timeline only renders if the local route table has points for this shift; on web that
  // table isn't populated yet, so instead of an empty section we say where route tracking lives.
  const routeSection =
    routePoints > 0
      ? `
      <section class="shd-section">
        <h3 class="shd-section-title">${esc(t('shiftDetail.routeTimeline'))}</h3>
        <p class="shd-muted">${esc(t('shiftDetail.routePoints').replace('{n}', String(routePoints)))}</p>
      </section>`
      : `
      <section class="shd-section">
        <h3 class="shd-section-title">${esc(t('shiftDetail.routeTimeline'))}</h3>
        <p class="shd-muted">${esc(t('shiftDetail.routePhoneOnly'))}</p>
      </section>`;

  const modal = /** @type {HTMLElement & { present: () => Promise<void>; dismiss: () => Promise<boolean> }} */ (
    document.createElement('ion-modal')
  );
  applySheetPresentation(modal, [0, 0.96], 0.96);
  const close = () => void modal.dismiss();

  const wrap = document.createElement('div');
  wrap.className = 'shd-body';
  wrap.innerHTML = `
    <style>
      .shd-body { display:flex; flex-direction:column; gap: var(--space-5); padding: var(--space-4) var(--space-4) var(--space-8); }
      .shd-topbar { display:flex; align-items:center; justify-content:space-between; gap: var(--space-3); }
      .shd-back { display:inline-flex; align-items:center; gap: var(--space-1); background:none; border:none; color: var(--color-text-secondary); cursor:pointer; font-size: var(--text-sm); font-weight:600; padding:6px; }
      .shd-topbar-title { font-family: var(--font-body); font-size: var(--text-sm); font-weight:700; letter-spacing: var(--tracking-tight); }
      .shd-edit { display:inline-flex; align-items:center; gap: var(--space-1); }
      .shd-hero { display:flex; flex-direction:column; gap: var(--space-2); background: var(--color-surface-raised); border:1px solid var(--color-border); border-radius: var(--radius-lg); padding: var(--space-5); }
      .shd-hero-plat { display:flex; align-items:center; gap: var(--space-2); }
      .shd-chip { display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius: var(--radius-md); background: var(--chip, var(--color-other)); color:#fff; font-weight:700; font-size: var(--text-xs); flex-shrink:0; }
      .shd-chip svg { width:17px; height:17px; }
      .shd-hero-name { font-weight:700; }
      .shd-hero-date { font-family: var(--font-display); font-size: var(--text-xl); }
      .shd-hero-time { font-family: var(--font-mono); font-size: var(--text-sm); color: var(--color-text-secondary); }
      .shd-hero-net-label { font-size: var(--text-xs); text-transform:uppercase; letter-spacing:0.06em; font-weight:800; color: var(--color-text-secondary); margin-top: var(--space-2); }
      .shd-hero-net { font-family: var(--font-body); font-size: var(--text-3xl); font-weight:900; color: var(--color-success); letter-spacing:-0.02em; }
      .shd-quickstats { display:grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-2); }
      .shd-stat { display:flex; flex-direction:column; gap:2px; align-items:flex-start; background: var(--color-surface-raised); border:1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-3); }
      .shd-stat-value { font-family: var(--font-mono); font-weight:700; font-size: var(--text-md); }
      .shd-stat-label { font-size: var(--text-xs); color: var(--color-text-secondary); }
      .shd-section { display:flex; flex-direction:column; gap: var(--space-1); }
      .shd-section-title { font-size: var(--text-sm); font-weight:700; margin-bottom: var(--space-1); }
      .shd-row { display:flex; justify-content:space-between; align-items:center; padding: var(--space-3) 0; border-bottom:1px solid color-mix(in srgb, var(--color-border) 45%, transparent); }
      .shd-row:last-child { border-bottom:none; }
      .shd-row-label { font-size: var(--text-sm); color: var(--color-text-secondary); }
      .shd-row-value { font-family: var(--font-mono); font-weight:700; }
      .shd-row-value.is-neg { color: var(--color-danger); }
      .shd-row-value.is-warn { color: var(--color-danger); }
      .shd-platform { border:1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-3); margin-top: var(--space-2); }
      .shd-platform-head { display:flex; align-items:center; gap: var(--space-2); }
      .shd-platform-name { font-weight:700; flex:1; }
      .shd-platform-gross { font-family: var(--font-mono); font-weight:700; }
      .shd-platform-grid { display:grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-2); margin-top: var(--space-3); }
      .shd-notes { font-size: var(--text-sm); color: var(--color-text-secondary); line-height:1.5; white-space:pre-wrap; }
      .shd-muted { font-size: var(--text-xs); color: var(--color-text-muted); }
      .shd-actions { display:flex; gap: var(--space-2); margin-top: var(--space-2); }
      .shd-actions ion-button { flex:1; }
      @media (max-width: 420px) { .shd-platform-grid { grid-template-columns: repeat(2, 1fr); } }
    </style>

    <div class="shd-topbar">
      <button type="button" class="shd-back" data-shd-close>${getIcon('chevron-left', 16)} <span>${esc(t('common.back'))}</span></button>
      <span class="shd-topbar-title">${esc(t('shiftDetail.title'))}</span>
      <ion-button size="small" fill="clear" class="shd-edit" data-shd-edit>${getIcon('edit', 16)} <span>${esc(t('shifts.editShift'))}</span></ion-button>
    </div>

    <div class="shd-hero">
      <div class="shd-hero-plat">
        <span class="shd-chip" style="--chip:var(--color-${esc(shift.platformId || 'other')}, var(--color-other))">${logo || esc(String(platformName || '?').charAt(0).toUpperCase())}</span>
        <span class="shd-hero-name">${esc(platformName)}</span>
      </div>
      <span class="shd-hero-date">${esc(dateStr)}</span>
      ${timeStr ? `<span class="shd-hero-time">${esc(timeStr)}</span>` : ''}
      <span class="shd-hero-net-label">${esc(t('shiftDetail.netEarnings'))}</span>
      <span class="shd-hero-net">${esc(fmt(net))}</span>
    </div>

    <div class="shd-quickstats">
      ${statCell(formatDuration(durationMin, 'compact'), t('shiftDetail.duration'))}
      ${statCell(fmt(hourly), t('shiftDetail.hourlyRate'))}
      ${statCell(distLabel(totalDist), t('shiftDetail.totalDistance'))}
    </div>

    <section class="shd-section">
      <h3 class="shd-section-title">${esc(t('shiftDetail.earnings'))}</h3>
      ${row(t('shiftDetail.grossPay'), fmt(gross))}
      ${tips ? row(t('shiftDetail.tips'), fmt(tips)) : ''}
      ${bonus ? row(t('shiftDetail.bonus'), fmt(bonus)) : ''}
      ${row(t('shiftDetail.netEarnings'), fmt(net))}
    </section>

    ${platformBreakdown}
    ${mileageSection}
    ${vehicle ? `<section class="shd-section"><h3 class="shd-section-title">${esc(t('shiftDetail.vehicle'))}</h3>${row(t('shiftDetail.vehicle'), vehicle.name || vehicle.make || '—')}</section>` : ''}
    ${notesSection}
    ${expensesSection}
    ${routeSection}

    <div class="shd-actions">
      <ion-button fill="outline" color="danger" data-shd-delete>${esc(t('shifts.deleteShift'))}</ion-button>
      <ion-button data-shd-edit-2>${esc(t('shifts.editShift'))}</ion-button>
    </div>
  `;

  modal.appendChild(wrap);
  modal.addEventListener('ionModalDidDismiss', () => modal.remove());
  document.body.appendChild(modal);
  await modal.present();

  const doEdit = () => {
    close();
    if (typeof handlers.onEdit === 'function') handlers.onEdit(shiftId);
  };
  wrap.querySelector('[data-shd-close]')?.addEventListener('click', close);
  wrap.querySelector('[data-shd-edit]')?.addEventListener('click', doEdit);
  wrap.querySelector('[data-shd-edit-2]')?.addEventListener('click', doEdit);
  wrap.querySelector('[data-shd-delete]')?.addEventListener('click', async () => {
    close();
    if (typeof handlers.onDeleted === 'function') await handlers.onDeleted(shiftId);
  });
}
