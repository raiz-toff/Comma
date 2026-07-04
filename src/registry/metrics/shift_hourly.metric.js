import { calcHourlyRate } from '../../utils/calculations.js';

function durationMinutes(shift) {
  const s = /** @type {Record<string, unknown>} */ (shift);
  if (Number.isFinite(Number(s.activeMinutes)) && Number(s.activeMinutes) > 0) return Number(s.activeMinutes);
  // Fix 1 (interop plan) — startTime/endTime are real epoch-ms timestamps now (mobile parity),
  // so duration is a plain subtraction — no more date+HH:mm string reconstruction needed.
  if (typeof s.startTime === 'number' && typeof s.endTime === 'number') {
    const ms = s.endTime - s.startTime;
    if (Number.isFinite(ms) && ms > 0) return Math.round(ms / 60000);
  }
  return Math.round(Number(s.durationSeconds) / 60) || Number(s.onlineMinutes) || 0;
}

export default {
  id: 'shift_hourly',
  label: 'Hourly rate',
  shortLabel: '/h',
  format: 'currency_per_hour',
  showInAnalytics: false,
  showOnShiftCard: true,
  shiftCardOrder: 2,
  messageKey: 'analytics.hourlyRate',
  /** @param {unknown} shift @param {unknown} [_vehicle] */
  calcPerShift: (shift, _vehicle) => {
    const s = /** @type {any} */ (shift);
    const base = Number(s?.grossRevenue ?? 0);
    const tips = Number(s?.tipsRevenue ?? 0);
    const bonus = Number(s?.bonusAmount) || 0;
    const grossDollars = base + tips + bonus;
    const mins = durationMinutes(shift);
    return mins > 0 ? calcHourlyRate(grossDollars, mins) : null;
  },
};
