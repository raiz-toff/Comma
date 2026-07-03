/** HH:mm (local time-of-day) from a shift's epoch-ms startTime/endTime (Fix 1 — interop plan). */
function fmtHm(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '';
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default {
  id: 'shifts',
  label: 'Shift list',
  defaultIncluded: true,
  /** @param {unknown} report @param {unknown} [_user] */
  renderHTML: async (report) => {
    const r = /** @type {{ shifts?: unknown[] }} */ (report);
    const n = Array.isArray(r.shifts) ? r.shifts.length : 0;
    return `<p style="color:var(--color-text-secondary);">${n} shift${n === 1 ? '' : 's'} in this date range (detail export: shifts CSV).</p>`;
  },
  /** @param {unknown} report @param {unknown} [_user] */
  renderText: (report) => {
    const r = /** @type {{ shifts?: unknown[] }} */ (report);
    const n = Array.isArray(r.shifts) ? r.shifts.length : 0;
    return `Shift rows: ${n}`;
  },
  /** @param {unknown} report @param {unknown} [_user] */
  renderCSV: (report) => {
    const r = /** @type {{ shifts?: Array<Record<string, unknown>> }} */ (report);
    const rows = Array.isArray(r.shifts) ? r.shifts : [];
    const header = [
      'id',
      'date',
      'provinceId',
      'platformId',
      'startTime',
      'endTime',
      'durationMinutes',
      'gross',
      'tips',
      'bonus',
      'orders',
      'distanceKm',
      'deadMilesKm',
      'notes',
    ];
    
    const body = rows.map((s) => [
      s.id,
      s.date,
      s.provinceId || '',
      s.platformId || '',
      fmtHm(s.startTime),
      fmtHm(s.endTime),
      Number(s.durationSeconds != null ? Math.round(s.durationSeconds / 60) : (s.onlineMinutes ?? 0)),
      Number(s.grossRevenue ?? 0),
      Number(s.tipsRevenue ?? 0),
      Number(s.customFields?.bonusAmount) || 0,
      s.deliveryCount ?? 0,
      s.activeMileage ?? 0,
      s.deadMileage ?? 0,
      s.notes ?? '',
    ]);
    return [header, ...body];
  },
};
