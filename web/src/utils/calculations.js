/** ISO-style week labels starting Monday (plan: Mon…Sun). */
const DOW_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function num(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

export function calcHourlyRate(gross, durationMinutes) {
  const m = num(durationMinutes);
  if (m <= 0) return 0;
  return (num(gross) / m) * 60;
}

export function calcNetHourlyRate(gross, expenses, durationMinutes) {
  const m = num(durationMinutes);
  if (m <= 0) return 0;
  return ((num(gross) - num(expenses)) / m) * 60;
}

export function calcEarningsPerOrder(gross, count) {
  const c = Math.max(0, Math.floor(num(count)));
  if (c === 0) return 0;
  return num(gross) / c;
}

export function calcTipRate(tips, gross) {
  const g = num(gross);
  if (g <= 0) return 0;
  return (num(tips) / g) * 100;
}

export function calcBonusDependencyRatio(bonus, gross) {
  const g = num(gross);
  if (g <= 0) return 0;
  return (num(bonus) / g) * 100;
}

export function calcUtilizationRate(activeMinutes, onlineMinutes) {
  const o = num(onlineMinutes);
  if (o <= 0) return 0;
  return (num(activeMinutes) / o) * 100;
}

export function calcEarningsPerKm(gross, distanceKm) {
  const d = num(distanceKm);
  if (d <= 0) return 0;
  return num(gross) / d;
}

export function calcFuelCost(distanceKm, efficiencyL100km, pricePerLiter) {
  return (num(distanceKm) * (num(efficiencyL100km) / 100)) * num(pricePerLiter);
}

export function calcEVCost(distanceKm, kwPer100km, electricityRate) {
  return (num(distanceKm) * (num(kwPer100km) / 100)) * num(electricityRate);
}

/**
 * @param {{ estimatedAnnualKm?: number }} vehicle
 * @param {{ totalAnnual?: number }} expenses
 */
export function calcVehicleCostPerKm(vehicle, expenses) {
  const km = Math.max(1, num(vehicle?.estimatedAnnualKm, 1));
  return num(expenses?.totalAnnual) / km;
}

export function calcDepreciation(purchasePrice, lifespanKm, distanceKm) {
  const life = Math.max(1, num(lifespanKm));
  return num(purchasePrice) * (num(distanceKm) / life);
}

export function calcActualCostDeduction(expenses, businessPct) {
  return num(expenses) * (num(businessPct) / 100);
}

export function calcTaxSetAside(gross, rate) {
  return num(gross) * (num(rate) / 100);
}

export function calcNetAfterTax(gross, taxRate) {
  return num(gross) * (1 - num(taxRate) / 100);
}

export function calcHSTRemittable(hstCollected, itcAmount) {
  return num(hstCollected) - num(itcAmount);
}

/** Simplified annual CPP (employee) estimate for planning — not payroll-grade. */
export function calcCPPContribution(netIncome, year) {
  const y = Math.floor(num(year, new Date().getFullYear()));
  const income = Math.max(0, num(netIncome));
  const ympe = y >= 2026 ? 71300 : y >= 2025 ? 68500 : 68500;
  const basicExemption = 3500;
  const pensionable = Math.max(0, Math.min(income, ympe) - basicExemption);
  const rate = 0.0595;
  return Math.max(0, pensionable * rate);
}

/** Simplified US self-employment tax (combined SS+Medicare on ~92.35% of net). */
export function calcSEtax(netIncome) {
  const n = Math.max(0, num(netIncome));
  const base = n * 0.9235;
  return base * 0.153;
}

/**
 * @param {Array<{ startAt?: string|Date, gross?: number }>} shifts
 * @returns {Record<string, number>}
 */
export function aggregateByDayOfWeek(shifts) {
  const sums = Object.fromEntries(DOW_KEYS.map((k) => [k, 0]));
  const counts = Object.fromEntries(DOW_KEYS.map((k) => [k, 0]));
  (shifts || []).forEach((s) => {
    const d = new Date(s?.startAt ?? 0);
    if (Number.isNaN(d.getTime())) return;
    const sun0 = d.getDay();
    const k = DOW_KEYS[sun0 === 0 ? 6 : sun0 - 1];
    sums[k] += num(s?.gross);
    counts[k] += 1;
  });
  const out = {};
  DOW_KEYS.forEach((k) => {
    out[k] = counts[k] ? sums[k] / counts[k] : 0;
  });
  return out;
}

/**
 * @param {Array<{ startAt?: string|Date, gross?: number }>} shifts
 */
export function aggregateByHourOfDay(shifts) {
  const sums = Object.fromEntries(Array.from({ length: 24 }, (_, h) => [String(h), 0]));
  const counts = Object.fromEntries(Array.from({ length: 24 }, (_, h) => [String(h), 0]));
  (shifts || []).forEach((s) => {
    const d = new Date(s?.startAt ?? 0);
    if (Number.isNaN(d.getTime())) return;
    const h = String(d.getHours());
    sums[h] += num(s?.gross);
    counts[h] += 1;
  });
  const out = {};
  for (let i = 0; i < 24; i += 1) {
    const h = String(i);
    out[h] = counts[h] ? sums[h] / counts[h] : 0;
  }
  return out;
}

/**
 * @param {Array<{ x: number, y: number }>} dataPoints
 */
export function calcLinearRegression(dataPoints) {
  const pts = (dataPoints || []).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const n = pts.length;
  if (n < 2) return { slope: 0, intercept: 0, trend: 'flat' };
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  pts.forEach((p) => {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
  });
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n, trend: 'flat' };
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  let trend = 'flat';
  if (slope > 0.0001) trend = 'up';
  else if (slope < -0.0001) trend = 'down';
  return { slope, intercept, trend };
}

