import dayjs from '../libs/dayjs.min.js';
import relativeTime from '../libs/dayjs.relativeTime.min.js';
import durationPlugin from '../libs/dayjs.duration.min.js';
import { getLocaleConfig } from './locale.js';
import { CountryRegistry } from '../registry/countries/index.js';
import { getTerminology } from '../registry/platforms/terminology.js';
import { store } from '../core/store.js';

dayjs.extend(relativeTime);
dayjs.extend(durationPlugin);

const KM_TO_MI = 0.621371192;

/** @param {string|undefined} s */
function isCountryCode(s) {
  return /^[A-Za-z]{2}$/.test(String(s || '').trim());
}

/**
 * @param {number} amount
 * @param {string} [locale] BCP-47 locale or 2-letter country (CA/US/UK)
 * @param {{ currency?: string }} [opts]
 */
export function formatCurrency(amount, locale = 'en-US', opts = {}) {
  const n = Number(amount);
  const safe = Number.isFinite(n) ? n : 0;
  let intlLocale = locale;
  let currency = opts.currency;
  if (isCountryCode(locale)) {
    const cfg = getLocaleConfig(locale);
    currency = cfg.currency;
    intlLocale = CountryRegistry.getById(String(locale).toUpperCase()).tax.intlLocaleTag;
  }
  if (!currency) currency = 'USD';
  return new Intl.NumberFormat(intlLocale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

/**
 * @param {number} minutes
 * @param {'compact'|'decimal'} [durationStyle] User preference: "2h 30m" vs "2.5 hrs"
 */
export function formatDuration(minutes, durationStyle = 'compact') {
  const m = Number(minutes);
  if (!Number.isFinite(m) || m < 0) return durationStyle === 'decimal' ? '0.0 hrs' : '0m';
  if (durationStyle === 'decimal') {
    const hrs = m / 60;
    return `${hrs.toFixed(1)} hrs`;
  }
  const d = dayjs.duration(m, 'minutes');
  const h = Math.floor(d.asHours());
  const min = m - h * 60;
  if (h === 0) return `${Math.round(min)}m`;
  if (min < 1) return `${h}h`;
  return `${h}h ${Math.round(min)}m`;
}

/**
 * @param {number} km
 * @param {'km'|'mi'} unit
 */
export function formatDistance(km, unit) {
  const k = Number(km);
  if (!Number.isFinite(k)) return unit === 'mi' ? '0.0 mi' : '0.0 km';
  if (unit === 'mi') {
    const mi = k * KM_TO_MI;
    return `${mi.toFixed(1)} mi`;
  }
  return `${k.toFixed(1)} km`;
}

/**
 * @param {string|Date|number} dateStr
 * @param {string} format Day.js format tokens
 * @param {string} [locale] optional Day.js locale name (default en)
 */
export function formatDate(dateStr, format, locale) {
  const d = dayjs(dateStr);
  if (!d.isValid()) return '';
  if (locale) return d.locale(locale).format(format);
  return d.format(format);
}

/**
 * @param {string|Date|number} timeStr
 * @param {boolean} use24h
 */
export function formatTime(timeStr, use24h) {
  const d = dayjs(timeStr);
  if (!d.isValid()) return '';
  return d.format(use24h ? 'HH:mm' : 'h:mm A');
}

/**
 * @param {number} value ratio 0–1 or 0–100 (auto if > 1)
 * @param {number} [decimals=1]
 */
export function formatPercent(value, decimals = 1) {
  const v = Number(value);
  if (!Number.isFinite(v)) return `${(0).toFixed(decimals)}%`;
  return `${v.toFixed(decimals)}%`;
}

/**
 * @param {number} n
 * @param {string} [locale]
 */
export function formatLargeNumber(n, locale = 'en-US') {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0';
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(v);
}

/**
 * @param {number} rate
 * @param {string} [locale]
 * @param {{ currency?: string }} [opts]
 */
export function formatHourlyRate(rate, locale = 'en-US', opts = {}) {
  return `${formatCurrency(rate, locale, opts)}/hr`;
}

/**
 * @param {string|Date|number} dateStr
 */
export function formatDateRelative(dateStr) {
  const d = dayjs(dateStr);
  if (!d.isValid()) return '';
  return d.fromNow();
}

/**
 * @param {string} str
 * @param {number} length
 */
export function truncate(str, length) {
  const s = String(str ?? '');
  const max = Math.max(0, Number(length) || 0);
  if (s.length <= max) return s;
  if (max <= 1) return '…';
  return `${s.slice(0, max - 1)}…`;
}

/**
 * @param {string} platformId
 * @param {string} term
 */
export function platformLabel(platformId, term) {
  const rows = /** @type {{ id?: string }[]} */ (store.get('platforms') || []);
  const ids = rows.map((r) => String(r?.id || '')).filter(Boolean);
  return getTerminology(platformId, String(term ?? ''), ids);
}
