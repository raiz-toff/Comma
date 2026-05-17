import { calcHourlyRate } from '../../utils/calculations.js';

function durationMinutes(shift) {
  const s = /** @type {Record<string, unknown>} */ (shift);
  if (Number.isFinite(Number(s.activeMinutes)) && Number(s.activeMinutes) > 0) return Number(s.activeMinutes);
  if (typeof s.date === 'string' && typeof s.startTime === 'string' && typeof s.endTime === 'string') {
    const start = new Date(`${s.date}T${s.startTime}:00`);
    const end = new Date(`${s.date}T${s.endTime}:00`);
    const ms = end.getTime() - start.getTime();
    if (Number.isFinite(ms) && ms > 0) return Math.round(ms / 60000);
  }
  return Number(s.durationMinutes) || Number(s.onlineMinutes) || 0;
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
    const base = Number(s?.grossEarnings ?? s?.gross ?? 0);
    const tips = Number(s?.tips ?? 0);
    const bonus = Number(s?.bonusEarnings ?? s?.bonus ?? 0);
    const grossDollars = (base + tips + bonus) / 100;
    const mins = durationMinutes(shift);
    return mins > 0 ? calcHourlyRate(grossDollars, mins) : null;
  },
};
