/**
 * P10 — platform-specific tracking helpers.
 * Pure utilities only: no UI coupling, safe to call from forms, shifts, and analytics.
 * Normalization is registry-driven (`specificSchema` on each platform definition).
 */

import { PlatformRegistry } from '../../registry/platforms/index.js';
import { getPlatformConfig } from '../../registry/platforms/terminology.js';
import {
  normalizePlatformSpecificFromDef,
  toNumberField as toNumber,
  normalizeStringArrayField as normalizeStringArray,
} from '../../registry/platforms/specific-normalize.js';

const SUPPORTED_PLATFORM_IDS = new Set(PlatformRegistry.getAll().map((p) => p.id));

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizePlatformId(value) {
  const id = String(value || '').toLowerCase();
  return SUPPORTED_PLATFORM_IDS.has(id) ? id : 'other';
}

/**
 * @param {string} platformId
 * @param {unknown} input
 */
export function normalizePlatformSpecific(platformId, input) {
  const id = normalizePlatformId(platformId);
  const def = PlatformRegistry.getById(id);
  return normalizePlatformSpecificFromDef(def, input);
}

/**
 * Feature 208 + 218 shift-level payload normalization.
 * @param {Record<string, unknown>} shiftInput
 */
export function extractShiftPlatformSpecific(shiftInput) {
  const platformId = normalizePlatformId(shiftInput.platformId);
  const multiAppPlatformIds = normalizeStringArray(shiftInput.multiAppPlatformIds).filter((id) => id !== platformId);
  const isMultiApp = multiAppPlatformIds.length > 0 || shiftInput.isMultiApp === true;
  const rawSpecific =
    shiftInput.platformSpecific && typeof shiftInput.platformSpecific === 'object'
      ? /** @type {Record<string, unknown>} */ (shiftInput.platformSpecific)
      : {};
  const platformSpecific = normalizePlatformSpecific(platformId, rawSpecific);
  const peakPayRaw = toNumber(shiftInput.peakPay, { min: 0 });
  const catalog = getPlatformConfig(platformId);
  const peakField = Array.isArray(catalog.relevantFields) && catalog.relevantFields.includes('peakPay');
  const peakPay = peakField ? peakPayRaw ?? toNumber(/** @type {any} */ (platformSpecific).peakPay, { min: 0 }) : null;

  return {
    platformSpecific,
    peakPay,
    isMultiApp,
    multiAppPlatformIds,
  };
}

/**
 * Features 217/285/286.
 * @param {{
 *   netHourlyByPlatform?: Record<string, number | null | undefined>,
 *   thresholdPercent?: number,
 *   doordashCustomerRating?: number | null,
 *   uberCompletionRate?: number | null,
 * }} input
 */
export function evaluatePlatformAlerts(input = {}) {
  const alerts = [];
  const thresholdPercent = Number.isFinite(Number(input.thresholdPercent)) ? Number(input.thresholdPercent) : 20;
  const entries = Object.entries(input.netHourlyByPlatform || {}).filter(([, v]) => Number.isFinite(Number(v)));
  if (entries.length >= 2) {
    entries.sort((a, b) => Number(b[1]) - Number(a[1]));
    const [bestId, bestRateRaw] = entries[0];
    const [worstId, worstRateRaw] = entries[entries.length - 1];
    const bestRate = Number(bestRateRaw);
    const worstRate = Number(worstRateRaw);
    if (bestRate > 0 && worstRate >= 0) {
      const gapPercent = ((bestRate - worstRate) / bestRate) * 100;
      if (gapPercent >= thresholdPercent) {
        alerts.push({
          type: 'arbitrage',
          platformId: bestId,
          comparedTo: worstId,
          gapPercent: Math.round(gapPercent * 10) / 10,
        });
      }
    }
  }

  for (const def of PlatformRegistry.getAll()) {
    if (!Array.isArray(def.alertChecks) || def.alertChecks.length === 0) continue;
    for (const check of def.alertChecks) {
      const rawIn = /** @type {Record<string, unknown>} */ (input);
      const val = toNumber(rawIn[check.inputKey], {
        min: check.min,
        max: check.max,
      });
      if (val != null && val < check.below) {
        alerts.push({ type: check.alertType, [check.payloadKey]: val });
      }
    }
  }
  return alerts;
}

/**
 * Feature 290 payout-day countdown.
 * @param {string} platformId
 * @param {Date} [from]
 * @param {number} [weekday] 0=Sun..6=Sat
 */
export function getPayoutCountdown(platformId, from = new Date(), weekday) {
  const id = normalizePlatformId(platformId);
  const def = PlatformRegistry.getById(id);
  const targetDay = Number.isInteger(weekday) ? Number(weekday) : Number(def.payoutWeekday ?? 5);
  const now = from instanceof Date ? from : new Date(from);
  const d = new Date(now);
  const current = d.getDay();
  let daysUntil = targetDay - current;
  if (daysUntil < 0) daysUntil += 7;
  if (daysUntil === 0) {
    const cutoff = new Date(d);
    cutoff.setHours(23, 59, 59, 999);
    if (now.getTime() > cutoff.getTime()) daysUntil = 7;
  }
  const next = new Date(d);
  next.setDate(next.getDate() + daysUntil);
  next.setHours(0, 0, 0, 0);
  return { daysUntil, nextPayoutDate: next.toISOString().slice(0, 10), weekday: targetDay };
}

/**
 * Feature 291 instant cashout fee helper.
 * @param {number} amount
 * @param {{ flatFee?: number, ratePct?: number }} [feeConfig]
 */
export function calculateInstantCashout(amount, feeConfig = {}) {
  const gross = Math.max(0, Number(amount) || 0);
  const flatFee = Math.max(0, Number(feeConfig.flatFee) || 0);
  const ratePct = Math.max(0, Number(feeConfig.ratePct) || 0);
  const fee = Math.round((flatFee + gross * (ratePct / 100)) * 100) / 100;
  const net = Math.max(0, Math.round((gross - fee) * 100) / 100);
  return { gross, fee, net };
}
