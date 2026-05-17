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
    
    const getDollars = (cents) => {
      if (cents == null) return 0;
      const n = Number(cents);
      return Number.isFinite(n) ? n / 100 : 0;
    };

    const body = rows.map((s) => [
      s.id,
      s.date,
      s.provinceId || '',
      s.platformId || '',
      s.startTime || '',
      s.endTime || '',
      Number(s.durationMinutes ?? s.onlineMinutes ?? 0),
      s.grossEarnings != null ? getDollars(s.grossEarnings) : Number(s.gross || 0),
      s.tips != null ? getDollars(s.tips) : 0,
      s.bonusEarnings != null ? getDollars(s.bonusEarnings) : Number(s.bonus || 0),
      s.deliveryCount ?? s.orders ?? 0,
      s.distanceKm ?? 0,
      s.deadMilesKm ?? s.deadKm ?? 0,
      s.notes ?? '',
    ]);
    return [header, ...body];
  },
};
