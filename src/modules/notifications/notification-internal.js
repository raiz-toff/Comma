/**
 * Shared notification helpers + persistence (used by registry defs and notifications.js).
 * Kept separate from notifications.js to avoid import cycles with registry/*.notification.js.
 */

import { db, getAppState, getUser } from '../../core/db.js';
import { isUserVaultActive } from '../../core/vault-gate.js';
import { showNotifyCard } from '../../ui/components.js';
import { getNextTaxDeadline } from '../../utils/locale.js';
import { getCountryTaxProfile } from '../../registry/countries/index.js';
import { store } from '../../core/store.js';
import { bus } from '../../core/events.js';
import { getDemoAnalyticsAnchorDate } from '../demo/sample-year.js';

export const NOTIFICATION_IDS = Object.freeze({
  dailySummary: 'daily_summary',
  midWeekGoal: 'mid_week_goal',
  weeklyGoalHit: 'weekly_goal_hit',
  weeklyGoalMiss: 'weekly_goal_miss',
  personalBest: 'personal_best',
  maintenanceDue: 'maintenance_due',
  insuranceExpiry: 'insurance_expiry',
  taxInstallment: 'tax_installment_due',
  streakRisk: 'streak_risk',
  backupOverdue: 'backup_overdue',
  lowHourlyRate: 'low_hourly_rate',
  highExpense: 'high_expense',
  milestoneProximity: 'milestone_proximity',
  crossPlatformArbitrage: 'cross_platform_arbitrage',
  hstThreshold: 'hst_threshold_approaching',
  mileageLogReminder: 'mileage_log_reminder',
  t4aSeason: 't4a_season',
  hstRemittanceUpcoming: 'hst_remittance_upcoming',
  idleDayAlert: 'idle_day_alert',
  dataEntryGap: 'data_entry_gap',
  vehicleServiceDue: 'vehicle_service_due',
  longShiftAlert: 'long_shift_alert',
  platformConcentration: 'platform_concentration',
  earningsTrend: 'earnings_trend',
  bestDayOfWeek: 'best_day_of_week',
});

const DEFAULT_NOTIFICATION_SETTINGS = Object.freeze({
  frequency: 'immediate',
  enabled: true,
});

export function nowIso() {
  return new Date().toISOString();
}

export function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Subtract days from a Date or YYYY-MM-DD string.
 * @param {Date|string} date
 * @param {number} days
 * @returns {string} YYYY-MM-DD string
 */
export function subtractDays(date, days) {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : new Date(date.getTime());
  d.setDate(d.getDate() - days);
  return ymd(d);
}


export function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function daysBetween(a, b) {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.floor(ms / 86400000);
}

/**
 * @param {Date} date
 * @param {number} weekStartDay
 */
