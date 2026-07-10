export default {
  id: 'shift_gross',
  label: 'Gross',
  shortLabel: 'Gross',
  format: 'currency',
  showInAnalytics: false,
  showOnShiftCard: true,
  shiftCardOrder: 1,
  messageKey: 'shifts.gross',
  /** @param {unknown} shift @param {unknown} [_vehicle] */
  calcPerShift: (shift, _vehicle) => {
    const s = /** @type {any} */ (shift);
    const base = Number(s?.grossRevenue ?? 0);
    const tips = Number(s?.tipsRevenue ?? 0);
    const bonus = Number(s?.bonusAmount) || 0;
    return base + tips + bonus;
  },
};
