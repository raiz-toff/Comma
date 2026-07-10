/** @typedef {{ month: number, day: number, label: string, followYear?: boolean }} TaxInstallment */

/** @typedef {TaxInstallment[]} TaxSchedule */

/**
 * @typedef {Object} LocaleConfig
 * @property {string} currency
 * @property {string} symbol
 * @property {'km'|'mi'} distanceUnit
 * @property {TaxSchedule} [taxInstallmentDates]
 * @property {boolean} [hasCPP]
 * @property {boolean} [hasHST]
 * @property {boolean} [hasSETax]
 */

import { CountryRegistry, countryDefToLocaleConfig } from '../registry/countries/index.js';
import { ProvinceRegistry } from '../registry/provinces/index.js';

/**
 * @param {string | null | undefined} countryId
 */
export function getCountryDef(countryId) {
  return CountryRegistry.getById(countryId);
}

/**
 * @param {string | null | undefined} provinceId
 */
export function getProvinceDef(provinceId) {
  return ProvinceRegistry.getById(provinceId);
}

/**
 * Province catalog row for the user's country, or null when none match (e.g. US state code with no registry row yet).
 * @param {string | null | undefined} countryId
 * @param {string | null | undefined} provinceId
 */
export function resolveProvinceDef(countryId, provinceId) {
  const c = String(countryId || '').toUpperCase();
  const pid = String(provinceId || '').toUpperCase();
  const list = ProvinceRegistry.getByCountry(c);
  if (!list.length) return null;
  const hit = list.find((p) => String(p.id).toUpperCase() === pid);
  if (hit) return hit;
  if (list.length === 1) return list[0];
  return null;
}

/**
 * @param {string} country
 * @returns {LocaleConfig}
 */
export function getLocaleConfig(country) {
  const def = CountryRegistry.getById(country);
  return { ...countryDefToLocaleConfig(def) };
}

/**
 * @param {string} country
 * @param {Date} [now]
 * @returns {{ date: Date, daysUntil: number, label: string }}
 */
export function getNextTaxDeadline(country, now = new Date()) {
  const cfg = getLocaleConfig(country);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const y = now.getFullYear();
  const entries = [];

  for (let yr = y; yr <= y + 1; yr += 1) {
    (cfg.taxInstallmentDates || []).forEach((row) => {
      const yy = yr + (row.followYear ? 1 : 0);
      const d = new Date(yy, row.month - 1, row.day);
      entries.push({ date: d, label: row.label });
    });
  }

  const upcoming = entries
    .filter((e) => e.date.getTime() >= startOfToday)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const next = upcoming[0] || entries[0];
  if (!next) {
    const fallback = new Date(y, 11, 31);
    return { date: fallback, daysUntil: Math.ceil((fallback.getTime() - now.getTime()) / 86400000), label: 'Tax deadline' };
  }
  const daysUntil = Math.ceil((next.date.getTime() - now.getTime()) / 86400000);
  return { date: next.date, daysUntil, label: next.label };
}


/**
 * @param {string} country
 * @param {number} year
 * @returns {Array<{ date: Date, label: string, daysUntil: number }>}
 */
export function getAllTaxDeadlines(country, year) {
  const cfg = getLocaleConfig(country);
  const now = Date.now();
  return (cfg.taxInstallmentDates || []).map((row) => {
    const yy = year + (row.followYear ? 1 : 0);
    const d = new Date(yy, row.month - 1, row.day);
    const daysUntil = Math.ceil((d.getTime() - now) / 86400000);
    return { date: d, label: row.label, daysUntil };
  });
}

/**
 * Next HST filing date from province definition (Ontario quarterly).
 * @param {ReturnType<typeof getProvinceDef>} provinceDef
 * @returns {{ date: Date, daysUntil: number, label: string } | null}
 */
export function getNextHSTDeadline(provinceDef) {
  const dates = provinceDef?.salesTax?.quarterlyDueDates;
  if (!Array.isArray(dates) || dates.length === 0) return null;
  const now = new Date();
  const y = now.getFullYear();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const entries = [];
  for (let yr = y; yr <= y + 1; yr += 1) {
    for (const row of dates) {
      if (!row || typeof row.month !== 'number' || typeof row.day !== 'number') continue;
      const d = new Date(yr, row.month - 1, row.day);
      const label =
        typeof row.labelKey === 'string'
          ? row.labelKey
          : typeof row.label === 'string'
            ? row.label
            : 'HST';
      entries.push({ date: d, label });
    }
  }
  const upcoming = entries
    .filter((e) => e.date.getTime() >= startOfToday)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const next = upcoming[0];
  if (!next) return null;
  const daysUntil = Math.ceil((next.date.getTime() - Date.now()) / 86400000);
  return { date: next.date, daysUntil, label: next.label };
}
