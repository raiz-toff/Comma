function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default {
  id: 'dead_miles_ratio',
  label: 'Dead miles ratio',
  shortLabel: 'Dead %',
  format: 'percent',
  showInAnalytics: false,
  showOnShiftCard: false,
  shiftCardOrder: 99,
  messageKey: 'analytics.deadMilesRatio',
  /** @param {unknown} shift @param {unknown} [_vehicle] */
  calcPerShift: (shift, _vehicle) => {
    const s = /** @type {{ deadMileage?: unknown; activeMileage?: unknown }} */ (shift);
    const dead = num(s.deadMileage);
    const biz = num(s.activeMileage);
    const total = dead + biz;
    if (total <= 0) return null;
    return (dead / total) * 100;
  },
  calcFromCtx: () => null,
};