/**
 * @param {Array<string|Date>} shiftDates
 */
export function calcStreakDays(shiftDates) {
  const days = [
    ...new Set(
      (shiftDates || [])
        .map((d) => {
          const t = new Date(d);
          return Number.isNaN(t.getTime()) ? null : t.toISOString().slice(0, 10);
        })
        .filter(Boolean),
    ),
  ].sort();
  if (days.length === 0) return 0;
  let best = 1;
  let cur = 1;
  for (let i = 1; i < days.length; i += 1) {
    const a = new Date(`${days[i - 1]}T12:00:00Z`).getTime();
    const b = new Date(`${days[i]}T12:00:00Z`).getTime();
    if ((b - a) / 86400000 === 1) {
      cur += 1;
      best = Math.max(best, cur);
    } else {
      cur = 1;
    }
  }
  return best;
}

/**
 * @param {Array<{ gross?: number, durationMinutes?: number, orders?: number }>} shifts
 */
export function calcPersonalRecords(shifts) {
  let bestHourlyRate = 0;
  let bestShiftEarnings = 0;
  let longestShiftMinutes = 0;
  let mostOrdersSingleShift = 0;
  (shifts || []).forEach((s) => {
    const g = num(s?.gross);
    const m = num(s?.durationMinutes);
    bestShiftEarnings = Math.max(bestShiftEarnings, g);
    longestShiftMinutes = Math.max(longestShiftMinutes, m);
    mostOrdersSingleShift = Math.max(mostOrdersSingleShift, Math.floor(num(s?.orders)));
    if (m > 0) bestHourlyRate = Math.max(bestHourlyRate, (g / m) * 60);
  });
  return { bestHourlyRate, bestShiftEarnings, longestShiftMinutes, mostOrdersSingleShift };
}

function startOfWeekMondayLocal(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = x.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * @param {Array<{ startAt?: string|Date, gross?: number }>} completedShifts
 * @param {string|Date} currentDate
 */
export function projectWeekEarnings(completedShifts, currentDate) {
  const now = new Date(currentDate);
  if (Number.isNaN(now.getTime())) return 0;
  const ws = startOfWeekMondayLocal(now);
  const we = new Date(ws);
  we.setDate(we.getDate() + 7);

  const inWeek = (completedShifts || []).filter((s) => {
    const t = new Date(s?.startAt ?? 0);
    if (Number.isNaN(t.getTime())) return false;
    return t >= ws && t < we;
  });
  const actual = inWeek.reduce((a, s) => a + num(s?.gross), 0);

  const msDay = 86400000;
  const elapsed = Math.max(msDay, Math.min(now.getTime() - ws.getTime() + 1, 7 * msDay));
  const dailyAvg = actual / (elapsed / msDay);
  return dailyAvg * 7;
}