export function weekBounds(date, weekStartDay) {
  const base = startOfDay(date);
  const dow = base.getDay();
  const diff = (dow - weekStartDay + 7) % 7;
  const start = new Date(base);
  start.setDate(base.getDate() - diff);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

/**
 * @param {string} type
 * @param {Date} date
 * @param {'day'|'week'|'month'|'quarter'|'ever'} scope
 */
export function makeNotificationId(type, date, scope = 'day') {
  if (scope === 'ever') return `notif:${type}:ever`;
  if (scope === 'week') {
    const wk = weekBounds(date, 1);
    return `notif:${type}:week:${ymd(wk.start)}`;
  }
  if (scope === 'month') {
    const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return `notif:${type}:month:${ym}`;
  }
  if (scope === 'quarter') {
    const q = Math.floor(date.getMonth() / 3) + 1;
    return `notif:${type}:quarter:${date.getFullYear()}-Q${q}`;
  }
  return `notif:${type}:day:${ymd(date)}`;
}

/**
 * @param {unknown} raw
 * @returns {{ enabled: boolean, frequency: 'off'|'immediate'|'daily'|'weekly' }}
 */
export function normalizeTypePref(raw) {
  if (raw === false) return { enabled: false, frequency: 'off' };
  if (raw === true || raw == null) return { ...DEFAULT_NOTIFICATION_SETTINGS };
  if (typeof raw !== 'object') return { ...DEFAULT_NOTIFICATION_SETTINGS };
  const obj = /** @type {{ enabled?: unknown, frequency?: unknown }} */ (raw);
  const enabled = obj.enabled == null ? true : Boolean(obj.enabled);
  const freqRaw = String(obj.frequency || 'immediate').toLowerCase();
  const frequency =
    freqRaw === 'off' || freqRaw === 'daily' || freqRaw === 'weekly'
      ? freqRaw
      : 'immediate';
  return { enabled, frequency };
}

/**
 * @param {Record<string, unknown> | null | undefined} prefs
 * @param {string} type
 */
export function getPrefForType(prefs, type) {
  if (!prefs || typeof prefs !== 'object') return { ...DEFAULT_NOTIFICATION_SETTINGS };
  return normalizeTypePref(prefs[type]);
}

let demoShownPopupCount = 0;
let toastQueue = [];
let queueFlushing = false;

async function flushToastQueue() {
  if (queueFlushing) return;
  queueFlushing = true;
  while (toastQueue.length > 0) {
    const cardOpts = toastQueue.shift();
    try {
      showNotifyCard(cardOpts);
    } catch (e) {
      console.error('[notification-internal] showNotifyCard failed', e);
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  queueFlushing = false;
}

/**
 * @param {string} type
 * @param {string} title
 * @param {string} message
 * @param {{ tone?: 'info'|'warning'|'success'|'celebration', scope?: 'day'|'week'|'month'|'quarter'|'ever', dedupeKey?: string }} [opts]
 */
export async function createNotification(type, title, message, opts = {}) {
  const user = await getUser();
  if (!isUserVaultActive(user)) return false;
  const pref = getPrefForType(user?.notificationPrefs, type);
  if (!pref.enabled || pref.frequency === 'off') return false;

  const createdAt = nowIso();
  const now = store.get('demoMode') ? getDemoAnalyticsAnchorDate() : new Date(createdAt);
  const id = opts.dedupeKey || makeNotificationId(type, now, opts.scope || 'day');
  const existing = await db.notifications.get(id);
  if (existing) return false;

  await db.notifications.put({
    id,
    type,
    title,
    message,
    read: false,
    dismissed: false,
    createdAt,
    shownAt: null,
  });

  const isDemo = store.get('demoMode');
  let shouldShowPopup = true;
  if (isDemo) {
    if (demoShownPopupCount >= 2) {
      shouldShowPopup = false;
    } else {
      demoShownPopupCount++;
    }
  }

  if (shouldShowPopup) {
    toastQueue.push({
      title,
      message,
      icon: 'bell',
      type: opts.tone || 'info',
      duration: 7000,
      actions: [
        {
          label: 'View',
          class: 'btn btn-primary btn-sm',
          onClick: (close) => {
            close();
            window.location.hash = '#/notifications';
          },
        },
      ],
    });
    void flushToastQueue();

    await db.notifications.update(id, {
      shownAt: nowIso(),
    });
  }

  // Write throttle keys to persist daily/weekly frequency preferences
  const weekStartDay = Math.max(0, Math.min(6, num(user?.locale?.weekStartDay, 0)));
  const todayStr = ymd(now);
  const weekStartStr = ymd(weekBounds(now, weekStartDay).start);

  try {
    await Promise.all([
      db.notifications.put({
        id: `notif:throttle:${type}:day:${todayStr}`,
        read: true,
        createdAt: nowIso(),
      }),
      db.notifications.put({
        id: `notif:throttle:${type}:week:${weekStartStr}`,
        read: true,
        createdAt: nowIso(),
      })
    ]);
  } catch (err) {
    // ignore throttle write errors
  }

  bus.emit('notification:unread-change');
  return true;
}

/**
 * @param {unknown} user
 * @param {string} weekStart
 * @param {string} weekEnd
 */
export async function getWeeklyGoal(user, weekStart, weekEnd) {
  const activeGoal = await db.goals
    .filter((g) => g.active === true && g.scope === 'weekly' && g.type === 'earnings')
    .first();
  if (activeGoal && num(activeGoal.target) > 0) return num(activeGoal.target);
  const platformTargets = await db.platforms.filter((p) => p.active === true).toArray();
  const platformSum = platformTargets.reduce((sum, p) => sum + Math.max(0, num(p.weeklyGoal)), 0);
  if (platformSum > 0) return platformSum;
  const fallback = num(user?.weeklyGoal);
  if (fallback > 0) return fallback / 100;

  const history = await db.shifts
    .where('date').between(weekStart, weekEnd, true, true)
    .filter((s) => s.deletedAt == null)
    .toArray();
  return sumGross(history);
}

/**
 * @param {Array<Record<string, unknown>>} shifts
 */
export function sumGross(shifts) {
  return shifts.reduce((sum, s) => sum + Math.max(0, num(s.grossRevenue)), 0);
}

/**
 * @param {Array<Record<string, unknown>>} shifts
 */
export function sumActiveMinutes(shifts) {
  return shifts.reduce((sum, s) => {
    const active = num(s.activeMinutes);
    if (active > 0) return sum + active;
    const online = num(s.onlineMinutes);
    if (online > 0) return sum + online;
    return sum;
  }, 0);
}

export { getAppState, getCountryTaxProfile, getNextTaxDeadline };
